import { supabase } from "../utils/supabase";
import {
	IN_HOUSE_SUPPLIER,
	PROCESS_LABELS,
	loadAllNcrRows,
	type NcrListRow,
} from "./ncrService";

/** The status name that means an NCR is closed. Any other status counts as open. */
export const STATUS_CLOSED = "Closed";
/** The status name that means an open NCR is on hold. */
export const STATUS_ON_HOLD = "On Hold";
/** An open NCR older than this many days is overdue. */
export const OVERDUE_DAYS = 30;

/** One problem type ticked on one NCR. */
export interface NcrProblem {
	ncrId: number;
	label: string;
}

/** What the report reads, as the database returned it. */
export interface RawReportData {
	/** Rows of the `ncr_list` view, drafts included (the report skips them). */
	ncrs: NcrListRow[];
	ncrProblems: NcrProblem[];
}

/** The numbers shown on the Reports page and the Dashboard. */
export interface Report {
	total: number;
	open: number;
	onHold: number;
	closed: number;
	/** Open NCRs still waiting on engineering, or on purchasing when they come from a supplier. */
	awaitingReview: number;
	openedThisMonth: number;
	openedLastMonth: number;
	closedThisMonth: number;
	closedLastMonth: number;
	/** null when no closed NCR has both dates */
	averageDaysToClose: number | null;
	closedWithDates: number;
	overdue: number;
	oldestOpen: { days: number; ncrNumber: string } | null;
	/** percent, null when no quantities were recorded */
	defectRate: number | null;
	defective: number;
	/** The total quantity ordered. The database no longer records a separate quantity received. */
	received: number;
	/** Open NCRs with no engineering disposition yet, or a disposition of Pending. */
	awaitingDisposition: number;
	topProblem: { label: string; count: number } | null;
	topSupplier: { name: string; count: number } | null;
	fromSuppliers: number;
	fromWip: number;
}

