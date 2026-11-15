import type { ChangeEvent } from "react";
import {
	DEPARTMENT_TEXT_MAX_LENGTH,
	INVALID_TEXT_CONTROLS,
} from "../ncrConstraints";
import {
	PROCESS_LABELS,
	type FormLookups,
	type NcrEditData,
} from "../ncrService";

export const ADD_SUPPLIER = "Not listed: add a new supplier";

export const ADD_INSPECTOR = "Not listed: add a new inspector";

export const fullName = (i: { first: string; middle?: string; last: string }) =>
	[i.first, i.middle, i.last].filter(Boolean).join(" ");

export const messageOf = (e: unknown) =>
	e instanceof Error ? e.message : String(e);

export type ChangeEvt = ChangeEvent<
	HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

export type ProcessType = "" | "supplier" | "wip";

export type YesNo = "" | "yes" | "no";

export interface FormValues {
	process: {
		ncrNumber: string;
		processType: ProcessType;
		supplier: string;
		newSupplierName: string;
		poNumber: string;
		salesOrderNumber: string;
	};
	item: { itemName: string; itemSapNumber: string; itemDescription: string };
	defect: {
		qtyOrdered: string;
		qtyDefective: string;
		problemTypeIds: string[];
		defectDescription: string;
		isNonconforming: YesNo;
		engineeringRequired: YesNo;
	};
	engineering: {
		disposition: string;
		instructions: string;
		comments: string;
		representative: string;
		dateCompleted: string;
	};
	operations: {
		disposition: string;
		instructions: string;
		comments: string;
		representative: string;
		dateCompleted: string;
	};
	procurement: { delayCommunication: string };
	qualityFinalReview: {
		inspectionResult: string;
		comments: string;
		acceptanceConfirmed: YesNo;
		dateClosed: string;
		closedBy: string;
	};
	evidence: { links: string[]; fileNames: string[] };
	inspector: {
		inspector: string;
		newFirstName: string;
		newMiddleName: string;
		newLastName: string;
	};
}

export type SectionId = keyof FormValues;

export type Errors = Record<string, string>;

/**
 * The props every section component receives: its own slice of the form
 * values, the current errors, and update and text helpers already bound to
 * that slice.
 */
export interface SectionProps<K extends SectionId> {
	values: FormValues[K];
	errors: Errors;
	update: (patch: Partial<FormValues[K]>) => void;
	text: (key: keyof FormValues[K]) => (e: ChangeEvt) => void;
}

const BASE_SECTIONS: { id: SectionId | "review"; title: string }[] = [
	{ id: "process", title: "Process and source" },
	{ id: "item", title: "Item" },
	{ id: "defect", title: "Defect details" },
	{ id: "evidence", title: "Pictures and links" },
	{ id: "inspector", title: "Inspector" },
	{ id: "review", title: "Review and submit" },
];

export const SAVED_IDS: SectionId[] = [
	"process",
	"item",
	"defect",
	"engineering",
	"operations",
	"procurement",
	"qualityFinalReview",
	"evidence",
	"inspector",
];

export function sectionsFor(engineeringRequired: boolean) {
	const sections = [...BASE_SECTIONS];
	{
		const reviewIndex = sections.findIndex(
			(section) => section.id === "review",
		);
		sections.splice(reviewIndex, 0, {
			id: "qualityFinalReview",
			title: "Quality Final Review",
		});
	}
	let workflowIndex = sections.findIndex(
		(section) => section.id === "qualityFinalReview",
	);
	if (workflowIndex < 0) {
		workflowIndex = sections.findIndex((section) => section.id === "review");
	}
	if (engineeringRequired) {
		sections.splice(workflowIndex, 0, {
			id: "engineering",
			title: "Engineering Disposition",
		});
		workflowIndex++;
	}
	{
		sections.splice(workflowIndex, 0, {
			id: "operations",
			title: "Operations Disposition",
		});
		workflowIndex++;
	}
	{
		sections.splice(workflowIndex, 0, {
			id: "procurement",
			title: "Procurement",
		});
	}
	return sections;
}

export const makeDefaults = (ncrNumber: string): FormValues => ({
	process: {
		ncrNumber,
		processType: "",
		supplier: "",
		newSupplierName: "",
		poNumber: "",
		salesOrderNumber: "",
	},
	item: { itemName: "", itemSapNumber: "", itemDescription: "" },
	defect: {
		qtyOrdered: "",
		qtyDefective: "",
		problemTypeIds: [],
		defectDescription: "",
		isNonconforming: "",
		engineeringRequired: "",
	},
	engineering: {
		disposition: "",
		instructions: "",
		comments: "",
		representative: "",
		dateCompleted: "",
	},
	operations: {
		disposition: "",
		instructions: "",
		comments: "",
		representative: "",
		dateCompleted: "",
	},
	procurement: { delayCommunication: "" },
	qualityFinalReview: {
		inspectionResult: "",
		comments: "",
		acceptanceConfirmed: "",
		dateClosed: "",
		closedBy: "",
	},
	evidence: { links: [""], fileNames: [] },
	inspector: {
		inspector: "",
		newFirstName: "",
		newMiddleName: "",
		newLastName: "",
	},
});

