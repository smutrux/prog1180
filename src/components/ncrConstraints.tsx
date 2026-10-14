/**
 * Data rules for the NCR database. NocoDB (without the premium plan) does not
 * enforce NOT NULL, UNIQUE, CHECK or foreign-key rules, so this file does it
 * before anything is written.
 *
 * There are two layers:
 *
 * 1. {@link assertRecord} is the safety net. {@link ncrService} calls it before
 *    every record it creates or changes, and it checks that record against the
 *    rules for its table in {@link RULES}: required columns, lengths, unique
 *    values, allowed values, number and date limits, and that linked rows exist.
 * 2. {@link validateSubmission} runs once, before the first write of a save. It
 *    catches problems that involve several tables at once (a purchase order
 *    that belongs to another supplier, a sales order number reused with another
 *    SAP number, a web address already attached elsewhere) and returns them
 *    tagged with the form field they belong to.
 *
 * Both throw a {@link ConstraintError}. Nothing is written when it is thrown
 * by the pre-save check, and a save that fails at the safety net is undone by
 * the service's normal rollback.
 */
import { fkValue, getByRef, listAll, refId, type NcRecord, type TableName } from "./api";
import type { NcrEditData, NcrSubmission } from "./ncrService";

/** One broken rule. */
export interface Violation {
	/** What went wrong, in words a person can act on. */
	message: string;
	/** The form field it belongs to, when there is one (for example `poNumber`). */
	field?: string;
	/** The value it is about. Used to find the right box among several, such as the web addresses. */
	value?: string;
}

/** Thrown when data would break one or more rules. Nothing was saved for it. */
export class ConstraintError extends Error {
	violations: Violation[];
	constructor(violations: Violation[]) {
		super(violations.map((v) => v.message).join(" "));
		this.name = "ConstraintError";
		this.violations = violations;
	}
}

/**
 * The sales order line stores the quantity ordered, and a defect count cannot
 * be larger than it. The app fills that quantity from the quantity received
 * when it creates the line, so an edit that raises the quantity received past
 * the stored number is blocked while this is `true`. Set it to `false` to
 * check only that the defective quantity is not more than the quantity received.
 */
export const ENFORCE_SO_QUANTITY_LIMIT = true;

/** The values NCRDisposition may hold. "Pending" is what a new NCR starts with. */
export const ALLOWED_DISPOSITIONS = ["Pending", "Use As Is", "Repair", "Rework", "Scrap"];
/** The values AttachmentType may hold. */
export const ALLOWED_ATTACHMENT_TYPES = ["Image", "Document", "Link"];

type Fields = Record<string, unknown>;
type Row = NcRecord<Fields>;
type Loader = (table: TableName) => Promise<Row[]>;

const NCR_NUMBER = /^\d{4}-\d{3,}$/;
const ORDER_NUMBER = /^\d{1,18}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Plain names for the columns, used in messages. Anything not listed falls back to the column name. */
const LABELS: Record<string, string> = {
	NCRNumber: "NCR number",
	NCRDefectDescription: "description of the defect",
	NCRProcessApplicable: "process applicable",
	NCRIsNonconforming: "nonconforming answer",
	NCRQuantityReceived: "quantity received",
	NCRQuantityDefective: "quantity defective",
	NCRUpdatedAt: "update date",
	NCRClosedAt: "close date",
	NCRRaisedByPersonId: "inspector",
	NCRPersonAssignedAt: "assigned date",
	SOLineItemId: "sales order line",
	POLineItemId: "purchase order line",
	PurchaseOrderId: "purchase order",
	SalesOrderId: "sales order",
	ItemId: "item",
	SupplierId: "supplier",
	RoleId: "role",
	PersonId: "person",
	NCRId: "NCR",
	ProblemTypeId: "problem type",
	RolePersonId: "inspector role",
	ReviewStatusId: "review status",
	SupplierName: "supplier name",
	PurchaseOrderNumber: "purchase order number",
	PurchaseOrderDate: "purchase order date",
	SalesOrderNumber: "sales order number",
	SalesOrderDate: "sales order date",
	ItemSapNumber: "SAP number",
	ItemName: "item name",
	ItemDesc: "item description",
	ItemUnitPrice: "item unit price",
	SOLineItemQuantityOrdered: "sales order line quantity",
	SOLineItemUnitPrice: "sales order line unit price",
	POLineItemQuantityOrdered: "purchase order line quantity",
	POLineItemUnitPrice: "purchase order line unit price",
	PersonFirstName: "first name",
	PersonMiddleName: "middle name",
	PersonLastName: "last name",
	PersonEmail: "email address",
	AttachmentType: "attachment type",
	AttachmentFileName: "attachment file name",
	AttachmentFilePath: "attachment file path",
	AttachmentUploadedByPersonId: "uploader",
};
const nameOf = (col: string) => LABELS[col] ?? col;

