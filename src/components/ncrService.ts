/* NCR domain logic: lookups for the form, the next NCR number, loading an
   NCR for editing, and the create and update sequences across all the tables. */
import {
	ApiError,
	createRecord,
	deleteRecord,
	findFirst,
	getByRef,
	listAll,
	ncDateTime,
	refId,
	updateRecord,
	where,
	type NcRecord,
	type TableName,
} from "./api";

/* ---- Names the database must contain (created by scripts/seed.mjs) ---- */
export const QUALITY_ROLE = "Quality Representative";
export const STATUS_NEW = "Active";
export const REVIEW_SUBMITTED = "Submitted";
export const IN_HOUSE_SUPPLIER = "In-house production";
export const PROCESS_LABELS = { supplier: "Supplier or Rec-Insp", wip: "WIP (Production Order)" } as const;

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
export interface NcrFields {
	NCRId?: number | null;
	NCRNumber: string | null;
	NCRProcessApplicable: string | null;
	NCRDefectDescription: string | null;
	NCRQuantityReceived: number | null;
	NCRQuantityDefective: number | null;
	NCRIsNonconforming: boolean | null;
	SOLineItemId: number | null;
	POLineItemId: number | null;
	NCRRaisedByPersonId: number | null;
	NCRUpdatedAt?: string | null;
	[column: string]: unknown;
}
interface SupplierFields { SupplierName: string | null }
interface ProblemTypeFields { ProblemTypeLabel: string | null; ProblemTypeDesc: string | null }
interface PersonFields { PersonFirstName: string | null; PersonMiddleName: string | null; PersonLastName: string | null }
interface RoleFields { RoleName: string | null }
interface RolePersonFields { RoleId: number | null; PersonId: number | null }
interface StatusFields { NCRStatusName: string | null }
interface ReviewStatusFields { ReviewStatusName: string | null }
interface NcrNumberFields { NCRNumber: string | null }
interface PurchaseOrderFields { PurchaseOrderNumber: string | null; SupplierId: number | null }
interface SalesOrderFields { SalesOrderNumber: string | null; ItemSapNumber: string | null }
interface ItemFields { ItemName: string | null; ItemDesc: string | null }
interface SOLineItemFields { ItemId: number | null; SalesOrderId: number | null }
interface POLineItemFields { PurchaseOrderId: number | null }
interface NCRProblemTypeFields { ProblemTypeId: number | null }
interface AttachmentFields { AttachmentType: string | null; AttachmentFileName: string | null; AttachmentFilePath: string | null }

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
/* Loading an NCR for editing                                          */
/* ------------------------------------------------------------------ */
export interface NcrEditData {
	recordId: number | string; // for PATCH and DELETE
	ncrRef: number; // for foreign keys that point at this NCR
	ncrNumber: string;
	processApplicable: string;
	supplier: string | null; // null: in-house production
	purchaseOrderNumber: string;
	salesOrderNumber: string;
	item: { name: string; description: string; sapNumber: string };
	quantityReceived: number | null;
	quantityDefective: number | null;
	problemTypeIds: number[];
	problemTypeRows: { recordId: number | string; problemTypeId: number }[];
	defectDescription: string;
	isNonconforming: boolean | null;
	inspector: { personId: number; first: string; middle: string; last: string };
	links: string[];
	linkRows: { recordId: number | string; url: string }[];
	existingFiles: string[];
	/** The NCR columns the update changes, as they are now. Used to undo a failed update. */
	originalFields: Record<string, unknown>;
}

const PATCHED_COLUMNS = [
	"NCRProcessApplicable", "NCRDefectDescription", "NCRQuantityReceived", "NCRQuantityDefective",
	"NCRIsNonconforming", "NCRUpdatedAt", "SOLineItemId", "POLineItemId", "NCRRaisedByPersonId",
] as const;

