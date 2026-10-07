/* NCR domain logic: lookups for the form, the next NCR number, and the
   submit sequence across all the tables. */
import {
	ApiError,
	createRecord,
	deleteRecord,
	findFirst,
	listAll,
	ncDateTime,
	refId,
	where,
	type NcRecord,
	type TableName,
} from "./api";

/* ---- Names the database must contain (created by scripts/seed.mjs) ---- */
export const QUALITY_ROLE = "Quality Representative";
export const STATUS_NEW = "Active";
export const REVIEW_SUBMITTED = "Submitted";
export const IN_HOUSE_SUPPLIER = "In-house production";

/* ---- Values for columns the Quality section does not collect ----
   Best guess: not nullable, so each gets a neutral value. Change here. */
const NCR_DEFAULTS = {
	NCRDisposition: "Pending",
	NCRIsNotificationRequired: false,
	NCRIsDrawingUpdateRequired: "Pending",
	NCROriginalRevNumber: "",
	NCRUpdatedRevNumber: "",
	NCRClosedAt: null as string | null, // an open NCR has no close date
};
const PLACEHOLDER_PRICE = 0; // Item, SOLineItem, POLineItem unit prices are not collected
const PERSON_CONTACT_DEFAULT = ""; // PersonEmail / PersonPhone for people created by the form

/* ---- Row shapes (only the columns this file reads) ---- */
interface SupplierFields { SupplierName: string | null }
interface ProblemTypeFields { ProblemTypeLabel: string | null; ProblemTypeDesc: string | null }
interface PersonFields { PersonFirstName: string | null; PersonMiddleName: string | null; PersonLastName: string | null }
interface RoleFields { RoleName: string | null }
interface RolePersonFields { RoleId: number | null; PersonId: number | null }
interface StatusFields { NCRStatusName: string | null }
interface ReviewStatusFields { ReviewStatusName: string | null }
interface NcrNumberFields { NCRNumber: string | null }
interface PurchaseOrderFields { PurchaseOrderNumber: string | null }
interface SalesOrderFields { SalesOrderNumber: string | null; ItemSapNumber: string | null }
interface ItemFields { ItemName: string | null; ItemDesc: string | null }

/* ---- What the form reads ---- */
export interface SupplierOption { id: number; name: string }
export interface ProblemTypeOption { id: number; label: string; description: string }
export interface InspectorOption { personId: number; rolePersonId: number; first: string; middle: string; last: string }
export interface FormLookups {
	suppliers: SupplierOption[];
	problemTypes: ProblemTypeOption[];
	inspectors: InspectorOption[];
}

export class DuplicateNcrNumberError extends Error {
	ncrNumber: string;
	constructor(ncrNumber: string) {
		super(`NCR number ${ncrNumber} is already used.`);
		this.name = "DuplicateNcrNumberError";
		this.ncrNumber = ncrNumber;
	}
}
export class MissingSeedError extends Error {
	constructor(what: string) {
		super(`${what} is missing from the database. Run the seed script (scripts/seed.mjs) or add it by hand.`);
		this.name = "MissingSeedError";
	}
}
export class SubmitError extends Error {
	leftovers: string[];
	constructor(message: string, leftovers: string[]) {
		super(message);
		this.name = "SubmitError";
		this.leftovers = leftovers;
	}
}

