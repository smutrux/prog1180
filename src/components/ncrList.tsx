import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fkValue, listAll, refId, type NcRecord, type TableName } from "./api";
import { loadNcrForEdit, type NcrEditData, type NcrFields } from "./ncrService";
import { FaSyncAlt } from "react-icons/fa";
import Button from "./button";
import { NcrModal, NewNcrButton } from "./ncrModal";

/**
 * The table finds the "date created" and "status" columns of the NCR table
 * by guessing from their names. If a column shows "-" and you know its exact
 * name, type it here (for example status: "NCRStatusId"). Leave "" to guess.
 */
const COLUMN_OVERRIDES = { date: "", status: "" };

/** Which NCRs the table lists. */
export type NcrShow = "all" | "archived";

/**
 * Props for {@link Ncrs}.
 */
interface NcrsProps {
	/**
	 * `"all"` lists every status. `"archived"` lists only archived NCRs,
	 * which are the ones with a closed status (see {@link isArchived}).
	 * @defaultValue `"all"`
	 */
	show?: NcrShow;

	/**
	 * Hides the search box and the filters. Pagination stays. A simple table
	 * always lists every NCR that matches `show`, over all time.
	 * @defaultValue `false`
	 */
	simple?: boolean;

	/**
	 * How many NCRs are shown per page.
	 * @defaultValue `10`
	 */
	pageSize?: number;

	/**
	 * Shows the Edit buttons and the New NCR button. Set to `false` for a
	 * read-only table.
	 * @defaultValue `true`
	 */
	editable?: boolean;

	/**
	 * Name of the table for screen readers. Give each table on a page its own
	 * name, so people can tell them apart.
	 * @defaultValue `"Non-conformance reports"`
	 */
	label?: string;
}

type AnyFields = Record<string, unknown>;
type NameMap = Map<string, string>;

interface NcrRow {
	record: NcRecord<NcrFields>;
	ncrNumber: string;
	date: Date | null;
	supplier: string;
	product: string;
	qtyReceived: string;
	qtyDefective: string;
	defect: string;
	status: string;
}

