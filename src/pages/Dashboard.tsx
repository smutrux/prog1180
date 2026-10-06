import StatusCard from "../components/statusCard";
import { FiAlertCircle } from "react-icons/fi";
const Dashboard = () => {
  return (<>
    <h1>Dashboard</h1>
    <StatusCard title="Open NCRs" amount={1} subtext="Requiring immediate action" icon={FiAlertCircle} status="alerted"/>
    <StatusCard title="Open NCRs" amount={1} subtext="Requiring immediate action" icon={FiAlertCircle} status="alerted"/>
    <StatusCard title="Open NCRs" amount={1} subtext="Requiring immediate action" icon={FiAlertCircle} status="alerted"/>
    <StatusCard title="Open NCRs" amount={1} subtext="Requiring immediate action" icon={FiAlertCircle} status="alerted"/>
    </>
  );
};

export default Dashboard;