export function sanitize(v: FormValues, l: FormLookups): FormValues {
	const validIds = new Set(l.problemTypes.map((t) => String(t.id)));
	const names = l.inspectors.map(fullName);
	const keep =
		v.inspector.inspector === ADD_INSPECTOR ||
		names.includes(v.inspector.inspector);
	return {
		...v,
		defect: {
			...v.defect,
			problemTypeIds: v.defect.problemTypeIds.filter((id) => validIds.has(id)),
		},
		engineering: {
			...v.engineering,
			instructions: sanitizeTextbox(v.engineering.instructions),
		},
		operations: {
			...v.operations,
			instructions: sanitizeTextbox(v.operations.instructions),
			comments: sanitizeTextbox(v.operations.comments),
		},
		procurement: {
			...v.procurement,
			delayCommunication: sanitizeTextbox(v.procurement.delayCommunication),
		},
		qualityFinalReview: {
			...v.qualityFinalReview,
			comments: sanitizeTextbox(v.qualityFinalReview.comments),
		},
		inspector: keep ? v.inspector : { ...v.inspector, inspector: "" },
	};
}

const processTypeOf = (label: string): ProcessType =>
	label === PROCESS_LABELS.supplier
		? "supplier"
		: label === PROCESS_LABELS.wip
			? "wip"
			: "";

const dateForInput = (value: string | null | undefined) =>
	typeof value === "string" ? value.slice(0, 10) : "";

export function toFormValues(ed: NcrEditData): FormValues {
	return {
		process: {
			ncrNumber: ed.ncrNumber,
			processType: processTypeOf(ed.processApplicable),
			supplier: ed.supplier ?? "",
			newSupplierName: "",
			poNumber: ed.purchaseOrderNumber,
			salesOrderNumber: ed.salesOrderNumber,
		},
		item: {
			itemName: ed.item.name,
			itemSapNumber: ed.item.sapNumber,
			itemDescription: ed.item.description,
		},
		defect: {
			qtyOrdered: ed.quantityOrdered === null ? "" : String(ed.quantityOrdered),
			qtyDefective:
				ed.quantityDefective === null ? "" : String(ed.quantityDefective),
			problemTypeIds: ed.problemTypeIds.map(String),
			defectDescription: ed.defectDescription,
			isNonconforming:
				ed.isNonconforming === null ? "" : ed.isNonconforming ? "yes" : "no",
			engineeringRequired:
				ed.engineeringRequired === null
					? ""
					: ed.engineeringRequired
						? "yes"
						: "no",
		},
		engineering: {
			disposition: ed.engineeringDisposition ?? "",
			instructions: ed.engineeringInstructions ?? "",
			comments: ed.engineeringComments ?? "",
			representative: ed.engineeringRepresentative ?? "",
			dateCompleted: dateForInput(ed.engineeringDateCompleted),
		},
		operations: {
			disposition: ed.operationsDisposition ?? "",
			instructions: ed.operationsInstructions ?? "",
			comments: ed.operationsComments ?? "",
			representative: ed.operationsRepresentative ?? "",
			dateCompleted: dateForInput(ed.operationsDateCompleted),
		},
		procurement: { delayCommunication: ed.procurementDelayCommunication ?? "" },
		qualityFinalReview: {
			inspectionResult: ed.qualityFinalInspectionResult ?? "",
			comments: ed.qualityFinalComments ?? "",
			acceptanceConfirmed:
				ed.qualityFinalAcceptanceConfirmed === null
					? ""
					: ed.qualityFinalAcceptanceConfirmed
						? "yes"
						: "no",
			dateClosed: dateForInput(ed.qualityDateClosed),
			closedBy: ed.qualityClosedBy ?? "",
		},
		evidence: { links: ed.links.length ? ed.links : [""], fileNames: [] },
		inspector: {
			inspector: fullName(ed.inspector),
			newFirstName: "",
			newMiddleName: "",
			newLastName: "",
		},
	};
}

export function addEditOptions(
	l: FormLookups,
	ed: NcrEditData | null,
): FormLookups {
	if (!ed) return l;
	const suppliers =
		ed.supplier && !l.suppliers.some((s) => s.name === ed.supplier)
			? [...l.suppliers, { id: 0, name: ed.supplier }]
			: l.suppliers;
	const label = fullName(ed.inspector);
	const inspectors =
		label && !l.inspectors.some((i) => fullName(i) === label)
			? [
					...l.inspectors,
					{
						personId: ed.inspector.personId,
						first: ed.inspector.first,
						middle: ed.inspector.middle,
						last: ed.inspector.last,
					},
				]
			: l.inspectors;
	return { ...l, suppliers, inspectors };
}

export const sanitizeTextbox = (value: string) =>
	value.replace(INVALID_TEXT_CONTROLS, "");

export const countHelp = (used: number) =>
	`Up to ${DEPARTMENT_TEXT_MAX_LENGTH} characters. ${used} used.`;

/** Today's date in the person's own time zone, as YYYY-MM-DD for a date column. */
export function todayLocal() {
	const d = new Date();
	const two = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

export const focusIdFor = (key: string) =>
	key === "processType"
		? "processType-supplier"
		: key === "isNonconforming"
			? "isNonconforming-yes"
			: key === "engineeringRequired"
				? "engineeringRequired-yes"
				: key === "qualityAcceptanceConfirmed"
					? "qualityAcceptanceConfirmed-yes"
					: key;

export const formatSize = (bytes: number) =>
	bytes < 1024 * 1024
		? `${Math.max(1, Math.round(bytes / 1024))} KB`
		: `${(bytes / 1024 / 1024).toFixed(1)} MB`;