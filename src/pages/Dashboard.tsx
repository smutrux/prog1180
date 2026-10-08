import { useState } from "react";
import StatusCard from "../components/statusCard";
import { TbCircleCheck } from "react-icons/tb";
import { LuArchive } from "react-icons/lu";
import { FiAlertCircle } from "react-icons/fi";
import { FaRegClock, FaPlus } from "react-icons/fa6";
import RecentNcrs from "../components/recentncrs";
import Button from "../components/button";
import { NcrModal } from "../components/NcrModal";
import type { NcRecord } from "../components/api";
import type { NcrFields } from "../components/ncrService";
import { useNcrList } from "../components/useNcrList";

const Dashboard = () => {
	const { rows, loading, error, refetch } = useNcrList();
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<NcRecord<NcrFields> | null>(null);

	if (loading) return <p role="status">Loading NCRs...</p>;
	if (error) return <p role="alert">{error}</p>;

	return (
		<div>
			<h1>Quality Control Dashboard</h1>
			<div>
				<Button
					text="New NCR"
					aria="New NCR"
					icon={FaPlus}
					onClick={() => setCreating(true)}
				/>

				<table>
					<caption>NCRs</caption>
					<thead>
						<tr>
							<th scope="col" className="col-number">
								Number
							</th>
							<th scope="col">Defect</th>
							<th scope="col" className="col-actions">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.id}>
								<td>{row.fields.NCRNumber}</td>
								<td
									className="defect-cell"
									title={row.fields.NCRDefectDescription ?? ""}
								>
									{row.fields.NCRDefectDescription}
								</td>
								<td>
									<Button
										text="Edit"
										aria={`Edit NCR ${row.fields.NCRNumber}`}
										onClick={() => setEditing(row)}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>

				<NcrModal
					open={creating}
					onClose={() => setCreating(false)}
					onSaved={refetch}
				/>
				<NcrModal
					open={editing !== null}
					edit
					data={editing ?? undefined}
					onClose={() => setEditing(null)}
					onSaved={refetch}
				/>
			</div>
			<div className="stats-row">
				<StatusCard
					title="Open NCRs"
					amount={1}
					subtext="Requiring immediate action"
					icon={FiAlertCircle}
					colour="red"
				/>
				<StatusCard
					title="awaiting review"
					amount={0}
					subtext="Pending QA coordination sign-off"
					icon={FaRegClock}
					colour="orange"
				/>
				<StatusCard
					title="closed ncrs"
					amount={1}
					subtext="Resolved this quarter"
					icon={TbCircleCheck}
					colour="green"
				/>
				<StatusCard
					title="total NCRs"
					amount={2}
					subtext="All logged occurrences"
					icon={LuArchive}
					colour="blue"
				/>
			</div>
			<RecentNcrs />
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