/** Compares two names, ignoring case and spaces at the ends. */
const same = (a: string | null | undefined, b: string) =>
	(a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/** Reads a date from the database. Returns null for anything that is not a date. */
function parseDate(v: unknown): Date | null {
	if (typeof v !== "string" || !v.trim()) return null;
	const d = new Date(v.trim().replace(" ", "T"));
	return Number.isNaN(d.getTime()) ? null : d;
}
/** A number that increases by one each month, so months can be compared. */
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const DAY = 24 * 60 * 60 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The name with the highest count. Ties go to the first name alphabetically. */
function top(counts: Map<string, number>): { name: string; count: number } | null {
	const best = [...counts.entries()].sort(
		(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
	)[0];
	return best ? { name: best[0], count: best[1] } : null;
}

/**
 * Works out every number in the report. It is a plain function, so it can be tested without a database.
 *
 * @param raw - The rows, as the database returned them.
 * @param now - The current time. Pass a fixed date in tests.
 * @returns The report.
 */
export function computeReport(raw: RawReportData, now: Date = new Date()): Report {
	const thisMonth = monthIndex(now);
	const lastMonth = thisMonth - 1;

	/** Drafts are unfinished, so they are left out of every number in the report. */
	const ncrs = raw.ncrs.filter((n) => !n.is_draft);

	const openNcrs: NcrListRow[] = [];
	let closed = 0;
	let onHold = 0;
	let openedThisMonth = 0;
	let openedLastMonth = 0;
	let closedThisMonth = 0;
	let closedLastMonth = 0;
	let closeDaysTotal = 0;
	let closedWithDates = 0;
	let received = 0;
	let defective = 0;
	let fromSuppliers = 0;
	let fromWip = 0;
	const supplierCounts = new Map<string, number>();

	for (const n of ncrs) {
		const isClosed = same(n.status_label, STATUS_CLOSED);
		if (isClosed) closed++;
		else {
			openNcrs.push(n);
			if (same(n.status_label, STATUS_ON_HOLD)) onHold++;
		}

		const created = parseDate(n.ncr_created_at);
		const closedAt = parseDate(n.ncr_closed_at);
		if (created) {
			if (monthIndex(created) === thisMonth) openedThisMonth++;
			if (monthIndex(created) === lastMonth) openedLastMonth++;
		}
		if (isClosed && closedAt) {
			if (monthIndex(closedAt) === thisMonth) closedThisMonth++;
			if (monthIndex(closedAt) === lastMonth) closedLastMonth++;
			if (created && closedAt >= created) {
				closeDaysTotal += (closedAt.getTime() - created.getTime()) / DAY;
				closedWithDates++;
			}
		}

		if (typeof n.quantity_ordered === "number" && typeof n.quantity_defective === "number") {
			received += n.quantity_ordered;
			defective += n.quantity_defective;
		}

		if (same(n.process_label, PROCESS_LABELS.supplier)) fromSuppliers++;
		if (same(n.process_label, PROCESS_LABELS.wip)) fromWip++;

		const supplier = (n.supplier_name ?? "").trim();
		if (supplier && !same(supplier, IN_HOUSE_SUPPLIER))
			supplierCounts.set(supplier, (supplierCounts.get(supplier) ?? 0) + 1);
	}

	let overdue = 0;
	let awaitingDisposition = 0;
	let awaitingReview = 0;
	let oldestOpen: Report["oldestOpen"] = null;
	for (const n of openNcrs) {
		const created = parseDate(n.ncr_created_at);
		if (created) {
			const days = Math.floor((now.getTime() - created.getTime()) / DAY);
			if (days > OVERDUE_DAYS) overdue++;
			if (!oldestOpen || days > oldestOpen.days)
				oldestOpen = { days, ncrNumber: n.ncr_number.trim() };
		}
		const disposition = (n.disposition_label ?? "").trim();
		if (!n.has_engineering || same(disposition, "Pending")) awaitingDisposition++;
		const needsPurchasing = same(n.process_label, PROCESS_LABELS.supplier);
		if (!n.has_engineering || (needsPurchasing && !n.has_purchasing)) awaitingReview++;
	}

	const allIds = new Set(ncrs.map((n) => n.ncr_id));
	const problemCounts = new Map<string, number>();
	for (const p of raw.ncrProblems) {
		if (allIds.has(p.ncrId) && p.label)
			problemCounts.set(p.label, (problemCounts.get(p.label) ?? 0) + 1);
	}
	const topProblem = top(problemCounts);

	return {
		total: ncrs.length,
		open: openNcrs.length,
		onHold,
		closed,
		awaitingReview,
		openedThisMonth,
		openedLastMonth,
		closedThisMonth,
		closedLastMonth,
		averageDaysToClose: closedWithDates ? round1(closeDaysTotal / closedWithDates) : null,
		closedWithDates,
		overdue,
		oldestOpen,
		defectRate: received > 0 ? round1((defective / received) * 100) : null,
		defective,
		received,
		awaitingDisposition,
		topProblem: topProblem && { label: topProblem.name, count: topProblem.count },
		topSupplier: top(supplierCounts),
		fromSuppliers,
		fromWip,
	};
}

/** Every problem type ticked on any NCR (in pages: the API returns at most 1000 rows per request). */
async function loadProblems(): Promise<NcrProblem[]> {
	const PAGE = 1000;
	const out: NcrProblem[] = [];
	for (let from = 0; ; from += PAGE) {
		const { data, error } = await supabase
			.from("ncr_problem_type")
			.select("ncr_id, problem_type ( problem_type_label )")
			.order("ncr_problem_type_id")
			.range(from, from + PAGE - 1);
		if (error) throw new Error(error.message);
		out.push(
			...data.map((r) => ({
				ncrId: r.ncr_id,
				label: (r.problem_type?.problem_type_label ?? "").trim(),
			})),
		);
		if (data.length < PAGE) return out;
	}
}

/** Loads the data the report needs and works out the report. */
export async function loadReport(): Promise<Report> {
	const [ncrs, ncrProblems] = await Promise.all([loadAllNcrRows(), loadProblems()]);
	return computeReport({ ncrs, ncrProblems });
}