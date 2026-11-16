import Input from "../input";
import { formatSize, type SectionProps } from "./formModel";

interface EvidenceSectionProps extends SectionProps<"evidence"> {
	files: File[];
	onFilesChange: (files: File[]) => void;
	/** Changing this key clears the file picker. */
	fileInputKey: number;
	/** Names of files already attached to the NCR being edited. */
	existingFiles: string[];
	/** Moves keyboard focus to this element id after the next render. */
	focusAfterRender: (id: string) => void;
}

export default function EvidenceSection({
	values,
	errors,
	update,
	files,
	onFilesChange,
	fileInputKey,
	existingFiles,
	focusAfterRender,
}: EvidenceSectionProps) {
	const links = values.links;
	return (
		<>
			<Input
				key={fileInputKey}
				type={Input.FILE}
				name="files"
				label="Pictures, screenshots and PDFs (optional)"
				accept="image/*,application/pdf"
				multiple
				error={errors.files}
				helpText="You can choose more than one file. File upload is not connected yet: only the file names are recorded, the files themselves are not stored."
				onChange={(e) => {
					const list = Array.from((e.target as HTMLInputElement).files ?? []);
					onFilesChange(list);
					update({ fileNames: list.map((f) => f.name) });
				}}
			/>
			{existingFiles.length > 0 && (
				<div className="ncr-note">
					<p>
						Already attached: {existingFiles.join(", ")}. These stay attached.
						Files you choose above are added.
					</p>
				</div>
			)}
			{files.length > 0 && (
				<ul className="ncr-file-list" aria-label="Chosen files">
					{files.map((f) => (
						<li key={`${f.name}-${f.size}`}>
							{f.name} ({formatSize(f.size)})
						</li>
					))}
				</ul>
			)}
			{files.length === 0 && values.fileNames.length > 0 && (
				<div className="ncr-note">
					<p>
						Your last save listed these files: {values.fileNames.join(", ")}.
						Browsers cannot keep files after a reload, so choose them again
						before you submit.
					</p>
					<button
						type="button"
						className="ncr-btn"
						onClick={() => update({ fileNames: [] })}
					>
						Remove saved file names
					</button>
				</div>
			)}
			<fieldset className="ncr-fieldset" aria-describedby="links-help">
				<legend>Links to videos or online pictures (optional)</legend>
				<p id="links-help" className="ncr-help">
					Paste the full web address. Use one box for each link.
				</p>
				{links.map((link, i) => (
					<div key={i} className="ncr-link-row">
						<Input
							type={Input.URL}
							name={`link-${i}`}
							label={`Link ${i + 1}`}
							value={link}
							maxLength={500}
							autoComplete="off"
							placeholder="https://example.com/video"
							onChange={(e) =>
								update({
									links: links.map((l, idx) =>
										idx === i ? e.target.value : l,
									),
								})
							}
							error={errors[`link-${i}`]}
						/>
						{(links.length > 1 || link) && (
							<button
								type="button"
								className="ncr-btn"
								onClick={() => {
									const next = links.filter((_, idx) => idx !== i);
									update({
										links: next.length ? next : [""],
									});
									focusAfterRender("add-link");
								}}
							>
								Remove link {i + 1}
							</button>
						)}
					</div>
				))}
				<button
					id="add-link"
					type="button"
					className="ncr-btn"
					onClick={() => {
						update({ links: [...links, ""] });
						focusAfterRender(`link-${links.length}`);
					}}
				>
					Add another link
				</button>
			</fieldset>
		</>
	);
}