const isBlank = (v: unknown) =>
	v === null || v === undefined || (typeof v === "string" && !v.trim());
const text = (v: unknown) =>
	typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v);
const asNumber = (v: unknown) =>
	typeof v === "number"
		? v
		: typeof v === "string" && v.trim() !== ""
			? Number(v)
			: Number.NaN;

/** A value in a form that can be compared: text ignores case and edge spaces, a link to another row becomes its id. */
function keyOf(v: unknown): string {
	if (typeof v === "string") return v.trim().toLowerCase();
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	const id = fkValue(v);
	return id === null ? "" : String(id);
}

/**
 * A date or date-time as minutes since 1970, reading only the digits and
 * ignoring any time zone. The app writes local times without a zone and the
 * database may hand them back with one, so comparing the digits keeps
 * "saved a minute ago" from looking like "saved before it was created".
 */
function wallTime(v: unknown): number | null {
	if (typeof v !== "string") return null;
	const m = v
		.trim()
		.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
	if (!m) return null;
	return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}

/** Loads each table at most once per check. */
function makeLoader(): Loader {
	const cache = new Map<TableName, Promise<Row[]>>();
	return (table) => {
		let hit = cache.get(table);
		if (!hit) {
			hit = listAll<Fields>(table) as Promise<Row[]>;
			cache.set(table, hit);
		}
		return hit;
	};
}

interface Ctx {
	/** The record as it will be after the save: the stored columns with the new ones on top. */
	merged: Fields;
	/** Only the columns being written. */
	patch: Fields;
	/** True when an existing record is being changed. */
	changing: boolean;
	load: Loader;
}

interface TableRules {
	/** Columns that cannot be empty (NOT NULL). */
	required?: string[];
	/** Longest allowed text per column. */
	maxLength?: Record<string, number>;
	/** Values that cannot repeat. A blank value never counts as a repeat. */
	unique?: { columns: string[]; what: string }[];
	/** Columns that must point at a row that exists. */
	references?: Record<string, TableName>;
	/** Anything else. Returns one message per broken rule. */
	check?: (c: Ctx) => Promise<string[]> | string[];
}

/** A number column that has to be a whole number of at least `min`. */
function wholeAtLeast(f: Fields, col: string, min: number): string[] {
	const v = f[col];
	if (isBlank(v)) return [];
	const n = asNumber(v);
	return Number.isInteger(n) && n >= min
		? []
		: [`The ${nameOf(col)} must be a whole number of ${min} or more.`];
}

/** A number column that cannot be negative. */
function notNegative(f: Fields, col: string): string[] {
	const v = f[col];
	if (isBlank(v)) return [];
	const n = asNumber(v);
	return Number.isFinite(n) && n >= 0 ? [] : [`The ${nameOf(col)} cannot be negative.`];
}

