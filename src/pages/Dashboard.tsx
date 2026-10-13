import { useState } from "react";
import StatusCard from "../components/statusCard";
import { TbCircleCheck } from "react-icons/tb";
import { LuArchive } from "react-icons/lu";
import { FiAlertCircle } from "react-icons/fi";
import { FaRegClock, FaPlus } from "react-icons/fa6";
import Button from "../components/button";
import { NcrModal } from "../components/NcrModal";
import type { NcRecord } from "../components/api";
import type { NcrFields } from "../components/ncrService";
import { useNcrList } from "../components/useNcrList";

const NCR_PAGE_HREF = "/ncrs";

const isOpen = (status: unknown) =>
	(typeof status === "string" ? status : "").trim().toLowerCase() === "open";

const formatDate = (value: unknown) => {
	if (!value || typeof value !== "string") return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const Dashboard = () => {
	const { rows, loading, error, refetch } = useNcrList();
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<NcRecord<NcrFields> | null>(null);

	if (loading) return <p role="status">Loading NCRs...</p>;
	if (error) return <p role="alert">{error}</p>;

	const openRows = rows.filter((row) => isOpen(row.fields.NCRStatus));

	return (
		<div className="page">
			<h1>Quality Control Dashboard</h1>

			<section aria-labelledby="open-ncrs-heading">
				<div className="table-header">
					<h2 id="open-ncrs-heading">Open NCRs</h2>
					<div className="table-actions">
						<a href={NCR_PAGE_HREF}>View all NCRs</a>
						<Button
							text="New NCR"
							aria="New NCR"
							icon={FaPlus}
							onClick={() => setCreating(true)}
						/>
					</div>
				</div>

				<div className="table-wrap">
					<table aria-labelledby="open-ncrs-heading">
						<thead>
							<tr>
								<th scope="col">ID</th>
								<th scope="col">Date</th>
								<th scope="col">Status</th>
								<th scope="col" className="col-action">
									Action
								</th>
							</tr>
						</thead>
						<tbody>
							{openRows.length === 0 ? (
								<tr>
									<td colSpan={4}>No open NCRs.</td>
								</tr>
							) : (
								openRows.map((row) => (
									<tr key={row.id}>
										<td>{String(row.fields.NCRNumber ?? "")}</td>
										<td>{formatDate(row.fields.NCRDate)}</td>
										<td>{String(row.fields.NCRStatus ?? "")}</td>
										<td>
											<Button
												text="Edit"
												aria={`Edit NCR ${String(row.fields.NCRNumber ?? "")}`}
												onClick={() => setEditing(row)}
											/>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

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
			</section>

			<div className="card-grid">
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

			<style jsx>{`
				.table-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 1rem;
					margin-bottom: 0.75rem;
				}

				.table-header h2 {
					margin-bottom: 0;
				}

				.table-actions {
					display: flex;
					align-items: center;
					gap: 1.25rem;
				}

				.table-actions a {
					color: var(--link);
					font-weight: 500;
					text-underline-offset: 0.2em;
				}

				.table-wrap {
					overflow-x: auto;
					background: var(--lifted-bg);
					border: 1px solid var(--border);
					border-radius: 0.75rem;
					box-shadow: var(--shadow);
				}

				table {
					width: 100%;
					border-collapse: collapse;
				}

				th,
				td {
					padding: 0.75rem 1rem;
					text-align: left;
					border-bottom: 1px solid var(--border);
				}

				th {
					color: var(--text-h);
					font-weight: 600;
					white-space: nowrap;
				}

				td {
					color: var(--text);
				}

				tbody tr:last-child td {
					border-bottom: none;
				}

				tbody tr:hover {
					background: var(--hover);
				}

				.col-action {
					width: 7rem;
				}

				@media (max-width: 768px) {
					.table-header {
						flex-direction: column;
						align-items: flex-start;
					}
				}
			`}</style>
		</div>
	);
};

export default Dashboard;