interface StatusData {
	ncrNames: NameMap;
	reviewNames: NameMap;
	history: NcRecord<AnyFields>[];
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

/** Formats a date as "Oct 9, 2026", or "-" when there is none. */
const formatDate = (d: Date | null) =>
	d
		? d.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "-";

/** Which colour a status pill gets. */
const statusTone = (s: string) =>
	/clos|complet|resolv|approv|archive/i.test(s)
		? "closed"
		: /open|new|pending/i.test(s)
			? "open"
			: "other";

/** An NCR is archived when its status is a closed one. Change this one line to change the rule. */
const isArchived = (status: string) => statusTone(status) === "closed";

/** Run `fn` over `items`, a few at a time, keeping the original order. */
async function mapPool<T, R>(
	items: T[],
	size: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const out = new Array<R>(items.length);
	let next = 0;
	const workers = Array.from(
		{ length: Math.min(size, items.length) },
		async () => {
			while (next < items.length) {
				const i = next++;
				out[i] = await fn(items[i]);
			}
		},
	);
	await Promise.all(workers);
	return out;
}

/** Reads a date from the database. Returns null for anything that is not a date. */
function parseDate(v: unknown): Date | null {
	if (typeof v !== "string" || !v.trim()) return null;
	const s = v.trim();
	const d = new Date(
		s.length === 10
			? `${s}T00:00:00`
			: s.includes("T")
				? s
				: s.replace(" ", "T"),
	);
	return Number.isNaN(d.getTime()) ? null : d;
}

/** Find the date an NCR was created, from whichever column holds one. */
function findDate(fields: AnyFields): Date | null {
	if (COLUMN_OVERRIDES.date) return parseDate(fields[COLUMN_OVERRIDES.date]);
	const keys = Object.keys(fields);
	const ordered = [
		...keys.filter((k) => /creat/i.test(k)),
		...keys.filter((k) => /date|submit/i.test(k)),
	];
	for (const k of ordered) {
		const d = parseDate(fields[k]);
		if (d) return d;
	}
	return null;
}

/** The readable name of a row in a small lookup table such as ReviewStatus. */
function displayName(fields: AnyFields): string {
	const texts = Object.entries(fields).filter(
		([k, v]) => typeof v === "string" && v.trim() && !/id$/i.test(k),
	);
	const best =
		texts.find(([k]) => /name|status|label|title/i.test(k)) ?? texts[0];
	return best ? String(best[1]).trim() : "";
}

/** Maps record ids to readable names for one lookup table. */
function buildNames(table: TableName, recs: NcRecord<AnyFields>[]): NameMap {
	const map: NameMap = new Map();
	for (const r of recs) {
		const name = displayName(r.fields);
		if (name) map.set(String(refId(table, r)), name);
	}
	return map;
}

/** A value that is either already text ("Open") or an id to look up. */
function textOrLookup(raw: unknown, maps: NameMap[]): string {
	if (typeof raw === "string" && raw.trim() && Number.isNaN(Number(raw)))
		return raw.trim();
	const id = fkValue(raw);
	if (id === null) return "";
	for (const m of maps) {
		const hit = m.get(String(id));
		if (hit) return hit;
	}
	return "";
}

/** Finds the status name of an NCR from its own column or from the status rows that point at it. */
function findStatus(rec: NcRecord<NcrFields>, sd: StatusData): string {
	const fields = rec.fields as unknown as AnyFields;

	const key =
		COLUMN_OVERRIDES.status ||
		Object.keys(fields).find((k) => /status/i.test(k));
	if (key) {
		const order = /review/i.test(key)
			? [sd.reviewNames, sd.ncrNames]
			: [sd.ncrNames, sd.reviewNames];
		const hit = textOrLookup(fields[key], order);
		if (hit) return hit;
	}

	const ncrId = refId("NCR", rec);
	const mine = sd.history
		.filter((h) =>
			Object.entries(h.fields).some(
				([k, v]) =>
					/ncr/i.test(k) && !/status/i.test(k) && fkValue(v) === ncrId,
			),
		)
		.sort((a, b) => Number(b.id) - Number(a.id));
	for (const h of mine) {
		for (const [k, v] of Object.entries(h.fields)) {
			if (!/review|status|state/i.test(k) || /^ncr/i.test(k)) continue;
			const hit = textOrLookup(v, [sd.reviewNames, sd.ncrNames]);
			if (hit) return hit;
		}
	}
	return "";
}

function toRow(
	record: NcRecord<NcrFields>,
	ed: NcrEditData | null,
	sd: StatusData,
): NcrRow {
	const fields = record.fields as unknown as AnyFields;
	const num = (n: number | null | undefined) =>
		n === null || n === undefined ? "-" : String(n);
	return {
		record,
		ncrNumber: ed?.ncrNumber || String(fields.NCRNumber ?? ""),
		date: findDate(fields),
		supplier: ed ? (ed.supplier ?? "In-house") : "-",
		product: ed ? ed.item.description || ed.item.name : "-",
		qtyReceived: num(ed?.quantityReceived),
		qtyDefective: num(ed?.quantityDefective),
		defect: ed?.defectDescription ?? "-",
		status: findStatus(record, sd),
	};
}

/** Small lookup tables: load once and reuse for every page and every table on the screen. */
let lookups: Promise<StatusData> | null = null;
/** The small lookup tables, loaded once and shared by every table on the screen. */
function getLookups(): Promise<StatusData> {
	const p = (lookups ??= (async () => {
		const none = [] as NcRecord<AnyFields>[];
		const [ncrStatus, reviewStatus] = await Promise.all([
			listAll<AnyFields>("NCRStatus").catch(() => none),
			listAll<AnyFields>("ReviewStatus").catch(() => none),
		]);
		return {
			ncrNames: buildNames("NCRStatus", ncrStatus),
			reviewNames: buildNames("ReviewStatus", reviewStatus),
			history: ncrStatus,
		};
	})());
	p.catch(() => {
		if (lookups === p) lookups = null;
	});
	return p;
}

/** The plain NCR records, newest first. */
let allNcrs: Promise<NcRecord<NcrFields>[]> | null = null;
/** The plain NCR records, newest first, loaded once and shared by every table on the screen. */
function getAllNcrs(): Promise<NcRecord<NcrFields>[]> {
	const p = (allNcrs ??= listAll<NcrFields>("NCR").then((recs) =>
		[...recs].sort((a, b) => Number(b.id) - Number(a.id)),
	));
	p.catch(() => {
		if (allNcrs === p) allNcrs = null;
	});
	return p;
}

/** Rows whose details were already loaded, so no row is fetched twice. */
const rowCache = new Map<string, NcrRow>();

/** Every mounted table listens here, so a save in one table refreshes all of them. */
const listeners = new Set<() => void>();

/** Forget everything loaded from the database and tell every table to reload (used after a save). */
function resetLoaders() {
	lookups = null;
	allNcrs = null;
	rowCache.clear();
	listeners.forEach((l) => l());
}

/** Turn plain NCR records into table rows by loading their related details. */
function enrich(
	records: NcRecord<NcrFields>[],
	sd: StatusData,
): Promise<NcrRow[]> {
	return mapPool(records, 6, async (rec) => {
		const key = String(rec.id);
		const cached = rowCache.get(key);
		if (cached) return cached;
		let ed: NcrEditData | null = null;
		try {
			ed = await loadNcrForEdit(rec);
		} catch {
			ed = null;
		}
		const row = toRow(rec, ed, sd);
		if (ed) rowCache.set(key, row);
		return row;
	});
}

/** Loads one page of NCRs for the given filters. This is the only place the table talks to the database. Status and date are filtered first, because they only need the NCR record itself. Search and supplier need the related details of every remaining NCR. */
async function fetchNcrPage(
	page: number,
	pageSize: number,
	filters: Filters,
): Promise<PageResult> {
	const [all, sd] = await Promise.all([getAllNcrs(), getLookups()]);

	const days =
		DATE_OPTIONS.find((d) => d.label === filters.dateRange)?.days ?? null;
	const cutoff =
		days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	const candidates = all.filter((rec) => {
		const status = findStatus(rec, sd);
		if (filters.show === "archived" && !isArchived(status)) return false;
		if (filters.status !== ALL_STATUSES && status !== filters.status)
			return false;
		if (cutoff) {
			const d = findDate(rec.fields as unknown as AnyFields);
			if (d && d < cutoff) return false;
		}
		return true;
	});

	const start = page * pageSize;
	const term = filters.search.trim().toLowerCase();
	const needsDetails = term !== "" || filters.supplier !== ALL_SUPPLIERS;

	let rows: NcrRow[];
	let total: number;

	if (needsDetails) {
		const detailed = await enrich(candidates, sd);
		const matches = detailed.filter((r) => {
			if (filters.supplier !== ALL_SUPPLIERS && r.supplier !== filters.supplier)
				return false;
			if (term) {
				const haystack = [r.ncrNumber, r.supplier, r.product, r.defect]
					.join(" ")
					.toLowerCase();
				if (!haystack.includes(term)) return false;
			}
			return true;
		});
		total = matches.length;
		rows = matches.slice(start, start + pageSize);
	} else {
		total = candidates.length;
		rows = await enrich(candidates.slice(start, start + pageSize), sd);
	}

	if (
		rows.length > 0 &&
		(rows.some((r) => !r.date) || rows.some((r) => !r.status))
	) {
		console.warn(
			"NCRs: could not find a date or status for some rows. First NCR record:",
			all[0]?.fields,
		);
	}
	return { rows, total };
}

/** The magnifying glass shown in the search box. */
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

/** The down arrow shown on each filter. */
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

/**
 * A filter shown as "Label: Value". A real `<select>` is laid invisibly on top of it, so it works with mouse, touch and keyboard.
 *
 * @param props - The filter's name, current value, choices and change handler.
 * @returns A labelled drop-down.
 */
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

/** Page numbers to show, 0-based, with "…" for gaps: 1 2 3 … 6 */
function pageWindow(current: number, total: number): (number | "…")[] {
	if (total <= 5) return Array.from({ length: total }, (_, i) => i);
	if (current < 3) return [0, 1, 2, "…", total - 1];
	if (current > total - 4) return [0, "…", total - 3, total - 2, total - 1];
	return [0, "…", current - 1, current, current + 1, "…", total - 1];
}

/**
 * A table of NCRs with optional search and filters, pagination, and a popup
 * to create and edit NCRs.
 *
 * Several tables can be on one page. They share the loaded data, and a save
 * in one table refreshes all of them.
 *
 * @param props - Component props, see {@link NcrsProps}.
 * @returns The table, its pagination and (when `editable`) the edit popup.
 *
 * @example
 * <Ncrs />
 * <Ncrs show="archived" simple editable={false} pageSize={5} label="Archived NCRs" />
 */
const Ncrs = ({
	show = "all",
	simple = false,
	pageSize = 10,
	editable = true,
	label = "Non-conformance reports",
}: NcrsProps) => {
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

	const [editing, setEditing] = useState<NcRecord<NcrFields> | null>(null);

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
				const names = res.rows
					.map((r) => r.supplier)
					.filter((s) => s && s !== "-");
				if (names.length > 0) {
					setKnownSuppliers((prev) => Array.from(new Set([...prev, ...names])));
				}
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
		getLookups()
			.then((sd) => {
				if (cancelled) return;
				const all = [...sd.ncrNames.values(), ...sd.reviewNames.values()];
				setStatusNames(Array.from(new Set(all)).sort());
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
		const names = statusNames.filter(
			(n) => show !== "archived" || isArchived(n),
		);
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
							<span role="columnheader">Date created</span>
							<span role="columnheader">Supplier name</span>
							<span role="columnheader">Product description</span>
							<span role="columnheader">Quantity received</span>
							<span role="columnheader">Quantity defective</span>
							<span role="columnheader">Description of defect</span>
							<span role="columnheader">Status</span>
							{editable && (
								<span role="columnheader" className="ncrs-edit-col">
									Edit
								</span>
							)}
						</div>
					</div>

					<div className="ncrs-body" role="rowgroup">
						{showRows &&
							data.rows.map((n) => (
								<div key={String(n.record.id)} className="ncrs-row ncrs-card" role="row">
									<span role="cell" className="ncrs-number">
										{n.ncrNumber}
									</span>
									<span role="cell" className="ncrs-muted">
										{formatDate(n.date)}
									</span>
									<span role="cell" className="ncrs-strong truncate-this">
										{n.supplier}
									</span>
									<span role="cell" className="ncrs-strong truncate-this">
										{n.product}
									</span>
									<span role="cell" className="truncate-this">{n.qtyReceived}</span>
									<span role="cell" className="truncate-this">{n.qtyDefective}</span>
									<span role="cell" className="truncate-this">{n.defect}</span>
									<span role="cell">
										<span className={`ncrs-status ncrs-status-${statusTone(n.status)}`}>
											<span className="ncrs-dot" aria-hidden="true" />
											{n.status || "-"}
										</span>
									</span>
									{editable && (
										<span role="cell" className="ncrs-edit-col">
											<Button
												text="Edit"
												aria={`Edit NCR ${n.ncrNumber}`}
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

			{editable && (
				<>
					<NewNcrButton onSaved={resetLoaders} />
					<NcrModal
						open={editing !== null}
						onClose={() => setEditing(null)}
						edit
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
					--cols: 7rem 6.5rem minmax(0, 1fr) minmax(0, 1fr) 6rem 6rem minmax(0, 1.4fr) 7rem 5rem;

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

				.ncrs-status {
					display: inline-flex;
					align-items: center;
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
				}
			`}</style>
		</div>
	);
};

export default Ncrs;