import { useEffect, useRef, useState } from "react";
import Input from "./input";

/* ------------------------------------------------------------------ */
/* Placeholder lookup data. Replace with API data once a backend exists. */
/* ------------------------------------------------------------------ */
const SUPPLIERS = [
	"Acme Fasteners Ltd.",
	"Northern Steel Supply",
	"Precision Castings Inc.",
];
const ADD_SUPPLIER = "Not listed: add a new supplier";

const PROBLEM_TYPES = [
	{ label: "Dimension out of tolerance", description: "A measurement is outside the tolerance on the drawing." },
	{ label: "Wrong material", description: "The material does not match the order or the drawing." },
	{ label: "Surface finish or coating", description: "Scratches, rust, poor plating, paint or coating faults." },
	{ label: "Damaged in shipping", description: "The item was damaged on the way to us." },
	{ label: "Wrong item or quantity", description: "We received a different item, or a different amount than ordered." },
	{ label: "Missing paperwork or certificates", description: "Material certificates or other required documents are missing." },
	{ label: "Other", description: "Anything not covered above. Explain it in the defect description." },
];

interface InspectorRecord { first: string; middle: string; last: string }
const INSPECTORS: InspectorRecord[] = [
	{ first: "Jordan", middle: "", last: "Smith" },
	{ first: "Priya", middle: "R.", last: "Nair" },
	{ first: "Marc", middle: "", last: "Tremblay" },
];
const CURRENT_USER = INSPECTORS[0]; // TODO: replace with the signed-in user
const ADD_INSPECTOR = "Not listed: add a new inspector";
const fullName = (i: { first: string; middle?: string; last: string }) =>
	[i.first, i.middle, i.last].filter(Boolean).join(" ");

/* ------------------------------------------------------------------ */
/* Types and defaults                                                  */
/* ------------------------------------------------------------------ */
type ChangeEvt = React.ChangeEvent<
	HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;
type ProcessType = "" | "supplier" | "wip";
type YesNo = "" | "yes" | "no";

interface FormValues {
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
		qtyReceived: string;
		qtyDefective: string;
		problemType: string;
		defectDescription: string;
		isNonconforming: YesNo;
	};
	evidence: { links: string[]; fileNames: string[] };
	inspector: {
		inspector: string;
		newFirstName: string;
		newMiddleName: string;
		newLastName: string;
	};
}
type SectionId = keyof FormValues;
type Errors = Record<string, string>;

const SECTIONS: { id: SectionId | "review"; title: string }[] = [
	{ id: "process", title: "Process and source" },
	{ id: "item", title: "Item" },
	{ id: "defect", title: "Defect details" },
	{ id: "evidence", title: "Pictures and links" },
	{ id: "inspector", title: "Inspector" },
	{ id: "review", title: "Review and submit" },
];
const SAVED_IDS: SectionId[] = ["process", "item", "defect", "evidence", "inspector"];
const REVIEW_STEP = SECTIONS.length - 1;

const makeDefaults = (ncrNumber: string): FormValues => ({
	process: { ncrNumber, processType: "", supplier: "", newSupplierName: "", poNumber: "", salesOrderNumber: "" },
	item: { itemName: "", itemSapNumber: "", itemDescription: "" },
	defect: { qtyReceived: "", qtyDefective: "", problemType: "", defectDescription: "", isNonconforming: "" },
	evidence: { links: [""], fileNames: [] },
	inspector: { inspector: fullName(CURRENT_USER), newFirstName: "", newMiddleName: "", newLastName: "" },
});

/* ------------------------------------------------------------------ */
/* Storage (localStorage, one key per section)                         */
/* ------------------------------------------------------------------ */
const sectionKey = (id: SectionId) => `ncr-draft:${id}`;
const LAST_NUMBER_KEY = "ncr-last-number";

