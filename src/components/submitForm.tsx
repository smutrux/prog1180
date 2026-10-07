import { useCallback, useEffect, useRef, useState } from "react";
import Input from "./input";
import {
	DuplicateNcrNumberError,
	SubmitError,
	loadFormLookups,
	nextNcrNumber,
	submitNcr,
	type FormLookups,
	type InspectorOption,
	type NcrSubmission,
} from "./ncrService";

const ADD_SUPPLIER = "Not listed: add a new supplier";
const ADD_INSPECTOR = "Not listed: add a new inspector";
const fullName = (i: { first: string; middle?: string; last: string }) =>
	[i.first, i.middle, i.last].filter(Boolean).join(" ");
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
		problemTypeIds: string[];
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
	defect: { qtyReceived: "", qtyDefective: "", problemTypeIds: [], defectDescription: "", isNonconforming: "" },
	evidence: { links: [""], fileNames: [] },
	inspector: { inspector: "", newFirstName: "", newMiddleName: "", newLastName: "" },
});

/* Fill in values that depend on database data: drop stale choices and
   default the inspector to the first person. */
function sanitize(v: FormValues, l: FormLookups): FormValues {
	const validIds = new Set(l.problemTypes.map((t) => String(t.id)));
	const names = l.inspectors.map(fullName);
	const keep = v.inspector.inspector === ADD_INSPECTOR || names.includes(v.inspector.inspector);
	return {
		...v,
		defect: { ...v.defect, problemTypeIds: v.defect.problemTypeIds.filter((id) => validIds.has(id)) },
		inspector: keep ? v.inspector : { ...v.inspector, inspector: names[0] ?? "" },
	};
}

/* ------------------------------------------------------------------ */
/* Draft storage (localStorage, one key per section)                   */
/* ------------------------------------------------------------------ */
const sectionKey = (id: SectionId) => `ncr-draft-v2:${id}`;

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

function loadDrafts() {
	const values = makeDefaults("");
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
	if (!Array.isArray(values.evidence.links) || values.evidence.links.length === 0) values.evidence.links = [""];
	if (!Array.isArray(values.defect.problemTypeIds)) values.defect.problemTypeIds = [];
	const firstUnsaved = SAVED_IDS.findIndex((id) => !saved[id]);
	return { values, saved, any, step: firstUnsaved === -1 ? REVIEW_STEP : firstUnsaved };
}

/* ------------------------------------------------------------------ */
/* Validation (limits match the database column sizes)                 */
/* ------------------------------------------------------------------ */
const DIGITS = /^\d{1,18}$/;
const POSITIVE_INT = /^[1-9]\d{0,8}$/;
const NCR_NUMBER = /^\d{4}-\d{3,}$/;
const blank = (s: string) => !s.trim();
const DIGIT_MSG = "Use digits only, up to 18. Remove spaces, dashes and letters.";

