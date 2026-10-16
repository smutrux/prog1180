import { useCallback, useEffect, useRef, useState } from "react";
import { LuX } from "react-icons/lu";
import { FaPlus } from "react-icons/fa6";
import Button from "./button";
import type { NcRecord } from "./api";
import type { NcrFields } from "./ncrService";
import NcrForm from "./submitForm";

export interface NcrModalProps {
	/** Whether the popup is showing. */
	open: boolean;

	/** Called when the popup closes, by any route. */
	onClose: () => void;

	/**
	 * Edit an existing NCR instead of creating a new one. Needs `data`.
	 * @defaultValue `false`
	 */
	edit?: boolean;

	/** The NCR row exactly as the NocoDB list or read endpoint returns it. */
	data?: NcRecord<NcrFields>;

	/** Called once after the NCR is created or updated. */
	onSaved?: (ncrNumber: string) => void;
}

/**
 * A popup that holds the NCR form. It uses the native `<dialog>`, so the
 * browser traps focus inside, makes the page behind it inert, and puts focus
 * back on the button that opened it. Closing with unsaved changes asks first.
 *
 * @param props - Component props, see {@link NcrModalProps}.
 * @returns The dialog and its styles.
 */
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

/** One label and value pair shown in the details popup. */
export interface NcrDetailItem {
	/** What the value is, such as "Supplier name". */
	label: string;

	/** The value as text. An empty value shows a dash. */
	value: string;
}

export interface NcrDetailsModalProps {
	/** Whether the popup is showing. */
	open: boolean;

	/** Called when the popup closes, by any route. */
	onClose: () => void;

	/** Heading of the popup, such as "NCR 1042". */
	title: string;

	/** The facts to show, in the order they should appear. */
	details: NcrDetailItem[];

	/**
	 * Shows an Edit button that calls this. The parent decides what happens
	 * next, usually closing this popup and opening the edit form. Leave it
	 * out for a view that cannot lead to editing.
	 */
	onEdit?: () => void;
}

/**
 * A read-only popup that shows the details of one NCR. It is built the same
 * way as {@link NcrModal}: the native `<dialog>` traps focus, makes the page
 * behind it inert, and returns focus to the button that opened it.
 *
 * @param props - Component props, see {@link NcrDetailsModalProps}.
 * @returns The dialog and its styles.
 *
 * @example
 * <NcrDetailsModal
 *   open={viewing !== null}
 *   onClose={() => setViewing(null)}
 *   title="NCR 1042"
 *   details={[{ label: "Status", value: "Open" }]}
 *   onEdit={() => openEditForm()}
 * />
 */
export function NcrDetailsModal({
	open,
	onClose,
	title,
	details,
	onEdit,
}: NcrDetailsModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);

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
				{open && (
					<div className="ncr-details">
						<h2 id="ncr-details-title">{title}</h2>
						<dl className="ncr-details-list">
							{details.map((item) => {
								const text = item.value.trim() || "\u2014";
								return (
									<div
										key={item.label}
										className={`ncr-details-row${text.length > 60 ? " wide" : ""}`}
									>
										<dt>{item.label}</dt>
										<dd>{text}</dd>
									</div>
								);
							})}
						</dl>
						<div className="ncr-details-actions">
							{onEdit && (
								<Button text="Edit" aria={`Edit ${title}`} onClick={onEdit} />
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

/**
 * The "New NCR" button in the bottom right corner of the screen, together
 * with the popup it opens. Pages with an NCR table or numbers that depend on
 * the NCRs use it, passing `onSaved` to reload their data.
 *
 * @param props - `onSaved` is called once after the NCR is created.
 * @returns The floating button and the popup.
 */
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
				bottom: 1rem;
				right: 1rem;
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