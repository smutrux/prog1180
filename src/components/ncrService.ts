import {
	ApiError,
	createRecord,
	deleteRecord,
	findFirst,
	fkValue,
	getByRef,
	listAll,
	ncDateTime,
	readRecord,
	refId,
	updateRecord,
	where,
	type NcRecord,
	type TableName,
} from "./api";
import { ConstraintError, assertRecord, validateSubmission } from "./ncrConstraints";

export const QUALITY_ROLE = "Quality Representative";
export const STATUS_NEW = "Open";
export const STATUS_DRAFT = "Draft";
const STATUS_NEW_FALLBACK_ID = 1;
export const isClosedStatus = (name: string) => /clos/i.test(name);
export const REVIEW_SUBMITTED = "Submitted";
export const IN_HOUSE_SUPPLIER = "In-house production";
export const PROCESS_LABELS = {
	supplier: "Supplier or Rec-Insp",
	wip: "WIP (Production Order)",
} as const;
const SUBMISSION_RULES = {
	inHouseSupplier: IN_HOUSE_SUPPLIER,
	processLabels: Object.values(PROCESS_LABELS),
};

const NCR_DEFAULTS = {
	NCRDisposition: "Pending",
	NCRIsNotificationRequired: false,
	NCRIsDrawingUpdateRequired: "Pending",
	NCROriginalRevNumber: "",
	NCRUpdatedRevNumber: "",
	NCRClosedAt: null as string | null,
};
const PLACEHOLDER_PRICE = 0;
const PERSON_CONTACT_DEFAULT = "";

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
interface SupplierFields {
	SupplierName: string | null;
}
interface ProblemTypeFields {
	ProblemTypeLabel: string | null;
	ProblemTypeDesc: string | null;
}
interface PersonFields {
	PersonFirstName: string | null;
	PersonMiddleName: string | null;
	PersonLastName: string | null;
}
interface RoleFields {
	RoleName: string | null;
}
interface RolePersonFields {
	RoleId: number | null;
	PersonId: number | null;
}
interface StatusFields {
	NCRStatusName: string | null;
}
interface ReviewStatusFields {
	ReviewStatusName: string | null;
}
interface NcrNumberFields {
	NCRNumber: string | null;
}
interface PurchaseOrderFields {
	PurchaseOrderNumber: string | null;
	SupplierId: number | null;
}
interface SalesOrderFields {
	SalesOrderNumber: string | null;
	ItemSapNumber: string | null;
}
interface ItemFields {
	ItemName: string | null;
	ItemDesc: string | null;
}
interface SOLineItemFields {
	ItemId: number | null;
	SalesOrderId: number | null;
}
interface POLineItemFields {
	PurchaseOrderId: number | null;
}
interface NCRProblemTypeFields {
	NCRId?: unknown;
	ProblemTypeId: number | null;
}
interface AttachmentFields {
	NCRId?: unknown;
	AttachmentType: string | null;
	AttachmentFileName: string | null;
	AttachmentFilePath: string | null;
}

export interface SupplierOption {
	id: number;
	name: string;
}
export interface ProblemTypeOption {
	id: number;
	label: string;
	description: string;
}
export interface StatusOption {
	id: number;
	name: string;
}
export interface InspectorOption {
	personId: number;
	rolePersonId: number;
	first: string;
	middle: string;
	last: string;
}
export interface FormLookups {
	suppliers: SupplierOption[];
	problemTypes: ProblemTypeOption[];
	inspectors: InspectorOption[];
	statuses: StatusOption[];
}

