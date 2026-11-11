import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { looseSupabase, supabase } from "../utils/supabase";
import {
	IN_HOUSE_SUPPLIER,
	isDraftRecord,
	loadNcrForEdit,
	loadStatuses,
	parseDraft,
	unarchiveNcr,
	type NcrListRow,
	type NcrRecord,
} from "./ncrService";
import { FaSyncAlt } from "react-icons/fa";
import Button from "./button";
import { NcrDetailsModal, NcrModal } from "./ncrModal";
import { useCurrentUser } from "./currentUser";

export type NcrShow = "all" | "archived";

interface NcrsProps {
	show?: NcrShow;
	simple?: boolean;
	pageSize?: number;
	editable?: boolean;
	label?: string;
}

interface NcrRow {
	record: NcrRecord;
	ncrNumber: string;
	date: Date | null;
	supplier: string;
	product: string;
	qtyOrdered: string;
	qtyDefective: string;
	defect: string;
	status: string;
}

interface Filters {
	search: string;
	status: string;
	dateRange: string;
	supplier: string;
	show: NcrShow;
}

interface PageResult {
	rows: NcrRow[];
	total: number;
}

const ALL_STATUSES = "All";
const ALL_TIME = "All Time";
const DATE_OPTIONS = [
	{ label: "Last 7 Days", days: 7 },
	{ label: "Last 30 Days", days: 30 },
	{ label: "Last 90 Days", days: 90 },
	{ label: ALL_TIME, days: null },
];
const ALL_SUPPLIERS = "All Suppliers";
const DEFAULT_DATE = "Last 30 Days";
/** How in-house production is named in the list and the Supplier filter. */
const IN_HOUSE_LABEL = "In-house";
/** Which colour a status pill gets. */
const statusTone = (s: string) =>
	/clos|complet|resolv|approv|archive/i.test(s)
		? "closed"
		: /open|new|pending/i.test(s)
			? "open"
			: "other";

const isArchived = (status: string) => statusTone(status) === "closed";

function parseDate(v: unknown): Date | null {
	if (typeof v !== "string" || !v.trim()) return null;
	const d = new Date(v.trim().replace(" ", "T"));
	return Number.isNaN(d.getTime()) ? null : d;
}

/** The status shown for an NCR. Drafts always show "Draft". */
const STATUS_DRAFT_LABEL = "Draft";
const NEW_SUPPLIER_CHOICE = "Not listed: add a new supplier";

/** A list row built from the answers saved in a draft. */
function draftRow(r: NcrListRow): NcrRow {
	const v = parseDraft(r)?.values ?? {};
	const str = (section: string, key: string) => {
		const x = v[section]?.[key];
		return typeof x === "string" ? x.trim() : "";
	};
	const process = str("process", "processType");
	const chosen = str("process", "supplier");
	const supplier =
		(chosen === NEW_SUPPLIER_CHOICE ? str("process", "newSupplierName") : chosen) ||
		(process ? IN_HOUSE_LABEL : "-");
	return {
		record: r,
		ncrNumber: r.ncr_number,
		date: parseDate(r.ncr_created_at),
		supplier,
		product: str("item", "itemName") || "-",
		qtyOrdered: str("defect", "qtyOrdered") || "-",
		qtyDefective: str("defect", "qtyDefective") || "-",
		defect: str("defect", "defectDescription") || "-",
		status: STATUS_DRAFT_LABEL,
	};
}

function toRow(r: NcrListRow): NcrRow {
	if (r.is_draft) return draftRow(r);
	const num = (n: number | null) => (n === null || n === undefined ? "-" : String(n));
	const supplier = (r.supplier_name ?? "").trim();
	return {
		record: r,
		ncrNumber: r.ncr_number,
		date: parseDate(r.ncr_created_at),
		supplier: !supplier
			? "-"
			: supplier.toLowerCase() === IN_HOUSE_SUPPLIER.toLowerCase()
				? IN_HOUSE_LABEL
				: supplier,
		product: r.item_name || "-",
		qtyOrdered: num(r.quantity_ordered),
		qtyDefective: num(r.quantity_defective),
		defect: r.defect_description || "-",
		status: r.status_label,
	};
}

