import type { IconType } from "react-icons";
interface StatusCardProps {
    title: string;
    amount: number;
    subtext: string;
    icon: IconType;

    size?: string;
    colour: "green" | "red" | "orange" | "blue";
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
    return (
        <div className="statusCard">
            <div className="statusCardHeader">
                <p>{props.title}</p>
                <div className="statusIcon" style={{color: colours[props.colour]}}>
                    <props.icon aria-hidden="true" />
                </div>
            </div>
            <p className="statusAmount">{props.amount}</p>
            <p className="statusSubtext">{props.subtext}</p>
           <style jsx>{`

            .statusCard {
                /* Icon colours. Light mode keeps the original palette. */
                --status-green: #059669;
                --status-red: #DC2626;
                --status-orange: #D97706;
                --status-blue: #2563EB;

                background-color: var(--code-bg);
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
        `}</style>
        </div>
    )
}

export default StatusCard;