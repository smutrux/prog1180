import { useCallback, useEffect, useRef, useState } from "react";
import { LuX } from "react-icons/lu";
import { FaPlus } from "react-icons/fa6";
import Button from "./button";
import type { NcRecord } from "./api";
import { loadNcrForEdit, type NcrEditData, type NcrFields } from "./ncrService";
import NcrForm from "./submitForm";

export interface NcrModalProps {
	open: boolean;
	onClose: () => void;
	edit?: boolean;
	data?: NcRecord<NcrFields>;
	onSaved?: (ncrNumber: string) => void;
}

export function NcrModal({
	open,
	onClose,
	edit = false,
	data,
	onSaved,
}: NcrModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const dirtyRef = useRef(false);
	const escHandledAt = useRef(0);
	const onDirtyChange = useCallback((dirty: boolean) => {
		dirtyRef.current = dirty;
	}, []);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (open && !dialog.open) {
			dirtyRef.current = false;
			dialog.showModal();
		}
		if (!open && dialog.open) dialog.close();
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [open]);

	function requestClose() {
		if (
			dirtyRef.current &&
			!window.confirm(
				"Close without saving? Changes in sections you have not saved will be lost. Sections you saved come back when you open this form again.",
			)
		) {
			return;
		}
		onClose();
	}

	return (
		<>
			<dialog
				ref={dialogRef}
				className="ncr-modal"
				aria-label={edit ? "Edit NCR" : "New NCR"}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						escHandledAt.current = Date.now();
						requestClose();
					}
				}}
				onCancel={(e) => {
					e.preventDefault();
					if (Date.now() - escHandledAt.current > 200) requestClose();
				}}
				onClose={onClose}
			>
				<div className="ncr-modal-bar">
					<button
						type="button"
						className="ncr-modal-x"
						aria-label="Close"
						onClick={requestClose}
					>
						<LuX size={24} aria-hidden="true" />
					</button>
				</div>
				{open && (
					<NcrForm
						key={edit ? String(data?.id) : "new"}
						edit={edit}
						data={data}
						onClose={onClose}
						onSaved={onSaved}
						onDirtyChange={onDirtyChange}
					/>
				)}
			</dialog>
			<ModalStyles />
		</>
	);
}

export interface NcrDetailsModalProps {
	open: boolean;
	onClose: () => void;
	data?: NcRecord<NcrFields>;
	status?: string;
	onEdit?: (row: NcRecord<NcrFields>) => void;
	onRestore?: (row: NcRecord<NcrFields>) => void;
	restoring?: boolean;
}

const HIDDEN_FIELDS = new Set([
	"Id",
	"id",
	"CreatedAt",
	"UpdatedAt",
	"created_at",
	"updated_at",
]);

const FIELD_LABELS: Record<string, string> = {
	NCRNumber: "NCR number",
	NCRDefectDescription: "Description of defect",
};

const labelFor = (key: string) =>
	FIELD_LABELS[key] ??
	key
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.replace(/_/g, " ");

function formatValue(value: unknown): string {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
	}
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

const RELATED_LABELS = [
	"Status",
	"Supplier",
	"Product",
	"Item SAP number",
	"Purchase order",
	"Sales order",
	"Raised by",
	"Links",
	"Files",
] as const;

function relatedValues(ed: NcrEditData | null, status?: string): string[] {
	if (!ed) return RELATED_LABELS.map((label) => (label === "Status" ? (status ?? "") : ""));
	const inspector = [ed.inspector.first, ed.inspector.middle, ed.inspector.last]
		.filter(Boolean)
		.join(" ");
	return [
		status ?? "",
		ed.supplier ?? "In-house",
		ed.item.description || ed.item.name,
		ed.item.sapNumber,
		ed.purchaseOrderNumber,
		ed.salesOrderNumber,
		inspector,
		ed.links.join("\n"),
		ed.existingFiles.join("\n"),
	];
}

const isShownField = (key: string, value: unknown) =>
	!HIDDEN_FIELDS.has(key) &&
	!/Id$/.test(key) &&
	!(typeof value === "object" && value !== null);

