import type { PostgrestError } from "@supabase/supabase-js";
import type { Tables } from "../../database.types";
import { looseSupabase as db, supabase } from "../utils/supabase";
import {
	ConstraintError,
	explainDbError,
	validateSubmission,
} from "./ncrConstraints";

export const QUALITY_ROLE = "Quality Representative";
export const STATUS_NEW = "Open";
export const STATUS_DRAFT = "Draft";
export const isClosedStatus = (name: string) => /clos/i.test(name);
export const IN_HOUSE_SUPPLIER = "In-house production";
export const PROCESS_LABELS = {
	supplier: "Supplier or Rec-Insp",
	wip: "WIP (Production Order)",
} as const;
const SUBMISSION_RULES = { processLabels: Object.values(PROCESS_LABELS) };

/** The NCR columns the list, the form and the modals read. */
export type NcrRecord = Pick<
	Tables<"ncr">,
	| "ncr_id"
	| "ncr_number"
	| "ncr_created_at"
	| "ncr_closed_at"
	| "ncr_draft_data"
	| "ncr_draft_step"
	| "ncr_is_reinspectable"
>;

/** One row of the `ncr_list` view: an NCR with its status, item, supplier and QA answers. */
export interface NcrListRow extends NcrRecord {
	ncr_status_id: number;
	status_label: string;
	is_draft: boolean;
	is_archived: boolean;
	supplier_name: string | null;
	item_name: string | null;
	sales_order_number: string | null;
	purchase_order_number: string | null;
	quantity_ordered: number | null;
	quantity_defective: number | null;
	defect_description: string | null;
	process_label: string | null;
	has_engineering: boolean;
	has_purchasing: boolean;
	disposition_label: string | null;
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
	first: string;
	middle: string;
	last: string;
}
export interface FormLookups {
	statuses: StatusOption[];
	suppliers: SupplierOption[];
	problemTypes: ProblemTypeOption[];
	inspectors: InspectorOption[];
}

const same = (a: string | null | undefined, b: string) =>
	(a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

export function defaultStatus(statuses: StatusOption[]): StatusOption | undefined {
	return statuses.find((s) => same(s.name, STATUS_NEW)) ?? statuses[0];
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
		super(`${what} is missing from the database. Run sql/01_ncr_functions.sql or add it by hand.`);
		this.name = "MissingSeedError";
	}
}
/** A save failed for a reason that is not a broken rule. `leftovers` is always empty: saves are atomic now. */
export class SubmitError extends Error {
	leftovers: string[];
	constructor(message: string, leftovers: string[] = []) {
		super(message);
		this.name = "SubmitError";
		this.leftovers = leftovers;
	}
}

/** Throws a readable error when a request failed. */
function throwIfError(res: { error: PostgrestError | null }, ncrNumber = ""): void {
	const { error } = res;
	if (!error) return;
	if (error.code === "23505" && /\(ncr_number\)/.test(error.details ?? ""))
		throw new DuplicateNcrNumberError(ncrNumber);
	const explained = explainDbError(error);
	throw explained instanceof ConstraintError ? explained : new SubmitError(explained.message);
}

/** Throws a readable error for a failed request. Returns the data otherwise. */
function unwrap<T>(res: { data: T | null; error: PostgrestError | null }, ncrNumber = ""): T {
	throwIfError(res, ncrNumber);
	return res.data as T;
}

export async function loadStatuses(): Promise<StatusOption[]> {
	const rows = unwrap(
		await supabase.from("ncr_status").select("ncr_status_id, ncr_status_label").order("ncr_status_id"),
	);
	return rows
		.map((r) => ({ id: r.ncr_status_id, name: r.ncr_status_label.trim() }))
		.filter((r) => r.name);
}