/** Follows the NCR's foreign keys and collects everything the form shows. */
export async function loadNcrForEdit(rec: NcRecord<NcrFields>): Promise<NcrEditData> {
	const f = rec.fields;
	const ncrRef = refId("NCR", rec);
	const [soLine, poLine, person, problemRows, attachments] = await Promise.all([
		getByRef<SOLineItemFields>("SOLineItem", f.SOLineItemId),
		getByRef<POLineItemFields>("POLineItem", f.POLineItemId),
		getByRef<PersonFields>("Person", f.NCRRaisedByPersonId),
		listAll<NCRProblemTypeFields>("NCRProblemType", { where: where(["NCRId", "eq", ncrRef]) }),
		listAll<AttachmentFields>("Attachment", { where: where(["NCRId", "eq", ncrRef]) }),
	]);
	const [item, salesOrder, purchaseOrder] = await Promise.all([
		getByRef<ItemFields>("Item", soLine?.fields.ItemId),
		getByRef<SalesOrderFields>("SalesOrder", soLine?.fields.SalesOrderId),
		getByRef<PurchaseOrderFields>("PurchaseOrder", poLine?.fields.PurchaseOrderId),
	]);
	const supplier = await getByRef<SupplierFields>("Supplier", purchaseOrder?.fields.SupplierId);
	const supplierName = (supplier?.fields.SupplierName ?? "").trim();

	const linkRows = attachments
		.filter((a) => same(a.fields.AttachmentType, "Link"))
		.map((a) => ({ recordId: a.id, url: (a.fields.AttachmentFilePath ?? "").trim() }));
	const problemTypeRows = problemRows
		.filter((r) => r.fields.ProblemTypeId !== null)
		.map((r) => ({ recordId: r.id, problemTypeId: Number(r.fields.ProblemTypeId) }));

	return {
		recordId: rec.id,
		ncrRef,
		ncrNumber: (f.NCRNumber ?? "").trim(),
		processApplicable: (f.NCRProcessApplicable ?? "").trim(),
		supplier: supplierName && !same(supplierName, IN_HOUSE_SUPPLIER) ? supplierName : null,
		purchaseOrderNumber: (purchaseOrder?.fields.PurchaseOrderNumber ?? "").trim(),
		salesOrderNumber: (salesOrder?.fields.SalesOrderNumber ?? "").trim(),
		item: {
			name: (item?.fields.ItemName ?? "").trim(),
			description: (item?.fields.ItemDesc ?? "").trim(),
			sapNumber: (salesOrder?.fields.ItemSapNumber ?? "").trim(),
		},
		quantityReceived: f.NCRQuantityReceived ?? null,
		quantityDefective: f.NCRQuantityDefective ?? null,
		problemTypeIds: problemTypeRows.map((r) => r.problemTypeId),
		problemTypeRows,
		defectDescription: (f.NCRDefectDescription ?? "").trim(),
		isNonconforming: f.NCRIsNonconforming ?? null,
		inspector: {
			personId: person ? refId("Person", person) : Number(f.NCRRaisedByPersonId ?? 0),
			first: (person?.fields.PersonFirstName ?? "").trim(),
			middle: (person?.fields.PersonMiddleName ?? "").trim(),
			last: (person?.fields.PersonLastName ?? "").trim(),
		},
		links: linkRows.map((r) => r.url).filter(Boolean),
		linkRows,
		existingFiles: attachments
			.filter((a) => !same(a.fields.AttachmentType, "Link"))
			.map((a) => (a.fields.AttachmentFileName ?? "").trim())
			.filter(Boolean),
		originalFields: Object.fromEntries(PATCHED_COLUMNS.map((k) => [k, f[k] ?? null])),
	};
}

/* ------------------------------------------------------------------ */
/* Create and update                                                   */
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

type Created = { table: TableName; id: number | string };
type Make = <F extends object = Record<string, unknown>>(
	table: TableName,
	label: string,
	fields: Record<string, unknown>,
) => Promise<NcRecord<F>>;

function startTracker(progress: (message: string) => void) {
	const created: Created[] = [];
	const now = ncDateTime();
	const make: Make = async <F extends object>(table: TableName, label: string, fields: Record<string, unknown>) => {
		progress(`Saving ${label}...`);
		const rec = await createRecord<F>(table, fields);
		created.push({ table, id: rec.id });
		return rec;
	};
	return { created, now, make };
}

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

/* STUB: nothing is uploaded yet. Returns the path the file will live at once
   file storage exists. Replace the body with a real upload. */
async function uploadAttachmentStub(file: File, ncrNumber: string): Promise<string> {
	const safeName = file.name.replace(/[^\w.-]+/g, "_");
	return `/uploads/ncr/${ncrNumber}/${safeName}`.slice(0, 500);
}