async function ncrChecks(c: Ctx): Promise<string[]> {
	const f = c.merged;
	const out: string[] = [];

	if (!c.changing && !isBlank(f.NCRNumber) && !NCR_NUMBER.test(text(f.NCRNumber)))
		out.push("The NCR number must look like 2026-001.");

	out.push(...wholeAtLeast(f, "NCRQuantityReceived", 1));
	out.push(...wholeAtLeast(f, "NCRQuantityDefective", 0));
	const received = asNumber(f.NCRQuantityReceived);
	const defective = asNumber(f.NCRQuantityDefective);
	if (Number.isFinite(received) && Number.isFinite(defective)) {
		if (defective > received)
			out.push(
				`The quantity defective (${defective}) cannot be more than the quantity received (${received}).`,
			);
		else if (ENFORCE_SO_QUANTITY_LIMIT) {
			const line = await getByRef<Fields>("SOLineItem", fkValue(f.SOLineItemId)).catch(
				() => undefined,
			);
			const ordered = asNumber(line?.fields.SOLineItemQuantityOrdered);
			if (Number.isFinite(ordered) && defective > ordered)
				out.push(
					`The quantity defective (${defective}) cannot be more than the quantity on the sales order line (${ordered}).`,
				);
		}
	}

	if (!isBlank(f.NCRIsNonconforming) && typeof f.NCRIsNonconforming !== "boolean")
		out.push("The nonconforming answer must be Yes or No.");

	if (
		!isBlank(f.NCRDisposition) &&
		!ALLOWED_DISPOSITIONS.some((d) => keyOf(d) === keyOf(f.NCRDisposition))
	)
		out.push(`The disposition must be one of: ${ALLOWED_DISPOSITIONS.join(", ")}.`);

	const drawing = f.NCRIsDrawingUpdateRequired;
	const drawingNeeded = drawing === true || /^(yes|true|required)$/i.test(text(drawing));
	if (drawingNeeded && isBlank(f.NCRUpdatedRevNumber))
		out.push("The updated revision number is required when a drawing update is required.");

	const createdKey = Object.keys(f).find((k) => /^NCRCreatedAt/.test(k));
	const created = createdKey ? wallTime(f[createdKey]) : null;
	if (created !== null) {
		for (const col of ["NCRUpdatedAt", "NCRClosedAt"]) {
			const t = wallTime(f[col]);
			if (t !== null && t < created)
				out.push(`The ${nameOf(col)} cannot be before the date the NCR was created.`);
		}
	}

	for (const [col, v] of Object.entries(c.patch)) {
		if (!/status/i.test(col) || /review/i.test(col)) continue;
		const id = fkValue(v);
		if (id === null) continue;
		const found = await getByRef<Fields>("NCRStatus", id).catch(() => undefined);
		if (found === null) out.push("The chosen status no longer exists. Reload and choose it again.");
	}
	return out;
}

