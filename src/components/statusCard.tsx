import type { IconType } from "react-icons";
interface StatusCardProps {
    title: string;
    amount: number;
    subtext: string;
    icon: IconType;

    size?: string;
    colour: "green" | "red" | "orange" | "blue";
    /** Show a shimmering placeholder instead of the numbers. The card keeps
        exactly the same size, so the page does not jump when the data arrives. */
    loading?: boolean;
}

/* Each colour is a CSS variable, so it can change with light and dark mode.
   The values are defined in the style block below. */
const colours = {
    green: "var(--status-green)",
    red: "var(--status-red)",
    orange: "var(--status-orange)",
    blue: "var(--status-blue)",
};

var StatusCard = (props: StatusCardProps) => {
    const skeleton = props.loading ? " skeleton" : "";
    return (
        <div className="statusCard" aria-busy={props.loading ? "true" : undefined}>
            <div className="statusCardHeader">
                <p>{props.title}</p>
                <div className="statusIcon" style={{color: colours[props.colour]}}>
                    <props.icon aria-hidden="true" />
                </div>
            </div>
            {/* While loading, the real text is still laid out (so the size is right)
                but drawn transparent, with a shimmering bar behind it. */}
            <p className={`statusAmount${skeleton}`} aria-hidden={props.loading ? "true" : undefined}>{props.amount}</p>
            <p className={`statusSubtext${skeleton}`} aria-hidden={props.loading ? "true" : undefined}>{props.subtext}</p>
           <style jsx>{`

            .statusCard {
                /* Icon colours. Light mode keeps the original palette. */
                --status-green: #059669;
                --status-red: #DC2626;
                --status-orange: #D97706;
                --status-blue: #2563EB;

                /* Loading placeholder colours. Grey with transparency, so they suit light and dark mode. */
                --skeleton-base: rgba(128, 128, 128, 0.22);
                --skeleton-shine: rgba(128, 128, 128, 0.4);

                background-color: var(--lifted-bg);
                display: flex;
                flex-direction: column;
                padding: 1rem 1.25rem;
                box-shadow: var(--shadow);
                border-radius: 16px;
                border: 3px solid var(--border);
                gap: 1rem;
            }

            /* Dark mode: lighter tints, so the icons stay clear on the dark surface. */
            @media (prefers-color-scheme: dark) {
                .statusCard {
                    --status-green: #34D399;
                    --status-red: #F87171;
                    --status-orange: #FBBF24;
                    --status-blue: #60A5FA;
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
                font-weight: bold;
            }

            .statusAmount {
               font-size: 2rem;
               font-weight: bold;
               color: var(--text-h);
            }

            .statusSubtext {
               color: var(--text-h);
               font-size: 0.9rem;
            }

            /* Loading placeholder: the text keeps its space but is invisible,
               and a moving highlight sweeps across the bar. */
            .skeleton {
                color: transparent;
                width: fit-content;
                max-width: 100%;
                border-radius: 8px;
                user-select: none;
                background: linear-gradient(
                    90deg,
                    var(--skeleton-base) 0%,
                    var(--skeleton-shine) 50%,
                    var(--skeleton-base) 100%
                );
                background-size: 200% 100%;
                animation: statusShimmer 1.4s ease-in-out infinite;
            }

            .statusAmount.skeleton {
                min-width: 4rem;
            }

            @keyframes statusShimmer {
                from { background-position: 200% 0; }
                to { background-position: -200% 0; }
            }

            /* People who ask for less motion get a still placeholder. */
            @media (prefers-reduced-motion: reduce) {
                .skeleton {
                    animation: none;
                }
            }
        `}</style>
        </div>
    )
}

export default StatusCard;