async function addFileAttachment(make: Make, file: File, ncrNumber: string, ncrRef: number, personId: number, now: string) {
	const path = await uploadAttachmentStub(file, ncrNumber);
	await make("Attachment", `attachment ${file.name}`, {
		AttachmentType: file.type.startsWith("image/") ? "Image" : "Document",
		AttachmentFileName: file.name.slice(0, 300),
		AttachmentFilePath: path,
		AttachmentUploadedAt: now,
		NCRId: ncrRef,
		AttachmentUploadedByPersonId: personId,
	});
}

async function addLinkAttachment(make: Make, link: string, ncrRef: number, personId: number, now: string) {
	await make("Attachment", "a link", {
		AttachmentType: "Link",
		AttachmentFileName: new URL(link).hostname.slice(0, 300),
		AttachmentFilePath: link,
		AttachmentUploadedAt: now,
		NCRId: ncrRef,
		AttachmentUploadedByPersonId: personId,
	});
}

/** The inspector's Person and RolePerson ids. Creates both for a new inspector. */
async function resolveInspector(s: NcrSubmission, make: Make) {
	if (s.inspector.kind === "existing") {
		return { personId: s.inspector.personId, rolePersonId: s.inspector.rolePersonId };
	}
	const roles = await listAll<RoleFields>("Role");
	const qualityRole = mustFind(roles, (r) => same(r.fields.RoleName, QUALITY_ROLE), `Role "${QUALITY_ROLE}"`);
	const person = await make("Person", "the inspector", {
		PersonFirstName: s.inspector.first,
		PersonMiddleName: s.inspector.middle,
		PersonLastName: s.inspector.last,
		PersonEmail: PERSON_CONTACT_DEFAULT,
		PersonPhone: PERSON_CONTACT_DEFAULT,
	});
	const personId = refId("Person", person);
	const rp = await make("RolePerson", "the inspector's role", {
		RoleId: refId("Role", qualityRole),
		PersonId: personId,
	});
	return { personId, rolePersonId: refId("RolePerson", rp) };
}

/** Supplier, purchase order, sales order, item and both line items.
    Reuses rows that already exist and creates the rest. */
async function resolveChain(s: NcrSubmission, make: Make, now: string) {
	const [suppliers, items] = await Promise.all([listAll<SupplierFields>("Supplier"), listAll<ItemFields>("Item")]);

	const supplierName = (s.supplier ?? IN_HOUSE_SUPPLIER).trim();
	const supplier =
		suppliers.find((r) => same(r.fields.SupplierName, supplierName)) ??
		(await make("Supplier", "the supplier", { SupplierName: supplierName }));

	const purchaseOrder =
		(await findFirst<PurchaseOrderFields>("PurchaseOrder", where(["PurchaseOrderNumber", "eq", s.purchaseOrderNumber]))) ??
		(await make("PurchaseOrder", "the purchase order", {
			PurchaseOrderNumber: s.purchaseOrderNumber,
			PurchaseOrderDate: now,
			SupplierId: refId("Supplier", supplier),
		}));

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

	return { soLineItemId, poLineItemId: refId("POLineItem", poLineItem) };
}

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : String(err));