/** The rules for each table the app writes to. Add a table here to protect it too. */
const RULES: Partial<Record<TableName, TableRules>> = {
	NCR: {
		required: [
			"NCRNumber",
			"NCRDefectDescription",
			"NCRProcessApplicable",
			"NCRIsNonconforming",
			"NCRQuantityReceived",
			"NCRQuantityDefective",
			"SOLineItemId",
			"NCRRaisedByPersonId",
		],
		maxLength: { NCRDefectDescription: 400 },
		unique: [{ columns: ["NCRNumber"], what: "NCR number" }],
		references: {
			SOLineItemId: "SOLineItem",
			POLineItemId: "POLineItem",
			NCRRaisedByPersonId: "Person",
		},
		check: ncrChecks,
	},
	Supplier: {
		required: ["SupplierName"],
		maxLength: { SupplierName: 200 },
		unique: [{ columns: ["SupplierName"], what: "supplier name" }],
	},
	PurchaseOrder: {
		required: ["PurchaseOrderNumber", "PurchaseOrderDate", "SupplierId"],
		maxLength: { PurchaseOrderNumber: 18 },
		unique: [{ columns: ["PurchaseOrderNumber"], what: "purchase order number" }],
	},
	SalesOrder: {
		required: ["SalesOrderNumber", "SalesOrderDate"],
		maxLength: { SalesOrderNumber: 18, ItemSapNumber: 20 },
		unique: [{ columns: ["SalesOrderNumber"], what: "sales order number" }],
	},
	Item: {
		required: ["ItemName"],
		maxLength: { ItemName: 200, ItemDesc: 300 },
		check: (c) => notNegative(c.merged, "ItemUnitPrice"),
	},
	SOLineItem: {
		required: ["SOLineItemQuantityOrdered", "SOLineItemUnitPrice", "ItemId", "SalesOrderId"],
		unique: [
			{ columns: ["SalesOrderId", "ItemId"], what: "A line for this item on this sales order" },
		],
		check: (c) => [
			...wholeAtLeast(c.merged, "SOLineItemQuantityOrdered", 1),
			...notNegative(c.merged, "SOLineItemUnitPrice"),
		],
	},
	POLineItem: {
		required: [
			"POLineItemQuantityOrdered",
			"POLineItemUnitPrice",
			"PurchaseOrderId",
			"ItemId",
		],
		check: (c) => [
			...wholeAtLeast(c.merged, "POLineItemQuantityOrdered", 1),
			...notNegative(c.merged, "POLineItemUnitPrice"),
		],
	},
	Person: {
		required: ["PersonFirstName", "PersonLastName"],
		maxLength: { PersonFirstName: 75, PersonMiddleName: 75, PersonLastName: 75 },
		// The form does not ask for an email yet, so a blank one is allowed and
		// never counts as a repeat. A real one must look like an email and be new.
		unique: [{ columns: ["PersonEmail"], what: "email address" }],
		check: (c) =>
			!isBlank(c.merged.PersonEmail) && !EMAIL.test(text(c.merged.PersonEmail))
				? ["The email address does not look right."]
				: [],
	},
	RolePerson: {
		required: ["RoleId", "PersonId"],
		unique: [{ columns: ["RoleId", "PersonId"], what: "This person already has this role. It" }],
	},
	NCRProblemType: {
		required: ["NCRId", "ProblemTypeId"],
		unique: [
			{ columns: ["NCRId", "ProblemTypeId"], what: "This NCR already has this problem type. It" },
		],
		references: { ProblemTypeId: "ProblemType" },
	},
	NCRPerson: {
		required: ["NCRPersonAssignedAt", "NCRId", "RolePersonId", "ReviewStatusId"],
		unique: [
			{ columns: ["NCRId", "RolePersonId"], what: "This person is already assigned to this NCR. It" },
		],
		references: { RolePersonId: "RolePerson", ReviewStatusId: "ReviewStatus" },
		check: (c) => {
			const assigned = wallTime(c.merged.NCRPersonAssignedAt);
			const reviewed = wallTime(c.merged.NCRPersonReviewedAt);
			return assigned !== null && reviewed !== null && reviewed < assigned
				? ["The review date cannot be before the assigned date."]
				: [];
		},
	},
	Attachment: {
		required: [
			"AttachmentType",
			"AttachmentFileName",
			"AttachmentFilePath",
			"NCRId",
			"AttachmentUploadedByPersonId",
		],
		maxLength: { AttachmentFileName: 300, AttachmentFilePath: 500 },
		unique: [{ columns: ["AttachmentFilePath"], what: "attachment file path" }],
		check: (c) =>
			!isBlank(c.merged.AttachmentType) &&
			!ALLOWED_ATTACHMENT_TYPES.includes(text(c.merged.AttachmentType))
				? [`The attachment type must be one of: ${ALLOWED_ATTACHMENT_TYPES.join(", ")}.`]
				: [],
	},
};

/**
 * Checks one record against the rules for its table. Call it before creating
 * the record, or, with `id`, before changing it. When changing, only the
 * columns in `fields` are checked for required values, lengths and repeats,
 * but the whole record (stored values plus the changes) is used for the
 * rules that compare columns, such as dates.
 *
 * @param table - The table being written to. A table with no rules passes.
 * @param fields - The columns being written.
 * @param opts - `id` is the record being changed. Leave it out for a new record.
 * @throws {@link ConstraintError} listing every rule that is broken.
 */
