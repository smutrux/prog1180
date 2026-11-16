import { useCallback, useEffect, useRef, useState } from "react";
import Button from "./button";
import { useCurrentUser } from "./currentUser";
import {
	DuplicateNcrNumberError,
	SubmitError,
	loadFormLookups,
	isDraftRecord,
	loadNcrForEdit,
	nextNcrNumber,
	parseDraft,
	saveDraft,
	saveEngineering,
	saveNcrSection,
	saveProcurement,
	submitNcr,
	updateNcr,
	type FormLookups,
	type NcrEditData,
	type NcrRecord,
} from "./ncrService";
import DefectSection from "./ncrForm/DefectSection";
import EngineeringSection from "./ncrForm/EngineeringSection";
import EvidenceSection from "./ncrForm/EvidenceSection";
import FormStyles from "./ncrForm/FormStyles";
import InspectorSection from "./ncrForm/InspectorSection";
import ItemSection from "./ncrForm/ItemSection";
import OperationsSection from "./ncrForm/OperationsSection";
import ProcessSection from "./ncrForm/ProcessSection";
import ProcurementSection from "./ncrForm/ProcurementSection";
import QualityFinalReviewSection from "./ncrForm/QualityFinalReviewSection";
import ReviewSection from "./ncrForm/ReviewSection";
import {
	SAVED_IDS,
	addEditOptions,
	focusIdFor,
	fullName,
	makeDefaults,
	messageOf,
	sanitize,
	sanitizeTextbox,
	sectionsFor,
	todayLocal,
	toFormValues,
	type ChangeEvt,
	type Errors,
	type FormValues,
	type SectionId,
	type SectionProps,
} from "./ncrForm/formModel";
import { canEditSection, rolesThatEdit } from "./ncrForm/formPermissions";
import {
	CREATE_PREFIX,
	clearDrafts,
	loadDrafts,
	savedAll,
	writeSection,
} from "./ncrForm/formStorage";
import {
	buildSubmission,
	engineeringInput,
	procurementInput,
	reviewGroups,
} from "./ncrForm/formSubmission";
import { NCR_NUMBER, stampSections, validate } from "./ncrForm/formValidation";
import { dismissToast, notifyLoading, notifySuccess } from "./toast";

export interface NcrFormProps {
	edit?: boolean;
	data?: NcrRecord;
	onClose?: () => void;
	onSaved?: (ncrNumber: string) => void;
	onDirtyChange?: (dirty: boolean) => void;
}