export async function submitNcr(
	s: NcrSubmission,
	progress: (message: string) => void = () => {},
): Promise<{ ncrNumber: string; recordId: number | string }> {
	const { created, now, make } = startTracker(progress);
	try {
		progress("Checking the NCR number...");
		if (await ncrNumberExists(s.ncrNumber)) throw new DuplicateNcrNumberError(s.ncrNumber);

		progress("Loading statuses...");
		const [statuses, reviewStatuses] = await Promise.all([
			listAll<StatusFields>("NCRStatus"),
			listAll<ReviewStatusFields>("ReviewStatus"),
		]);
		const status = mustFind(statuses, (r) => same(r.fields.NCRStatusName, STATUS_NEW), `NCR status "${STATUS_NEW}"`);
		const review = mustFind(reviewStatuses, (r) => same(r.fields.ReviewStatusName, REVIEW_SUBMITTED), `Review status "${REVIEW_SUBMITTED}"`);

		const inspector = await resolveInspector(s, make);
		const chain = await resolveChain(s, make, now);

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
			SOLineItemId: chain.soLineItemId,
			POLineItemId: chain.poLineItemId,
			NCRRaisedByPersonId: inspector.personId,
		});
		const ncrRef = refId("NCR", ncr);

		for (const problemTypeId of s.problemTypeIds) {
			await make("NCRProblemType", "a problem type", { NCRId: ncrRef, ProblemTypeId: problemTypeId });
		}
		for (const file of s.files) await addFileAttachment(make, file, s.ncrNumber, ncrRef, inspector.personId, now);
		for (const link of s.links) await addLinkAttachment(make, link, ncrRef, inspector.personId, now);

		await make("NCRPerson", "the inspector's sign-off", {
			NCRPersonAssignedAt: now,
			NCRPersonReviewedAt: now,
			NCRId: ncrRef,
			RolePersonId: inspector.rolePersonId,
			ReviewStatusId: refId("ReviewStatus", review),
		});

		return { ncrNumber: s.ncrNumber, recordId: ncr.id };
	} catch (err) {
		const leftovers = await rollback(created);
		if (err instanceof DuplicateNcrNumberError || err instanceof MissingSeedError) throw err;
		throw new SubmitError(messageOf(err), leftovers);
	}
}

/** Saves edits to an existing NCR. Order matters: new rows first, then the
    NCR itself, then removals. A failure before the NCR is patched can be
    undone completely; removals come last because they cannot be undone. */
export async function updateNcr(
	edit: NcrEditData,
	s: NcrSubmission,
	progress: (message: string) => void = () => {},
): Promise<{ ncrNumber: string; recordId: number | string }> {
	const { created, now, make } = startTracker(progress);
	let patchAttempted = false;
	try {
		const inspector = await resolveInspector(s, make);
		const chain = await resolveChain(s, make, now);

		const have = new Set(edit.problemTypeRows.map((r) => r.problemTypeId));
		for (const problemTypeId of s.problemTypeIds) {
			if (!have.has(problemTypeId)) {
				await make("NCRProblemType", "a problem type", { NCRId: edit.ncrRef, ProblemTypeId: problemTypeId });
			}
		}
		for (const file of s.files) await addFileAttachment(make, file, edit.ncrNumber, edit.ncrRef, inspector.personId, now);
		const haveLinks = new Set(edit.linkRows.map((r) => r.url));
		for (const link of s.links) {
			if (!haveLinks.has(link)) await addLinkAttachment(make, link, edit.ncrRef, inspector.personId, now);
		}

		progress("Updating the NCR...");
		patchAttempted = true;
		await updateRecord("NCR", edit.recordId, {
			NCRProcessApplicable: s.processApplicable,
			NCRDefectDescription: s.defectDescription,
			NCRQuantityReceived: s.quantityReceived,
			NCRQuantityDefective: s.quantityDefective,
			NCRIsNonconforming: s.isNonconforming,
			NCRUpdatedAt: now,
			SOLineItemId: chain.soLineItemId,
			POLineItemId: chain.poLineItemId,
			NCRRaisedByPersonId: inspector.personId,
		});
	} catch (err) {
		if (patchAttempted) {
			try {
				await updateRecord("NCR", edit.recordId, edit.originalFields);
			} catch {
				/* reported through the thrown error below */
			}
		}
		const leftovers = await rollback(created);
		if (err instanceof MissingSeedError) throw err;
		throw new SubmitError(messageOf(err), leftovers);
	}

	/* Removals */
	const leftovers: string[] = [];
	const wanted = new Set(s.problemTypeIds);
	for (const r of edit.problemTypeRows) {
		if (wanted.has(r.problemTypeId)) continue;
		progress("Removing a problem type...");
		try {
			await deleteRecord("NCRProblemType", r.recordId);
		} catch {
			leftovers.push(`NCRProblemType #${r.recordId}`);
		}
	}
	const wantedLinks = new Set(s.links);
	for (const r of edit.linkRows) {
		if (wantedLinks.has(r.url)) continue;
		progress("Removing a link...");
		try {
			await deleteRecord("Attachment", r.recordId);
		} catch {
			leftovers.push(`Attachment #${r.recordId}`);
		}
	}
	if (leftovers.length) {
		throw new SubmitError("The NCR was updated, but some old records could not be removed.", leftovers);
	}
	return { ncrNumber: edit.ncrNumber, recordId: edit.recordId };
}