export function defaultStatus(
	statuses: StatusOption[],
): StatusOption | undefined {
	return (
		statuses.find((s) => same(s.name, STATUS_NEW)) ??
		statuses.find((s) => s.id === STATUS_NEW_FALLBACK_ID) ??
		statuses[0]
	);
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
		super(
			`${what} is missing from the database. Run the seed script (scripts/seed.mjs) or add it by hand.`,
		);
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

export const STATUS_COLUMN = "NCRStatusId";

function statusColumnOf(fields: Record<string, unknown>): string {
	if (STATUS_COLUMN in fields) return STATUS_COLUMN;
	return (
		Object.keys(fields).find((k) => /status/i.test(k) && !/review/i.test(k)) ??
		STATUS_COLUMN
	);
}

const same = (a: string | null | undefined, b: string) =>
	(a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

function mustFind<T>(list: T[], test: (item: T) => boolean, what: string): T {
	const hit = list.find(test);
	if (!hit) throw new MissingSeedError(what);
	return hit;
}

export async function loadFormLookups(): Promise<FormLookups> {
	const [suppliers, problemTypes, roles, rolePersons, people, statuses] =
		await Promise.all([
			listAll<SupplierFields>("Supplier"),
			listAll<ProblemTypeFields>("ProblemType"),
			listAll<RoleFields>("Role"),
			listAll<RolePersonFields>("RolePerson"),
			listAll<PersonFields>("Person"),
			listAll<StatusFields>("NCRStatus"),
		]);

	const quality = roles.find((r) => same(r.fields.RoleName, QUALITY_ROLE));
	const inspectors: InspectorOption[] = [];
	if (quality) {
		for (const rp of rolePersons) {
			if (fkValue(rp.fields.RoleId) !== refId("Role", quality)) continue;
			const person = people.find(
				(p) => refId("Person", p) === fkValue(rp.fields.PersonId),
			);
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
			.map((s) => ({
				id: refId("Supplier", s),
				name: (s.fields.SupplierName ?? "").trim(),
			}))
			.filter((s) => s.name && !same(s.name, IN_HOUSE_SUPPLIER))
			.sort((a, b) => a.name.localeCompare(b.name)),
		problemTypes: problemTypes.map((t) => ({
			id: refId("ProblemType", t),
			label: (t.fields.ProblemTypeLabel ?? "").trim(),
			description: (t.fields.ProblemTypeDesc ?? "").trim(),
		})),
		inspectors,
		statuses: statuses
			.map((r) => ({
				id: refId("NCRStatus", r),
				name: (r.fields.NCRStatusName ?? "").trim(),
			}))
			.filter((r) => r.name)
			.sort((a, b) => a.id - b.id),
	};
}

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
	return (
		(await findFirst<NcrNumberFields>(
			"NCR",
			where(["NCRNumber", "eq", ncrNumber]),
		)) !== null
	);
}

/** True when an NCR is an unfinished draft (its form answers are stored in NCRDraftData). */
export function isDraftRecord(rec: { fields: object }): boolean {
	const raw = (rec.fields as Record<string, unknown>).NCRDraftData;
	return typeof raw === "string" && raw.trim() !== "";
}

export interface DraftPayload {
	values: Record<string, Record<string, unknown>>;
	/** The index of the form section the person was on when they saved. */
	step: number;
}

/** Reads the saved form answers of a draft. Returns null if there are none or they are unreadable. */
export function parseDraft(rec: { fields: object }): DraftPayload | null {
	const f = rec.fields as Record<string, unknown>;
	const raw = f.NCRDraftData;
	if (typeof raw !== "string" || !raw.trim()) return null;
	try {
		const parsed = JSON.parse(raw) as { values?: unknown };
		if (!parsed || typeof parsed.values !== "object" || parsed.values === null)
			return null;
		const step = Number(f.NCRDraftStep);
		return {
			values: parsed.values as DraftPayload["values"],
			step: Number.isFinite(step) ? Math.trunc(step) : 0,
		};
	} catch {
		return null;
	}
}

export interface DraftToSave {
	/** The NCR record id of an existing draft, or null for the first save. */
	recordId: number | string | null;
	ncrNumber: string;
	/** The form answers, stored as they are. */
	values: unknown;
	step: number;
}

/**
 * Saves the form answers as a draft NCR. The first save creates the NCR record
 * (so the NCR number is reserved). Later saves update it.
 * Nothing is validated: a draft can be incomplete.
 */
export async function saveDraft(
	d: DraftToSave,
	statuses: StatusOption[],
	progress: (message: string) => void = () => {},
): Promise<{ ncrNumber: string; recordId: number | string }> {
	const now = ncDateTime();
	const draftFields = {
		NCRDraftData: JSON.stringify({ v: 1, values: d.values }),
		NCRDraftStep: String(d.step),
		NCRUpdatedAt: now,
	};
	if (d.recordId !== null) {
		progress("Saving the draft...");
		await updateRecord("NCR", d.recordId, draftFields);
		return { ncrNumber: d.ncrNumber, recordId: d.recordId };
	}
	progress("Checking the NCR number...");
	if (await ncrNumberExists(d.ncrNumber))
		throw new DuplicateNcrNumberError(d.ncrNumber);
	const status =
		statuses.find((s) => same(s.name, STATUS_DRAFT)) ?? defaultStatus(statuses);
	progress("Saving the draft...");
	const rec = await createRecord("NCR", {
		NCRNumber: d.ncrNumber,
		...NCR_DEFAULTS,
		NCRCreatedAtD: now,
		...draftFields,
		...(status ? { [STATUS_COLUMN]: status.id } : {}),
	});
	return { ncrNumber: d.ncrNumber, recordId: rec.id };
}

export interface NcrEditData {
	recordId: number | string;
	ncrRef: number;
	ncrNumber: string;
	processApplicable: string;
	statusId: number | null;
	statusColumn: string;
	supplier: string | null;
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
	originalFields: Record<string, unknown>;
  isArchived?: boolean;
}

const PATCHED_COLUMNS = [
	"NCRProcessApplicable",
	"NCRDefectDescription",
	"NCRQuantityReceived",
	"NCRQuantityDefective",
	"NCRIsNonconforming",
	"NCRUpdatedAt",
	"SOLineItemId",
	"POLineItemId",
	"NCRRaisedByPersonId",
	"NCRClosedAt",
] as const;

async function listForNcr<F extends { NCRId?: unknown }>(
	table: TableName,
	ncrRef: number,
): Promise<NcRecord<F>[]> {
	const filtered = await listAll<F>(table, {
		where: where(["NCRId", "eq", ncrRef]),
	});
	if (filtered.length > 0) return filtered;
	const everything = await listAll<F>(table);
	return everything.filter((r) => fkValue(r.fields.NCRId) === ncrRef);
}

export async function loadNcrForEdit(
	rec: NcRecord<NcrFields>,
): Promise<NcrEditData> {
	const f = rec.fields;
	const ncrRef = refId("NCR", rec);
	const [soLine, poLine, person, problemRows, attachments] = await Promise.all([
		getByRef<SOLineItemFields>("SOLineItem", f.SOLineItemId),
		getByRef<POLineItemFields>("POLineItem", f.POLineItemId),
		getByRef<PersonFields>("Person", f.NCRRaisedByPersonId),
		listForNcr<NCRProblemTypeFields>("NCRProblemType", ncrRef),
		listForNcr<AttachmentFields>("Attachment", ncrRef),
	]);
	const [item, salesOrder, purchaseOrder] = await Promise.all([
		getByRef<ItemFields>("Item", soLine?.fields.ItemId),
		getByRef<SalesOrderFields>("SalesOrder", soLine?.fields.SalesOrderId),
		getByRef<PurchaseOrderFields>(
			"PurchaseOrder",
			poLine?.fields.PurchaseOrderId,
		),
	]);
	const supplier = await getByRef<SupplierFields>(
		"Supplier",
		purchaseOrder?.fields.SupplierId,
	);
	const supplierName = (supplier?.fields.SupplierName ?? "").trim();

	const linkRows = attachments
		.filter((a) => same(a.fields.AttachmentType, "Link"))
		.map((a) => ({
			recordId: a.id,
			url: (a.fields.AttachmentFilePath ?? "").trim(),
		}));
	const problemTypeRows = problemRows.flatMap((r) => {
		const problemTypeId = fkValue(r.fields.ProblemTypeId);
		return problemTypeId === null ? [] : [{ recordId: r.id, problemTypeId }];
	});

	const statusColumn = statusColumnOf(f);
	return {
		recordId: rec.id,
		ncrRef,
		ncrNumber: (f.NCRNumber ?? "").trim(),
		processApplicable: (f.NCRProcessApplicable ?? "").trim(),
		statusId: fkValue(f[statusColumn]),
		statusColumn,
		supplier:
			supplierName && !same(supplierName, IN_HOUSE_SUPPLIER)
				? supplierName
				: null,
		purchaseOrderNumber: (
			purchaseOrder?.fields.PurchaseOrderNumber ?? ""
		).trim(),
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
			personId: person
				? refId("Person", person)
				: (fkValue(f.NCRRaisedByPersonId) ?? 0),
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
		originalFields: Object.fromEntries(
			[...PATCHED_COLUMNS, statusColumn].map((k) => [k, f[k] ?? null]),
		),
	};
}

export interface NcrSubmission {
	ncrNumber: string;
	processApplicable: string;
	status: StatusOption;
	supplier: string | null;
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
	const make: Make = async <F extends object>(
		table: TableName,
		label: string,
		fields: Record<string, unknown>,
	) => {
		await assertRecord(table, fields);
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

async function uploadAttachmentStub(
	file: File,
	ncrNumber: string,
): Promise<string> {
	const safeName = file.name.replace(/[^\w.-]+/g, "_");
	return `/uploads/ncr/${ncrNumber}/${safeName}`.slice(0, 500);
}

async function addFileAttachment(
	make: Make,
	file: File,
	ncrNumber: string,
	ncrRef: number,
	personId: number,
	now: string,
) {
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

async function addLinkAttachment(
	make: Make,
	link: string,
	ncrRef: number,
	personId: number,
	now: string,
) {
	await make("Attachment", "a link", {
		AttachmentType: "Link",
		AttachmentFileName: new URL(link).hostname.slice(0, 300),
		AttachmentFilePath: link,
		AttachmentUploadedAt: now,
		NCRId: ncrRef,
		AttachmentUploadedByPersonId: personId,
	});
}

async function resolveInspector(s: NcrSubmission, make: Make) {
	if (s.inspector.kind === "existing") {
		return {
			personId: s.inspector.personId,
			rolePersonId: s.inspector.rolePersonId,
		};
	}
	const roles = await listAll<RoleFields>("Role");
	const qualityRole = mustFind(
		roles,
		(r) => same(r.fields.RoleName, QUALITY_ROLE),
		`Role "${QUALITY_ROLE}"`,
	);
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

async function resolveChain(s: NcrSubmission, make: Make, now: string) {
	const [suppliers, items] = await Promise.all([
		listAll<SupplierFields>("Supplier"),
		listAll<ItemFields>("Item"),
	]);

	const supplierName = (s.supplier ?? IN_HOUSE_SUPPLIER).trim();
	const supplier =
		suppliers.find((r) => same(r.fields.SupplierName, supplierName)) ??
		(await make("Supplier", "the supplier", { SupplierName: supplierName }));

	const purchaseOrder =
		(await findFirst<PurchaseOrderFields>(
			"PurchaseOrder",
			where(["PurchaseOrderNumber", "eq", s.purchaseOrderNumber]),
		)) ??
		(await make("PurchaseOrder", "the purchase order", {
			PurchaseOrderNumber: s.purchaseOrderNumber,
			PurchaseOrderDate: now,
			SupplierId: refId("Supplier", supplier),
		}));

	const salesOrders = await listAll<SalesOrderFields>("SalesOrder", {
		where: where(["SalesOrderNumber", "eq", s.salesOrderNumber]),
	});
	const salesOrder =
		salesOrders.find(
			(r) => (r.fields.ItemSapNumber ?? "").trim() === s.item.sapNumber,
		) ??
		(await make("SalesOrder", "the sales order", {
			SalesOrderNumber: s.salesOrderNumber,
			ItemSapNumber: s.item.sapNumber,
			SalesOrderDate: now,
		}));

	const item =
		items.find(
			(r) =>
				same(r.fields.ItemName, s.item.name) &&
				same(r.fields.ItemDesc, s.item.description),
		) ??
		(await make("Item", "the item", {
			ItemName: s.item.name,
			ItemDesc: s.item.description,
			ItemUnitPrice: PLACEHOLDER_PRICE,
		}));

	const purchaseOrderId = refId("PurchaseOrder", purchaseOrder);
	const salesOrderId = refId("SalesOrder", salesOrder);
	const itemId = refId("Item", item);

	const soLineItem =
		(await findFirst<object>(
			"SOLineItem",
			where(["SalesOrderId", "eq", salesOrderId], ["ItemId", "eq", itemId]),
		)) ??
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
			where(
				["PurchaseOrderId", "eq", purchaseOrderId],
				["ItemId", "eq", itemId],
				["SOLineItemId", "eq", soLineItemId],
			),
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

const messageOf = (err: unknown) =>
	err instanceof ApiError || err instanceof Error ? err.message : String(err);

/** Columns put back if turning a draft into a real NCR fails part way. */
const DRAFT_RESTORE_COLUMNS = [
	...PATCHED_COLUMNS,
	"NCRDraftData",
	"NCRDraftStep",
	"NCRCreatedAtD",
] as const;

/**
 * Submits an NCR. Pass `draftId` to turn a saved draft into the real NCR
 * instead of creating a new NCR record.
 */
export async function submitNcr(
	s: NcrSubmission,
	progress: (message: string) => void = () => {},
	draftId: number | string | null = null,
): Promise<{ ncrNumber: string; recordId: number | string }> {
	const { created, now, make } = startTracker(progress);
	let draftRestore: { id: number | string; fields: Record<string, unknown> } | null =
		null;
	let draftPatched = false;
	try {
		let draftRec: NcRecord<NcrFields> | null = null;
		if (draftId !== null) {
			progress("Loading the draft...");
			draftRec = await readRecord<NcrFields>("NCR", draftId);
			if (!draftRec)
				throw new SubmitError(
					"The saved draft could not be found. It may have been removed.",
					[],
				);
			const df = draftRec.fields as Record<string, unknown>;
			draftRestore = {
				id: draftRec.id,
				fields: Object.fromEntries(
					[...DRAFT_RESTORE_COLUMNS, statusColumnOf(df)].map((k) => [
						k,
						df[k] ?? null,
					]),
				),
			};
		} else {
			progress("Checking the NCR number...");
			if (await ncrNumberExists(s.ncrNumber))
				throw new DuplicateNcrNumberError(s.ncrNumber);
		}

		progress("Checking the answers...");
		await validateSubmission(s, undefined, SUBMISSION_RULES);

		progress("Loading statuses...");
		const reviewStatuses = await listAll<ReviewStatusFields>("ReviewStatus");
		const review = mustFind(
			reviewStatuses,
			(r) => same(r.fields.ReviewStatusName, REVIEW_SUBMITTED),
			`Review status "${REVIEW_SUBMITTED}"`,
		);

		const inspector = await resolveInspector(s, make);
		const chain = await resolveChain(s, make, now);

		const ncrFields = {
			NCRNumber: s.ncrNumber,
			NCRProcessApplicable: s.processApplicable,
			NCRDefectDescription: s.defectDescription,
			NCRQuantityReceived: s.quantityReceived,
			NCRQuantityDefective: s.quantityDefective,
			NCRIsNonconforming: s.isNonconforming,
			...NCR_DEFAULTS,
			NCRCreatedAtD: now,
			NCRUpdatedAt: now,
			[STATUS_COLUMN]: s.status.id,
			NCRClosedAt: isClosedStatus(s.status.name) ? now : null,
			SOLineItemId: chain.soLineItemId,
			POLineItemId: chain.poLineItemId,
			NCRRaisedByPersonId: inspector.personId,
		};
		let ncr: NcRecord<object>;
		if (draftRec) {
			await assertRecord("NCR", ncrFields, { id: draftRec.id });
			progress("Saving the NCR...");
			draftPatched = true;
			await updateRecord("NCR", draftRec.id, {
				...ncrFields,
				NCRDraftData: "",
				NCRDraftStep: "",
			});
			ncr = draftRec;
		} else {
			ncr = await make("NCR", "the NCR", ncrFields);
		}
		const ncrRef = refId("NCR", ncr);

		for (const problemTypeId of s.problemTypeIds) {
			await make("NCRProblemType", "a problem type", {
				NCRId: ncrRef,
				ProblemTypeId: problemTypeId,
			});
		}
		for (const file of s.files)
			await addFileAttachment(
				make,
				file,
				s.ncrNumber,
				ncrRef,
				inspector.personId,
				now,
			);
		for (const link of s.links)
			await addLinkAttachment(make, link, ncrRef, inspector.personId, now);

		await make("NCRPerson", "the inspector's sign-off", {
			NCRPersonAssignedAt: now,
			NCRPersonReviewedAt: now,
			NCRId: ncrRef,
			RolePersonId: inspector.rolePersonId,
			ReviewStatusId: refId("ReviewStatus", review),
		});

		return { ncrNumber: s.ncrNumber, recordId: ncr.id };
	} catch (err) {
		if (draftPatched && draftRestore) {
			try {
				await updateRecord("NCR", draftRestore.id, draftRestore.fields);
			} catch {}
		}
		const leftovers = await rollback(created);
		if (
			err instanceof DuplicateNcrNumberError ||
			err instanceof MissingSeedError ||
			err instanceof ConstraintError
		)
			throw err;
		throw new SubmitError(messageOf(err), leftovers);
	}
}

export async function updateNcr(
	edit: NcrEditData,
	s: NcrSubmission,
	progress: (message: string) => void = () => {},
): Promise<{ ncrNumber: string; recordId: number | string }> {
	const { created, now, make } = startTracker(progress);
	let patchAttempted = false;
	try {
		progress("Checking the answers...");
		await validateSubmission(s, edit, SUBMISSION_RULES);

		const inspector = await resolveInspector(s, make);
		const chain = await resolveChain(s, make, now);

		const have = new Set(edit.problemTypeRows.map((r) => r.problemTypeId));
		for (const problemTypeId of s.problemTypeIds) {
			if (!have.has(problemTypeId)) {
				await make("NCRProblemType", "a problem type", {
					NCRId: edit.ncrRef,
					ProblemTypeId: problemTypeId,
				});
			}
		}
		for (const file of s.files)
			await addFileAttachment(
				make,
				file,
				edit.ncrNumber,
				edit.ncrRef,
				inspector.personId,
				now,
			);
		const haveLinks = new Set(edit.linkRows.map((r) => r.url));
		for (const link of s.links) {
			if (!haveLinks.has(link))
				await addLinkAttachment(
					make,
					link,
					edit.ncrRef,
					inspector.personId,
					now,
				);
		}

		const wasClosedAt = edit.originalFields.NCRClosedAt;
		const closedAt = isClosedStatus(s.status.name)
			? typeof wasClosedAt === "string" && wasClosedAt
				? wasClosedAt
				: now
			: null;

		const patch = {
			NCRProcessApplicable: s.processApplicable,
			NCRDefectDescription: s.defectDescription,
			NCRQuantityReceived: s.quantityReceived,
			NCRQuantityDefective: s.quantityDefective,
			NCRIsNonconforming: s.isNonconforming,
			NCRUpdatedAt: now,
			[edit.statusColumn]: s.status.id,
			NCRClosedAt: closedAt,
			SOLineItemId: chain.soLineItemId,
			POLineItemId: chain.poLineItemId,
			NCRRaisedByPersonId: inspector.personId,
		};
		await assertRecord("NCR", patch, { id: edit.recordId });

		progress("Updating the NCR...");
		patchAttempted = true;
		await updateRecord("NCR", edit.recordId, patch);
	} catch (err) {
		if (patchAttempted) {
			try {
				await updateRecord("NCR", edit.recordId, edit.originalFields);
			} catch {}
		}
		const leftovers = await rollback(created);
		if (err instanceof MissingSeedError || err instanceof ConstraintError) throw err;
		throw new SubmitError(messageOf(err), leftovers);
	}

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
		throw new SubmitError(
			"The NCR was updated, but some old records could not be removed.",
			leftovers,
		);
	}
	return { ncrNumber: edit.ncrNumber, recordId: edit.recordId };
}

/** Moves an archived (closed) NCR back to the open status, so it can be edited again. */
export async function unarchiveNcr(
	edit: NcrEditData,
	statuses: StatusOption[],
	progress: (message: string) => void = () => {},
): Promise<{ ncrNumber: string; recordId: number | string }> {
	const target = defaultStatus(statuses);
	if (!target) throw new MissingSeedError("An open NCR status");

	progress("Restoring the NCR...");
	await updateRecord("NCR", edit.recordId, {
		[edit.statusColumn]: target.id,
		NCRClosedAt: null,
		NCRUpdatedAt: ncDateTime(),
	});
	return { ncrNumber: edit.ncrNumber, recordId: edit.recordId };
}