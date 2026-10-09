/* Loads the tables the Reports page needs and turns them into the numbers
   on the cards. computeReport is a plain function, so it can be tested
   without a database. */
import { fkValue, listAll, refId, type NcRecord, type TableName } from "./api";
import { IN_HOUSE_SUPPLIER, PROCESS_LABELS } from "./ncrService";

/* ---- What the numbers mean. Change here if your wording differs. ---- */
export const STATUS_CLOSED = "Closed"; // any other status counts as open
export const STATUS_ON_HOLD = "On Hold";
export const REVIEW_OPEN = ["Pending", "In Review"]; // review statuses that mean "awaiting review"
export const OVERDUE_DAYS = 30; // an open NCR older than this is overdue

/* ---- Row shapes (only the columns read here) ---- */
interface NcrRow {
	NCRNumber: string | null;
	NCRProcessApplicable: string | null;
	NCRQuantityReceived: number | null;
	NCRQuantityDefective: number | null;
	NCRDisposition: string | null;
	NCRCreatedAtD: string | null;
	NCRClosedAt: string | null;
	StatusId: unknown;
	POLineItemId: unknown;
}
interface StatusRow { NCRStatusName: string | null }
interface NcrProblemRow { NCRId: unknown; ProblemTypeId: unknown }
interface ProblemTypeRow { ProblemTypeLabel: string | null }
interface NcrPersonRow { NCRId: unknown; ReviewStatusId: unknown }
interface ReviewStatusRow { ReviewStatusName: string | null }
interface POLineRow { PurchaseOrderId: unknown }
interface PurchaseOrderRow { SupplierId: unknown }
interface SupplierRow { SupplierName: string | null }

export interface RawReportData {
	ncrs: NcRecord<NcrRow>[];
	statuses: NcRecord<StatusRow>[];
	ncrProblems: NcRecord<NcrProblemRow>[];
	problemTypes: NcRecord<ProblemTypeRow>[];
	ncrPeople: NcRecord<NcrPersonRow>[];
	reviewStatuses: NcRecord<ReviewStatusRow>[];
	poLines: NcRecord<POLineRow>[];
	purchaseOrders: NcRecord<PurchaseOrderRow>[];
	suppliers: NcRecord<SupplierRow>[];
}

export interface Report {
	total: number;
	open: number;
	onHold: number;
	closed: number;
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
	received: number;
	awaitingDisposition: number;
	topProblem: { label: string; count: number } | null;
	topSupplier: { name: string; count: number } | null;
	fromSuppliers: number;
	fromWip: number;
}

