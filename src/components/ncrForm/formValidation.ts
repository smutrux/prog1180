import {
	DEPARTMENT_TEXT_MAX_LENGTH,
	INVALID_TEXT_CONTROLS,
	isReworkDisposition,
} from "../ncrConstraints";
import {
	ADD_INSPECTOR,
	ADD_SUPPLIER,
	type Errors,
	type FormValues,
	type SectionId,
} from "./formModel";

const DIGITS = /^\d{1,18}$/;

const POSITIVE_INT = /^[1-9]\d{0,8}$/;

export const NCR_NUMBER = /^\d{4}-\d{3,}$/;

const blank = (s: string) => !s.trim();

const DIGIT_MSG =
	"Use digits only, up to 18. Remove spaces, dashes and letters.";

const filled = (...parts: string[]) => parts.some((x) => x.trim() !== "");

/** True for a real calendar date written as YYYY-MM-DD. */
const validDate = (s: string) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const d = new Date(`${s}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Fills in the hidden "who and when" fields of Engineering, Operations and Quality Final Review
 * with the signed-in person and today. A section is stamped when it has content and
 * either it was just saved or changed, or it has never been stamped. A section
 * nobody touched keeps its earlier stamp.
 *
 * `canStamp` limits this to the sections the signed-in person may edit, so
 * their name is never put on someone else's section.
 */
export function stampSections(
	v: FormValues,
	name: string,
	today: string,
	touched: ReadonlySet<SectionId>,
	canStamp: (id: SectionId) => boolean = () => true,
): FormValues {
	if (!name) return v;
	let next = v;
	const g = v.engineering;
	if (
		canStamp("engineering") &&
		filled(g.disposition, g.instructions, g.originalRev, g.updatedRev) &&
		(touched.has("engineering") || !g.representative || !g.dateCompleted)
	) {
		next = {
			...next,
			engineering: { ...g, representative: name, dateCompleted: today },
		};
	}
	const o = v.operations;
	if (
		canStamp("operations") &&
		filled(o.disposition, o.instructions, o.comments) &&
		(touched.has("operations") || !o.representative || !o.dateCompleted)
	) {
		next = {
			...next,
			operations: { ...o, representative: name, dateCompleted: today },
		};
	}
	const q = v.qualityFinalReview;
	if (
		canStamp("qualityFinalReview") &&
		filled(q.inspectionResult, q.comments, q.acceptanceConfirmed) &&
		(touched.has("qualityFinalReview") || !q.closedBy || !q.dateClosed)
	) {
		next = {
			...next,
			qualityFinalReview: { ...q, closedBy: name, dateClosed: today },
		};
	}
	return next;
}

export function validate(
	id: SectionId,
	v: FormValues,
	files: File[],
	forSubmit: boolean,
): Errors {
	const e: Errors = {};
	const validateDepartmentTextbox = (key: string, value: string) => {
		if (value.length > DEPARTMENT_TEXT_MAX_LENGTH) {
			e[key] = `Use ${DEPARTMENT_TEXT_MAX_LENGTH} characters or fewer.`;
		} else if (INVALID_TEXT_CONTROLS.test(value)) {
			INVALID_TEXT_CONTROLS.lastIndex = 0;
			e[key] = "Remove unsupported control characters.";
		}
		INVALID_TEXT_CONTROLS.lastIndex = 0;
	};
	switch (id) {
		case "process": {
			const p = v.process;
			const isSupplier = p.processType === "supplier";
			if (!NCR_NUMBER.test(p.ncrNumber))
				e.ncrNumber =
					"The NCR number is missing. Reload the form to get the next number.";
			if (!p.processType)
				e.processType = "Choose which process this report covers.";
			if (isSupplier && !p.supplier)
				e.supplier = "Choose a supplier from the list.";
			if (p.supplier === ADD_SUPPLIER) {
				if (blank(p.newSupplierName))
					e.newSupplierName = "Enter the supplier's name.";
				else if (p.newSupplierName.trim().length > 200)
					e.newSupplierName = "Use 200 characters or fewer.";
			}
			if (blank(p.poNumber))
				e.poNumber = isSupplier
					? "Enter the purchase order number."
					: "Enter the production order number.";
			else if (!DIGITS.test(p.poNumber.trim())) e.poNumber = DIGIT_MSG;
			if (blank(p.salesOrderNumber))
				e.salesOrderNumber = "Enter the sales order number.";
			else if (!DIGITS.test(p.salesOrderNumber.trim()))
				e.salesOrderNumber = DIGIT_MSG;
			break;
		}
		case "item": {
			const i = v.item;
			if (blank(i.itemName)) e.itemName = "Enter the item name.";
			else if (i.itemName.trim().length > 200)
				e.itemName = "Use 200 characters or fewer.";
			if (blank(i.itemSapNumber)) e.itemSapNumber = "Enter the SAP number.";
			else if (i.itemSapNumber.trim().length > 20)
				e.itemSapNumber = "Use 20 characters or fewer.";
			if (i.itemDescription.trim().length > 300)
				e.itemDescription = "Use 300 characters or fewer.";
			break;
		}
		case "defect": {
			const d = v.defect;
			const ordered = d.qtyOrdered.trim();
			const defective = d.qtyDefective.trim();
			if (!POSITIVE_INT.test(ordered))
				e.qtyOrdered = "Enter a whole number of 1 or more.";
			if (!POSITIVE_INT.test(defective))
				e.qtyDefective = "Enter a whole number of 1 or more.";
			else if (
				POSITIVE_INT.test(ordered) &&
				Number(defective) > Number(ordered)
			) {
				e.qtyDefective = "This cannot be more than the quantity ordered.";
			}
			if (d.problemTypeIds.length === 0)
				e.problemTypeIds = "Tick at least one problem type.";
			if (blank(d.defectDescription))
				e.defectDescription = "Describe the defect.";
			else if (d.defectDescription.trim().length > 400)
				e.defectDescription = "Use 400 characters or fewer.";
			if (!d.isNonconforming) e.isNonconforming = "Choose Yes or No.";
			if (!d.engineeringRequired) e.engineeringRequired = "Choose Yes or No.";
			break;
		}
		case "engineering": {
			const g = v.engineering;
			validateDepartmentTextbox("engineeringInstructions", g.instructions);
			validateDepartmentTextbox("engineeringOriginalRev", g.originalRev);
			validateDepartmentTextbox("engineeringUpdatedRev", g.updatedRev);
			if (g.revisionDate && !validDate(g.revisionDate))
				e.engineeringRevisionDate = "Enter a real date as YYYY-MM-DD.";
			// Engineering is stored as one row, so once any answer is given the required ones must be there too.
			const started = filled(
				g.disposition,
				g.instructions,
				g.drawingUpdateRequired,
				g.notificationRequired,
				g.originalRev,
				g.updatedRev,
				g.revisionDate,
			);
			if (started) {
				if (!g.disposition)
					e.engineeringDisposition = "Choose the engineering disposition.";
				if (!g.drawingUpdateRequired)
					e.engineeringDrawingUpdate = "Choose Yes or No.";
				if (!g.notificationRequired)
					e.engineeringNotification = "Choose Yes or No.";
				if (g.drawingUpdateRequired === "yes" && blank(g.updatedRev))
					e.engineeringUpdatedRev =
						"Enter the updated revision number. A drawing update needs one.";
			}
			break;
		}
		case "operations":
			if (
				isReworkDisposition(v.operations.disposition) &&
				blank(v.operations.instructions)
			) {
				e.operationsInstructions = "Enter the rework or repair instructions.";
			} else {
				validateDepartmentTextbox(
					"operationsInstructions",
					v.operations.instructions,
				);
			}
			validateDepartmentTextbox("operationsComments", v.operations.comments);
			break;
		case "procurement": {
			const g = v.procurement;
			validateDepartmentTextbox(
				"procurementDelayCommunication",
				g.delayCommunication,
			);
			validateDepartmentTextbox("procurementRmaNumber", g.rmaNumber);
			validateDepartmentTextbox("procurementCarrierName", g.carrierName);
			validateDepartmentTextbox(
				"procurementCarrierAccountNumber",
				g.carrierAccountNumber,
			);
			if (g.replacementDate && !validDate(g.replacementDate))
				e.procurementReplacementDate = "Enter a real date as YYYY-MM-DD.";
			break;
		}
		case "qualityFinalReview":
			validateDepartmentTextbox(
				"qualityFinalComments",
				v.qualityFinalReview.comments,
			);
			if (!v.qualityFinalReview.acceptanceConfirmed) {
				e.qualityAcceptanceConfirmed =
					"Confirm Yes or No for final acceptance.";
			}
			break;
		case "evidence": {
			v.evidence.links.forEach((link, i) => {
				const t = link.trim();
				if (!t) return;
				if (t.length > 500) {
					e[`link-${i}`] = "Use 500 characters or fewer.";
					return;
				}
				try {
					if (!/^https?:$/.test(new URL(t).protocol))
						throw new Error("protocol");
				} catch {
					e[`link-${i}`] =
						"Enter a full web address that starts with http:// or https://.";
				}
			});
			const bad = files.find(
				(f) => !(f.type.startsWith("image/") || f.type === "application/pdf"),
			);
			const long = files.find((f) => f.name.length > 300);
			if (bad)
				e.files = `"${bad.name}" is not a picture or PDF. Choose the files again without it.`;
			else if (long)
				e.files =
					"A file name is longer than 300 characters. Rename it and choose it again.";
			else if (
				forSubmit &&
				v.evidence.fileNames.length > 0 &&
				files.length === 0
			) {
				e.files =
					"Your saved draft lists files, but the browser does not keep files after a reload. Choose them again, or remove the saved file names.";
			}
			break;
		}
		case "inspector": {
			const n = v.inspector;
			if (!n.inspector) e.inspector = "Choose the inspector.";
			if (n.inspector === ADD_INSPECTOR) {
				if (blank(n.newFirstName)) e.newFirstName = "Enter a first name.";
				else if (n.newFirstName.trim().length > 75)
					e.newFirstName = "Use 75 characters or fewer.";
				if (n.newMiddleName.trim().length > 75)
					e.newMiddleName = "Use 75 characters or fewer.";
				if (blank(n.newLastName)) e.newLastName = "Enter a last name.";
				else if (n.newLastName.trim().length > 75)
					e.newLastName = "Use 75 characters or fewer.";
			}
			break;
		}
	}
	return e;
}