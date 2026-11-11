/**
 * Data rules for the NCR app.
 *
 * The database now enforces the hard rules (NOT NULL, UNIQUE, CHECK, foreign
 * keys, and the cross-table rules inside the save functions in
 * sql/01_ncr_functions.sql). This file keeps two things:
 *
 * 1. {@link validateSubmission}: a quick check of the answers themselves,
 *    run before any request is sent, so mistakes come back at once and with
 *    the form field they belong to. It needs no database.
 * 2. {@link explainDbError}: turns a database error (a Postgres error code, a
 *    constraint name, or a message raised by the save functions) into words a
 *    person can act on.
 */
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

const ORDER_NUMBER = /^\d{1,18}$/;

/** What validateSubmission needs to know from the service. */
export interface SubmissionRules {
	/** The process names the NCR may be saved with. */
	processLabels: readonly string[];
}

/**
 * Checks the answers before anything is sent. Every problem is reported at
 * once, tagged with its form field. The rules that need the database (a
 * purchase order owned by another supplier, a sales order with another SAP
 * number, a link already attached elsewhere) are checked by the save
 * functions and come back through {@link explainDbError}.
 *
 * @throws {@link ConstraintError} listing every problem found.
 */
export function validateSubmission(
	s: NcrSubmission,
	edit: NcrEditData | undefined,
	rules: SubmissionRules,
): void {
	const out: Violation[] = [];
	const add = (field: string, message: string, value?: string) =>
		out.push({ field, message, value });

	if (!rules.processLabels.includes(s.processApplicable))
		add("processType", "Choose which process this report covers.");

	const supplier = (s.supplier ?? "").trim();
	if (supplier.length > 200) add("newSupplierName", "Use 200 characters or fewer.");

	if (!ORDER_NUMBER.test(s.purchaseOrderNumber.trim()))
		add("poNumber", "Use digits only, up to 18. Remove spaces, dashes and letters.");
	if (!ORDER_NUMBER.test(s.salesOrderNumber.trim()))
		add("salesOrderNumber", "Use digits only, up to 18. Remove spaces, dashes and letters.");

	const name = s.item.name.trim();
	const sap = s.item.sapNumber.trim();
	if (!name) add("itemName", "Enter the item name.");
	else if (name.length > 200) add("itemName", "Use 200 characters or fewer.");
	if (!sap) add("itemSapNumber", "Enter the SAP number.");
	else if (sap.length > 20) add("itemSapNumber", "Use 20 characters or fewer.");
	if (s.item.description.trim().length > 300)
		add("itemDescription", "Use 300 characters or fewer.");

	const ordered = s.quantityOrdered;
	const defective = s.quantityDefective;
	if (!Number.isInteger(ordered) || ordered < 1)
		add("qtyOrdered", "Enter a whole number of 1 or more.");
	if (!Number.isInteger(defective) || defective < 0)
		add("qtyDefective", "Enter a whole number of 0 or more.");
	else if (Number.isInteger(ordered) && defective > ordered)
		add("qtyDefective", "This cannot be more than the quantity ordered.");

	if (s.problemTypeIds.length === 0) add("problemTypeIds", "Tick at least one problem type.");
	else if (new Set(s.problemTypeIds).size !== s.problemTypeIds.length)
		add("problemTypeIds", "A problem type is ticked more than once.");

	const defect = s.defectDescription.trim();
	if (!defect) add("defectDescription", "Describe the defect.");
	else if (defect.length > 400) add("defectDescription", "Use 400 characters or fewer.");

	const departmentTextFields = [
		["engineeringInstructions", s.engineeringInstructions],
		["operationsInstructions", s.operationsInstructions],
		["procurementDelayCommunication", s.procurementDelayCommunication],
		["qualityFinalComments", s.qualityFinalComments],
	] as const;
	for (const [field, value] of departmentTextFields) {
		if (value.length > DEPARTMENT_TEXT_MAX_LENGTH)
			add(field, `Use ${DEPARTMENT_TEXT_MAX_LENGTH} characters or fewer.`);
		if (INVALID_TEXT_CONTROLS.test(value))
			add(field, "Remove unsupported control characters.");
	}

	if (s.inspector.kind === "new") {
		const { first, middle, last } = s.inspector;
		if (!first.trim()) add("newFirstName", "Enter a first name.");
		else if (first.trim().length > 75) add("newFirstName", "Use 75 characters or fewer.");
		if (middle.trim().length > 75) add("newMiddleName", "Use 75 characters or fewer.");
		if (!last.trim()) add("newLastName", "Enter a last name.");
		else if (last.trim().length > 75) add("newLastName", "Use 75 characters or fewer.");
	}

	// Web addresses: valid and not repeated within this report.
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
		if (seenLinks.has(link)) add("links", "This web address is listed more than once.", link);
		seenLinks.add(link);
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

	if (out.length) throw new ConstraintError(out);
}

/** The shape of an error from supabase-js. */
export interface DbErrorLike {
	code?: string;
	message?: string;
	details?: string | null;
	hint?: string | null;
}

