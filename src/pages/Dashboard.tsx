import { useCallback, useEffect, useState } from "react";
import { TbCircleCheck } from "react-icons/tb";
import { LuArchive } from "react-icons/lu";
import { FiAlertCircle } from "react-icons/fi";
import { FaRegClock } from "react-icons/fa6";
import { FaSyncAlt } from "react-icons/fa";
import Button from "../components/button";
import Ncrs from "../components/ncrList";
import PageHeader from "../components/pageHeader";
import StatusCard from "../components/statusCard";
import { loadReport, type Report } from "../components/reportsService";

/** The dashboard: four headline numbers and the list of NCRs. */
const Dashboard = () => {
	const [report, setReport] = useState<Report | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setReport(await loadReport());
			setError("");
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const showCards = report !== null || loading;
	const placeholder = report === null;

	return (
		<div className="page">
			<PageHeader
				title="Quality Control Dashboard"
				description="A summary of NCR activity and the latest reports"
			/>

			{showCards ? (
				<div className="card-grid">
					{placeholder && (
						<p role="status" className="sr-only">
							Loading data...
						</p>
					)}
					<StatusCard
						title="Open NCRs"
						amount={report?.open ?? 0}
						subtext={
							report?.onHold ? `${report.onHold} on hold` : "None on hold"
						}
						icon={FiAlertCircle}
						colour="red"
						loading={placeholder}
					/>
					<StatusCard
						title="Awaiting review"
						amount={report?.awaitingReview ?? 0}
						subtext="Open NCRs with a review pending"
						icon={FaRegClock}
						colour="orange"
						loading={placeholder}
					/>
					<StatusCard
						title="Closed NCRs"
						amount={report?.closed ?? 0}
						subtext={`${report?.closedThisMonth ?? 0} closed this month`}
						icon={TbCircleCheck}
						colour="green"
						loading={placeholder}
					/>
					<StatusCard
						title="Total NCRs"
						amount={report?.total ?? 0}
						subtext="All NCRs raised"
						icon={LuArchive}
						colour="blue"
						loading={placeholder}
					/>
				</div>
			) : (
				<div className="stack">
					<p role="alert">{error}</p>
					<Button
						text="Try again"
						aria="Try again"
						icon={FaSyncAlt}
						onClick={() => void load()}
					/>
				</div>
			)}

			<Ncrs show="all" simple />
		</div>
	);
};

export default Dashboard;