export async function assertRecord(
	table: TableName,
	fields: Fields,
	opts: { id?: number | string } = {},
): Promise<void> {
	const rules = RULES[table];
	if (!rules) return;

	const changing = opts.id !== undefined;
	const load = makeLoader();
	const own = (r: Row) => String(r.id) === String(opts.id);
	const existing = changing ? (await load(table)).find(own) : undefined;
	if (changing && !existing)
		throw new ConstraintError([
			{ message: "This record no longer exists. Close the form and reload the list." },
		]);

	const merged = { ...(existing?.fields ?? {}), ...fields };
	const out: string[] = [];
	const touched = (col: string) => !changing || col in fields;

	for (const col of rules.required ?? []) {
		if (!touched(col)) continue;
		const v = merged[col];
		const emptyId = typeof v === "number" && v <= 0 && /Id$/.test(col);
		if (isBlank(v) || emptyId) out.push(`The ${nameOf(col)} is required.`);
	}

	for (const [col, max] of Object.entries(rules.maxLength ?? {})) {
		if (!touched(col)) continue;
		if (text(merged[col]).length > max)
			out.push(`The ${nameOf(col)} must be ${max} characters or fewer.`);
	}

	for (const u of rules.unique ?? []) {
		if (!u.columns.some(touched)) continue;
		const wanted = u.columns.map((c) => keyOf(merged[c]));
		if (wanted.some((k) => k === "")) continue;
		const clash = (await load(table)).find(
			(r) => !own(r) && u.columns.every((c, i) => keyOf(r.fields[c]) === wanted[i]),
		);
		if (clash)
			out.push(
				u.columns.length === 1
					? `The ${u.what} "${text(merged[u.columns[0]])}" is already used.`
					: `${u.what} already exists.`,
			);
	}

	for (const [col, target] of Object.entries(rules.references ?? {})) {
		if (!touched(col)) continue;
		const id = fkValue(merged[col]);
		if (id === null) continue;
		const found = await getByRef<Fields>(target, id).catch(() => undefined);
		if (found === null)
			out.push(`The chosen ${nameOf(col)} no longer exists. Reload and choose it again.`);
	}

	if (rules.check) out.push(...(await rules.check({ merged, patch: fields, changing, load })));

	if (out.length) throw new ConstraintError(out.map((message) => ({ message })));
}

/** What {@link validateSubmission} needs to know from the service. */
export interface SubmissionRules {
	/** The supplier name used for NCRs from in-house production. */
	inHouseSupplier: string;
	/** The process names the NCR may be saved with. */
	processLabels: readonly string[];
}

/**
 * Checks everything a save will write, before anything is written. It covers
 * the answers themselves (so the rules hold no matter which screen calls the
 * service) and the places where the answers collide with rows already in the
 * database. Every problem is reported at once, tagged with its form field.
 *
 * @param s - The answers being saved.
 * @param edit - The NCR being changed. Leave it out for a new NCR.
 * @param rules - Names the service owns, see {@link SubmissionRules}.
 * @throws {@link ConstraintError} listing every problem found.
 */
