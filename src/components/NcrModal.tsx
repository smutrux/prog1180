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