function validate(id: SectionId, v: FormValues, files: File[], forSubmit: boolean): Errors {
	const e: Errors = {};
	switch (id) {
		case "process": {
			const p = v.process;
			const isSupplier = p.processType === "supplier";
			if (!NCR_NUMBER.test(p.ncrNumber)) e.ncrNumber = "The NCR number is missing. Reload the form to get the next number.";
			if (!p.processType) e.processType = "Choose which process this report covers.";
			if (isSupplier && !p.supplier) e.supplier = "Choose a supplier from the list.";
			if (p.supplier === ADD_SUPPLIER) {
				if (blank(p.newSupplierName)) e.newSupplierName = "Enter the supplier's name.";
				else if (p.newSupplierName.trim().length > 200) e.newSupplierName = "Use 200 characters or fewer.";
			}
			if (blank(p.poNumber)) e.poNumber = isSupplier ? "Enter the purchase order number." : "Enter the production order number.";
			else if (!DIGITS.test(p.poNumber.trim())) e.poNumber = DIGIT_MSG;
			if (blank(p.salesOrderNumber)) e.salesOrderNumber = "Enter the sales order number.";
			else if (!DIGITS.test(p.salesOrderNumber.trim())) e.salesOrderNumber = DIGIT_MSG;
			break;
		}
		case "item": {
			const i = v.item;
			if (blank(i.itemName)) e.itemName = "Enter the item name.";
			else if (i.itemName.trim().length > 200) e.itemName = "Use 200 characters or fewer.";
			if (blank(i.itemSapNumber)) e.itemSapNumber = "Enter the SAP number.";
			else if (i.itemSapNumber.trim().length > 20) e.itemSapNumber = "Use 20 characters or fewer.";
			if (i.itemDescription.trim().length > 300) e.itemDescription = "Use 300 characters or fewer.";
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
			if (d.problemTypeIds.length === 0) e.problemTypeIds = "Tick at least one problem type.";
			if (blank(d.defectDescription)) e.defectDescription = "Describe the defect.";
			else if (d.defectDescription.trim().length > 400) e.defectDescription = "Use 400 characters or fewer.";
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
			const long = files.find((f) => f.name.length > 300);
			if (bad) e.files = `"${bad.name}" is not a picture or PDF. Choose the files again without it.`;
			else if (long) e.files = "A file name is longer than 300 characters. Rename it and choose it again.";
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
				else if (n.newFirstName.trim().length > 75) e.newFirstName = "Use 75 characters or fewer.";
				if (n.newMiddleName.trim().length > 75) e.newMiddleName = "Use 75 characters or fewer.";
				if (blank(n.newLastName)) e.newLastName = "Enter a last name.";
				else if (n.newLastName.trim().length > 75) e.newLastName = "Use 75 characters or fewer.";
			}
			break;
		}
	}
	return e;
}

const focusIdFor = (key: string) =>
	key === "processType" ? "processType-supplier" : key === "isNonconforming" ? "isNonconforming-yes" : key;

const formatSize = (bytes: number) =>
	bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/* ------------------------------------------------------------------ */