/** Plain names for columns, used in messages. Anything not listed falls back to the column name. */
const COLUMN_NAMES: Record<string, string> = {
	ncr_number: "NCR number",
	purchase_order_number: "purchase order number",
	sales_order_number: "sales order number",
	item_sap_number: "SAP number",
	supplier_name: "supplier name",
	item_name: "item name",
	person_email: "email address",
	qa_defect_desc: "description of the defect",
	qa_quantity_defective: "quantity defective",
	so_line_item_quantity_ordered: "quantity ordered",
	attachment_file_path: "web address or file",
	attachment_file_name: "attachment file name",
	person_first_name: "first name",
	person_last_name: "last name",
	ncr_status_id: "status",
	ncr_created_by_person_id: "your account",
	qa_rep_person_id: "inspector",
	ncr_process_applicable_id: "process",
};
const columnName = (c: string) => COLUMN_NAMES[c] ?? c.replace(/_/g, " ");

/** Form field for a column, where there is one. */
const COLUMN_FIELDS: Record<string, string> = {
	purchase_order_number: "poNumber",
	sales_order_number: "salesOrderNumber",
	attachment_file_path: "links",
};

/** Messages for named CHECK and UNIQUE constraints from sql/02_ncr_constraints.sql. */
const CONSTRAINT_MESSAGES: Record<string, Violation> = {
	ncr_number_format: { message: "The NCR number must look like 2026-001.", field: "ncrNumber" },
	ncr_closed_after_created: { message: "The close date cannot be before the date the NCR was created." },
	qa_defect_desc_len: { message: "Use 400 characters or fewer.", field: "defectDescription" },
	qa_quantity_defective_check: { message: "The quantity defective cannot be negative.", field: "qtyDefective" },
	purchase_order_number_format: { message: "Use digits only, up to 18. Remove spaces, dashes and letters.", field: "poNumber" },
	sales_order_number_format: { message: "Use digits only, up to 18. Remove spaces, dashes and letters.", field: "salesOrderNumber" },
	sales_order_sap_len: { message: "Use 20 characters or fewer.", field: "itemSapNumber" },
	supplier_name_len: { message: "Use 200 characters or fewer.", field: "newSupplierName" },
	item_name_len: { message: "Use 200 characters or fewer.", field: "itemName" },
	item_desc_len: { message: "Use 300 characters or fewer.", field: "itemDescription" },
	so_line_qty_min: { message: "The quantity ordered must be a whole number of 1 or more.", field: "qtyOrdered" },
	po_line_qty_min: { message: "The quantity ordered must be a whole number of 1 or more.", field: "qtyOrdered" },
	attachment_type_allowed: { message: "The attachment type must be Image, Document or Link." },
	attachment_name_len: { message: "A file name is longer than 300 characters. Rename it and choose it again.", field: "files" },
	attachment_path_len: { message: "A web address is longer than 500 characters.", field: "links" },
	attachment_path_uq: { message: "This web address or file is already attached to a report.", field: "links" },
	person_email_format: { message: "The email address does not look right." },
	person_name_len: { message: "Use 75 characters or fewer.", field: "newFirstName" },
	engineering_updated_rev_required: { message: "The updated revision number is required when a drawing update is required." },
	supplier_name_lower_uq: { message: "A supplier with this name already exists.", field: "newSupplierName" },
	person_email_lower_uq: { message: "This email address is already used." },
};

/**
 * Turns a database error into something a person can act on.
 *
 * - Errors the save functions raise on purpose (P0001) keep their message, and
 *   carry the form field from DETAIL and the value from HINT.
 * - Unique, not-null, foreign-key, check and length errors get plain messages.
 * - Anything else keeps the database's own message.
 *
 * Returns a {@link ConstraintError} when the problem is with the data, or a
 * plain Error when it is not (a lost connection, a permissions problem).
 */
export function explainDbError(err: DbErrorLike): Error {
	const message = err.message ?? "";
	const details = err.details ?? "";
	const code = err.code ?? "";

	if (code === "P0001")
		return new ConstraintError([
			{ message, field: details || undefined, value: err.hint || undefined },
		]);

	const named = Object.keys(CONSTRAINT_MESSAGES).find((n) => message.includes(`"${n}"`));
	if (named) return new ConstraintError([CONSTRAINT_MESSAGES[named]]);

	if (code === "23505") {
		const m = details.match(/^Key \((.+?)\)=\((.*)\) already exists/);
		const cols = m ? m[1].split(",").map((c) => c.trim()) : [];
		const what = cols.map(columnName).join(" and ");
		const value = m?.[2];
		return new ConstraintError([
			{
				message:
					cols.length === 1
						? `The ${what} "${value}" is already used.`
						: `A record with this ${what || "combination"} already exists.`,
				field: cols.length === 1 ? COLUMN_FIELDS[cols[0]] : undefined,
				value,
			},
		]);
	}
	if (code === "23502") {
		const col = message.match(/null value in column "(.+?)"/)?.[1];
		return new ConstraintError([{ message: `The ${col ? columnName(col) : "value"} is required.` }]);
	}
	if (code === "23503")
		return new ConstraintError([
			{ message: "A linked record no longer exists. Reload the form and choose it again." },
		]);
	if (code === "23514")
		return new ConstraintError([{ message: "A value is outside what the database allows." }]);
	if (code === "22001")
		return new ConstraintError([{ message: "A value is too long for the database." }]);
	if (code === "42501")
		return new Error("You do not have permission to do that.");
	if (!code)
		return new Error("Could not reach the database. Check your connection and try again.");
	return new Error(message || "The database returned an error.");
}