const same = (a: string | null | undefined, b: string) =>
	(a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

function parseDate(v: unknown): Date | null {
	if (typeof v !== "string" || !v.trim()) return null;
	const d = new Date(v.trim().replace(" ", "T")); // "2026-10-07 04:00:00+00:00"
	return Number.isNaN(d.getTime()) ? null : d;
}
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const DAY = 24 * 60 * 60 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;

function nameMap<F extends object>(table: TableName, rows: NcRecord<F>[], pick: (f: F) => string | null) {
	return new Map(rows.map((r) => [refId(table, r), (pick(r.fields) ?? "").trim()]));
}

/** The name with the highest count. Ties go to the first name alphabetically. */
function top(counts: Map<string, number>): { name: string; count: number } | null {
	const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
	return best ? { name: best[0], count: best[1] } : null;
}

export function computeReport(raw: RawReportData, now: Date = new Date()): Report {
	const statusName = nameMap("NCRStatus", raw.statuses, (f) => f.NCRStatusName);
	const reviewName = nameMap("ReviewStatus", raw.reviewStatuses, (f) => f.ReviewStatusName);
	const problemLabel = nameMap("ProblemType", raw.problemTypes, (f) => f.ProblemTypeLabel);
	const supplierName = nameMap("Supplier", raw.suppliers, (f) => f.SupplierName);
	const poSupplier = new Map(raw.purchaseOrders.map((r) => [refId("PurchaseOrder", r), fkValue(r.fields.SupplierId)]));
	const poLinePo = new Map(raw.poLines.map((r) => [refId("POLineItem", r), fkValue(r.fields.PurchaseOrderId)]));

	const thisMonth = monthIndex(now);
	const lastMonth = thisMonth - 1;

	const openNcrs: NcRecord<NcrRow>[] = [];
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

	for (const ncr of raw.ncrs) {
		const f = ncr.fields;
		const status = statusName.get(fkValue(f.StatusId) ?? -1) ?? "";
		const isClosed = same(status, STATUS_CLOSED);
		if (isClosed) closed++;
		else {
			openNcrs.push(ncr);
			if (same(status, STATUS_ON_HOLD)) onHold++;
		}

		const created = parseDate(f.NCRCreatedAtD);
		const closedAt = parseDate(f.NCRClosedAt);
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

		if (typeof f.NCRQuantityReceived === "number" && typeof f.NCRQuantityDefective === "number") {
			received += f.NCRQuantityReceived;
			defective += f.NCRQuantityDefective;
		}

		if (same(f.NCRProcessApplicable, PROCESS_LABELS.supplier)) fromSuppliers++;
		if (same(f.NCRProcessApplicable, PROCESS_LABELS.wip)) fromWip++;

		/* NCR -> PO line -> purchase order -> supplier */
		const poId = poLinePo.get(fkValue(f.POLineItemId) ?? -1);
		const supplierId = poId == null ? null : poSupplier.get(poId);
		const name = supplierId == null ? "" : (supplierName.get(supplierId) ?? "");
		if (name && !same(name, IN_HOUSE_SUPPLIER)) supplierCounts.set(name, (supplierCounts.get(name) ?? 0) + 1);
	}

	/* Open NCRs: age, overdue, disposition */
	let overdue = 0;
	let awaitingDisposition = 0;
	let oldestOpen: Report["oldestOpen"] = null;
	for (const ncr of openNcrs) {
		const created = parseDate(ncr.fields.NCRCreatedAtD);
		if (created) {
			const days = Math.floor((now.getTime() - created.getTime()) / DAY);
			if (days > OVERDUE_DAYS) overdue++;
			if (!oldestOpen || days > oldestOpen.days) oldestOpen = { days, ncrNumber: (ncr.fields.NCRNumber ?? "").trim() };
		}
		const disposition = (ncr.fields.NCRDisposition ?? "").trim();
		if (!disposition || same(disposition, "Pending")) awaitingDisposition++;
	}

	/* Awaiting review: open NCRs with a person whose review is still pending */
	const openRefs = new Set(openNcrs.map((n) => refId("NCR", n)));
	const awaiting = new Set<number>();
	for (const p of raw.ncrPeople) {
		const ncrRef = fkValue(p.fields.NCRId);
		const review = reviewName.get(fkValue(p.fields.ReviewStatusId) ?? -1) ?? "";
		if (ncrRef !== null && openRefs.has(ncrRef) && REVIEW_OPEN.some((s) => same(review, s))) awaiting.add(ncrRef);
	}

	/* Most common problem type (only rows that belong to a real NCR) */
	const allRefs = new Set(raw.ncrs.map((n) => refId("NCR", n)));
	const problemCounts = new Map<string, number>();
	for (const row of raw.ncrProblems) {
		const ncrRef = fkValue(row.fields.NCRId);
		const label = problemLabel.get(fkValue(row.fields.ProblemTypeId) ?? -1);
		if (ncrRef !== null && allRefs.has(ncrRef) && label) problemCounts.set(label, (problemCounts.get(label) ?? 0) + 1);
	}
	const topProblem = top(problemCounts);
	const topSupplier = top(supplierCounts);

	return {
		total: raw.ncrs.length,
		open: openNcrs.length,
		onHold,
		closed,
		awaitingReview: awaiting.size,
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
		topSupplier,
		fromSuppliers,
		fromWip,
	};
}

export async function loadReport(): Promise<Report> {
	const [ncrs, statuses, ncrProblems, problemTypes, ncrPeople, reviewStatuses, poLines, purchaseOrders, suppliers] =
		await Promise.all([
			listAll<NcrRow>("NCR"),
			listAll<StatusRow>("NCRStatus"),
			listAll<NcrProblemRow>("NCRProblemType"),
			listAll<ProblemTypeRow>("ProblemType"),
			listAll<NcrPersonRow>("NCRPerson"),
			listAll<ReviewStatusRow>("ReviewStatus"),
			listAll<POLineRow>("POLineItem"),
			listAll<PurchaseOrderRow>("PurchaseOrder"),
			listAll<SupplierRow>("Supplier"),
		]);
	return computeReport({ ncrs, statuses, ncrProblems, problemTypes, ncrPeople, reviewStatuses, poLines, purchaseOrders, suppliers });
}