export function NcrDetailsModal({
	open,
	onClose,
	data,
	status,
	onEdit,
	onRestore,
	restoring = false,
}: NcrDetailsModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [related, setRelated] = useState<{
		id: unknown;
		ed: NcrEditData | null;
	} | null>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [open]);

	useEffect(() => {
		if (!open || !data) return;
		let cancelled = false;
		loadNcrForEdit(data)
			.then((ed) => {
				if (!cancelled) setRelated({ id: data.id, ed });
			})
			.catch(() => {
				if (!cancelled) setRelated({ id: data.id, ed: null });
			});
		return () => {
			cancelled = true;
		};
	}, [open, data]);

	const entries = data
		? Object.entries(data.fields).filter(([key, value]) =>
				isShownField(key, value),
			)
		: [];
	const number = data?.fields.NCRNumber;
	const settled = related !== null && related.id === data?.id;
	const values = relatedValues(settled ? related.ed : null, status);

	return (
		<>
			<dialog
				ref={dialogRef}
				className="ncr-modal"
				aria-labelledby="ncr-details-title"
				onClose={onClose}
			>
				<div className="ncr-modal-bar">
					<button
						type="button"
						className="ncr-modal-x"
						aria-label="Close"
						onClick={onClose}
					>
						<LuX size={24} aria-hidden="true" />
					</button>
				</div>
				{open && data && (
					<div className="ncr-details">
						<h2 id="ncr-details-title">
							{number ? `NCR ${number}` : "NCR details"}
						</h2>

						<section aria-labelledby="ncr-related-title" aria-busy={!settled}>
							<h3 id="ncr-related-title" className="ncr-details-heading">
								Related details
								{settled && !related.ed && " (could not be loaded)"}
							</h3>
							<dl className="ncr-details-list">
								{RELATED_LABELS.map((label, i) => {
									const shown = formatValue(values[i]);
									return (
										<div
											key={label}
											className={`ncr-details-row${settled && shown.length > 60 ? " wide" : ""}`}
										>
											<dt>{label}</dt>
											{settled || (label === "Status" && status) ? (
												<dd>{shown}</dd>
											) : (
												<dd className="ncr-skeleton" aria-hidden="true" />
											)}
										</div>
									);
								})}
							</dl>
						</section>

						<section aria-labelledby="ncr-fields-title">
							<h3 id="ncr-fields-title" className="ncr-details-heading">
								Report
							</h3>
							<dl className="ncr-details-list">
								{entries.map(([key, value]) => {
									const text = formatValue(value);
									return (
										<div
											key={key}
											className={`ncr-details-row${text.length > 60 ? " wide" : ""}`}
										>
											<dt>{labelFor(key)}</dt>
											<dd>{text}</dd>
										</div>
									);
								})}
							</dl>
						</section>

						<div className="ncr-details-actions">
							{onRestore && (
								<Button
									text={restoring ? "Restoring..." : "Restore / Make Live"}
									aria={`Restore NCR ${number ?? ""}`.trim()}
									onClick={() => onRestore(data)}
								/>
							)}
							{onEdit && (
								<Button
									text="Edit"
									aria={`Edit NCR ${number ?? ""}`.trim()}
									onClick={() => onEdit(data)}
								/>
							)}
							<Button text="Close" aria="Close" onClick={onClose} />
						</div>
					</div>
				)}
			</dialog>
			<ModalStyles />
		</>
	);
}

export function NewNcrButton({
	onSaved,
}: {
	onSaved?: (ncrNumber: string) => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<div className="ncr-new-btn">
				<Button
					text="New NCR"
					aria="New NCR"
					icon={FaPlus}
					onClick={() => setOpen(true)}
				/>
			</div>
			<NcrModal open={open} onClose={() => setOpen(false)} onSaved={onSaved} />
		</>
	);
}

function ModalStyles() {
	return (
		<style jsx global>{`
			.ncr-new-btn {
				position: fixed;
				top: 2rem;
				right: 2rem;
				z-index: 1000;
			}

			.ncr-modal {
				width: min(52rem, calc(100% - 2rem));
				max-height: calc(100dvh - 2rem);
				margin: auto;
				border: 3px solid var(--border);
				border-radius: 0.75rem;
				background: var(--lifted-bg);
				color: var(--text-h);
				overflow: auto;
			}

			.ncr-modal::backdrop {
				background: rgba(0, 0, 0, 0.65);
			}

			.ncr-modal-bar {
				position: sticky;
				top: 0;
				z-index: 1;
				display: flex;
				justify-content: flex-end;
				padding: 0.5rem;
				background: var(--lifted-bg);
			}

			.ncr-modal-x {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 3rem;
				height: 3rem;
				border: 2px solid var(--text);
				border-radius: 0.5rem;
				background: transparent;
				color: var(--text-h);
				cursor: pointer;
				padding: 0;
			}

			.ncr-details {
				display: flex;
				flex-direction: column;
				gap: 1.25rem;
				padding: 0 1.5rem 1.5rem;
			}

			.ncr-details h2 {
				margin-bottom: 0;
			}

			.ncr-details-heading {
				margin-bottom: 0.75rem;
				font-size: 1rem;
				color: var(--text-h);
			}

			.ncr-details-row dd {
				min-height: 1.5em;
			}

			.ncr-details-row dd.ncr-skeleton {
				width: 70%;
				border-radius: 0.25rem;
				background: color-mix(in srgb, var(--text) 25%, transparent);
				animation: ncr-pulse 1.2s ease-in-out infinite;
			}

			@keyframes ncr-pulse {
				50% {
					opacity: 0.4;
				}
			}

			@media (prefers-reduced-motion: reduce) {
				.ncr-details-row dd.ncr-skeleton {
					animation: none;
				}
			}

			.ncr-details-list {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
				gap: 1rem 1.5rem;
			}

			.ncr-details-row {
				min-width: 0;
			}

			.ncr-details-row.wide {
				grid-column: 1 / -1;
			}

			.ncr-details-row dt {
				font-size: 0.85rem;
				font-weight: 600;
				text-transform: uppercase;
				color: var(--text);
			}

			.ncr-details-row dd {
				color: var(--text-h);
				overflow-wrap: anywhere;
				white-space: pre-wrap;
			}

			.ncr-details-actions {
				display: flex;
				justify-content: flex-end;
				gap: 0.75rem;
			}

			@media (max-width: 1024px) {
				.ncr-new-btn {
					position: relative;
					top: 0;
					right: 0;
				}

				Button {
					width: 100%;
				}
			}

			@media (max-width: 40rem) {
				.ncr-modal {
					width: 100%;
					max-width: 100%;
					height: 100dvh;
					max-height: 100dvh;
					border-width: 0;
					border-radius: 0;
				}
			}
		`}</style>
	);
}