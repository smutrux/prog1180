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
import { NewNcrButton } from "../components/ncrModal";
import PageHeader from "../components/pageHeader";
import StatusCard from "../components/statusCard";
import {
	OVERDUE_DAYS,
	loadReport,
	type Report,
} from "../components/reportsService";

type CardProps = ComponentProps<typeof StatusCard>;
interface Group {
	id: string;
	title: string;
	cards: CardProps[];
}

/** Writes a count with the right singular or plural word, such as "1 day" or "3 days". */
const plural = (n: number, one: string, many: string) =>
	`${n} ${n === 1 ? one : many}`;

/**
 * Stands in for the real numbers while the page loads. The cards built from it
 * are drawn as placeholders, so only their size matters, not their content.
 */
/** Stands in for the real numbers while the page loads. The cards built from it are drawn as placeholders. */
const EMPTY_REPORT: Report = {
	total: 0,
	open: 0,
	onHold: 0,
	closed: 0,
	awaitingReview: 0,
	openedThisMonth: 0,
	openedLastMonth: 0,
	closedThisMonth: 0,
	closedLastMonth: 0,
	averageDaysToClose: null,
	closedWithDates: 0,
	overdue: 0,
	oldestOpen: null,
	defectRate: null,
	defective: 0,
	received: 0,
	awaitingDisposition: 0,
	topProblem: null,
	topSupplier: null,
	fromSuppliers: 0,
	fromWip: 0,
};

/** Every card is a number plus one line of plain-language context. */
/** Turns the report numbers into the cards, grouped under the page's section headings. */
function buildGroups(r: Report): Group[] {
	const supplierShare = r.total
		? Math.round((r.fromSuppliers / r.total) * 100)
		: 0;
	return [
		{
			id: "status",
			title: "Status",
			cards: [
				{
					title: "Open NCRs",
					amount: r.open,
					subtext: r.onHold ? `${r.onHold} on hold` : "None on hold",
					icon: FaFolderOpen,
					colour: "orange",
				},
				{
					title: "Closed NCRs",
					amount: r.closed,
					subtext: `${r.closedThisMonth} closed this month`,
					icon: FaCheckCircle,
					colour: "green",
				},
				{
					title: "Awaiting review",
					amount: r.awaitingReview,
					subtext: "Open NCRs with a review pending",
					icon: FaHourglassHalf,
					colour: "blue",
				},
				{
					title: "Total NCRs",
					amount: r.total,
					subtext: "All NCRs raised",
					icon: FaClipboardList,
					colour: "blue",
				},
			],
		},
		{
			id: "timing",
			title: "Timing",
			cards: [
				{
					title: "Opened this month",
					amount: r.openedThisMonth,
					subtext: `${r.openedLastMonth} last month`,
					icon: FaCalendarPlus,
					colour: "blue",
				},
				{
					title: "Closed this month",
					amount: r.closedThisMonth,
					subtext: `${r.closedLastMonth} last month`,
					icon: FaCalendarCheck,
					colour: "green",
				},
				{
					title: "Average days to close",
					amount: r.averageDaysToClose ?? 0,
					subtext: r.closedWithDates
						? `Across ${plural(r.closedWithDates, "closed NCR", "closed NCRs")}`
						: "No closed NCRs yet",
					icon: FaStopwatch,
					colour: "blue",
				},
				{
					title: `Open over ${OVERDUE_DAYS} days`,
					amount: r.overdue,
					subtext: r.oldestOpen
						? `Oldest: NCR ${r.oldestOpen.ncrNumber}, ${plural(r.oldestOpen.days, "day", "days")}`
						: "No open NCRs",
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
					subtext: r.received
						? `${r.defective} defective of ${r.received} received`
						: "No quantities recorded yet",
					icon: FaPercentage,
					colour: "red",
				},
				{
					title: "Awaiting disposition",
					amount: r.awaitingDisposition,
					subtext: "Open NCRs with no decision yet",
					icon: FaBalanceScale,
					colour: "orange",
				},
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

/** The reports page: grouped numbers about every NCR, with a Refresh button. */
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

	if (!report && !loading) {
		return (
			<div className="page">
				<PageHeader title="Reports" />
				{error && (
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
				<NewNcrButton onSaved={() => void load()} />
			</div>
		);
	}

	const placeholder = !report;
	const description = placeholder
		? "Loading data..."
		: loading
			? "Refreshing..."
			: updatedAt
				? `Updated at ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
				: undefined;

	return (
		<div className="page">
			<PageHeader title="Reports" description={description} live>
				<Button
					text="Refresh"
					aria="Refresh reports"
					icon={FaSyncAlt}
					enabled={!loading}
					onClick={() => void load()}
				/>
			</PageHeader>

			{report && error && (
				<p role="alert" className="reportsError">
					The numbers could not be refreshed. {error}
				</p>
			)}

			{buildGroups(report ?? EMPTY_REPORT).map((group) => (
				<section key={group.id} aria-labelledby={`reports-${group.id}`}>
					<h2 id={`reports-${group.id}`}>{group.title}</h2>
					<ul className="card-grid">
						{group.cards.map((card) => (
							<li key={card.title}>
								<StatusCard {...card} loading={placeholder} />
							</li>
						))}
					</ul>
				</section>
			))}

			<NewNcrButton onSaved={() => void load()} />

			<style jsx>{`
				.reportsError {
					color: var(--error);
					font-weight: 600;
				}
			`}</style>
		</div>
	);
};

export default Reports;