/* Small presentational helper                                         */
/* ------------------------------------------------------------------ */
function ChoiceGroup(props: {
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
	const [status, setStatus] = useState("");
	const [submitted, setSubmitted] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState("");
	const [lookups, setLookups] = useState<FormLookups>({ suppliers: [], problemTypes: [], inspectors: [] });
	const [lookupState, setLookupState] = useState<"loading" | "ready" | "error">("loading");
	const [lookupError, setLookupError] = useState("");

	const headingRef = useRef<HTMLHeadingElement>(null);
	const summaryRef = useRef<HTMLElement>(null);
	const submitErrorRef = useRef<HTMLElement>(null);
	const focusHeading = useRef(false);
	const focusSummary = useRef(false);
	const focusSubmitError = useRef(false);
	const pendingFocus = useRef<string | null>(null);

	/* Database data: dropdown options and the next NCR number. */
	const loadLookups = useCallback(async (silent = false) => {
		if (!silent) {
			setLookupState("loading");
			setLookupError("");
		}
		try {
			const [l, next] = await Promise.all([loadFormLookups(), nextNcrNumber()]);
			setLookups(l);
			setValues((prev) => {
				const clean = sanitize(prev, l);
				return clean.process.ncrNumber ? clean : { ...clean, process: { ...clean.process, ncrNumber: next } };
			});
			setLookupState("ready");
		} catch (err) {
			if (!silent) {
				setLookupError(messageOf(err));
				setLookupState("error");
			}
		}
	}, []);

	/* On first render in the browser: restore saved sections, then load database data. */
	useEffect(() => {
		const d = loadDrafts();
		setValues(d.values);
		setSaved(d.saved);
		setHasDraft(d.any);
		setStep(d.step);
		if (d.any) setStatus("Your saved sections were restored. You are on the first section that is not saved yet.");
		setHydrated(true);
		void loadLookups();
	}, [loadLookups]);

	useEffect(() => {
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
		if (focusSubmitError.current && submitErrorRef.current) {
			submitErrorRef.current.focus();
			focusSubmitError.current = false;
		}
	}, [submitError]);

	useEffect(() => {
		if (pendingFocus.current) {
			document.getElementById(pendingFocus.current)?.focus();
			pendingFocus.current = null;
		}
	});

	function goTo(i: number) {
		setStep(i);
		setErrors({});
		setSubmitError("");
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

	async function submit() {
		if (submitting) return;
		for (let i = 0; i < SAVED_IDS.length; i++) {
			const found = validate(SAVED_IDS[i], values, files, true);
			if (Object.keys(found).length) {
				goTo(i);
				showErrors(found);
				return;
			}
		}
		setSubmitting(true);
		setSubmitError("");
		try {
			const result = await submitNcr(buildSubmission(values, files, lookups), setStatus);
			clearDrafts();
			setHasDraft(false);
			setSubmitted(result.ncrNumber);
			focusHeading.current = true;
			setStatus(`NCR ${result.ncrNumber} submitted.`);
			void loadLookups(true);
		} catch (err) {
			if (err instanceof DuplicateNcrNumberError) {
				const next = await nextNcrNumber().catch(() => "");
				if (next) update("process", { ncrNumber: next });
				setSubmitError(
					`NCR number ${err.ncrNumber} was already used by another report. ${next ? `Your NCR number is now ${next}. Check it, then submit again.` : "Reload the form to get a new number."}`,
				);
			} else {
				const left = err instanceof SubmitError && err.leftovers.length
					? ` Some records could not be removed and need cleaning up by hand: ${err.leftovers.join(", ")}.`
					: "";
				setSubmitError(`${messageOf(err)}${left} Your answers are kept. Try again.`);
			}
			focusSubmitError.current = true;
			setStatus("The NCR was not submitted.");
		} finally {
			setSubmitting(false);
		}
	}

	function resetForm(message: string) {
		setValues(makeDefaults(""));
		setSaved(Object.fromEntries(SAVED_IDS.map((id) => [id, false])) as Record<SectionId, boolean>);
		setFiles([]);
		setFileInputKey((k) => k + 1);
		goTo(0);
		setStatus(message);
		void loadLookups(true);
	}

	function restoreSaved() {
		const d = loadDrafts();
		setValues(sanitize(d.values, lookups));
		setSaved(d.saved);
		setFiles([]);
		setFileInputKey((k) => k + 1);
		goTo(d.step);
		setStatus("Your saved sections were restored.");
		void loadLookups(true);
	}

	/* --- derived values --- */
	const p = values.process;
	const isSupplierProcess = p.processType === "supplier";
	const links = values.evidence.links;
	const current = SECTIONS[step];
	const errorKeys = Object.keys(errors);
	const selectedProblems = values.defect.problemTypeIds;

	if (!hydrated || lookupState === "loading") return <p role="status">Loading form...</p>;

	if (lookupState === "error") {
		return (
			<div className="ncr-form">
				<h1>Non-conformance report (NCR)</h1>
				<section className="ncr-error-summary" role="alert">
					<h2>The form could not load</h2>
					<p>{lookupError}</p>
				</section>
				<p>
					<button type="button" className="ncr-btn ncr-btn-primary" onClick={() => void loadLookups()}>
						Try again
					</button>
				</p>
				<FormStyles />
			</div>
		);
	}

	if (submitted) {
		return (
			<div className="ncr-form">
				<h1 ref={headingRef} tabIndex={-1}>NCR {submitted} submitted</h1>
				<p>The report was saved to the database.</p>
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
				if (step === REVIEW_STEP) void submit();
				else saveAndContinue();
			}}
		>
			<h1 id="ncr-title">Non-conformance report (NCR)</h1>

			<nav aria-label="Form sections" className="ncr-steps">
				<ol>
					{SECTIONS.map((s, i) => {
						const state = s.id === "review" ? "" : saved[s.id as SectionId] ? "Saved" : "Not saved";
						return (
							<li key={s.id}>
								<button type="button" className="ncr-step-btn" aria-current={i === step ? "step" : undefined} onClick={() => goTo(i)}>
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
							placeholder="Looking up the next number..." error={errors.ncrNumber}
							helpText="The next number in the sequence. It is checked again when you submit." />
						<ChoiceGroup id="processType" legend="Which process does this report cover?" required
							helpText="Choose Supplier or receiving inspection for purchased items. Choose Work in progress for items made in-house."
							error={errors.processType}>
							<Input type={Input.RADIO} name="processType-supplier" groupName="processType" value="supplier"
								label="Supplier or receiving inspection" checked={p.processType === "supplier"} required
								onChange={() => update("process", { processType: "supplier" })} />
							<Input type={Input.RADIO} name="processType-wip" groupName="processType" value="wip"
								label="Work in progress (production order)" checked={p.processType === "wip"} required
								onChange={() => update("process", { processType: "wip" })} />
						</ChoiceGroup>
						<Input type={Input.DROPDOWN} name="supplier" label={isSupplierProcess ? "Supplier" : "Supplier (optional)"}
							items={[...lookups.suppliers.map((s) => s.name), ADD_SUPPLIER]} value={p.supplier} required={isSupplierProcess}
							onChange={text("process", "supplier")} error={errors.supplier}
							helpText={isSupplierProcess ? "Pick the supplier that sent the item." : "Leave empty for in-house production."} />
						{p.supplier === ADD_SUPPLIER && (
							<Input type={Input.TEXT} name="newSupplierName" label="New supplier name" value={p.newSupplierName}
								required maxLength={200} placeholder="e.g. Lakeshore Tooling Co." autoComplete="off"
								onChange={text("process", "newSupplierName")} error={errors.newSupplierName} />
						)}
						<Input type={Input.TEXT} name="poNumber"
							label={p.processType === "wip" ? "Production order number" : "Purchase order number"}
							value={p.poNumber} required inputMode="numeric" maxLength={18} autoComplete="off"
							placeholder="e.g. 4500123456" helpText="Type it exactly as it appears on the paperwork. Digits only."
							onChange={text("process", "poNumber")} error={errors.poNumber} />
						<Input type={Input.TEXT} name="salesOrderNumber" label="Sales order number"
							value={p.salesOrderNumber} required inputMode="numeric" maxLength={18} autoComplete="off"
							placeholder="e.g. 1012345" helpText="Digits only."
							onChange={text("process", "salesOrderNumber")} error={errors.salesOrderNumber} />
					</>
				)}

				{current.id === "item" && (
					<>
						<Input type={Input.TEXT} name="itemName" label="Item name" value={values.item.itemName} required
							maxLength={200} autoComplete="off" placeholder="e.g. Hydraulic fitting, 1/2 in"
							onChange={text("item", "itemName")} error={errors.itemName} />
						<Input type={Input.TEXT} name="itemSapNumber" label="SAP number" value={values.item.itemSapNumber} required
							maxLength={20} autoComplete="off" placeholder="e.g. 100234567"
							onChange={text("item", "itemSapNumber")} error={errors.itemSapNumber} />
						<Input type={Input.PARAGRAPH} name="itemDescription" label="Item description (optional)"
							value={values.item.itemDescription} maxLength={300} placeholder="e.g. Stainless steel, drawing rev C, lot 24-0815"
							helpText={`Material, revision or lot help identify the item. Up to 300 characters. ${values.item.itemDescription.length} used.`}
							onChange={text("item", "itemDescription")} error={errors.itemDescription} />
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
						<ChoiceGroup id="problemTypeIds" legend="Problem types" required
							helpText="Tick every problem that applies." error={errors.problemTypeIds}>
							{lookups.problemTypes.length === 0 && (
								<p className="ncr-help">No problem types are set up in the database yet.</p>
							)}
							{lookups.problemTypes.map((t, idx) => {
								const idStr = String(t.id);
								return (
									<Input key={t.id} type={Input.CHECKBOX} id={idx === 0 ? "problemTypeIds" : undefined}
										name={`problemType-${t.id}`} value={idStr} label={t.label} helpText={t.description || undefined}
										checked={selectedProblems.includes(idStr)}
										onChange={() => update("defect", {
											problemTypeIds: selectedProblems.includes(idStr)
												? selectedProblems.filter((x) => x !== idStr)
												: [...selectedProblems, idStr],
										})} />
								);
							})}
						</ChoiceGroup>
						<Input type={Input.PARAGRAPH} name="defectDescription" label="Description of defect"
							value={values.defect.defectDescription} required maxLength={400}
							placeholder="Say what is wrong, where on the item, and how you found it. Include measurements if you have them."
							helpText={`Up to 400 characters. ${values.defect.defectDescription.length} used.`}
							onChange={text("defect", "defectDescription")} error={errors.defectDescription} />
						<ChoiceGroup id="isNonconforming" legend="Is the item marked as nonconforming?" required
							helpText="Choose Yes if the item has been tagged or marked as nonconforming." error={errors.isNonconforming}>
							<Input type={Input.RADIO} name="isNonconforming-yes" groupName="isNonconforming" value="yes" label="Yes"
								checked={values.defect.isNonconforming === "yes"} required
								onChange={() => update("defect", { isNonconforming: "yes" })} />
							<Input type={Input.RADIO} name="isNonconforming-no" groupName="isNonconforming" value="no" label="No"
								checked={values.defect.isNonconforming === "no"} required
								onChange={() => update("defect", { isNonconforming: "no" })} />
						</ChoiceGroup>
					</>
				)}

				{current.id === "evidence" && (
					<>
						<Input key={fileInputKey} type={Input.FILE} name="files" label="Pictures, screenshots and PDFs (optional)"
							accept="image/*,application/pdf" multiple error={errors.files}
							helpText="You can choose more than one file. File upload is not connected yet: only the file names are recorded, the files themselves are not stored."
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
							items={[...lookups.inspectors.map(fullName), ADD_INSPECTOR]} value={values.inspector.inspector} required
							helpText="Filled in with the first inspector on the list. Change it if someone else did the inspection."
							onChange={text("inspector", "inspector")} error={errors.inspector} />
						{values.inspector.inspector === ADD_INSPECTOR && (
							<>
								<Input type={Input.TEXT} name="newFirstName" label="First name" value={values.inspector.newFirstName}
									required maxLength={75} autoComplete="off" onChange={text("inspector", "newFirstName")} error={errors.newFirstName} />
								<Input type={Input.TEXT} name="newMiddleName" label="Middle name (optional)" value={values.inspector.newMiddleName}
									maxLength={75} autoComplete="off" onChange={text("inspector", "newMiddleName")} error={errors.newMiddleName} />
								<Input type={Input.TEXT} name="newLastName" label="Last name" value={values.inspector.newLastName}
									required maxLength={75} autoComplete="off" onChange={text("inspector", "newLastName")} error={errors.newLastName} />
							</>
						)}
					</>
				)}

				{current.id === "review" && (
					<>
						{submitError && (
							<section ref={submitErrorRef} tabIndex={-1} className="ncr-error-summary" aria-labelledby="ncr-submit-error-title">
								<h3 id="ncr-submit-error-title">The NCR was not submitted</h3>
								<p>{submitError}</p>
							</section>
						)}
						<p>Check each part. Choose Change to fix something, then save that section again. The time of submission is recorded as the NCR's creation time.</p>
						{reviewGroups(values, files, lookups).map((g) => (
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
					<button type="submit" className="ncr-btn ncr-btn-primary" aria-disabled={submitting || undefined}>
						{step === REVIEW_STEP ? (submitting ? "Submitting..." : "Submit NCR") : "Save and continue"}
					</button>
				</div>
			</div>
			<FormStyles />
		</form>
	);
}

/* ------------------------------------------------------------------ */
/* Review summary and submission                                       */
/* ------------------------------------------------------------------ */
const supplierOf = (p: FormValues["process"]) =>
	p.supplier === ADD_SUPPLIER ? p.newSupplierName.trim() : p.supplier.trim();
const processLabel = (t: ProcessType) =>
	t === "supplier" ? "Supplier or Rec-Insp" : t === "wip" ? "WIP (Production Order)" : "";

function reviewGroups(v: FormValues, files: File[], l: FormLookups) {
	const yesNo = v.defect.isNonconforming === "yes" ? "Yes" : v.defect.isNonconforming === "no" ? "No" : "";
	const fileNames = files.length ? files.map((f) => f.name) : v.evidence.fileNames;
	const problems = l.problemTypes.filter((t) => v.defect.problemTypeIds.includes(String(t.id))).map((t) => t.label);
	const inspector = v.inspector.inspector === ADD_INSPECTOR
		? fullName({ first: v.inspector.newFirstName.trim(), middle: v.inspector.newMiddleName.trim(), last: v.inspector.newLastName.trim() })
		: v.inspector.inspector;
	return [
		{ id: "process" as SectionId, title: "Process and source", rows: [
			["NCR number", v.process.ncrNumber], ["Process", processLabel(v.process.processType)],
			["Supplier", supplierOf(v.process) || "In-house production"],
			[v.process.processType === "wip" ? "Production order" : "Purchase order", v.process.poNumber],
			["Sales order", v.process.salesOrderNumber]] },
		{ id: "item" as SectionId, title: "Item", rows: [
			["Item name", v.item.itemName], ["SAP number", v.item.itemSapNumber], ["Description", v.item.itemDescription]] },
		{ id: "defect" as SectionId, title: "Defect details", rows: [
			["Quantity received", v.defect.qtyReceived], ["Quantity defective", v.defect.qtyDefective],
			["Problem types", problems.join(", ")], ["Description of defect", v.defect.defectDescription],
			["Marked nonconforming", yesNo]] },
		{ id: "evidence" as SectionId, title: "Pictures and links", rows: [
			["Files", fileNames.join(", ")], ["Links", v.evidence.links.filter((x) => x.trim()).join(", ")]] },
		{ id: "inspector" as SectionId, title: "Inspector", rows: [["Inspector", inspector]] },
	] as { id: SectionId; title: string; rows: [string, string][] }[];
}

function buildSubmission(v: FormValues, files: File[], l: FormLookups): NcrSubmission {
	const p = v.process;
	let inspector: NcrSubmission["inspector"];
	if (v.inspector.inspector === ADD_INSPECTOR) {
		inspector = {
			kind: "new",
			first: v.inspector.newFirstName.trim(),
			middle: v.inspector.newMiddleName.trim(),
			last: v.inspector.newLastName.trim(),
		};
	} else {
		const known: InspectorOption | undefined = l.inspectors.find((i) => fullName(i) === v.inspector.inspector);
		if (!known) throw new Error("The chosen inspector is no longer in the database. Go back and choose the inspector again.");
		inspector = { kind: "existing", personId: known.personId, rolePersonId: known.rolePersonId };
	}
	return {
		ncrNumber: p.ncrNumber,
		processApplicable: processLabel(p.processType),
		supplier: supplierOf(p) || null,
		purchaseOrderNumber: p.poNumber.trim(),
		salesOrderNumber: p.salesOrderNumber.trim(),
		item: { name: v.item.itemName.trim(), description: v.item.itemDescription.trim(), sapNumber: v.item.itemSapNumber.trim() },
		quantityReceived: Number(v.defect.qtyReceived),
		quantityDefective: Number(v.defect.qtyDefective),
		problemTypeIds: v.defect.problemTypeIds.map(Number),
		defectDescription: v.defect.defectDescription.trim(),
		isNonconforming: v.defect.isNonconforming === "yes",
		inspector,
		files,
		links: v.evidence.links.map((x) => x.trim()).filter(Boolean),
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
			.ncr-btn[aria-disabled="true"] { cursor: progress; }
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
			.ncr-error-summary p { margin: 0.5rem 0 0; }
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