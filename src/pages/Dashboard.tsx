import { useCallback, useEffect, useState } from "react";
import StatusCard from "../components/statusCard";
import Button from "../components/button";
import Ncrs from "../components/Ncrs";
import { loadReport, type Report } from "../components/reportsService";
import { TbCircleCheck } from "react-icons/tb";
import { LuArchive } from "react-icons/lu";
import { FiAlertCircle } from "react-icons/fi";
import { FaRegClock } from "react-icons/fa6";
import { FaSyncAlt } from "react-icons/fa";

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

	return (
		<div>
			<h1>Quality Control Dashboard</h1>

			{report ? (
				<div className="stats-row">
					<StatusCard
						title="Open NCRs"
						amount={report.open}
						subtext={report.onHold ? `${report.onHold} on hold` : "None on hold"}
						icon={FiAlertCircle}
						colour="red"
					/>
					<StatusCard
						title="Awaiting review"
						amount={report.awaitingReview}
						subtext="Open NCRs with a review pending"
						icon={FaRegClock}
						colour="orange"
					/>
					<StatusCard
						title="Closed NCRs"
						amount={report.closed}
						subtext={`${report.closedThisMonth} closed this month`}
						icon={TbCircleCheck}
						colour="green"
					/>
					<StatusCard
						title="Total NCRs"
						amount={report.total}
						subtext="All NCRs raised"
						icon={LuArchive}
						colour="blue"
					/>
				</div>
			) : (
				<div className="stats-status">
					{loading && <p role="status">Loading data...</p>}
					{error && (
						<>
							<p role="alert">{error}</p>
							<Button text="Try again" aria="Try again" icon={FaSyncAlt} onClick={() => void load()} />
						</>
					)}
				</div>
			)}

			<Ncrs show="all" simple />

			<style jsx>{`
				h1 {
					color: var(--text);
					font-size: 2rem;
					font-weight: bold;
					margin-bottom: 2rem;
				}

				table {
					width: 100%;
					table-layout: fixed; /* Forces the table to respect column bounds */
					margin-top: 1rem;
				}

				.new-ncr-button {
					position: fixed;
					bottom: 1rem;
					right: 1rem;
					z-index: 1000;
				}

				.col-number {
					width: 140px;
				}

				.col-actions {
					width: 100px;
				}
				/* The middle "Defect" column automatically takes up 100% of the remaining space */

				.defect-cell {
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.stats-row {
					display: grid;
					grid-template-columns: repeat(4, 1fr);
					gap: 1rem;
					margin-bottom: 3rem;
				}

				.stats-status {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
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