import { isReworkDisposition } from "../ncrConstraints";
import {
	PROCESS_LABELS,
	defaultStatus,
	type FormLookups,
	type InspectorOption,
	type NcrSubmission,
} from "../ncrService";
import {
	ADD_INSPECTOR,
	ADD_SUPPLIER,
	fullName,
	sanitizeTextbox,
	type FormValues,
	type ProcessType,
	type SectionId,
} from "./formModel";

/** One block of the review screen: a section's title and its label and value rows. */
export type ReviewGroup = {
	id: SectionId;
	title: string;
	rows: [string, string][];
};

const supplierOf = (p: FormValues["process"]) =>
	p.supplier === ADD_SUPPLIER ? p.newSupplierName.trim() : p.supplier.trim();

const processLabel = (t: ProcessType) => (t ? PROCESS_LABELS[t] : "");

export function reviewGroups(
	v: FormValues,
	files: File[],
	l: FormLookups,
	existingFiles: string[],
) {
	const yesNo =
		v.defect.isNonconforming === "yes"
			? "Yes"
			: v.defect.isNonconforming === "no"
				? "No"
				: "";
	const fileNames = [
		...existingFiles,
		...(files.length ? files.map((f) => f.name) : v.evidence.fileNames),
	];
	const problems = l.problemTypes
		.filter((t) => v.defect.problemTypeIds.includes(String(t.id)))
		.map((t) => t.label);
	const inspector =
		v.inspector.inspector === ADD_INSPECTOR
			? fullName({
					first: v.inspector.newFirstName.trim(),
					middle: v.inspector.newMiddleName.trim(),
					last: v.inspector.newLastName.trim(),
				})
			: v.inspector.inspector;
	const groups = [
		{
			id: "process" as SectionId,
			title: "Process and source",
			rows: [
				["NCR number", v.process.ncrNumber],
				["Process", processLabel(v.process.processType)],
				["Supplier", supplierOf(v.process) || "In-house production"],
				[
					v.process.processType === "wip"
						? "Production order"
						: "Purchase order",
					v.process.poNumber,
				],
				["Sales order", v.process.salesOrderNumber],
			],
		},
		{
			id: "item" as SectionId,
			title: "Item",
			rows: [
				["Item name", v.item.itemName],
				["SAP number", v.item.itemSapNumber],
				["Description", v.item.itemDescription],
			],
		},
		{
			id: "defect" as SectionId,
			title: "Defect details",
			rows: [
				["Quantity ordered", v.defect.qtyOrdered],
				["Quantity defective", v.defect.qtyDefective],
				["Problem types", problems.join(", ")],
				["Description of defect", v.defect.defectDescription],
				["Marked nonconforming", yesNo],
				[
					"Engineering required",
					v.defect.engineeringRequired === "yes"
						? "Yes"
						: v.defect.engineeringRequired === "no"
							? "No"
							: "",
				],
			],
		},
		{
			id: "evidence" as SectionId,
			title: "Pictures and links",
			rows: [
				["Files", fileNames.join(", ")],
				["Links", v.evidence.links.filter((x) => x.trim()).join(", ")],
			],
		},
		{
			id: "inspector" as SectionId,
			title: "Inspector",
			rows: [["Inspector", inspector]],
		},
		{
			id: "engineering" as SectionId,
			title: "Engineering Disposition",
			rows: [["Engineering instructions", v.engineering.instructions]],
		},
		{
			id: "operations" as SectionId,
			title: "Operations Disposition",
			rows: [
				["Operations disposition", v.operations.disposition],
				...(isReworkDisposition(v.operations.disposition)
					? [["Rework/repair instructions", v.operations.instructions]]
					: []),
				["Operations comments", v.operations.comments],
				["Operations representative", v.operations.representative],
				["Operations date completed", v.operations.dateCompleted],
			],
		},
		{
			id: "procurement" as SectionId,
			title: "Procurement",
			rows: [
				[
					"Communication of a delay due to quality rejection",
					v.procurement.delayCommunication,
				],
			],
		},
		{
			id: "qualityFinalReview" as SectionId,
			title: "Quality Final Review",
			rows: [
				["Final inspection result", v.qualityFinalReview.inspectionResult],
				["Quality comments", v.qualityFinalReview.comments],
				[
					"Final acceptance confirmation",
					v.qualityFinalReview.acceptanceConfirmed === "yes"
						? "Yes"
						: v.qualityFinalReview.acceptanceConfirmed === "no"
							? "No"
							: "",
				],
				["Quality review date", v.qualityFinalReview.dateClosed],
				["Quality reviewer", v.qualityFinalReview.closedBy],
			],
		},
	] as ReviewGroup[];
	return groups.filter(
		(group) =>
			group.id !== "engineering" || v.defect.engineeringRequired === "yes",
	);
}

