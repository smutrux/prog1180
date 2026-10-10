import type { IconType } from "react-icons";

/**
 * Props for {@link StatusCard}.
 */
interface StatusCardProps {
	/** Short name of the number, shown in capitals at the top. */
	title: string;

	/** The number itself. */
	amount: number;

	/** One line of plain-language context under the number. */
	subtext: string;

	/** Icon shown beside the title. It is decoration only. */
	icon: IconType;

	/** Colour of the icon. */
	colour: "green" | "red" | "orange" | "blue";

	/**
	 * Shows a shimmering placeholder instead of the numbers. The card keeps
	 * exactly the same size, so the page does not jump when the data arrives.
	 * @defaultValue `false`
	 */
	loading?: boolean;
}

const colours = {
	green: "var(--status-green)",
	red: "var(--status-red)",
	orange: "var(--status-orange)",
	blue: "var(--status-blue)",
};

/**
 * A card with one number and a line of context.
 *
 * @param props - Component props, see {@link StatusCardProps}.
 * @returns The card. While `loading`, the number and text are hidden from
 *   screen readers and the card is marked busy.
 *
 * @example
 * <StatusCard title="Open NCRs" amount={4} subtext="1 on hold" icon={FaFolderOpen} colour="orange" />
 */
const StatusCard = (props: StatusCardProps) => {
	const skeleton = props.loading ? " skeleton" : "";
	return (
		<div className="statusCard" aria-busy={props.loading ? "true" : undefined}>
			<div className="statusCardHeader">
				<p>{props.title}</p>
				<div className="statusIcon" style={{ color: colours[props.colour] }}>
					<props.icon aria-hidden="true" />
				</div>
			</div>
			<p
				className={`statusAmount${skeleton}`}
				aria-hidden={props.loading ? "true" : undefined}
			>
				{props.amount}
			</p>
			<p
				className={`statusSubtext${skeleton}`}
				aria-hidden={props.loading ? "true" : undefined}
			>
				{props.subtext}
			</p>

			<style jsx>{`
				.statusCard {
					--status-green: #059669;
					--status-red: #dc2626;
					--status-orange: #d97706;
					--status-blue: #2563eb;
					--skeleton-base: rgba(128, 128, 128, 0.22);
					--skeleton-shine: rgba(128, 128, 128, 0.4);

					display: flex;
					flex-direction: column;
					gap: 1rem;
					padding: 1rem 1.25rem;
					background-color: var(--lifted-bg);
					border: 3px solid var(--border);
					border-radius: 16px;
					box-shadow: var(--shadow);
				}

				@media (prefers-color-scheme: dark) {
					.statusCard {
						--status-green: #34d399;
						--status-red: #f87171;
						--status-orange: #fbbf24;
						--status-blue: #60a5fa;
					}
				}

				.statusCardHeader {
					display: flex;
					align-items: center;
					justify-content: space-between;
				}

				.statusCardHeader p {
					text-transform: uppercase;
					font-size: 1rem;
					font-weight: 600;
					color: var(--text-h);
				}

				.statusIcon {
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 0.4rem;
					border-radius: 25%;
					background-color: var(--bg);
					font-size: 1.5rem;
				}

				.statusAmount {
					font-size: 2rem;
					font-weight: bold;
					color: var(--text-h);
				}

				.statusSubtext {
					font-size: 0.9rem;
					color: var(--text-h);
				}

				.skeleton {
					width: fit-content;
					max-width: 100%;
					border-radius: 8px;
					background: linear-gradient(
						90deg,
						var(--skeleton-base) 0%,
						var(--skeleton-shine) 50%,
						var(--skeleton-base) 100%
					);
					background-size: 200% 100%;
					color: transparent;
					user-select: none;
					animation: statusShimmer 1.4s ease-in-out infinite;
				}

				.statusAmount.skeleton {
					min-width: 4rem;
				}

				@keyframes statusShimmer {
					from {
						background-position: 200% 0;
					}
					to {
						background-position: -200% 0;
					}
				}
			`}</style>
		</div>
	);
};

export default StatusCard;
