import type { IconType } from "react-icons";
interface StatusCardProps {
    title: string;
    amount: number;
    subtext: string;
    icon: IconType;

    size?: string;
    colour: "green" | "red" | "orange" | "blue";
}

const colours = {
    green: "#059669", 
    red: "#DC2626",
    orange: "#D97706",
    blue: "#2563EB"
};

var StatusCard = (props: StatusCardProps) => {
    return (
        <div className="statusCard">
            <div className="statusCardHeader">
                <p>{props.title}</p>
                <div className="statusIcon" style={{color: colours[props.colour]}}>
                    <props.icon />
                </div>     
            </div>
            <p className="statusAmount">{props.amount}</p>
            <p className="statusSubtext">{props.subtext}</p>
           <style jsx>{`
  
            .statusCard { 
                background-color: white;
                display: flex;
                flex-direction: column;
                padding: 1rem 1.25rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                border-radius: 16px;
                border: 3px solid #e2e8f0;
                gap: 1rem;
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
                color: #64748b;
            }

            .statusIcon {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0.4rem;
                border-radius: 25%;
                background-color: #eff6ff;
                font-size: 1.5rem;
                font-weight: bold;
            }

            .statusAmount {
               font-size: 2rem;
               font-weight: bold;
               color: black;
               {/* margin-bottom: 1rem; */}
            }

            .statusSubtext {
               color: #475569;
               font-size: 0.9rem;
            }
        `}</style>
        </div>
    )
}

export default StatusCard;