export default function NcrForm({
	edit = false,
	data,
	onClose,
	onSaved,
	onDirtyChange,
}: NcrFormProps) {
	const me = useCurrentUser();
	const personId = me.status === "ready" ? me.personId : null;
	const myName = me.status === "ready" ? me.name : "";
	const roles = me.status === "ready" ? me.roles : [];
	/** Whether the signed-in person's role may change this section. */
	const canEdit = (id: SectionId) => canEditSection(roles, id);
	const [values, setValues] = useState<FormValues>(() => makeDefaults(""));
	const [saved, setSaved] = useState<Record<SectionId, boolean>>(
		() =>
			Object.fromEntries(SAVED_IDS.map((id) => [id, false])) as Record<
				SectionId,
				boolean
			>,
	);
	const [hasDraft, setHasDraft] = useState(false);
	const [dirtyIds, setDirtyIds] = useState<Set<SectionId>>(() => new Set());
	const [step, setStep] = useState(0);
	const [errors, setErrors] = useState<Errors>({});
	const [files, setFiles] = useState<File[]>([]);
	const [fileInputKey, setFileInputKey] = useState(0);
	const [status, setStatus] = useState("");
	const [submitted, setSubmitted] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState("");
	const [lookups, setLookups] = useState<FormLookups>({
		statuses: [],
		suppliers: [],
		problemTypes: [],
		inspectors: [],
		dispositions: [],
		dispositionOptions: [],
	});
	const [lookupState, setLookupState] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const [lookupError, setLookupError] = useState("");
	const [editData, setEditData] = useState<NcrEditData | null>(null);
	const isArchived = edit && editData?.isArchived === true;
	const isDraft = !edit && !!data && isDraftRecord(data);
	const draftIdRef = useRef<number | null>(null);
	const [savingDraft, setSavingDraft] = useState(false);

	const headingRef = useRef<HTMLHeadingElement>(null);
	const summaryRef = useRef<HTMLElement>(null);
	const submitErrorRef = useRef<HTMLElement>(null);
	const focusHeading = useRef(false);
	const focusSummary = useRef(false);
	const focusSubmitError = useRef(false);
	const pendingFocus = useRef<string | null>(null);
	const dataRef = useRef(data);
	dataRef.current = data;
	const editRef = useRef<NcrEditData | null>(null);
	const baseRef = useRef<FormValues>(makeDefaults(""));

	const prefix =
		edit && data
			? `${CREATE_PREFIX}-edit-${data.ncr_id}`
			: isDraft && data
				? `${CREATE_PREFIX}-draft-${data.ncr_id}`
				: CREATE_PREFIX;

	const init = useCallback(async () => {
		setLookupState("loading");
		setLookupError("");
		try {
			if (edit && !dataRef.current)
				throw new Error("No NCR was given to edit.");
			const draftRec =
				!edit && dataRef.current && isDraftRecord(dataRef.current)
					? dataRef.current
					: null;
			if (draftRec) {
				const l = await loadFormLookups();
				const parsed = parseDraft(draftRec);
				const base = makeDefaults(draftRec.ncr_number.trim());
				const merged: FormValues = JSON.parse(JSON.stringify(base));
				if (parsed) {
					for (const id of SAVED_IDS) {
						const stored = parsed.values[id];
						if (stored && typeof stored === "object")
							(merged as Record<SectionId, unknown>)[id] = {
								...merged[id],
								...stored,
							};
					}
				}
				if (
					!Array.isArray(merged.evidence.links) ||
					merged.evidence.links.length === 0
				)
					merged.evidence.links = [""];
				if (!Array.isArray(merged.defect.problemTypeIds))
					merged.defect.problemTypeIds = [];
				baseRef.current = base;
				editRef.current = null;
				draftIdRef.current = draftRec.ncr_id;
				setEditData(null);
				setLookups(l);
				setValues(sanitize(merged, l));
				setSaved(savedAll(true));
				setHasDraft(false);
				setDirtyIds(new Set());
				setStep(
					Math.min(
						Math.max(parsed?.step ?? 0, 0),
						sectionsFor(merged.defect.engineeringRequired === "yes").length - 1,
					),
				);
				setStatus(
					"Your saved draft was loaded. You are on the section where you left off.",
				);
				setLookupState("ready");
				return;
			}
			const [l, next, ed] = await Promise.all([
				loadFormLookups(),
				edit ? Promise.resolve("") : nextNcrNumber(),
				edit
					? loadNcrForEdit(dataRef.current as NcrRecord)
					: Promise.resolve(null),
			]);
			const withExtras = addEditOptions(l, ed);
			const base = ed ? toFormValues(ed) : makeDefaults(next);
			const d = loadDrafts(prefix, base, !edit);
			baseRef.current = base;
			editRef.current = ed;
			setEditData(ed);
			setLookups(withExtras);
			setValues(sanitize(d.values, withExtras));
			setSaved(d.saved);
			setHasDraft(d.any);
			setDirtyIds(new Set());
			setStep(d.step);
			if (d.any)
				setStatus(
					"Your saved sections were restored. You are on the first section that is not saved yet.",
				);
			setLookupState("ready");
		} catch (err) {
			setLookupError(messageOf(err));
			setLookupState("error");
		}
	}, [edit, prefix]);

	useEffect(() => {
		void init();
	}, [init]);

	const refreshLookups = useCallback(async () => {
		try {
			const [l, next] = await Promise.all([
				loadFormLookups(),
				edit ? Promise.resolve("") : nextNcrNumber(),
			]);
			const withExtras = addEditOptions(l, editRef.current);
			setLookups(withExtras);
			setValues((prev) => {
				const clean = sanitize(prev, withExtras);
				return clean.process.ncrNumber
					? clean
					: { ...clean, process: { ...clean.process, ncrNumber: next } };
			});
		} catch {
			/* keep what is on screen */
		}
	}, [edit]);

	useEffect(() => {
		// Pick the signed-in person as the inspector when they are on the list and nobody has chosen yet.
		if (lookupState !== "ready" || me.status !== "ready") return;
		const mine = lookups.inspectors.find((i) => i.personId === me.personId);
		if (!mine) return;
		setValues((prev) =>
			prev.inspector.inspector
				? prev
				: {
						...prev,
						inspector: { ...prev.inspector, inspector: fullName(mine) },
					},
		);
	}, [lookupState, me, lookups.inspectors]);

	useEffect(() => {
		onDirtyChange?.(dirtyIds.size > 0);
	}, [dirtyIds, onDirtyChange]);

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

	function update<K extends SectionId>(
		section: K,
		patch: Partial<FormValues[K]>,
	) {
		setValues((prev) => ({
			...prev,
			[section]: { ...prev[section], ...patch },
		}));
		setSaved((prev) => ({ ...prev, [section]: false }));
		setDirtyIds((prev) => new Set(prev).add(section));
		setErrors((prev) => {
			const next = { ...prev };
			for (const key of Object.keys(patch)) {
				delete next[key];
				if (section === "engineering" && key === "instructions")
					delete next.engineeringInstructions;
				if (section === "operations" && key === "instructions")
					delete next.operationsInstructions;
				if (section === "procurement" && key === "delayCommunication")
					delete next.procurementDelayCommunication;
				if (section === "qualityFinalReview" && key === "comments")
					delete next.qualityFinalComments;
				if (section === "qualityFinalReview" && key === "acceptanceConfirmed")
					delete next.qualityAcceptanceConfirmed;
				if (key === "links")
					Object.keys(next)
						.filter((k) => k.startsWith("link-"))
						.forEach((k) => delete next[k]);
				if (key === "fileNames") delete next.files;
			}
			return next;
		});
	}

	const text =
		<K extends SectionId>(section: K, key: keyof FormValues[K]) =>
		(e: ChangeEvt) => {
			const cleanInput =
				(section === "engineering" && key === "instructions") ||
				(section === "operations" && key === "instructions") ||
				(section === "operations" && key === "comments") ||
				(section === "procurement" && key === "delayCommunication") ||
				(section === "qualityFinalReview" && key === "comments");
			const value = cleanInput
				? sanitizeTextbox(e.target.value)
				: e.target.value;
			update(section, { [key]: value } as Partial<FormValues[K]>);
		};

	/**
	 * The props every section gets: its own slice of the values, the errors,
	 * and update and text already bound to that slice.
	 */
	function bind<K extends SectionId>(id: K): SectionProps<K> {
		return {
			values: values[id],
			errors,
			update: (patch) => update(id, patch),
			text: (key) => text(id, key),
		};
	}

	function showErrors(found: Errors) {
		setErrors(found);
		focusSummary.current = true;
		const n = Object.keys(found).length;
		setStatus(
			`This section has ${n} ${n === 1 ? "problem" : "problems"}. Fix them and try again.`,
		);
	}

	async function saveDraftNow() {
		if (savingDraft || submitting) return;
		if (!NCR_NUMBER.test(values.process.ncrNumber)) {
			setStatus(
				"The draft was not saved. The NCR number is missing. Reload the form to get the next number.",
			);
			return;
		}
		setSavingDraft(true);
		const toastId = notifyLoading("Saving draft...");
		try {
			const result = await saveDraft(
				{
					recordId: draftIdRef.current,
					ncrNumber: values.process.ncrNumber,
					values,
					step,
					createdByPersonId: personId,
				},
				lookups.statuses,
				setStatus,
			);
			draftIdRef.current = result.recordId;
			setSaved(savedAll(true));
			setDirtyIds(new Set());
			setStatus(
				`Draft ${result.ncrNumber} saved. You can close this form and choose Continue on it in the NCR list later. Chosen files are not kept in a draft.`,
			);
			notifySuccess(`Draft ${result.ncrNumber} saved.`, toastId);
			onSaved?.(result.ncrNumber);
		} catch (err) {
			dismissToast(toastId);
			if (err instanceof DuplicateNcrNumberError) {
				const next = await nextNcrNumber().catch(() => "");
				if (next) update("process", { ncrNumber: next });
				setStatus(
					`The draft was not saved. NCR number ${err.ncrNumber} was already used. ${next ? `Your NCR number is now ${next}. Choose Save draft again.` : "Reload the form to get a new number."}`,
				);
			} else {
				setStatus(
					`The draft was not saved. ${messageOf(err)} Your answers are still on screen.`,
				);
			}
		} finally {
			setSavingDraft(false);
		}
	}

	async function saveAndContinue() {
		const sections = sectionsFor(values.defect.engineeringRequired === "yes");
		const current = sections[step];
		if (!current || current.id === "review") return;
		const id = current.id;
		if (!canEdit(id)) {
			// Read only for this role: there is nothing to save, so just move on.
			goTo(step + 1);
			setStatus(
				`${current.title} is read only for your role. Now on the next section.`,
			);
			return;
		}
		const found = validate(id, values, files, false);
		if (Object.keys(found).length) return showErrors(found);
		const needsStamp =
			id === "engineering" ||
			id === "operations" ||
			id === "qualityFinalReview";
		if (needsStamp && me.status !== "ready") {
			setStatus(
				"Your account is not loaded yet. Reload the page and try again.",
			);
			return;
		}
		const stamped = stampSections(
			values,
			myName,
			todayLocal(),
			new Set([id]),
			canEdit,
		);
		const sectionData = stamped[id];
		let savedToDatabase = false;
		const isDatabaseSection =
			id === "engineering" ||
			id === "operations" ||
			id === "procurement" ||
			id === "qualityFinalReview";
		if (isDatabaseSection) {
			const ncrId = edit ? editData?.ncrId : draftIdRef.current;
			// A brand new NCR has no database row until it is submitted or saved as a draft.
			// Until then these sections are kept in this browser and sent with the submission.
			if (ncrId !== null && ncrId !== undefined) {
				if (personId === null) {
					setStatus(
						"Your account is not loaded yet. Reload the page and try again.",
					);
					return;
				}
				try {
					if (id === "engineering") {
						// Engineering is its own table. It is only written once it is complete.
						const row = engineeringInput(stamped, lookups, personId);
						if (row) await saveEngineering(ncrId, row);
					} else {
						await saveNcrSection(ncrId, id, sectionData, personId, step + 1);
						if (id === "procurement") {
							const row = procurementInput(stamped, personId);
							if (row) await saveProcurement(ncrId, row);
						}
					}
					savedToDatabase = true;
				} catch (err) {
					setStatus(
						`${current.title} was not saved to the database. ${messageOf(err)} Your answers are still on screen.`,
					);
					return;
				}
			}
		}
		const ok = writeSection(prefix, id, sectionData);
		if (needsStamp)
			setValues((prev) => ({ ...prev, [id]: sectionData }) as FormValues);
		setSaved((prev) => ({ ...prev, [id]: ok }));
		setDirtyIds((prev) => {
			const next = new Set(prev);
			next.delete(id);
			return next;
		});
		setHasDraft((prev) => prev || ok);
		goTo(step + 1);
		const next = sections[step + 1];
		setStatus(
			ok && next
				? `${current.title} saved${savedToDatabase ? " to the database and this browser" : ""}. Now on section ${step + 2} of ${sections.length}: ${next.title}.`
				: savedToDatabase
					? `${current.title} was saved to the database, but this browser blocked local saving. Now on the next section.`
					: "Your answers are on screen, but this browser blocked saving. Now on the next section.",
		);
		if (ok || savedToDatabase) notifySuccess(`${current.title} saved.`);
	}

	async function submit() {
		if (submitting) return;
		const sections = sectionsFor(values.defect.engineeringRequired === "yes");
		for (let i = 0; i < sections.length; i++) {
			const section = sections[i];
			if (section.id === "review") continue;
			// Sections this role cannot edit are not theirs to complete.
			if (!canEdit(section.id)) continue;
			const found = validate(section.id, values, files, true);
			if (Object.keys(found).length) {
				goTo(i);
				showErrors(found);
				return;
			}
		}
		if (me.status !== "ready") {
			setSubmitError(
				"Your account is not loaded yet. Reload the page and try again.",
			);
			focusSubmitError.current = true;
			return;
		}
		setSubmitting(true);
		setSubmitError("");
		const toastId = notifyLoading(edit ? "Updating NCR..." : "Submitting NCR...");
		try {
			const submission = buildSubmission(
				stampSections(values, myName, todayLocal(), dirtyIds, canEdit),
				files,
				lookups,
				edit ? (editData?.statusId ?? null) : null,
				personId,
				dirtyIds.has("engineering") || !editData?.engineeringPersonId
					? personId
					: editData.engineeringPersonId,
				canEdit,
			);
			const result =
				edit && editData
					? await updateNcr(editData, submission, setStatus)
					: await submitNcr(submission, setStatus, draftIdRef.current);
			draftIdRef.current = null;
			clearDrafts(prefix);
			setHasDraft(false);
			setDirtyIds(new Set());
			setSubmitted(result.ncrNumber);
			focusHeading.current = true;
			setStatus(`NCR ${result.ncrNumber} ${edit ? "updated" : "submitted"}.`);
			notifySuccess(
				`NCR ${result.ncrNumber} ${edit ? "updated" : "submitted"}.`,
				toastId,
			);
			onSaved?.(result.ncrNumber);
			void refreshLookups();
			
		} catch (err) {
			dismissToast(toastId);
			if (err instanceof DuplicateNcrNumberError) {
				const next = await nextNcrNumber().catch(() => "");
				if (next) update("process", { ncrNumber: next });
				setSubmitError(
					`NCR number ${err.ncrNumber} was already used by another report. ${next ? `Your NCR number is now ${next}. Check it, then submit again.` : "Reload the form to get a new number."}`,
				);
			} else {
				const left =
					err instanceof SubmitError && err.leftovers.length
						? ` Some records could not be removed and need cleaning up by hand: ${err.leftovers.join(", ")}.`
						: "";
				setSubmitError(
					`${messageOf(err)}${left} Your answers are kept. Try again.`,
				);
			}
			focusSubmitError.current = true;
			setStatus(
				edit ? "The changes were not saved." : "The NCR was not submitted.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	function resetForm(message: string) {
		const base = edit
			? baseRef.current
			: makeDefaults(
					draftIdRef.current !== null ? values.process.ncrNumber : "",
				);
		setValues(sanitize(JSON.parse(JSON.stringify(base)), lookups));
		setSaved(
			Object.fromEntries(SAVED_IDS.map((id) => [id, false])) as Record<
				SectionId,
				boolean
			>,
		);
		setDirtyIds(new Set());
		setFiles([]);
		setFileInputKey((k) => k + 1);
		goTo(0);
		setStatus(message);
		void refreshLookups();
	}

	function restoreSaved() {
		const d = loadDrafts(prefix, baseRef.current);
		setValues(sanitize(d.values, lookups));
		setSaved(d.saved);
		setDirtyIds(new Set());
		setFiles([]);
		setFileInputKey((k) => k + 1);
		goTo(d.step);
		setStatus("Your saved sections were restored.");
		notifySuccess("Your saved sections were restored.");
		void refreshLookups();
	}

	const p = values.process;
	const sections = sectionsFor(values.defect.engineeringRequired === "yes");
	const reviewStep = sections.length - 1;
	const current = sections[step];
	const errorKeys = Object.keys(errors);

	if (lookupState === "loading") return <p role="status">Loading form...</p>;

	if (lookupState === "error") {
		return (
			<div className="ncr-form">
				<h1>Non-conformance report (NCR)</h1>
				<section className="ncr-error-summary" role="alert">
					<h2>The form could not load</h2>
					<p>{lookupError}</p>
				</section>
				<p>
					<Button
						text="Try again"
						aria="Try again"
						bold
						onClick={() => void init()}
					/>
				</p>
				<FormStyles />
			</div>
		);
	}

	if (submitted) {
		return (
			<div className="ncr-form">
				<h1 ref={headingRef} tabIndex={-1}>
					NCR {submitted} {edit ? "updated" : "submitted"}
				</h1>
				<p>
					{edit
						? "The changes were saved to the database."
						: "The report was saved to the database."}
				</p>
				<div className="ncr-actions">
					{!edit && (
						<Button
							text="Start a new NCR"
							aria="Start a new NCR"
							bold
							onClick={() => {
								setSubmitted(null);
								resetForm("Started a new NCR.");
							}}
						/>
					)}
					{onClose && (
						<button type="button" className="ncr-btn" onClick={onClose}>
							Close
						</button>
					)}
				</div>
				<p role="status" className="ncr-status">
					{status}
				</p>
				<FormStyles />
			</div>
		);
	}

	const currentEditable = current.id === "review" || canEdit(current.id);
	const primaryLabel =
		step === reviewStep
			? submitting
				? edit
					? "Saving..."
					: "Submitting..."
				: edit
					? "Save changes"
					: "Submit NCR"
			: currentEditable
				? "Save and continue"
				: "Next";

	return (
		<form
			className="ncr-form"
			noValidate
			aria-labelledby="ncr-title"
			onSubmit={(e) => {
				e.preventDefault();
				if (step === reviewStep) void submit();
				else saveAndContinue();
			}}
		>
			{isArchived && (
				<section className="ncr-error-summary" role="alert">
					<h3>This NCR is archived</h3>
					<p>
						Archived reports are read-only. Use "Restore / Make Live" to make
						changes.
					</p>
				</section>
			)}

			<h1 id="ncr-title">
				{edit ? `Edit NCR ${p.ncrNumber}` : "Non-conformance report (NCR)"}
			</h1>

			<nav aria-label="Form sections" className="ncr-steps">
				<ol>
					{sections.map((s, i) => {
						const state =
							s.id === "review"
								? ""
								: saved[s.id as SectionId]
									? "Saved"
									: "Not saved";
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
				{!isArchived && (
					<button
						type="button"
						className="ncr-btn"
						onClick={() => {
							if (
								window.confirm(
									"Clear everything on screen? Sections you already saved stay stored, and you can restore them.",
								)
							) {
								resetForm(
									"Form cleared. Your saved sections are still stored. Choose Restore saved sections to bring them back.",
								);
							}
						}}
					>
						Reset form
					</button>
				)}
				{hasDraft && (
					<button type="button" className="ncr-btn" onClick={restoreSaved}>
						Restore saved sections
					</button>
				)}
			</div>

			<p role="status" className="ncr-status">
				{status}
			</p>

			<div className="ncr-section">
				<p className="ncr-progress">
					Section {step + 1} of {sections.length}
				</p>
				<h2 ref={headingRef} tabIndex={-1}>
					{current.title}
				</h2>
				<p className="ncr-help">
					Fields marked (required) must be filled in before you can save this
					section.
				</p>

				{errorKeys.length > 0 && (
					<section
						ref={summaryRef}
						tabIndex={-1}
						className="ncr-error-summary"
						aria-labelledby="ncr-error-title"
					>
						<h3 id="ncr-error-title">
							{errorKeys.length === 1
								? "There is 1 problem"
								: `There are ${errorKeys.length} problems`}{" "}
							in this section
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

				{current.id !== "review" && (
					<>
						{!currentEditable && !isArchived && me.status === "ready" && (
							<p className="ncr-note">
								You can read this section but not change it. It is edited by{" "}
								{rolesThatEdit(current.id).join(" or ")}.
							</p>
						)}
						<fieldset
							className="ncr-readonly"
							disabled={!currentEditable || isArchived || me.status !== "ready"}
						>
							<legend className="ncr-sr-only">{current.title}</legend>
							{current.id === "process" && (
								<ProcessSection
									{...bind("process")}
									edit={edit}
									suppliers={lookups.suppliers}
								/>
							)}

							{current.id === "item" && <ItemSection {...bind("item")} />}

							{current.id === "defect" && (
								<DefectSection
									{...bind("defect")}
									problemTypes={lookups.problemTypes}
								/>
							)}

							{current.id === "engineering" && (
								<EngineeringSection
									{...bind("engineering")}
									dispositions={lookups.dispositions}
								/>
							)}

							{current.id === "operations" && (
								<OperationsSection
									{...bind("operations")}
									dispositions={lookups.dispositions}
									announce={setStatus}
								/>
							)}

							{current.id === "procurement" && (
								<ProcurementSection {...bind("procurement")} />
							)}

							{current.id === "qualityFinalReview" && (
								<QualityFinalReviewSection {...bind("qualityFinalReview")} />
							)}

							{current.id === "evidence" && (
								<EvidenceSection
									{...bind("evidence")}
									files={files}
									onFilesChange={setFiles}
									fileInputKey={fileInputKey}
									existingFiles={edit ? (editData?.existingFiles ?? []) : []}
									focusAfterRender={(id) => {
										pendingFocus.current = id;
									}}
								/>
							)}

							{current.id === "inspector" && (
								<InspectorSection
									{...bind("inspector")}
									inspectors={lookups.inspectors}
								/>
							)}
						</fieldset>
					</>
				)}

				{current.id === "review" && (
					<ReviewSection
						edit={edit}
						submitError={submitError}
						submitErrorRef={submitErrorRef}
						groups={reviewGroups(
							stampSections(values, myName, todayLocal(), dirtyIds, canEdit),
							files,
							lookups,
							editData?.existingFiles ?? [],
						)}
						saved={saved}
						onChange={(id) =>
							goTo(sections.findIndex((section) => section.id === id))
						}
					/>
				)}

				<div className="ncr-actions">
					{step > 0 && (
						<button
							type="button"
							className="ncr-btn"
							onClick={() => goTo(step - 1)}
						>
							Back
						</button>
					)}
					{isArchived ? (
						<Button
							text="Close"
							aria="Close"
							bold
							onClick={() => onClose?.()}
						/>
					) : (
						<>
							{!edit && (
								<button
									type="button"
									className="ncr-btn"
									aria-disabled={savingDraft || undefined}
									onClick={() => void saveDraftNow()}
								>
									{savingDraft ? "Saving draft..." : "Save draft"}
								</button>
							)}
							<Button
								text={primaryLabel}
								aria={primaryLabel}
								bold
								enabled={!submitting}
								onClick={() => {
									if (step === reviewStep) void submit();
									else void saveAndContinue();
								}}
							/>
						</>
					)}
				</div>
			</div>
			<FormStyles />
		</form>
	);
}