export async function validateSubmission(
	s: NcrSubmission,
	edit: NcrEditData | undefined,
	rules: SubmissionRules,
): Promise<void> {
	const out: Violation[] = [];
	const add = (field: string, message: string, value?: string) =>
		out.push({ field, message, value });

	// The answers themselves.
	if (!rules.processLabels.includes(s.processApplicable))
		add("processType", "Choose which process this report covers.");

	const supplierName = (s.supplier ?? rules.inHouseSupplier).trim();
	if (supplierName.length > 200) add("newSupplierName", "Use 200 characters or fewer.");

	const po = s.purchaseOrderNumber.trim();
	const so = s.salesOrderNumber.trim();
	if (!ORDER_NUMBER.test(po))
		add("poNumber", "Use digits only, up to 18. Remove spaces, dashes and letters.");
	if (!ORDER_NUMBER.test(so))
		add("salesOrderNumber", "Use digits only, up to 18. Remove spaces, dashes and letters.");

	const name = s.item.name.trim();
	const sap = s.item.sapNumber.trim();
	if (!name) add("itemName", "Enter the item name.");
	else if (name.length > 200) add("itemName", "Use 200 characters or fewer.");
	if (!sap) add("itemSapNumber", "Enter the SAP number.");
	else if (sap.length > 20) add("itemSapNumber", "Use 20 characters or fewer.");
	if (s.item.description.trim().length > 300)
		add("itemDescription", "Use 300 characters or fewer.");

	const received = s.quantityReceived;
	const defective = s.quantityDefective;
	if (!Number.isInteger(received) || received < 1)
		add("qtyReceived", "Enter a whole number of 1 or more.");
	if (!Number.isInteger(defective) || defective < 0)
		add("qtyDefective", "Enter a whole number of 0 or more.");
	else if (Number.isInteger(received) && defective > received)
		add("qtyDefective", "This cannot be more than the quantity received.");

	if (s.problemTypeIds.length === 0) add("problemTypeIds", "Tick at least one problem type.");
	else if (new Set(s.problemTypeIds).size !== s.problemTypeIds.length)
		add("problemTypeIds", "A problem type is ticked more than once.");

	const defect = s.defectDescription.trim();
	if (!defect) add("defectDescription", "Describe the defect.");
	else if (defect.length > 400) add("defectDescription", "Use 400 characters or fewer.");

	if (s.inspector.kind === "new") {
		const { first, middle, last } = s.inspector;
		if (!first.trim()) add("newFirstName", "Enter a first name.");
		else if (first.trim().length > 75) add("newFirstName", "Use 75 characters or fewer.");
		if (middle.trim().length > 75) add("newMiddleName", "Use 75 characters or fewer.");
		if (!last.trim()) add("newLastName", "Enter a last name.");
		else if (last.trim().length > 75) add("newLastName", "Use 75 characters or fewer.");
	}

	// Web addresses: valid, not repeated, and not already attached to another report.
	const load = makeLoader();
	const attachments = await load("Attachment");
	const ownLinks = new Set((edit?.linkRows ?? []).map((r) => r.url));
	const seenLinks = new Set<string>();
	for (const link of s.links) {
		let valid = true;
		try {
			valid = /^https?:$/.test(new URL(link).protocol);
		} catch {
			valid = false;
		}
		if (!valid) {
			add("links", "Enter a full web address that starts with http:// or https://.", link);
			continue;
		}
		if (seenLinks.has(link)) {
			add("links", "This web address is listed more than once.", link);
			continue;
		}
		seenLinks.add(link);
		if (
			!ownLinks.has(link) &&
			attachments.some((a) => text(a.fields.AttachmentFilePath) === link)
		)
			add("links", "This web address is already attached to another report.", link);
	}

	// Files: names must not repeat, because the saved path is built from the name.
	const taken = new Set((edit?.existingFiles ?? []).map((n) => n.toLowerCase()));
	for (const file of s.files) {
		const key = file.name.toLowerCase();
		if (taken.has(key)) {
			add(
				"files",
				`A file named "${file.name}" is already attached to this report. Rename it and choose it again.`,
			);
			break;
		}
		taken.add(key);
	}

	// Rows already in the database that these answers would collide with.
	if (ORDER_NUMBER.test(po)) {
		const [orders, suppliers] = await Promise.all([
			load("PurchaseOrder"),
			load("Supplier"),
		]);
		const existing = orders.find((o) => keyOf(o.fields.PurchaseOrderNumber) === keyOf(po));
		if (existing) {
			const ownerId = fkValue(existing.fields.SupplierId);
			const owner = suppliers.find((r) => refId("Supplier", r) === ownerId);
			const ownerName = text(owner?.fields.SupplierName);
			if (ownerName && keyOf(ownerName) !== keyOf(supplierName))
				add(
					"poNumber",
					`Purchase order ${po} already belongs to "${ownerName}". Choose that supplier, or use a different number.`,
				);
		}
	}
	if (ORDER_NUMBER.test(so) && sap) {
		const same = (await load("SalesOrder")).filter(
			(r) => keyOf(r.fields.SalesOrderNumber) === keyOf(so),
		);
		if (same.length > 0 && !same.some((r) => text(r.fields.ItemSapNumber) === sap)) {
			const other = text(same[0].fields.ItemSapNumber);
			add(
				"salesOrderNumber",
				`Sales order ${so} already exists with ${other ? `SAP number "${other}"` : "no SAP number"}. Use that SAP number, or a different sales order number.`,
			);
		}
	}

	if (out.length) throw new ConstraintError(out);
}