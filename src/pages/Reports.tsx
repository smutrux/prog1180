import { useCallback, useEffect, useState, type ComponentProps } from "react";
import {
	FaBalanceScale,
	FaCalendarCheck,
	FaCalendarPlus,
	FaCheckCircle,
	FaClipboardList,
	FaExclamationCircle,
	FaExclamationTriangle,
	FaFolderOpen,
	FaHourglassHalf,
	FaIndustry,
	FaPercentage,
	FaStopwatch,
	FaSyncAlt,
	FaTruck,
} from "react-icons/fa";
import Button from "../components/button";
import StatusCard from "../components/statusCard";
import { OVERDUE_DAYS, loadReport, type Report } from "../components/reportsService";

type CardProps = ComponentProps<typeof StatusCard>;
interface Group {
	id: string;
	title: string;
	cards: CardProps[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* Every card is a number plus one line of plain-language context. */
function buildGroups(r: Report): Group[] {
	const supplierShare = r.total ? Math.round((r.fromSuppliers / r.total) * 100) : 0;
	return [
		{
			id: "status",
			title: "Status",
			cards: [
				{ title: "Open NCRs", amount: r.open, subtext: r.onHold ? `${r.onHold} on hold` : "None on hold", icon: FaFolderOpen, colour: "orange" },
				{ title: "Closed NCRs", amount: r.closed, subtext: `${r.closedThisMonth} closed this month`, icon: FaCheckCircle, colour: "green" },
				{ title: "Awaiting review", amount: r.awaitingReview, subtext: "Open NCRs with a review pending", icon: FaHourglassHalf, colour: "blue" },
				{ title: "Total NCRs", amount: r.total, subtext: "All NCRs raised", icon: FaClipboardList, colour: "blue" },
			],
		},
		{
			id: "timing",
			title: "Timing",
			cards: [
				{ title: "Opened this month", amount: r.openedThisMonth, subtext: `${r.openedLastMonth} last month`, icon: FaCalendarPlus, colour: "blue" },
				{ title: "Closed this month", amount: r.closedThisMonth, subtext: `${r.closedLastMonth} last month`, icon: FaCalendarCheck, colour: "green" },
				{
					title: "Average days to close",
					amount: r.averageDaysToClose ?? 0,
					subtext: r.closedWithDates ? `Across ${plural(r.closedWithDates, "closed NCR", "closed NCRs")}` : "No closed NCRs yet",
					icon: FaStopwatch,
					colour: "blue",
				},
				{
					title: `Open over ${OVERDUE_DAYS} days`,
					amount: r.overdue,
					subtext: r.oldestOpen ? `Oldest: NCR ${r.oldestOpen.ncrNumber}, ${plural(r.oldestOpen.days, "day", "days")}` : "No open NCRs",
					icon: FaExclamationTriangle,
					colour: "red",
				},
			],
		},
		{
			id: "quality",
			title: "Quality",
			cards: [
				{
					title: "Defect rate (%)",
					amount: r.defectRate ?? 0,
					subtext: r.received ? `${r.defective} defective of ${r.received} received` : "No quantities recorded yet",
					icon: FaPercentage,
					colour: "red",
				},
				{ title: "Awaiting disposition", amount: r.awaitingDisposition, subtext: "Open NCRs with no decision yet", icon: FaBalanceScale, colour: "orange" },
				{
					title: "Most common problem",
					amount: r.topProblem?.count ?? 0,
					subtext: r.topProblem?.label ?? "No problems recorded yet",
					icon: FaExclamationCircle,
					colour: "orange",
				},
			],
		},
		{
			id: "sources",
			title: "Sources",
			cards: [
				{
					title: "Most NCRs by supplier",
					amount: r.topSupplier?.count ?? 0,
					subtext: r.topSupplier?.name ?? "No supplier NCRs yet",
					icon: FaTruck,
					colour: "orange",
				},
				{
					title: "From suppliers",
					amount: r.fromSuppliers,
					subtext: `${supplierShare}% of all NCRs. ${r.fromWip} from work in progress.`,
					icon: FaIndustry,
					colour: "blue",
				},
			],
		},
	];
}

const Reports = () => {
	const [report, setReport] = useState<Report | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setReport(await loadReport());
			setUpdatedAt(new Date());
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

	if (!report) {
		return (
			<div className="reports">
				<h1>Reports</h1>
				{loading && <p role="status">Loading reports...</p>}
				{error && (
					<>
						<p role="alert">{error}</p>
						<div>
							<Button text="Try again" aria="Try again" icon={FaSyncAlt} onClick={() => void load()} />
						</div>
					</>
				)}
				<style jsx>{`
					.reports { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
					.reports h1 { margin: 0; }
				`}</style>
			</div>
		);
	}

	return (
		<div className="reports">
			<div className="reportsHeader">
				<div>
					<h1>Reports</h1>
					<p role="status" className="reportsUpdated">
						{loading
							? "Refreshing..."
							: updatedAt && `Updated at ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
					</p>
				</div>
				<Button text="Refresh" aria="Refresh reports" icon={FaSyncAlt} enabled={!loading} onClick={() => void load()} />
			</div>

			{error && <p role="alert" className="reportsError">The numbers could not be refreshed. {error}</p>}

			{buildGroups(report).map((group) => (
				<section key={group.id} aria-labelledby={`reports-${group.id}`} className="reportsGroup">
					<h2 id={`reports-${group.id}`}>{group.title}</h2>
					<ul className="cardGrid">
						{group.cards.map((card) => (
							<li key={card.title}>
								<StatusCard {...card} />
							</li>
						))}
					</ul>
				</section>
			))}

			<style jsx>{`
				.reports { display: flex; flex-direction: column; gap: 1.5rem; }
				.reportsHeader { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
				.reportsHeader h1 { margin: 1.5rem 0; }
				.reportsUpdated { margin: 0.5rem 0; color: var(--text-h); font-size: 0.95rem; }
				.reportsError { margin: 0; color: #b3001b; font-weight: 600; }
				.reportsGroup h2 { margin: 0 0 0.75rem; font-size: 1.25rem; }
				.cardGrid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
					gap: 1rem;
					margin: 0;
					padding: 0;
					list-style: none;
				}
			`}</style>
		</div>
	);
};

export default Reports;