const same = (a: string | null | undefined, b: string) =>
	(a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

function mustFind<T>(list: T[], test: (item: T) => boolean, what: string): T {
	const hit = list.find(test);
	if (!hit) throw new MissingSeedError(what);
	return hit;
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */
export async function loadFormLookups(): Promise<FormLookups> {
	const [suppliers, problemTypes, roles, rolePersons, people] = await Promise.all([
		listAll<SupplierFields>("Supplier"),
		listAll<ProblemTypeFields>("ProblemType"),
		listAll<RoleFields>("Role"),
		listAll<RolePersonFields>("RolePerson"),
		listAll<PersonFields>("Person"),
	]);

	const quality = roles.find((r) => same(r.fields.RoleName, QUALITY_ROLE));
	const inspectors: InspectorOption[] = [];
	if (quality) {
		for (const rp of rolePersons) {
			if (Number(rp.fields.RoleId) !== refId("Role", quality)) continue;
			const person = people.find((p) => refId("Person", p) === Number(rp.fields.PersonId));
			if (!person) continue;
			inspectors.push({
				personId: refId("Person", person),
				rolePersonId: refId("RolePerson", rp),
				first: (person.fields.PersonFirstName ?? "").trim(),
				middle: (person.fields.PersonMiddleName ?? "").trim(),
				last: (person.fields.PersonLastName ?? "").trim(),
			});
		}
	}

	return {
		suppliers: suppliers
			.map((s) => ({ id: refId("Supplier", s), name: (s.fields.SupplierName ?? "").trim() }))
			.filter((s) => s.name && !same(s.name, IN_HOUSE_SUPPLIER))
			.sort((a, b) => a.name.localeCompare(b.name)),
		problemTypes: problemTypes.map((t) => ({
			id: refId("ProblemType", t),
			label: (t.fields.ProblemTypeLabel ?? "").trim(),
			description: (t.fields.ProblemTypeDesc ?? "").trim(),
		})),
		inspectors,
	};
}

/** Next number in the YYYY-NNN sequence for the current year. */
export async function nextNcrNumber(): Promise<string> {
	const year = new Date().getFullYear();
	const rows = await listAll<NcrNumberFields>("NCR", { fields: ["NCRNumber"] });
	const pattern = new RegExp(`^${year}-(\\d{3,})$`);
	let highest = 0;
	for (const r of rows) {
		const m = (r.fields.NCRNumber ?? "").trim().match(pattern);
		if (m) highest = Math.max(highest, Number(m[1]));
	}
	return `${year}-${String(highest + 1).padStart(3, "0")}`;
}

async function ncrNumberExists(ncrNumber: string): Promise<boolean> {
	return (await findFirst<NcrNumberFields>("NCR", where(["NCRNumber", "eq", ncrNumber]))) !== null;
}

/* ------------------------------------------------------------------ */
/* Submit                                                              */
/* ------------------------------------------------------------------ */
export interface NcrSubmission {
	ncrNumber: string;
	processApplicable: string;
	/** Supplier name. null means in-house production. Found by name, created if new. */
	supplier: string | null;
	/** Purchase order number, or the production order number for WIP. */
	purchaseOrderNumber: string;
	salesOrderNumber: string;
	item: { name: string; description: string; sapNumber: string };
	quantityReceived: number;
	quantityDefective: number;
	problemTypeIds: number[];
	defectDescription: string;
	isNonconforming: boolean;
	inspector:
		| { kind: "existing"; personId: number; rolePersonId: number }
		| { kind: "new"; first: string; middle: string; last: string };
	files: File[];
	links: string[];
}

/* STUB: nothing is uploaded yet. Returns the path the file will live at once
   file storage exists. Replace the body with a real upload. */
async function uploadAttachmentStub(file: File, ncrNumber: string): Promise<string> {
	const safeName = file.name.replace(/[^\w.-]+/g, "_");
	return `/uploads/ncr/${ncrNumber}/${safeName}`.slice(0, 500);
}

type Created = { table: TableName; id: number | string };

async function rollback(created: Created[]): Promise<string[]> {
	const leftovers: string[] = [];
	for (const c of [...created].reverse()) {
		try {
			await deleteRecord(c.table, c.id);
		} catch {
			leftovers.push(`${c.table} #${c.id}`);
		}
	}
	return leftovers;
}

export async function submitNcr(
	s: NcrSubmission,
	progress: (message: string) => void = () => {},
): Promise<{ ncrNumber: string; recordId: number | string }> {
	const created: Created[] = [];
	const now = ncDateTime();

	const make = async <F extends object = Record<string, unknown>>(
		table: TableName,
		label: string,
		fields: Record<string, unknown>,
	): Promise<NcRecord<F>> => {
		progress(`Saving ${label}...`);
		const rec = await createRecord<F>(table, fields);
		created.push({ table, id: rec.id });
		return rec;
	};

	try {
		progress("Checking the NCR number...");
		if (await ncrNumberExists(s.ncrNumber)) throw new DuplicateNcrNumberError(s.ncrNumber);

		progress("Loading statuses and roles...");
		const [statuses, reviewStatuses, roles, suppliers, items] = await Promise.all([
			listAll<StatusFields>("NCRStatus"),
			listAll<ReviewStatusFields>("ReviewStatus"),
			listAll<RoleFields>("Role"),
			listAll<SupplierFields>("Supplier"),
			listAll<ItemFields>("Item"),
		]);
		const status = mustFind(statuses, (r) => same(r.fields.NCRStatusName, STATUS_NEW), `NCR status "${STATUS_NEW}"`);
		const review = mustFind(reviewStatuses, (r) => same(r.fields.ReviewStatusName, REVIEW_SUBMITTED), `Review status "${REVIEW_SUBMITTED}"`);
		const qualityRole = mustFind(roles, (r) => same(r.fields.RoleName, QUALITY_ROLE), `Role "${QUALITY_ROLE}"`);

		/* Inspector */
		let personId: number;
		let rolePersonId: number;
		if (s.inspector.kind === "existing") {
			personId = s.inspector.personId;
			rolePersonId = s.inspector.rolePersonId;
		} else {
			const person = await make("Person", "the inspector", {
				PersonFirstName: s.inspector.first,
				PersonMiddleName: s.inspector.middle,
				PersonLastName: s.inspector.last,
				PersonEmail: PERSON_CONTACT_DEFAULT,
				PersonPhone: PERSON_CONTACT_DEFAULT,
			});
			personId = refId("Person", person);
			const rp = await make("RolePerson", "the inspector's role", {
				RoleId: refId("Role", qualityRole),
				PersonId: personId,
			});
			rolePersonId = refId("RolePerson", rp);
		}

		/* Supplier and purchase order */
		const supplierName = (s.supplier ?? IN_HOUSE_SUPPLIER).trim();
		const supplier =
			suppliers.find((r) => same(r.fields.SupplierName, supplierName)) ??
			(await make("Supplier", "the supplier", { SupplierName: supplierName }));
		const supplierId = refId("Supplier", supplier);

		const purchaseOrder =
			(await findFirst<PurchaseOrderFields>("PurchaseOrder", where(["PurchaseOrderNumber", "eq", s.purchaseOrderNumber]))) ??
			(await make("PurchaseOrder", "the purchase order", {
				PurchaseOrderNumber: s.purchaseOrderNumber,
				PurchaseOrderDate: now,
				SupplierId: supplierId,
			}));

		/* Sales order, item and line items */
		const salesOrders = await listAll<SalesOrderFields>("SalesOrder", {
			where: where(["SalesOrderNumber", "eq", s.salesOrderNumber]),
		});
		const salesOrder =
			salesOrders.find((r) => (r.fields.ItemSapNumber ?? "").trim() === s.item.sapNumber) ??
			(await make("SalesOrder", "the sales order", {
				SalesOrderNumber: s.salesOrderNumber,
				ItemSapNumber: s.item.sapNumber,
				SalesOrderDate: now,
			}));

		const item =
			items.find((r) => same(r.fields.ItemName, s.item.name) && same(r.fields.ItemDesc, s.item.description)) ??
			(await make("Item", "the item", {
				ItemName: s.item.name,
				ItemDesc: s.item.description,
				ItemUnitPrice: PLACEHOLDER_PRICE,
			}));

		const purchaseOrderId = refId("PurchaseOrder", purchaseOrder);
		const salesOrderId = refId("SalesOrder", salesOrder);
		const itemId = refId("Item", item);

		const soLineItem =
			(await findFirst<object>("SOLineItem", where(["SalesOrderId", "eq", salesOrderId], ["ItemId", "eq", itemId]))) ??
			(await make("SOLineItem", "the sales order line", {
				SOLineItemQuantityOrdered: s.quantityReceived,
				SOLineItemUnitPrice: PLACEHOLDER_PRICE,
				ItemId: itemId,
				SalesOrderId: salesOrderId,
			}));
		const soLineItemId = refId("SOLineItem", soLineItem);

		const poLineItem =
			(await findFirst<object>(
				"POLineItem",
				where(["PurchaseOrderId", "eq", purchaseOrderId], ["ItemId", "eq", itemId], ["SOLineItemId", "eq", soLineItemId]),
			)) ??
			(await make("POLineItem", "the purchase order line", {
				POLineItemQuantityOrdered: s.quantityReceived,
				POLineItemUnitPrice: PLACEHOLDER_PRICE,
				PurchaseOrderId: purchaseOrderId,
				ItemId: itemId,
				SOLineItemId: soLineItemId,
			}));

		/* The NCR itself */
		const ncr = await make("NCR", "the NCR", {
			NCRNumber: s.ncrNumber,
			NCRProcessApplicable: s.processApplicable,
			NCRDefectDescription: s.defectDescription,
			NCRQuantityReceived: s.quantityReceived,
			NCRQuantityDefective: s.quantityDefective,
			NCRIsNonconforming: s.isNonconforming,
			...NCR_DEFAULTS,
			NCRCreatedAtD: now, // the column name has this spelling in the database
			NCRUpdatedAt: now,
			StatusId: refId("NCRStatus", status),
			SOLineItemId: soLineItemId,
			POLineItemId: refId("POLineItem", poLineItem),
			NCRRaisedByPersonId: personId,
		});
		const ncrId = refId("NCR", ncr);

		/* Children of the NCR */
		for (const problemTypeId of s.problemTypeIds) {
			await make("NCRProblemType", "a problem type", { NCRId: ncrId, ProblemTypeId: problemTypeId });
		}

		for (const file of s.files) {
			const path = await uploadAttachmentStub(file, s.ncrNumber);
			await make("Attachment", `attachment ${file.name}`, {
				AttachmentType: file.type.startsWith("image/") ? "Image" : "Document",
				AttachmentFileName: file.name.slice(0, 300),
				AttachmentFilePath: path,
				AttachmentUploadedAt: now,
				NCRId: ncrId,
				AttachmentUploadedByPersonId: personId,
			});
		}
		for (const link of s.links) {
			await make("Attachment", "a link", {
				AttachmentType: "Link",
				AttachmentFileName: new URL(link).hostname.slice(0, 300),
				AttachmentFilePath: link,
				AttachmentUploadedAt: now,
				NCRId: ncrId,
				AttachmentUploadedByPersonId: personId,
			});
		}

		await make("NCRPerson", "the inspector's sign-off", {
			NCRPersonAssignedAt: now,
			NCRPersonReviewedAt: now,
			NCRId: ncrId,
			RolePersonId: rolePersonId,
			ReviewStatusId: refId("ReviewStatus", review),
		});

		return { ncrNumber: s.ncrNumber, recordId: ncr.id };
	} catch (err) {
		const leftovers = await rollback(created);
		if (err instanceof DuplicateNcrNumberError || err instanceof MissingSeedError) throw err;
		const message = err instanceof ApiError || err instanceof Error ? err.message : String(err);
		throw new SubmitError(message, leftovers);
	}
}