export async function loadFormLookups(): Promise<FormLookups> {
	const [statuses, suppliers, problemTypes, inspectors] = await Promise.all([
		loadStatuses(),
		supabase.from("supplier").select("supplier_id, supplier_name").order("supplier_name"),
		supabase
			.from("problem_type")
			.select("problem_type_id, problem_type_label, problem_type_desc")
			.order("problem_type_id"),
		supabase
			.from("person")
			.select("person_id, person_first_name, person_middle_name, person_last_name, role!inner(role_name)")
			.ilike("role.role_name", QUALITY_ROLE)
			.order("person_last_name")
			.order("person_first_name"),
	]);

	return {
		statuses,
		suppliers: unwrap(suppliers)
			.map((s) => ({ id: s.supplier_id, name: s.supplier_name.trim() }))
			.filter((s) => s.name && !same(s.name, IN_HOUSE_SUPPLIER)),
		problemTypes: unwrap(problemTypes).map((t) => ({
			id: t.problem_type_id,
			label: t.problem_type_label.trim(),
			description: (t.problem_type_desc ?? "").trim(),
		})),
		inspectors: unwrap(inspectors).map((p) => ({
			personId: p.person_id,
			first: p.person_first_name.trim(),
			middle: (p.person_middle_name ?? "").trim(),
			last: p.person_last_name.trim(),
		})),
	};
}

/** The next free NCR number for this year, for example 2026-001. */
export async function nextNcrNumber(): Promise<string> {
	return unwrap<string>(await db.rpc("next_ncr_number"));
}

/** True when an NCR is an unfinished draft (its form answers are stored in ncr_draft_data). */
export function isDraftRecord(rec: { ncr_draft_data: string | null }): boolean {
	return typeof rec.ncr_draft_data === "string" && rec.ncr_draft_data.trim() !== "";
}

export interface DraftPayload {
	values: Record<string, Record<string, unknown>>;
	/** The index of the form section the person was on when they saved. */
	step: number;
}

/** Reads the saved form answers of a draft. Returns null if there are none or they are unreadable. */
export function parseDraft(
	rec: Pick<NcrRecord, "ncr_draft_data" | "ncr_draft_step">,
): DraftPayload | null {
	const raw = rec.ncr_draft_data;
	if (typeof raw !== "string" || !raw.trim()) return null;
	try {
		const parsed = JSON.parse(raw) as { values?: unknown };
		if (!parsed || typeof parsed.values !== "object" || parsed.values === null) return null;
		const step = Number(rec.ncr_draft_step);
		return {
			values: parsed.values as DraftPayload["values"],
			step: Number.isFinite(step) ? Math.trunc(step) : 0,
		};
	} catch {
		return null;
	}
}

export interface DraftToSave {
	/** The NCR id of an existing draft, or null for the first save. */
	recordId: number | null;
	ncrNumber: string;
	/** The form answers, stored as they are. */
	values: unknown;
	step: number;
	/** The signed-in person (see useCurrentUser). */
	createdByPersonId: number | null;
}

/**
 * Saves the form answers as a draft NCR. The first save creates the NCR row
 * (so the NCR number is reserved). Later saves update it.
 * Nothing is validated: a draft can be incomplete.
 */
export async function saveDraft(
	d: DraftToSave,
	statuses: StatusOption[],
	progress: (message: string) => void = () => {},
): Promise<{ ncrNumber: string; recordId: number }> {
	if (d.recordId === null && d.createdByPersonId === null)
		throw new SubmitError("Your account is not loaded yet. Reload the page and try again.");
	const status = statuses.find((s) => same(s.name, STATUS_DRAFT)) ?? defaultStatus(statuses);
	if (!status) throw new MissingSeedError("An NCR status");
	progress("Saving the draft...");
	const res = unwrap<{ ncr_id: number }>(
		await db.rpc("save_ncr_draft", {
			p: {
				ncr_id: d.recordId,
				ncr_number: d.ncrNumber,
				status_id: status.id,
				created_by_person_id: d.createdByPersonId,
				draft_data: JSON.stringify({ v: 1, values: d.values }),
				draft_step: String(d.step),
			},
		}),
		d.ncrNumber,
	);
	return { ncrNumber: d.ncrNumber, recordId: res.ncr_id };
}

export interface NcrEditData {
	ncrId: number;
	ncrNumber: string;
	createdAt: string;
	closedAt: string | null;
	isReinspectable: boolean;
	processApplicable: string;
	statusId: number | null;
	supplier: string | null;
	purchaseOrderNumber: string;
	salesOrderNumber: string;
	item: { name: string; description: string; sapNumber: string };
	quantityOrdered: number | null;
	quantityDefective: number | null;
	problemTypeIds: number[];
	problemTypeLabels: string[];
	defectDescription: string;
	isNonconforming: boolean | null;
	inspector: { personId: number; first: string; middle: string; last: string };
	links: string[];
	existingFiles: string[];
	isArchived?: boolean;
}

