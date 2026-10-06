import type { IconType } from "react-icons";
interface StatusCardProps {
    title: string;
    amount: number;
    subtext: string;
    icon: IconType;

    size?: string;
    status?: "normal" | "alerted";
}

var StatusCard = () => {
    return (
        <div style={{display: "flex", flexDirection: "column"}}>
            <div style={{display: "flex", justifyContent: "space-between"}}>
                <p>Open NCRS</p>
                <p>img</p>       
            </div>
            <p>1</p>
            <p>Requiring immediatee action</p>
        </div>
    )
}

export default StatusCard;