function readSection(id: SectionId): unknown {
	try {
		const raw = window.localStorage.getItem(sectionKey(id));
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
function writeSection(id: SectionId, data: unknown): boolean {
	try {
		window.localStorage.setItem(sectionKey(id), JSON.stringify(data));
		return true;
	} catch {
		return false;
	}
}
function clearDrafts() {
	try {
		SAVED_IDS.forEach((id) => window.localStorage.removeItem(sectionKey(id)));
	} catch {
		/* storage unavailable */
	}
}
/* Stand-in for the NCR log: next number in the sequence, format YYYY-NNN. */
function nextNcrNumber(): string {
	const year = new Date().getFullYear();
	let seq = 0;
	try {
		const m = window.localStorage.getItem(LAST_NUMBER_KEY)?.match(/^(\d{4})-(\d{3})$/);
		if (m && Number(m[1]) === year) seq = Number(m[2]);
	} catch {
		/* storage unavailable */
	}
	return `${year}-${String(seq + 1).padStart(3, "0")}`;
}

function loadDrafts() {
	const values = makeDefaults(nextNcrNumber());
	const saved = Object.fromEntries(SAVED_IDS.map((id) => [id, false])) as Record<SectionId, boolean>;
	let any = false;
	for (const id of SAVED_IDS) {
		const stored = readSection(id);
		if (stored && typeof stored === "object") {
			(values as Record<SectionId, unknown>)[id] = { ...values[id], ...stored };
			saved[id] = true;
			any = true;
		}
	}
	if (!Array.isArray(values.evidence.links) || values.evidence.links.length === 0) {
		values.evidence.links = [""];
	}
	const firstUnsaved = SAVED_IDS.findIndex((id) => !saved[id]);
	return { values, saved, any, step: firstUnsaved === -1 ? REVIEW_STEP : firstUnsaved };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */
const DIGITS = /^\d{1,18}$/; // BIGINT-safe
const POSITIVE_INT = /^[1-9]\d{0,8}$/; // fits a 32-bit INT
const blank = (s: string) => !s.trim();

function validate(id: SectionId, v: FormValues, files: File[], forSubmit: boolean): Errors {
	const e: Errors = {};
	switch (id) {
		case "process": {
			const p = v.process;
			const isSupplier = p.processType === "supplier";
			if (!p.processType) e.processType = "Choose which process this report covers.";
			if (isSupplier && !p.supplier) e.supplier = "Choose a supplier from the list.";
			if (p.supplier === ADD_SUPPLIER) {
				if (blank(p.newSupplierName)) e.newSupplierName = "Enter the supplier's name.";
				else if (p.newSupplierName.trim().length > 75) e.newSupplierName = "Use 75 characters or fewer.";
			}
			if (blank(p.poNumber)) {
				if (isSupplier) e.poNumber = "Enter the purchase order number.";
			} else if (!DIGITS.test(p.poNumber.trim())) {
				e.poNumber = "Use digits only, up to 18. Remove spaces, dashes and letters.";
			}
			if (!blank(p.salesOrderNumber) && !DIGITS.test(p.salesOrderNumber.trim())) {
				e.salesOrderNumber = "Use digits only, up to 18. Remove spaces, dashes and letters.";
			}
			break;
		}
		case "item": {
			const i = v.item;
			if (blank(i.itemName)) e.itemName = "Enter the item name.";
			else if (i.itemName.trim().length > 100) e.itemName = "Use 100 characters or fewer.";
			if (blank(i.itemSapNumber)) e.itemSapNumber = "Enter the SAP number.";
			else if (i.itemSapNumber.trim().length > 20) e.itemSapNumber = "Use 20 characters or fewer.";
			break;
		}
		case "defect": {
			const d = v.defect;
			const received = d.qtyReceived.trim();
			const defective = d.qtyDefective.trim();
			if (!POSITIVE_INT.test(received)) e.qtyReceived = "Enter a whole number of 1 or more.";
			if (!POSITIVE_INT.test(defective)) e.qtyDefective = "Enter a whole number of 1 or more.";
			else if (POSITIVE_INT.test(received) && Number(defective) > Number(received)) {
				e.qtyDefective = "This cannot be more than the quantity received.";
			}
			if (!d.problemType) e.problemType = "Choose the problem type that fits best.";
			if (blank(d.defectDescription)) e.defectDescription = "Describe the defect.";
			if (!d.isNonconforming) e.isNonconforming = "Choose Yes or No.";
			break;
		}
		case "evidence": {
			v.evidence.links.forEach((link, i) => {
				const t = link.trim();
				if (!t) return;
				if (t.length > 500) {
					e[`link-${i}`] = "Use 500 characters or fewer.";
					return;
				}
				try {
					if (!/^https?:$/.test(new URL(t).protocol)) throw new Error("protocol");
				} catch {
					e[`link-${i}`] = "Enter a full web address that starts with http:// or https://.";
				}
			});
			const bad = files.find((f) => !(f.type.startsWith("image/") || f.type === "application/pdf"));
			if (bad) e.files = `"${bad.name}" is not a picture or PDF. Remove it and choose the files again.`;
			else if (forSubmit && v.evidence.fileNames.length > 0 && files.length === 0) {
				e.files = "Your saved draft lists files, but the browser does not keep files after a reload. Choose them again, or remove the saved file names.";
			}
			break;
		}
		case "inspector": {
			const n = v.inspector;
			if (!n.inspector) e.inspector = "Choose the inspector.";
			if (n.inspector === ADD_INSPECTOR) {
				if (blank(n.newFirstName)) e.newFirstName = "Enter a first name.";
				else if (n.newFirstName.trim().length > 20) e.newFirstName = "Use 20 characters or fewer.";
				if (n.newMiddleName.trim().length > 20) e.newMiddleName = "Use 20 characters or fewer.";
				if (blank(n.newLastName)) e.newLastName = "Enter a last name.";
				else if (n.newLastName.trim().length > 20) e.newLastName = "Use 20 characters or fewer.";
			}
			break;
		}
	}
	return e;
}

const focusIdFor = (key: string) =>
	key === "processType" ? "processType-supplier" : key === "isNonconforming" ? "isNonconforming-yes" : key;

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const formatSize = (bytes: number) =>
	bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */
function RadioGroup(props: {
	id: string;
	legend: string;
	required?: boolean;
	helpText?: string;
	error?: string;
	children: React.ReactNode;
}) {
	const { id, legend, required, helpText, error, children } = props;
	const describedBy = [helpText && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
	return (
		<fieldset className="ncr-fieldset" aria-describedby={describedBy}>
			<legend>
				{legend}
				{required && <span className="ncr-req"> (required)</span>}
			</legend>
			{helpText && <p id={`${id}-help`} className="ncr-help">{helpText}</p>}
			{children}
			{error && (
				<p id={`${id}-error`} className="ncr-error">
					<strong>Error: </strong>
					{error}
				</p>
			)}
		</fieldset>
	);
}

/* ------------------------------------------------------------------ */
/* The form                                                            */
/* ------------------------------------------------------------------ */
export default function NcrForm() {
	const [hydrated, setHydrated] = useState(false);
	const [values, setValues] = useState<FormValues>(() => makeDefaults(""));
	const [saved, setSaved] = useState<Record<SectionId, boolean>>(
		() => Object.fromEntries(SAVED_IDS.map((id) => [id, false])) as Record<SectionId, boolean>,
	);
	const [hasDraft, setHasDraft] = useState(false);
	const [step, setStep] = useState(0);
	const [errors, setErrors] = useState<Errors>({});
	const [files, setFiles] = useState<File[]>([]);
	const [fileInputKey, setFileInputKey] = useState(0);
	const [signedAt, setSignedAt] = useState("");
	const [status, setStatus] = useState("");
	const [submitted, setSubmitted] = useState<string | null>(null);

	const headingRef = useRef<HTMLHeadingElement>(null);
	const summaryRef = useRef<HTMLElement>(null);
	const focusHeading = useRef(false);
	const focusSummary = useRef(false);
	const pendingFocus = useRef<string | null>(null);

	/* Load saved sections on first render in the browser. */
	useEffect(() => {
		const d = loadDrafts();
		setValues(d.values);
		setSaved(d.saved);
		setHasDraft(d.any);
		setStep(d.step);
		if (d.any) setStatus("Your saved sections were restored. You are on the first section that is not saved yet.");
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (step >= SAVED_IDS.indexOf("inspector")) setSignedAt(toLocalInput(new Date()));
		if (focusHeading.current) {
			headingRef.current?.focus();
			focusHeading.current = false;
		}
	}, [step, submitted]);

	useEffect(() => {
		if (focusSummary.current && summaryRef.current) {
			summaryRef.current.focus();
			focusSummary.current = false;
		}
	}, [errors]);

	useEffect(() => {
		if (pendingFocus.current) {
			document.getElementById(pendingFocus.current)?.focus();
			pendingFocus.current = null;
		}
	});

	function goTo(i: number) {
		setStep(i);
		setErrors({});
		focusHeading.current = true;
	}

	function update<K extends SectionId>(section: K, patch: Partial<FormValues[K]>) {
		setValues((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
		setSaved((prev) => ({ ...prev, [section]: false }));
		setErrors((prev) => {
			const next = { ...prev };
			for (const key of Object.keys(patch)) {
				delete next[key];
				if (key === "links") Object.keys(next).filter((k) => k.startsWith("link-")).forEach((k) => delete next[k]);
				if (key === "fileNames") delete next.files;
			}
			return next;
		});
	}

	const text =
		<K extends SectionId>(section: K, key: keyof FormValues[K]) =>
		(e: ChangeEvt) =>
			update(section, { [key]: e.target.value } as Partial<FormValues[K]>);

	function showErrors(found: Errors) {
		setErrors(found);
		focusSummary.current = true;
		const n = Object.keys(found).length;
		setStatus(`This section has ${n} ${n === 1 ? "problem" : "problems"}. Fix them and try again.`);
	}

	function saveAndContinue() {
		const id = SECTIONS[step].id as SectionId;
		const found = validate(id, values, files, false);
		if (Object.keys(found).length) return showErrors(found);
		const ok = writeSection(id, values[id]);
		setSaved((prev) => ({ ...prev, [id]: ok }));
		setHasDraft((prev) => prev || ok);
		goTo(step + 1);
		setStatus(
			ok
				? `${SECTIONS[step].title} saved. Now on section ${step + 2} of ${SECTIONS.length}: ${SECTIONS[step + 1].title}.`
				: "Your answers are on screen, but this browser blocked saving. Now on the next section.",
		);
	}

	function submit() {
		for (let i = 0; i < SAVED_IDS.length; i++) {
			const found = validate(SAVED_IDS[i], values, files, true);
			if (Object.keys(found).length) {
				goTo(i);
				showErrors(found);
				return;
			}
		}
		const payload = buildPayload(values, files);
		console.log("NCR submission", payload);
		console.log("Files to upload", files);
		try {
			window.localStorage.setItem(LAST_NUMBER_KEY, values.process.ncrNumber);
		} catch {
			/* storage unavailable */
		}
		clearDrafts();
		setHasDraft(false);
		setSubmitted(values.process.ncrNumber);
		focusHeading.current = true;
		setStatus(`NCR ${values.process.ncrNumber} submitted.`);
	}

	function resetForm(message: string) {
		setValues(makeDefaults(nextNcrNumber()));
		setSaved(Object.fromEntries(SAVED_IDS.map((id) => [id, false])) as Record<SectionId, boolean>);
		setFiles([]);
		setFileInputKey((k) => k + 1);
		goTo(0);
		setStatus(message);
	}

	function restoreSaved() {
		const d = loadDrafts();
		setValues(d.values);
		setSaved(d.saved);
		setFiles([]);
		setFileInputKey((k) => k + 1);
		goTo(d.step);
		setStatus("Your saved sections were restored.");
	}

	/* --- derived values --- */
	const p = values.process;
	const isSupplierProcess = p.processType === "supplier";
	const problem = PROBLEM_TYPES.find((t) => t.label === values.defect.problemType);
	const links = values.evidence.links;
	const current = SECTIONS[step];
	const errorKeys = Object.keys(errors);

	if (!hydrated) return <p role="status">Loading form...</p>;

	if (submitted) {
		return (
			<div className="ncr-form">
				<h1 ref={headingRef} tabIndex={-1}>NCR {submitted} submitted</h1>
				<p>The report was written to the browser console. Nothing was sent to a server.</p>
				<button type="button" className="ncr-btn ncr-btn-primary" onClick={() => { setSubmitted(null); resetForm("Started a new NCR."); }}>
					Start a new NCR
				</button>
				<p role="status" className="ncr-status">{status}</p>
				<FormStyles />
			</div>
		);
	}

	return (
		<form
			className="ncr-form"
			noValidate
			aria-labelledby="ncr-title"
			onSubmit={(e) => {
				e.preventDefault();
				if (step === REVIEW_STEP) submit();
				else saveAndContinue();
			}}
		>
			<h1 id="ncr-title">Non-conformance report (NCR)</h1>

			<nav aria-label="Form sections" className="ncr-steps">
				<ol>
					{SECTIONS.map((s, i) => {
						const state =
							s.id === "review" ? "" : saved[s.id as SectionId] ? "Saved" : "Not saved";
						return (
							<li key={s.id}>
								<button
									type="button"
									className="ncr-step-btn"
									aria-current={i === step ? "step" : undefined}
									onClick={() => goTo(i)}
								>
									{i + 1}. {s.title}
									{state && <span className="ncr-step-state">{state}</span>}
								</button>
							</li>
						);
					})}
				</ol>
			</nav>

			<div className="ncr-tools">
				<button
					type="button"
					className="ncr-btn"
					onClick={() => {
						if (window.confirm("Clear everything on screen? Sections you already saved stay stored, and you can restore them.")) {
							resetForm("Form cleared. Your saved sections are still stored. Choose Restore saved sections to bring them back.");
						}
					}}
				>
					Reset form
				</button>
				{hasDraft && (
					<button type="button" className="ncr-btn" onClick={restoreSaved}>
						Restore saved sections
					</button>
				)}
			</div>

			<p role="status" className="ncr-status">{status}</p>

			<div className="ncr-section">
				<p className="ncr-progress">Section {step + 1} of {SECTIONS.length}</p>
				<h2 ref={headingRef} tabIndex={-1}>{current.title}</h2>
				<p className="ncr-help">Fields marked (required) must be filled in before you can save this section.</p>

				{errorKeys.length > 0 && (
					<section ref={summaryRef} tabIndex={-1} className="ncr-error-summary" aria-labelledby="ncr-error-title">
						<h3 id="ncr-error-title">
							{errorKeys.length === 1 ? "There is 1 problem" : `There are ${errorKeys.length} problems`} in this section
						</h3>
						<ul>
							{errorKeys.map((k) => (
								<li key={k}>
									<a
										href={`#${focusIdFor(k)}`}
										onClick={(e) => {
											e.preventDefault();
											document.getElementById(focusIdFor(k))?.focus();
										}}
									>
										{errors[k]}
									</a>
								</li>
							))}
						</ul>
					</section>
				)}

				{current.id === "process" && (
					<>
						<Input type={Input.TEXT} name="ncrNumber" label="NCR number" value={p.ncrNumber} readOnly
							helpText="Assigned for you in the format year-number. You cannot change it." />
						<RadioGroup id="processType" legend="Which process does this report cover?" required
							helpText="Choose Supplier or receiving inspection for purchased items. Choose Work in progress for items made in-house."
							error={errors.processType}>
							<Input type={Input.RADIO} name="processType-supplier" groupName="processType" value="supplier"
								label="Supplier or receiving inspection" checked={p.processType === "supplier"} required
								onChange={() => update("process", { processType: "supplier" })} />
							<Input type={Input.RADIO} name="processType-wip" groupName="processType" value="wip"
								label="Work in progress (production order)" checked={p.processType === "wip"} required
								onChange={() => update("process", { processType: "wip" })} />
						</RadioGroup>
						<Input type={Input.DROPDOWN} name="supplier" label={isSupplierProcess ? "Supplier" : "Supplier (optional)"}
							items={[...SUPPLIERS, ADD_SUPPLIER]} value={p.supplier} required={isSupplierProcess}
							onChange={text("process", "supplier")} error={errors.supplier}
							helpText="Pick the supplier that sent the item." />
						{p.supplier === ADD_SUPPLIER && (
							<Input type={Input.TEXT} name="newSupplierName" label="New supplier name" value={p.newSupplierName}
								required maxLength={75} placeholder="e.g. Lakeshore Tooling Co." autoComplete="off"
								onChange={text("process", "newSupplierName")} error={errors.newSupplierName} />
						)}
						<Input type={Input.TEXT} name="poNumber"
							label={isSupplierProcess ? "Purchase order number" : "Production order number (optional)"}
							value={p.poNumber} required={isSupplierProcess} inputMode="numeric" maxLength={18} autoComplete="off"
							placeholder="e.g. 4500123456" helpText="Type it exactly as it appears on the paperwork. Digits only."
							onChange={text("process", "poNumber")} error={errors.poNumber} />
						<Input type={Input.TEXT} name="salesOrderNumber" label="Sales order number (optional)"
							value={p.salesOrderNumber} inputMode="numeric" maxLength={18} autoComplete="off"
							placeholder="e.g. 1012345" helpText="Digits only. Leave empty if there is none."
							onChange={text("process", "salesOrderNumber")} error={errors.salesOrderNumber} />
					</>
				)}

				{current.id === "item" && (
					<>
						<Input type={Input.TEXT} name="itemName" label="Item name" value={values.item.itemName} required
							maxLength={100} autoComplete="off" placeholder="e.g. Hydraulic fitting, 1/2 in"
							onChange={text("item", "itemName")} error={errors.itemName} />
						<Input type={Input.TEXT} name="itemSapNumber" label="SAP number" value={values.item.itemSapNumber} required
							maxLength={20} autoComplete="off" placeholder="e.g. 100234567"
							onChange={text("item", "itemSapNumber")} error={errors.itemSapNumber} />
						<Input type={Input.PARAGRAPH} name="itemDescription" label="Item description (optional)"
							value={values.item.itemDescription} placeholder="e.g. Stainless steel, drawing rev C, lot 24-0815"
							helpText="Add anything that helps identify the item, such as material, revision or lot."
							onChange={text("item", "itemDescription")} />
					</>
				)}

				{current.id === "defect" && (
					<>
						<Input type={Input.NUMBER} name="qtyReceived" label="Quantity received" value={values.defect.qtyReceived}
							required min={1} step={1} inputMode="numeric" placeholder="e.g. 50"
							onChange={text("defect", "qtyReceived")} error={errors.qtyReceived} />
						<Input type={Input.NUMBER} name="qtyDefective" label="Quantity defective" value={values.defect.qtyDefective}
							required min={1} max={values.defect.qtyReceived || undefined} step={1} inputMode="numeric" placeholder="e.g. 3"
							helpText="Count only the items that do not meet requirements."
							onChange={text("defect", "qtyDefective")} error={errors.qtyDefective} />
						<Input type={Input.DROPDOWN} name="problemType" label="Problem type" items={PROBLEM_TYPES.map((t) => t.label)}
							value={values.defect.problemType} required
							helpText={problem ? problem.description : "Pick the closest match. A short description appears here."}
							onChange={text("defect", "problemType")} error={errors.problemType} />
						<Input type={Input.PARAGRAPH} name="defectDescription" label="Description of defect"
							value={values.defect.defectDescription} required
							placeholder="Say what is wrong, where on the item, and how you found it. Include measurements if you have them."
							onChange={text("defect", "defectDescription")} error={errors.defectDescription} />
						<RadioGroup id="isNonconforming" legend="Is the item marked as nonconforming?" required
							helpText="Choose Yes if the item has been tagged or marked as nonconforming." error={errors.isNonconforming}>
							<Input type={Input.RADIO} name="isNonconforming-yes" groupName="isNonconforming" value="yes" label="Yes"
								checked={values.defect.isNonconforming === "yes"} required
								onChange={() => update("defect", { isNonconforming: "yes" })} />
							<Input type={Input.RADIO} name="isNonconforming-no" groupName="isNonconforming" value="no" label="No"
								checked={values.defect.isNonconforming === "no"} required
								onChange={() => update("defect", { isNonconforming: "no" })} />
						</RadioGroup>
					</>
				)}

				{current.id === "evidence" && (
					<>
						<Input key={fileInputKey} type={Input.FILE} name="files" label="Pictures, screenshots and PDFs (optional)"
							accept="image/*,application/pdf" multiple error={errors.files}
							helpText="You can choose more than one file. To change your choice, choose the files again."
							onChange={(e) => {
								const list = Array.from((e.target as HTMLInputElement).files ?? []);
								setFiles(list);
								update("evidence", { fileNames: list.map((f) => f.name) });
							}} />
						{files.length > 0 && (
							<ul className="ncr-file-list" aria-label="Chosen files">
								{files.map((f) => (
									<li key={`${f.name}-${f.size}`}>{f.name} ({formatSize(f.size)})</li>
								))}
							</ul>
						)}
						{files.length === 0 && values.evidence.fileNames.length > 0 && (
							<div className="ncr-note">
								<p>
									Your last save listed these files: {values.evidence.fileNames.join(", ")}. Browsers cannot keep
									files after a reload, so choose them again before you submit.
								</p>
								<button type="button" className="ncr-btn" onClick={() => update("evidence", { fileNames: [] })}>
									Remove saved file names
								</button>
							</div>
						)}
						<fieldset className="ncr-fieldset" aria-describedby="links-help">
							<legend>Links to videos or online pictures (optional)</legend>
							<p id="links-help" className="ncr-help">Paste the full web address. Use one box for each link.</p>
							{links.map((link, i) => (
								<div key={i} className="ncr-link-row">
									<Input type={Input.URL} name={`link-${i}`} label={`Link ${i + 1}`} value={link} maxLength={500}
										autoComplete="off" placeholder="https://example.com/video"
										onChange={(e) => update("evidence", { links: links.map((l, idx) => (idx === i ? e.target.value : l)) })}
										error={errors[`link-${i}`]} />
									{(links.length > 1 || link) && (
										<button type="button" className="ncr-btn" onClick={() => {
											const next = links.filter((_, idx) => idx !== i);
											update("evidence", { links: next.length ? next : [""] });
											pendingFocus.current = "add-link";
										}}>
											Remove link {i + 1}
										</button>
									)}
								</div>
							))}
							<button id="add-link" type="button" className="ncr-btn" onClick={() => {
								update("evidence", { links: [...links, ""] });
								pendingFocus.current = `link-${links.length}`;
							}}>
								Add another link
							</button>
						</fieldset>
					</>
				)}

				{current.id === "inspector" && (
					<>
						<Input type={Input.DROPDOWN} name="inspector" label="Inspector name"
							items={[...INSPECTORS.map(fullName), ADD_INSPECTOR]} value={values.inspector.inspector} required
							helpText="Filled in with your name. Change it if someone else did the inspection."
							onChange={text("inspector", "inspector")} error={errors.inspector} />
						{values.inspector.inspector === ADD_INSPECTOR && (
							<>
								<Input type={Input.TEXT} name="newFirstName" label="First name" value={values.inspector.newFirstName}
									required maxLength={20} autoComplete="off" onChange={text("inspector", "newFirstName")} error={errors.newFirstName} />
								<Input type={Input.TEXT} name="newMiddleName" label="Middle name (optional)" value={values.inspector.newMiddleName}
									maxLength={20} autoComplete="off" onChange={text("inspector", "newMiddleName")} error={errors.newMiddleName} />
								<Input type={Input.TEXT} name="newLastName" label="Last name" value={values.inspector.newLastName}
									required maxLength={20} autoComplete="off" onChange={text("inspector", "newLastName")} error={errors.newLastName} />
							</>
						)}
						<Input type={Input.DATETIME} name="signedAt" label="Signed date and time" value={signedAt} readOnly
							helpText="Set to the exact time when you submit the report." />
					</>
				)}

				{current.id === "review" && (
					<>
						<p>Check each part. Choose Change to fix something, then save that section again.</p>
						{reviewGroups(values, files).map((g) => (
							<section key={g.id} className="ncr-review-group" aria-labelledby={`review-${g.id}`}>
								<div className="ncr-review-head">
									<h3 id={`review-${g.id}`}>{g.title}</h3>
									<button type="button" className="ncr-btn" onClick={() => goTo(SAVED_IDS.indexOf(g.id))}>
										Change {g.title.toLowerCase()}
									</button>
								</div>
								{!saved[g.id] && (
									<p className="ncr-help">This section is not saved yet. Saved sections come back if the page reloads.</p>
								)}
								<dl>
									{g.rows.map(([label, value]) => (
										<div key={label} className="ncr-review-row">
											<dt>{label}</dt>
											<dd>{value || "Not provided"}</dd>
										</div>
									))}
								</dl>
							</section>
						))}
					</>
				)}

				<div className="ncr-actions">
					{step > 0 && (
						<button type="button" className="ncr-btn" onClick={() => goTo(step - 1)}>
							Back
						</button>
					)}
					<button type="submit" className="ncr-btn ncr-btn-primary">
						{step === REVIEW_STEP ? "Submit NCR" : "Save and continue"}
					</button>
				</div>
			</div>
			<FormStyles />
		</form>
	);
}

/* ------------------------------------------------------------------ */
/* Review summary and payload (shaped like the data model)             */
/* ------------------------------------------------------------------ */
const supplierOf = (p: FormValues["process"]) =>
	p.supplier === ADD_SUPPLIER ? p.newSupplierName.trim() : p.supplier;
const processLabel = (t: ProcessType) =>
	t === "supplier" ? "Supplier or Rec-Insp" : t === "wip" ? "WIP (Production Order)" : "";
const inspectorOf = (n: FormValues["inspector"]) =>
	n.inspector === ADD_INSPECTOR
		? { first: n.newFirstName.trim(), middle: n.newMiddleName.trim(), last: n.newLastName.trim() }
		: INSPECTORS.find((i) => fullName(i) === n.inspector) ?? { first: n.inspector, middle: "", last: "" };

function reviewGroups(v: FormValues, files: File[]) {
	const yesNo = v.defect.isNonconforming === "yes" ? "Yes" : v.defect.isNonconforming === "no" ? "No" : "";
	const fileNames = files.length ? files.map((f) => f.name) : v.evidence.fileNames;
	return [
		{ id: "process" as SectionId, title: "Process and source", rows: [
			["NCR number", v.process.ncrNumber], ["Process", processLabel(v.process.processType)],
			["Supplier", supplierOf(v.process)], ["Purchase or production order", v.process.poNumber],
			["Sales order", v.process.salesOrderNumber]] },
		{ id: "item" as SectionId, title: "Item", rows: [
			["Item name", v.item.itemName], ["SAP number", v.item.itemSapNumber], ["Description", v.item.itemDescription]] },
		{ id: "defect" as SectionId, title: "Defect details", rows: [
			["Quantity received", v.defect.qtyReceived], ["Quantity defective", v.defect.qtyDefective],
			["Problem type", v.defect.problemType], ["Description of defect", v.defect.defectDescription],
			["Marked nonconforming", yesNo]] },
		{ id: "evidence" as SectionId, title: "Pictures and links", rows: [
			["Files", fileNames.join(", ")], ["Links", v.evidence.links.filter((l) => l.trim()).join(", ")]] },
		{ id: "inspector" as SectionId, title: "Inspector", rows: [["Inspector", fullName(inspectorOf(v.inspector))]] },
	] as { id: SectionId; title: string; rows: [string, string][] }[];
}

function buildPayload(v: FormValues, files: File[]) {
	const supplierName = supplierOf(v.process);
	const inspector = inspectorOf(v.inspector);
	return {
		ncr: {
			ncrNumber: v.process.ncrNumber,
			ncrProcessType: processLabel(v.process.processType),
			ncrDefectDescription: v.defect.defectDescription.trim(),
			ncrQuantityReceived: Number(v.defect.qtyReceived),
			ncrQuantityDefective: Number(v.defect.qtyDefective),
			ncrIsNonconforming: v.defect.isNonconforming === "yes",
			ncrSignedAt: new Date().toISOString(),
		},
		problemType: v.defect.problemType, // backend resolves ProblemTypeId
		inspector: { inspectorFirstName: inspector.first, inspectorMiddleName: inspector.middle, inspectorLastName: inspector.last },
		supplier: supplierName ? { supplierName, isNew: v.process.supplier === ADD_SUPPLIER } : null,
		// BIGINT values stay strings: JS numbers lose precision above 2^53.
		purchaseOrder: v.process.poNumber.trim() ? { purchaseOrderNumber: v.process.poNumber.trim() } : null,
		salesOrder: v.process.salesOrderNumber.trim() ? { salesOrderNumber: v.process.salesOrderNumber.trim() } : null,
		item: {
			itemName: v.item.itemName.trim(),
			itemDescription: v.item.itemDescription.trim() || null,
			itemSAPNumber: v.item.itemSapNumber.trim(),
		},
		attachments: [
			...files.map((f) => ({
				attachmentType: f.type.startsWith("image/") ? "Image" : "Document",
				attachmentFileName: f.name,
			})),
			...v.evidence.links.filter((l) => l.trim()).map((l) => ({
				attachmentType: "Link",
				attachmentFileName: new URL(l.trim()).hostname,
				attachmentFilePath: l.trim(),
			})),
		],
	};
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
function FormStyles() {
	return (
		<style jsx global>{`
			.ncr-form {
				--error: #b3001b;
				max-width: 44rem;
				margin: 0 auto;
				padding: 1rem;
				text-align: left;
				font-family: var(--sans);
				line-height: 1.5;
				color: var(--text-h);
			}
			@media (prefers-color-scheme: dark) {
				.ncr-form { --error: #ffb4bf; }
			}
			.ncr-form h1 { font-size: 1.75rem; margin: 0 0 1rem; }
			.ncr-form h2 { font-size: 1.4rem; margin: 0; }
			.ncr-form h3 { font-size: 1.1rem; margin: 0; }
			.ncr-form :focus-visible { outline: 3px solid var(--text-h); outline-offset: 2px; }
			.ncr-steps ol { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0; margin: 0 0 1rem; }
			.ncr-step-btn, .ncr-btn {
				min-height: 2.75rem;
				min-width: 2.75rem;
				padding: 0.5rem 1rem;
				border: 2px solid var(--text-h);
				border-radius: 0.5rem;
				background: transparent;
				color: var(--text-h);
				font: inherit;
				cursor: pointer;
			}
			.ncr-step-btn { text-align: left; padding: 0.5rem 0.75rem; }
			.ncr-step-btn[aria-current="step"] { border-width: 4px; font-weight: 700; }
			.ncr-step-state { display: block; font-size: 0.9rem; font-weight: 400; }
			.ncr-btn-primary { background: var(--text-h); color: var(--bg, Canvas); font-weight: 600; }
			.ncr-tools, .ncr-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
			.ncr-actions { margin-top: 0.5rem; }
			.ncr-status { min-height: 1.5rem; margin: 0.75rem 0; }
			.ncr-progress { margin: 0; font-size: 0.95rem; }
			.ncr-section { display: flex; flex-direction: column; gap: 1.25rem; }
			.ncr-help { margin: 0; font-size: 0.95rem; }
			.ncr-error { margin: 0.5rem 0 0; color: var(--error); }
			.ncr-req { font-weight: 400; }
			.ncr-fieldset { border: 1px solid var(--text-h); border-radius: 0.5rem; padding: 0.75rem 1rem 1rem; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
			.ncr-fieldset legend { font-weight: 600; padding: 0 0.25rem; }
			.ncr-error-summary { border: 3px solid var(--error); border-radius: 0.5rem; padding: 1rem; }
			.ncr-error-summary ul { margin: 0.5rem 0 0; padding-left: 1.25rem; }
			.ncr-error-summary li { margin: 0; }
			.ncr-error-summary a { display: inline-block; padding: 0.5rem 0; color: var(--text-h); text-decoration: underline; }
			.ncr-file-list { margin: 0; padding-left: 1.25rem; }
			.ncr-note { border: 1px dashed var(--text-h); border-radius: 0.5rem; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
			.ncr-note p { margin: 0; }
			.ncr-link-row { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
			.ncr-link-row .fld { width: 100%; }
			.ncr-review-group { border: 1px solid var(--text-h); border-radius: 0.5rem; padding: 0.75rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
			.ncr-review-head { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: space-between; align-items: center; }
			.ncr-review-group dl { margin: 0; }
			.ncr-review-row { display: grid; grid-template-columns: minmax(8rem, 1fr) 2fr; gap: 0.5rem; padding: 0.25rem 0; }
			.ncr-review-row dt { font-weight: 600; }
			.ncr-review-row dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
			@media (max-width: 40rem) {
				.ncr-review-row { grid-template-columns: 1fr; gap: 0; }
			}
		`}</style>
	);
}