const listeners = new Set<() => void>();

/** Tells every mounted list to load again. */
function resetLoaders() {
	listeners.forEach((l) => l());
}

/** Wraps a search term for a PostgREST `ilike` inside an `or(...)` filter. */
function likePattern(term: string): string {
	const escaped = term.replace(/[\\%_]/g, "\\$&").replace(/[\\"]/g, "\\$&");
	return `"*${escaped}*"`;
}

async function loadSupplierNames(): Promise<string[]> {
	const { data, error } = await supabase
		.from("supplier")
		.select("supplier_name")
		.order("supplier_name");
	if (error) throw new Error(error.message);
	return data.map((r: { supplier_name: string; }) =>
		r.supplier_name.trim().toLowerCase() === IN_HOUSE_SUPPLIER.toLowerCase()
			? IN_HOUSE_LABEL
			: r.supplier_name.trim(),
	);
}

/**
 * One page of NCRs. The database does the filtering, searching, counting and
 * paging (see the `ncr_list` view in sql/01_ncr_functions.sql). Draft rows are
 * found by NCR number only, because their other answers are stored as text.
 */
async function fetchNcrPage(
	page: number,
	pageSize: number,
	filters: Filters,
): Promise<PageResult> {
	let q = looseSupabase.from("ncr_list").select("*", { count: "exact" });

	if (filters.show === "archived") q = q.eq("is_archived", true);
	if (filters.status === STATUS_DRAFT_LABEL) q = q.eq("is_draft", true);
	else if (filters.status !== ALL_STATUSES)
		q = q.eq("is_draft", false).eq("status_label", filters.status);

	const days = DATE_OPTIONS.find((d) => d.label === filters.dateRange)?.days ?? null;
	if (days !== null)
		q = q.gte("ncr_created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

	if (filters.supplier !== ALL_SUPPLIERS)
		q = q.eq(
			"supplier_name",
			filters.supplier === IN_HOUSE_LABEL ? IN_HOUSE_SUPPLIER : filters.supplier,
		);

	const term = filters.search.trim();
	if (term) {
		const pattern = likePattern(term);
		q = q.or(
			["ncr_number", "supplier_name", "item_name", "defect_description"]
				.map((col) => `${col}.ilike.${pattern}`)
				.join(","),
		);
	}

	const from = page * pageSize;
	const { data, error, count } = await q
		.order("ncr_id", { ascending: false })
		.range(from, from + pageSize - 1);
	if (error) throw new Error(error.message);

	const rows = (data as NcrListRow[]).map(toRow);
	if (rows.length > 0 && rows.some((r) => !r.date))
		console.warn("NCRs: some rows have no created date.", rows.find((r) => !r.date)?.record);
	return { rows, total: count ?? rows.length };
}

function SearchIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="7" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	);
}

function ChevronIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

function FilterPill(props: {
	label: string;
	value: string;
	options: string[];
	onChange: (value: string) => void;
}) {
	const { label, value, options, onChange } = props;
	return (
		<label className="ncrs-pill">
			<span className="ncrs-pill-label">{label}:</span>
			<span className="ncrs-pill-value">{value}</span>
			<ChevronIcon />
			<select
				className="ncrs-pill-select"
				aria-label={label}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			>
				{options.map((o) => (
					<option key={o} value={o}>
						{o}
					</option>
				))}
			</select>
			<style jsx>{`
				.ncrs-pill {
					position: relative;
					display: inline-flex;
					align-items: center;
					gap: 6px;
					min-height: 44px;
					padding: 0 14px;
					background: var(--lifted-bg);
					border: 1px solid var(--text);
					border-radius: 8px;
					color: var(--text);
					cursor: pointer;
					white-space: nowrap;
				}
				.ncrs-pill:focus-within {
					outline: 3px solid var(--focus);
					outline-offset: 2px;
				}
				.ncrs-pill-value {
					color: var(--text-h);
					font-weight: 600;
				}
				.ncrs-pill :global(svg) {
					margin-left: 6px;
				}
				.ncrs-pill-select {
					position: absolute;
					inset: 0;
					width: 100%;
					height: 100%;
					opacity: 0;
					cursor: pointer;
					font: inherit;
				}
				.ncrs-pill-select:focus-visible {
					outline: none;
				}
			`}</style>
		</label>
	);
}

function pageWindow(current: number, total: number): (number | "…")[] {
	if (total <= 5) return Array.from({ length: total }, (_, i) => i);
	if (current < 3) return [0, 1, 2, "…", total - 1];
	if (current > total - 4) return [0, "…", total - 3, total - 2, total - 1];
	return [0, "…", current - 1, current, current + 1, "…", total - 1];
}

const Ncrs = ({
	show = "all",
	simple = false,
	pageSize = 10,
	editable: allowEdit = true,
	label = "Non-conformance reports",
}: NcrsProps) => {
	const me = useCurrentUser();
	const editable = allowEdit && me.status === "ready" && !me.isPending;
	
	const defaultDate = simple || show === "archived" ? ALL_TIME : DEFAULT_DATE;

	const [data, setData] = useState<PageResult>({ rows: [], total: 0 });
	const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const [loadError, setLoadError] = useState("");
	const [reloadKey, setReloadKey] = useState(0);

	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [status, setStatus] = useState<string>(ALL_STATUSES);
	const [dateChoice, setDateChoice] = useState<string | null>(null);
	const [supplier, setSupplier] = useState<string>(ALL_SUPPLIERS);
	const dateRange = dateChoice ?? defaultDate;

	const [editing, setEditing] = useState<NcrRecord | null>(null);
	const [viewing, setViewing] = useState<NcrRow | null>(null);
	const [restoring, setRestoring] = useState(false);

	const openDetails = (row: NcrRow) => {
		if (window.getSelection()?.toString()) return;
		setViewing(row);
	};

	const restoreNcr = async (row: NcrRecord) => {
		if (restoring || me.status !== "ready") return;
		setRestoring(true);
		try {
			const edit = await loadNcrForEdit(row);
			const statuses = await loadStatuses();
			await unarchiveNcr(edit, statuses, me.personId);
			resetLoaders();
			setViewing(null);
		} catch (err) {
			console.error("Could not restore the NCR:", err);
			window.alert("Could not restore the NCR. Please try again.");
		} finally {
			setRestoring(false);
		}
	};

	const [statusNames, setStatusNames] = useState<string[]>([]);
	const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);

	useEffect(() => {
		const t = window.setTimeout(() => setDebouncedSearch(search), 300);
		return () => window.clearTimeout(t);
	}, [search]);

	const filters = useMemo<Filters>(
		() =>
			simple
				? {
						search: "",
						status: ALL_STATUSES,
						dateRange: ALL_TIME,
						supplier: ALL_SUPPLIERS,
						show,
					}
				: { search: debouncedSearch, status, dateRange, supplier, show },
		[simple, debouncedSearch, status, dateRange, supplier, show],
	);
	const sig = JSON.stringify([filters, pageSize]);

	const [pageState, setPageState] = useState({ sig: "", page: 0 });
	const page = pageState.sig === sig ? pageState.page : 0;
	const goTo = useCallback(
		(p: number) => setPageState({ sig, page: p }),
		[sig],
	);

	const pageCount = Math.max(1, Math.ceil(data.total / pageSize));

	const cache = useRef(new Map<string, Promise<PageResult>>());

	const getPage = useCallback(
		(p: number) => {
			const key = `${sig}|${p}`;
			let hit = cache.current.get(key);
			if (!hit) {
				hit = fetchNcrPage(p, pageSize, filters);
				cache.current.set(key, hit);
				const failed = hit;
				failed.catch(() => {
					if (cache.current.get(key) === failed) cache.current.delete(key);
				});
			}
			return hit;
		},
		[sig, filters, pageSize],
	);

	const prefetch = (p: number) => {
		if (p >= 0 && p < pageCount) void getPage(p).catch(() => {});
	};

	useEffect(() => {
		let cancelled = false;
		setLoadState("loading");
		setLoadError("");
		getPage(page)
			.then((res) => {
				if (cancelled) return;
				setData(res);
				setLoadState("ready");
			})
			.catch((err) => {
				if (cancelled) return;
				setLoadError(err instanceof Error ? err.message : String(err));
				setLoadState("error");
			});
		return () => {
			cancelled = true;
		};
	}, [getPage, page, reloadKey]);

	useEffect(() => {
		if (loadState === "ready" && page > pageCount - 1) goTo(pageCount - 1);
	}, [loadState, page, pageCount, goTo]);

	useEffect(() => {
		if (simple) return;
		let cancelled = false;
		loadStatuses()
			.then((list) => {
				if (cancelled) return;
				setStatusNames(Array.from(new Set(list.map((s) => s.name))).sort());
			})
			.catch(() => {});
		loadSupplierNames()
			.then((names) => {
				if (!cancelled) setKnownSuppliers(names);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [simple, reloadKey]);

	useEffect(() => {
		const reload = () => {
			cache.current.clear();
			setReloadKey((k) => k + 1);
		};
		listeners.add(reload);
		return () => {
			listeners.delete(reload);
		};
	}, []);

	const statusOptions = useMemo(() => {
		const names = [
			...statusNames.filter((n) => show !== "archived" || isArchived(n)),
			...(show === "archived" ? [] : [STATUS_DRAFT_LABEL]),
		];
		return [
			ALL_STATUSES,
			...Array.from(
				new Set([...names, ...(status !== ALL_STATUSES ? [status] : [])]),
			).sort(),
		];
	}, [statusNames, status, show]);
	const supplierOptions = useMemo(
		() => [
			ALL_SUPPLIERS,
			...Array.from(
				new Set([
					...knownSuppliers,
					...(supplier !== ALL_SUPPLIERS ? [supplier] : []),
				]),
			).sort(),
		],
		[knownSuppliers, supplier],
	);

	const clearFilters = () => {
		setSearch("");
		setDebouncedSearch("");
		setStatus(ALL_STATUSES);
		setDateChoice(null);
		setSupplier(ALL_SUPPLIERS);
	};

	const showRows =
		loadState === "ready" || (loadState === "loading" && data.rows.length > 0);
	const updating = loadState === "loading" && data.rows.length > 0;
	const firstShown = data.total === 0 ? 0 : page * pageSize + 1;
	const lastShown = Math.min(data.total, page * pageSize + data.rows.length);

	const showMessage =
		loadState === "error" || data.rows.length === 0;
	const unfiltered =
		simple ||
		(search.trim() === "" &&
			status === ALL_STATUSES &&
			supplier === ALL_SUPPLIERS &&
			dateRange === ALL_TIME);
	const emptyText = !unfiltered
		? "No NCRs match your search. Change the filters or choose Clear filters."
		: show === "archived"
			? "There are no archived NCRs yet."
			: "No NCRs have been submitted yet.";

	return (
		<div className="ncrs">
			{!simple && (
				<section className="ncrs-filters" role="search" aria-label={`Search and filter: ${label}`}>
					<div className="ncrs-search">
						<SearchIcon />
						<input
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search NCRs, suppliers, or products..."
							aria-label="Search NCRs, suppliers, or products"
						/>
					</div>
					<div className="ncrs-filter-group">
						<FilterPill label="Status" value={status} options={statusOptions} onChange={setStatus} />
						<FilterPill
							label="Date"
							value={dateRange}
							options={DATE_OPTIONS.map((d) => d.label)}
							onChange={setDateChoice}
						/>
						<FilterPill label="Supplier" value={supplier} options={supplierOptions} onChange={setSupplier} />
						<button type="button" className="ncrs-clear" onClick={clearFilters}>
							Clear filters
						</button>
					</div>
				</section>
			)}

			<div className="ncrs-scroll" role="region" tabIndex={0} aria-label={`Scrollable area: ${label}`}>
				<div className="ncrs-table" role="table" aria-label={label} aria-busy={loadState === "loading"}>
					<div role="rowgroup">
						<div className="ncrs-row ncrs-head" role="row">
							<span role="columnheader">NCR number</span>
							<span role="columnheader">Supplier name</span>
							<span role="columnheader">Product name</span>
							<span role="columnheader" className="ncrs-defect">Description of defect</span>
							<span role="columnheader">Status</span>
							
						</div>
					</div>

					<div className="ncrs-body" role="rowgroup">
						{showRows &&
							data.rows.map((n) => (
								<div
									key={String(n.record.ncr_id)}
									className="ncrs-row ncrs-card ncrs-clickable"
									role="row"
									onClick={() => openDetails(n)}
								>
									<span role="cell" className="ncrs-number">
										<button
											type="button"
											className="ncrs-open"
											aria-label={`View details of NCR ${n.ncrNumber}`}
											onClick={(e) => {
												e.stopPropagation();
												setViewing(n);
											}}
										>
											{n.ncrNumber}
										</button>
									</span>
									
									<span role="cell" className="ncrs-strong truncate-this">
										{n.supplier}
									</span>
									<span role="cell" className="ncrs-strong truncate-this">
										{n.product}
									</span>
									<span role="cell" className="truncate-this ncrs-defect">{n.defect}</span>
									<span role="cell">
										<span className={`ncrs-status ncrs-status-${statusTone(n.status)}`}>
											<span className="ncrs-dot" aria-hidden="true" />
											{n.status || "-"}
										</span>
									</span>
									{editable && !isArchived(n.status) && (
										<span
											role="cell"
											className="ncrs-edit-col"
											onClick={(e) => e.stopPropagation()}
										>
											<Button												
												text={isDraftRecord(n.record) ? "Continue" : "Edit"}
												aria={`${isDraftRecord(n.record) ? "Continue" : "Edit"} NCR ${n.ncrNumber}`}
												onClick={() => setEditing(n.record)}
											/>
										</span>
									)}
								</div>
							))}

						{showMessage && (
							<div role="row">
								<div className="ncrs-empty" role="cell" aria-colspan={editable ? 9 : 8}>
									{loadState === "loading" && <p role="status">Loading NCRs...</p>}
									{loadState === "error" && (
										<>
											<p role="alert">The NCRs could not be loaded. {loadError}</p>
											<Button text="Try again" aria="Try again" icon={FaSyncAlt} onClick={resetLoaders} />
										</>
									)}
									{loadState === "ready" && <p>{emptyText}</p>}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{loadState !== "error" && (
				<nav className="ncrs-pager" aria-label={`Pagination: ${label}`}>
					<p className="ncrs-pager-info" role="status">
						Showing <strong>{firstShown}</strong> to <strong>{lastShown}</strong> of <strong>{data.total}</strong>{" "}
						{data.total === 1 ? "report" : "reports"}
						{updating && ". Updating results."}
					</p>

					<div className="ncrs-pager-controls">
						<button
							type="button"
							className="ncrs-page-btn ncrs-page-edge"
							disabled={page === 0}
							onClick={() => goTo(page - 1)}
							onMouseEnter={() => prefetch(page - 1)}
							onFocus={() => prefetch(page - 1)}
							onTouchStart={() => prefetch(page - 1)}
						>
							<span aria-hidden="true">←</span> Previous
						</button>

						{pageWindow(page, pageCount).map((p, i) =>
							p === "…" ? (
								<span key={`gap-${i}`} className="ncrs-page-gap" aria-hidden="true">
									…
								</span>
							) : (
								<button
									key={p}
									type="button"
									className={`ncrs-page-btn${p === page ? " ncrs-page-active" : ""}`}
									aria-label={`Page ${p + 1}`}
									aria-current={p === page ? "page" : undefined}
									onClick={() => goTo(p)}
									onMouseEnter={() => prefetch(p)}
									onFocus={() => prefetch(p)}
									onTouchStart={() => prefetch(p)}
								>
									{p + 1}
								</button>
							),
						)}

						<button
							type="button"
							className="ncrs-page-btn ncrs-page-edge"
							disabled={page >= pageCount - 1}
							onClick={() => goTo(page + 1)}
							onMouseEnter={() => prefetch(page + 1)}
							onFocus={() => prefetch(page + 1)}
							onTouchStart={() => prefetch(page + 1)}
						>
							Next <span aria-hidden="true">→</span>
						</button>
					</div>
				</nav>
			)}

			<NcrDetailsModal
				open={viewing !== null}
				data={viewing?.record}
				status={viewing?.status}
				onClose={() => setViewing(null)}
				onEdit={editable && viewing && !isArchived(viewing.status)
					? (row) => {
						setViewing(null);
						setEditing(row);
					}
					: undefined}
				onRestore={editable && viewing && isArchived(viewing.status)
					? (row) => void restoreNcr(row)
					: undefined}
				restoring={restoring} onPrint={function (): void {
					throw new Error("Function not implemented.");
				} }			/>

			{editable && (
				<>
					{/* <NewNcrButton onSaved={resetLoaders} /> */}
					<NcrModal
						open={editing !== null}
						onClose={() => setEditing(null)}
						edit={editing === null || !isDraftRecord(editing)}
						data={editing ?? undefined}
						onSaved={resetLoaders}
					/>
				</>
			)}

			<style jsx>{`
				.ncrs {
					--head-bg: color-mix(in srgb, var(--link) 10%, var(--lifted-bg));
					--error-bg: color-mix(in srgb, var(--error) 10%, transparent);
					--error-line: color-mix(in srgb, var(--error) 45%, transparent);
					--success-bg: color-mix(in srgb, var(--success) 10%, transparent);
					--success-line: color-mix(in srgb, var(--success) 45%, transparent);
					--cols: minmax(5rem, 6rem) minmax(6rem, 12rem) minmax(6rem, 12rem) minmax(10rem, 1fr) 6rem minmax(4rem, 7rem);
					--cols-no-defect: minmax(5rem, 6rem) minmax(6rem, 12rem) minmax(6rem, 1fr) 6rem minmax(4rem, 7rem);

					color: var(--text-h);
					font-size: 0.9375rem;
				}

				.ncrs-filters {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					justify-content: space-between;
					gap: 16px;
					margin-bottom: 24px;
					padding: 18px;
					background: var(--lifted-bg);
					border: 1px solid var(--border);
					border-radius: 14px;
				}

				.ncrs-search {
					display: flex;
					align-items: center;
					gap: 10px;
					flex: 1 1 280px;
					max-width: 440px;
					min-height: 44px;
					padding: 0 14px;
					background: var(--lifted-bg);
					border: 1px solid var(--text);
					border-radius: 8px;
					color: var(--text);
				}

				.ncrs-search:focus-within {
					outline: 3px solid var(--focus);
					outline-offset: 2px;
				}

				.ncrs-search input {
					flex: 1;
					min-width: 0;
					min-height: 42px;
					border: 0;
					outline: 0;
					background: transparent;
					font: inherit;
					color: var(--text-h);
				}

				.ncrs-search input::placeholder {
					color: var(--text);
					opacity: 1;
				}

				.ncrs-filter-group {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					gap: 14px;
				}

				.ncrs-clear {
					min-width: 44px;
					min-height: 44px;
					padding: 0 14px;
					border: 0;
					background: transparent;
					color: var(--text);
					font: inherit;
					text-decoration: underline;
					cursor: pointer;
				}

				.ncrs-clear:hover {
					color: var(--text-h);
				}

				.ncrs-scroll {
					overflow-x: auto;
				}

				.ncrs-table {
					min-width: 56rem;
				}

				.ncrs-row {
					display: grid;
					grid-template-columns: var(--cols);
					align-items: center;
					column-gap: 12px;
					padding: 0 20px;
				}

				.ncrs-head {
					min-height: 58px;
					background: var(--head-bg);
					border: 1px solid var(--border);
					border-radius: 14px;
					font-size: 0.8125rem;
					font-weight: 600;
					letter-spacing: 0.02em;
					text-transform: uppercase;
					color: var(--text);
				}

				.ncrs-head span {
					line-height: 1.25;
					overflow-wrap: anywhere;
				}

				.truncate-this {
					display: block;
					max-width: 100%;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.ncrs-body {
					display: flex;
					flex-direction: column;
					gap: 14px;
					margin-top: 14px;
				}

				.ncrs-card {
					min-height: 62px;
					padding-top: 10px;
					padding-bottom: 10px;
					background: var(--lifted-bg);
					border: 1px solid var(--border);
					border-radius: 12px;
					color: var(--text-h);
				}

				.ncrs-card > span {
					min-width: 0;
					overflow-wrap: anywhere;
				}

				.ncrs-number {
					font-family: var(--mono);
					font-size: 0.875rem;
					font-weight: 700;
					color: var(--link);
				}

				.ncrs-clickable {
					cursor: pointer;
				}

				.ncrs-clickable:hover {
					background: var(--hover);
				}

				.ncrs-clickable:focus-within {
					outline: 3px solid var(--focus);
					outline-offset: 2px;
				}

				.ncrs-open {
					padding: 0;
					border: 0;
					background: transparent;
					color: inherit;
					font: inherit;
					text-align: left;
					cursor: pointer;
				}

				.ncrs-muted {
					color: var(--text);
				}

				.ncrs-strong {
					font-weight: 500;
				}

				.ncrs-edit-col {
					justify-self: end;
					text-align: right;					
				}
				
				.ncrs-edit-col button {
					width: 6.5rem;
				}

				.ncrs-status {
					display: inline-flex;
					width: 6rem;
					align-items: center;
					justify-content: center;
					gap: 6px;
					padding: 3px 10px;
					border: 1px solid;
					border-radius: 999px;
					font-size: 0.875rem;
					font-weight: 500;
					overflow-wrap: normal;
				}

				.ncrs-dot {
					width: 6px;
					height: 6px;
					flex: none;
					border-radius: 50%;
					background: currentColor;
				}

				.ncrs-status-open {
					color: var(--error);
					background: var(--error-bg);
					border-color: var(--error-line);
				}

				.ncrs-status-closed {
					color: var(--success);
					background: var(--success-bg);
					border-color: var(--success-line);
				}

				.ncrs-status-other {
					color: var(--text);
					background: transparent;
					border-color: var(--border);
				}

				.ncrs-empty {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 12px;
					padding: 28px 20px;
					background: var(--lifted-bg);
					border: 1px solid var(--border);
					border-radius: 12px;
					color: var(--text);
					text-align: center;
				}

				.ncrs-pager {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					justify-content: space-between;
					gap: 12px 16px;
					margin-top: 20px;
					padding: 14px 20px;
					background: var(--lifted-bg);
					border: 1px solid var(--border);
					border-radius: 14px;
				}

				.ncrs-pager-info {
					font-size: 0.875rem;
					color: var(--text);
				}

				.ncrs-pager-info strong {
					color: var(--text-h);
					font-weight: 700;
				}

				.ncrs-pager-controls {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					gap: 6px;
				}

				.ncrs-page-btn {
					min-width: 44px;
					min-height: 44px;
					padding: 0 10px;
					border: 2px solid transparent;
					border-radius: 6px;
					background: transparent;
					color: var(--text);
					font: inherit;
					font-size: 0.875rem;
					cursor: pointer;
				}

				.ncrs-page-edge {
					padding: 0 14px;
					border-color: var(--text);
					background: var(--lifted-bg);
				}

				.ncrs-page-btn:hover:not(:disabled):not(.ncrs-page-active) {
					background: var(--hover);
					color: var(--text-h);
				}

				.ncrs-page-active {
					background: color-mix(in srgb, var(--link) 14%, transparent);
					border-color: var(--link);
					color: var(--link);
					font-weight: 700;
					cursor: default;
				}

				.ncrs-page-btn:disabled {
					opacity: 0.45;
					cursor: default;
				}

				.ncrs-page-gap {
					padding: 0 4px;
					color: var(--text);
				}

				@media (max-width: 40rem) {	
					.ncrs-search {
						max-width: none;
					}

					.ncrs-pager-controls {
    					width: 100%;
    					justify-content: space-between;
					}

					.ncrs-table {
						min-width: 40rem;
					}

					.ncrs-defect {
						display: none;
					}

					.ncrs-row {
						grid-template-columns: var(--cols-no-defect);
					}
					
				}
			`}</style>
		</div>
	);
};

export default Ncrs;