export function buildSubmission(
	v: FormValues,
	files: File[],
	l: FormLookups,
	currentStatusId: number | null = null,
	createdByPersonId: number | null = null,
): NcrSubmission {
	const p = v.process;
	const status =
		(currentStatusId !== null
			? l.statuses.find((x) => x.id === currentStatusId)
			: undefined) ?? defaultStatus(l.statuses);
	if (!status)
		throw new Error(
			"No NCR statuses were found in the database, so the NCR cannot be saved.",
		);
	let inspector: NcrSubmission["inspector"];
	if (v.inspector.inspector === ADD_INSPECTOR) {
		inspector = {
			kind: "new",
			first: v.inspector.newFirstName.trim(),
			middle: v.inspector.newMiddleName.trim(),
			last: v.inspector.newLastName.trim(),
		};
	} else {
		const known: InspectorOption | undefined = l.inspectors.find(
			(i) => fullName(i) === v.inspector.inspector,
		);
		if (!known)
			throw new Error(
				"The chosen inspector is no longer in the database. Go back and choose the inspector again.",
			);
		inspector = { kind: "existing", personId: known.personId };
	}
	return {
		ncrNumber: p.ncrNumber,
		processApplicable: processLabel(p.processType),
		status,
		supplier: supplierOf(p) || null,
		purchaseOrderNumber: p.poNumber.trim(),
		salesOrderNumber: p.salesOrderNumber.trim(),
		item: {
			name: v.item.itemName.trim(),
			description: v.item.itemDescription.trim(),
			sapNumber: v.item.itemSapNumber.trim(),
		},
		quantityOrdered: Number(v.defect.qtyOrdered),
		quantityDefective: Number(v.defect.qtyDefective),
		problemTypeIds: v.defect.problemTypeIds.map(Number),
		defectDescription: v.defect.defectDescription.trim(),
		isNonconforming: v.defect.isNonconforming === "yes",
		engineeringRequired: v.defect.engineeringRequired === "yes",
		engineeringDisposition:
			v.defect.engineeringRequired === "yes"
				? v.engineering.disposition.trim()
				: "",
		engineeringInstructions:
			v.defect.engineeringRequired === "yes"
				? sanitizeTextbox(v.engineering.instructions).trim()
				: "",
		engineeringComments:
			v.defect.engineeringRequired === "yes"
				? v.engineering.comments.trim()
				: "",
		engineeringRepresentative:
			v.defect.engineeringRequired === "yes"
				? v.engineering.representative.trim()
				: "",
		engineeringDateCompleted:
			v.defect.engineeringRequired === "yes" ? v.engineering.dateCompleted : "",
		operationsDisposition: v.operations.disposition.trim(),
		operationsInstructions: isReworkDisposition(v.operations.disposition)
			? sanitizeTextbox(v.operations.instructions).trim()
			: "",
		operationsComments: v.operations.comments.trim(),
		operationsRepresentative: v.operations.representative.trim(),
		operationsDateCompleted: v.operations.dateCompleted,
		procurementDelayCommunication: sanitizeTextbox(
			v.procurement.delayCommunication,
		).trim(),
		qualityFinalInspectionResult: v.qualityFinalReview.inspectionResult.trim(),
		qualityFinalComments: sanitizeTextbox(v.qualityFinalReview.comments).trim(),
		qualityFinalAcceptanceConfirmed: v.qualityFinalReview.acceptanceConfirmed
			? v.qualityFinalReview.acceptanceConfirmed === "yes"
			: null,
		qualityDateClosed: v.qualityFinalReview.dateClosed,
		qualityClosedBy: v.qualityFinalReview.closedBy.trim(),
		inspector,
		files,
		links: v.evidence.links.map((x) => x.trim()).filter(Boolean),
		createdByPersonId,
	};
}