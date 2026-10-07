import { useCallback, useEffect, useRef, useState } from "react";
import { LuX } from "react-icons/lu";
import type { NcRecord } from "./api";
import type { NcrFields } from "./ncrService";
import NcrForm from "./submitForm";

export interface NcrModalProps {
	open: boolean;
	onClose: () => void;
	/** Edit an existing NCR instead of creating a new one. Needs `data`. */
	edit?: boolean;
	/** The NCR row exactly as the NocoDB list or read endpoint returns it. */
	data?: NcRecord<NcrFields>;
	/** Called once after the NCR is created or updated. */
	onSaved?: (ncrNumber: string) => void;
}

/* Uses the native <dialog>: the browser traps focus inside, makes the page
   behind it inert, and puts focus back on the button that opened it. */
export function NcrModal({ open, onClose, edit = false, data, onSaved }: NcrModalProps) {
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

	/* Keep the page behind from scrolling while the modal is open. */
	useEffect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [open]);

	/* X button and Esc both come through here. */
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
						e.preventDefault(); // stops the browser closing it before we can ask
						escHandledAt.current = Date.now();
						requestClose();
					}
				}}
				onCancel={(e) => {
					e.preventDefault();
					// Esc already handled by onKeyDown. This catches other ways a browser cancels a dialog.
					if (Date.now() - escHandledAt.current > 200) requestClose();
				}}
				onClose={onClose}
			>
				<div className="ncr-modal-bar">
					<button type="button" className="ncr-modal-x" aria-label="Close" onClick={requestClose}>
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

/** A button that opens the modal. Use it for "New NCR" or, with `edit` and `data`, for "Edit". */
export default function NcrFormButton({
	edit = false,
	data,
	label,
	onSaved,
}: {
	edit?: boolean;
	data?: NcRecord<NcrFields>;
	label?: string;
	onSaved?: (ncrNumber: string) => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" className="ncr-open-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
				{label ?? (edit ? "Edit NCR" : "New NCR")}
			</button>
			<NcrModal open={open} onClose={() => setOpen(false)} edit={edit} data={data} onSaved={onSaved} />
		</>
	);
}

function ModalStyles() {
	return (
		<style jsx global>{`
			.ncr-open-btn {
				min-height: 2.75rem;
				min-width: 2.75rem;
				padding: 0.5rem 1rem;
				border: 2px solid var(--border);
				border-radius: 0.5rem;
				background: var(--text-h);
				color: var(--bg, Canvas);
				font: inherit;
				font-weight: 600;
				cursor: pointer;
			}
			.ncr-open-btn:focus-visible,
			.ncr-modal-x:focus-visible {
				outline: 3px solid var(--border);
				outline-offset: 2px;
			}
			.ncr-modal {
				box-sizing: border-box;
				width: min(52rem, calc(100% - 2rem));
				max-height: calc(100dvh - 2rem);
				padding: 0;
				border: 3px solid var(--border);
				border-radius: 0.75rem;
				background: var(--bg, Canvas);
				color: var(--text-h, CanvasText);
				overflow: auto;
				margin: auto;
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
				background: var(--bg, Canvas);
			}
			.ncr-modal-x {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 2.75rem;
				height: 2.75rem;
				padding: 0;
				border: 2px solid var(--border);
				border-radius: 0.5rem;
				background: transparent;
				color: var(--text-h);
				cursor: pointer;
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