/** Everything the form and the details window show about one NCR, in one request. */
const EDIT_SELECT = `
	ncr_id, ncr_number, ncr_status_id, ncr_created_at, ncr_closed_at, ncr_is_reinspectable,
	qa (
		qa_defect_desc, qa_quantity_defective, qa_is_non_conforming,
		ncr_process_applicable ( ncr_process_applicable_label ),
		person ( person_id, person_first_name, person_middle_name, person_last_name )
	),
	so_line_item (
		so_line_item_quantity_ordered,
		item ( item_name, item_desc ),
		sales_order ( sales_order_number, item_sap_number ),
		po_line_item ( po_line_item_id, purchase_order ( purchase_order_number, supplier ( supplier_name ) ) )
	),
	ncr_problem_type ( problem_type_id, problem_type ( problem_type_label ) ),
	attachment ( attachment_type, attachment_file_name, attachment_file_path )
`;

export async function loadNcrForEdit(rec: Pick<NcrRecord, "ncr_id">): Promise<NcrEditData> {
	const res = await supabase
		.from("ncr")
		.select(EDIT_SELECT)
		.eq("ncr_id", rec.ncr_id)
		.maybeSingle();
	throwIfError(res);
	const row = res.data;
	if (!row) throw new SubmitError("This NCR no longer exists. Close the form and reload the list.");

	const qa = row.qa;
	const line = row.so_line_item;
	// Several purchase orders can point at one sales order line. Use the newest.
	const poLine = [...(line?.po_line_item ?? [])].sort(
		(a, b) => b.po_line_item_id - a.po_line_item_id,
	)[0];
	const supplierName = (poLine?.purchase_order?.supplier?.supplier_name ?? "").trim();
	const attachments = row.attachment;
	const person = qa?.person;

	return {
		ncrId: row.ncr_id,
		ncrNumber: row.ncr_number.trim(),
		createdAt: row.ncr_created_at,
		closedAt: row.ncr_closed_at,
		isReinspectable: row.ncr_is_reinspectable,
		processApplicable: (qa?.ncr_process_applicable?.ncr_process_applicable_label ?? "").trim(),
		statusId: row.ncr_status_id,
		supplier: supplierName && !same(supplierName, IN_HOUSE_SUPPLIER) ? supplierName : null,
		purchaseOrderNumber: (poLine?.purchase_order?.purchase_order_number ?? "").trim(),
		salesOrderNumber: (line?.sales_order?.sales_order_number ?? "").trim(),
		item: {
			name: (line?.item?.item_name ?? "").trim(),
			description: (line?.item?.item_desc ?? "").trim(),
			sapNumber: (line?.sales_order?.item_sap_number ?? "").trim(),
		},
		quantityOrdered: line?.so_line_item_quantity_ordered ?? null,
		quantityDefective: qa?.qa_quantity_defective ?? null,
		problemTypeIds: row.ncr_problem_type.map((r) => r.problem_type_id),
		problemTypeLabels: row.ncr_problem_type
			.map((r) => (r.problem_type?.problem_type_label ?? "").trim())
			.filter(Boolean),
		defectDescription: (qa?.qa_defect_desc ?? "").trim(),
		isNonconforming: qa?.qa_is_non_conforming ?? null,
		inspector: {
			personId: person?.person_id ?? 0,
			first: (person?.person_first_name ?? "").trim(),
			middle: (person?.person_middle_name ?? "").trim(),
			last: (person?.person_last_name ?? "").trim(),
		},
		links: attachments
			.filter((a) => same(a.attachment_type, "Link"))
			.map((a) => a.attachment_file_path.trim())
			.filter(Boolean),
		existingFiles: attachments
			.filter((a) => !same(a.attachment_type, "Link"))
			.map((a) => a.attachment_file_name.trim())
			.filter(Boolean),
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
	quantityOrdered: number;
	quantityDefective: number;
	problemTypeIds: number[];
	defectDescription: string;
	isNonconforming: boolean;
	inspector:
		| { kind: "existing"; personId: number }
		| { kind: "new"; first: string; middle: string; last: string };
	files: File[];
	links: string[];
	/** The signed-in person (see useCurrentUser). */
	createdByPersonId: number | null;
}

/** Stand-in until file upload is connected: records where the file would live. */
const stubFilePath = (file: File, ncrNumber: string) =>
	`/uploads/ncr/${ncrNumber}/${file.name.replace(/[^\w.-]+/g, "_")}`.slice(0, 500);

/** The JSON the save functions in sql/01_ncr_functions.sql expect. */
function payload(s: NcrSubmission, ncrId: number | null) {
	return {
		ncr_id: ncrId,
		ncr_number: s.ncrNumber,
		created_by_person_id: s.createdByPersonId,
		process_label: s.processApplicable,
		status_id: s.status.id,
		supplier: s.supplier,
		purchase_order_number: s.purchaseOrderNumber,
		sales_order_number: s.salesOrderNumber,
		item: {
			name: s.item.name,
			description: s.item.description,
			sap_number: s.item.sapNumber,
		},
		quantity_ordered: s.quantityOrdered,
		quantity_defective: s.quantityDefective,
		problem_type_ids: s.problemTypeIds,
		defect_description: s.defectDescription,
		is_non_conforming: s.isNonconforming,
		inspector:
			s.inspector.kind === "existing"
				? { kind: "existing", person_id: s.inspector.personId }
				: { kind: "new", first: s.inspector.first, middle: s.inspector.middle, last: s.inspector.last },
		links: s.links,
		files: s.files.map((f) => ({
			name: f.name,
			type: f.type.startsWith("image/") ? "Image" : "Document",
			path: stubFilePath(f, s.ncrNumber),
		})),
	};
}

/**
 * Submits an NCR. Pass `draftId` to turn a saved draft into the real NCR
 * instead of creating a new one. Everything is saved in one database
 * transaction: it all succeeds or nothing is saved.
 */
export async function submitNcr(
	s: NcrSubmission,
	progress: (message: string) => void = () => {},
	draftId: number | null = null,
): Promise<{ ncrNumber: string; recordId: number }> {
	progress("Checking the answers...");
	validateSubmission(s, undefined, SUBMISSION_RULES);
	progress("Saving the NCR...");
	const res = unwrap<{ ncr_id: number; ncr_number: string }>(
		await db.rpc("submit_ncr", { p: payload(s, draftId) }),
		s.ncrNumber,
	);
	return { ncrNumber: res.ncr_number, recordId: res.ncr_id };
}

export async function updateNcr(
	edit: NcrEditData,
	s: NcrSubmission,
	progress: (message: string) => void = () => {},
): Promise<{ ncrNumber: string; recordId: number }> {
	progress("Checking the answers...");
	validateSubmission(s, edit, SUBMISSION_RULES);
	progress("Updating the NCR...");
	const res = unwrap<{ ncr_id: number; ncr_number: string }>(
		await db.rpc("update_ncr", { p: payload(s, edit.ncrId) }),
		edit.ncrNumber,
	);
	return { ncrNumber: res.ncr_number, recordId: res.ncr_id };
}

/** Moves an archived (closed) NCR back to the open status, so it can be edited again. */
export async function unarchiveNcr(
	edit: NcrEditData,
	statuses: StatusOption[],
	personId: number,
	progress: (message: string) => void = () => {},
): Promise<{ ncrNumber: string; recordId: number }> {
	const target = defaultStatus(statuses);
	if (!target) throw new MissingSeedError("An open NCR status");
	progress("Restoring the NCR...");
	unwrap(
		await db.rpc("restore_ncr", {
			p_ncr_id: edit.ncrId,
			p_status_id: target.id,
			p_person_id: personId,
		}),
	);
	return { ncrNumber: edit.ncrNumber, recordId: edit.ncrId };
}

/** Every `ncr_list` row, in pages (the API returns at most 1000 rows per request). */
export async function loadAllNcrRows(): Promise<NcrListRow[]> {
	const PAGE = 1000;
	const out: NcrListRow[] = [];
	for (let from = 0; ; from += PAGE) {
		const rows = unwrap<NcrListRow[]>(
			await db
				.from("ncr_list")
				.select("*")
				.order("ncr_id", { ascending: false })
				.range(from, from + PAGE - 1),
		);
		out.push(...rows);
		if (rows.length < PAGE) return out;
	}
}