import type { RefObject } from "react";
import type { SectionId } from "./formModel";
import type { ReviewGroup } from "./formSubmission";

interface ReviewSectionProps {
	edit: boolean;
	submitError: string;
	submitErrorRef: RefObject<HTMLElement | null>;
	groups: ReviewGroup[];
	saved: Record<SectionId, boolean>;
	/** Opens the section with this id so something can be changed. */
	onChange: (id: SectionId) => void;
}

export default function ReviewSection({
	edit,
	submitError,
	submitErrorRef,
	groups,
	saved,
	onChange,
}: ReviewSectionProps) {
	return (
		<>
			{submitError && (
				<section
					ref={submitErrorRef}
					tabIndex={-1}
					className="ncr-error-summary"
					aria-labelledby="ncr-submit-error-title"
				>
					<h3 id="ncr-submit-error-title">The NCR was not submitted</h3>
					<p>{submitError}</p>
				</section>
			)}
			<p>
				Check each part. Choose Change to fix something, then save that section
				again.{" "}
				{edit
					? "The time you save is recorded as the update time."
					: "The time of submission is recorded as the NCR's creation time."}
			</p>
			{groups.map((g) => (
				<section
					key={g.id}
					className="ncr-review-group"
					aria-labelledby={`review-${g.id}`}
				>
					<div className="ncr-review-head">
						<h3 id={`review-${g.id}`}>{g.title}</h3>
						<button
							type="button"
							className="ncr-btn"
							onClick={() => onChange(g.id)}
						>
							Change {g.title.toLowerCase()}
						</button>
					</div>
					{!saved[g.id] && (
						<p className="ncr-help">
							This section is not saved yet. Saved sections come back if the
							page reloads.
						</p>
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
	);
}