import type { IconType } from "react-icons";
interface StatusCardProps {
    title: string;
    amount: number;
    subtext: string;
    icon: IconType;

    size?: string;
    status?: "normal" | "alerted";
}

var StatusCard = (props: StatusCardProps) => {
    return (
        <div className="statusCard">
            <div className="statusCardHeader">
                <p>{props.title}</p>
                <div className="statusIcon">
                    <props.icon />
                </div>     
            </div>
            <p className="statusAmount">{props.amount}</p>
            <p className="statusSubtext">{props.subtext}</p>
           <style>{`
  
            .statusCard {
             
              
                background-color: white;
                display: flex;
                flex-direction: column;
                padding: 1rem 1.5rem;
                width: 30%;
                border-radius: 8px;
                border: 3px solid #e2e8f0;
                gap: 1rem;
            }

            .statusCardHeader {
                display: flex;
                margin-block: 1rem;
                justify-content: space-between;
            }

            .statusCardHeader p {
                text-transform: uppercase;
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
                color: red;
                font-size: 2rem;
                font0-weight: bold;
            }

            .statusAmount {
               font-size: 2rem;
               font-weight: bold;
               color: black;
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