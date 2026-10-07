import StatusCard from "../components/statusCard";
import { TbCircleCheck } from "react-icons/tb";
import { LuArchive } from "react-icons/lu";
import { FiAlertCircle } from "react-icons/fi";
import { FaRegClock } from "react-icons/fa6";
import RecentNcrs from "../components/recentncrs";
const Dashboard = () => {
  return (<div>
    <h1>Quality Control Dashboard</h1>
    <p>stats-row</p>
    <div className="stats-row">
      <StatusCard title="Open NCRs" amount={1} subtext="Requiring immediate action" icon={FiAlertCircle} colour="red"/>
      <StatusCard title="awaiting review" amount={0} subtext="Pending QA coordination sign-off" icon={FaRegClock} colour="orange"/>
      <StatusCard title="closed ncrs" amount={1} subtext="Resolved this quarter" icon={TbCircleCheck} colour="green"/>
      <StatusCard title="total NCRs" amount={2} subtext="All logged occurrences" icon={LuArchive} colour="blue"/>
    </div>
    <RecentNcrs />
    <style jsx>{`
      h1 {color: black; font-size: 2rem; font-weight: bold; margin-bottom: 2rem;}

      .stats-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
        margin-bottom: 3rem;
      }

      @media (max-width: 1200px) {
        .stats-row {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 900px) {
        .stats-row {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  </div>
  );
};

export default Dashboard;