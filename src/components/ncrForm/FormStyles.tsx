export default function FormStyles() {
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
				.ncr-form {
					--error: #ffb4bf;
				}
			}
			.ncr-form h1 {
				font-size: 1.75rem;
				margin: 0 0 1rem;
			}
			.ncr-form h2 {
				font-size: 1.6rem;
				margin: 0;
				font-weight: 600;
				color: var(--text-h);
			}
			.ncr-form h3 {
				font-size: 1.1rem;
				margin: 0;
			}
			.ncr-form :focus-visible {
				outline: 3px solid var(--border);
				outline-offset: 2px;
			}
			.ncr-steps ol {
				list-style: none;
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
				padding: 0;
				margin: 0 0 1rem;
			}
			.ncr-step-btn,
			.ncr-btn {
				min-height: 2.75rem;
				min-width: 2.75rem;
				padding: 0.5rem 1rem;
				border: 2px solid var(--border);
				border-radius: 0.5rem;
				background: transparent;
				color: var(--text-h);
				font: inherit;
				cursor: pointer;
			}
			.ncr-step-btn {
				text-align: left;
				padding: 0.5rem 0.75rem;
			}
			.ncr-step-btn[aria-current="step"] {
				border-width: 4px;
				font-weight: 700;
				border-color: var(--accent);
			}
			.ncr-step-state {
				display: block;
				font-size: 0.9rem;
				font-weight: 400;
			}
			.ncr-btn-primary {
				background: var(--accent);
				color: var(--text-h, Canvas);
				font-weight: 600;
			}
			.ncr-btn[aria-disabled="true"] {
				cursor: progress;
			}
			.ncr-tools,
			.ncr-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.75rem;
			}
			.ncr-actions {
				margin-top: 0.5rem;
			}
			.ncr-status {
				min-height: 1.5rem;
				margin: 0.75rem 0;
			}
			.ncr-progress {
				margin: 2rem 0 0 0;
				font-size: 0.95rem;
			}
			.ncr-section {
				display: flex;
				flex-direction: column;
				gap: 0.75rem;
			}
			.ncr-help {
				margin: 0;
				font-size: 0.95rem;
			}
			.ncr-error {
				margin: 0.5rem 0 0;
				color: var(--error);
			}
			.ncr-req {
				font-weight: 400;
			}
			.ncr-fieldset {
				border: 1px solid var(--border);
				border-radius: 0.5rem;
				padding: 0.75rem 1rem 1rem;
				margin: 0;
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}
			.ncr-fieldset legend {
				font-weight: 600;
				padding: 0 0.25rem;
			}
			.ncr-error-summary {
				border: 3px solid var(--error);
				border-radius: 0.5rem;
				padding: 1rem;
			}
			.ncr-error-summary p {
				margin: 0.5rem 0 0;
			}
			.ncr-error-summary ul {
				margin: 0.5rem 0 0;
				padding-left: 1.25rem;
			}
			.ncr-error-summary li {
				margin: 0;
			}
			.ncr-error-summary a {
				display: inline-flex;
				align-items: center;
				min-height: 2.75rem;
				padding: 0.25rem 0;
				color: var(--text-h);
				text-decoration: underline;
			}
			.ncr-file-list {
				margin: 0;
				padding-left: 1.25rem;
			}
			.ncr-note {
				border: 1px dashed var(--border);
				border-radius: 0.5rem;
				padding: 0.75rem 1rem;
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				align-items: flex-start;
			}
			.ncr-note p {
				margin: 0;
			}
			.ncr-link-row {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				align-items: flex-start;
			}
			.ncr-link-row .fld {
				width: 100%;
			}
			.ncr-review-group {
				border: 1px solid var(--border);
				border-radius: 0.5rem;
				padding: 0.75rem 1rem 1rem;
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}
			.ncr-review-head {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
				justify-content: space-between;
				align-items: center;
			}
			.ncr-review-group dl {
				margin: 0;
			}
			.ncr-review-row {
				display: grid;
				grid-template-columns: minmax(8rem, 1fr) 2fr;
				gap: 0.5rem;
				padding: 0.25rem 0;
			}
			.ncr-review-row dt {
				font-weight: 600;
			}
			.ncr-review-row dd {
				margin: 0;
				overflow-wrap: anywhere;
				white-space: pre-wrap;
			}
			@media (max-width: 40rem) {
				.ncr-review-row {
					grid-template-columns: 1fr;
					gap: 0;
				}
			}
		`}</style>
	);
}