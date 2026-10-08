import { useCallback, useEffect, useMemo, useState } from "react";
import { fkValue, listAll, refId, type NcRecord, type TableName } from "../components/api";
import { loadNcrForEdit, type NcrEditData, type NcrFields } from "../components/ncrService";
/* The form that creates and edits NCRs. If your NcrForm lives in a different
   file than submitForm.tsx, change this one line. */
import NcrForm from "../components/submitForm";

/* ------------------------------------------------------------------ */
/* Settings you may need to touch                                      */
/* ------------------------------------------------------------------ */
/* The page finds the "date created" and "status" columns of the NCR table
   by guessing from their names. If a column shows "-" and you know its exact
   name, type it here (for example status: "NCRStatusId"). Leave "" to guess. */
const COLUMN_OVERRIDES = { date: "", status: "" };

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
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
	ncrNames: NameMap; // names from the NCRStatus table, by record
	reviewNames: NameMap; // names from the ReviewStatus table, by record
	history: NcRecord<AnyFields>[]; // every NCRStatus row, in case they point back at an NCR
}

/* ------------------------------------------------------------------ */
/* Loading data from the database                                      */
/* ------------------------------------------------------------------ */

/** Run `fn` over `items`, a few at a time, keeping the original order. */
async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out = new Array<R>(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]);
		}
	});
	await Promise.all(workers);
	return out;
}

function parseDate(v: unknown): Date | null {
	if (typeof v !== "string" || !v.trim()) return null;
	const s = v.trim();
	const d = new Date(s.length === 10 ? `${s}T00:00:00` : s.includes("T") ? s : s.replace(" ", "T"));
	return Number.isNaN(d.getTime()) ? null : d;
}

/** Find the date an NCR was created, from whichever column holds one. */
function findDate(fields: AnyFields): Date | null {
	if (COLUMN_OVERRIDES.date) return parseDate(fields[COLUMN_OVERRIDES.date]);
	const keys = Object.keys(fields);
	const ordered = [...keys.filter((k) => /creat/i.test(k)), ...keys.filter((k) => /date|submit/i.test(k))];
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
	const best = texts.find(([k]) => /name|status|label|title/i.test(k)) ?? texts[0];
	return best ? String(best[1]).trim() : "";
}

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
	if (typeof raw === "string" && raw.trim() && Number.isNaN(Number(raw))) return raw.trim();
	const id = fkValue(raw);
	if (id === null) return "";
	for (const m of maps) {
		const hit = m.get(String(id));
		if (hit) return hit;
	}
	return "";
}

function findStatus(rec: NcRecord<NcrFields>, sd: StatusData): string {
	const fields = rec.fields as unknown as AnyFields;

	/* 1. A status column on the NCR itself. */
	const key = COLUMN_OVERRIDES.status || Object.keys(fields).find((k) => /status/i.test(k));
	if (key) {
		const order = /review/i.test(key) ? [sd.reviewNames, sd.ncrNames] : [sd.ncrNames, sd.reviewNames];
		const hit = textOrLookup(fields[key], order);
		if (hit) return hit;
	}

	/* 2. Status rows that point back at this NCR (newest one wins). */
	const ncrId = refId("NCR", rec);
	const mine = sd.history
		.filter((h) =>
			Object.entries(h.fields).some(([k, v]) => /ncr/i.test(k) && !/status/i.test(k) && fkValue(v) === ncrId),
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

function toRow(record: NcRecord<NcrFields>, ed: NcrEditData | null, sd: StatusData): NcrRow {
	const fields = record.fields as unknown as AnyFields;
	const num = (n: number | null | undefined) => (n === null || n === undefined ? "-" : String(n));
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

async function loadRows(): Promise<NcrRow[]> {
	const none = [] as NcRecord<AnyFields>[];
	const [records, ncrStatus, reviewStatus] = await Promise.all([
		listAll<NcrFields>("NCR"),
		listAll<AnyFields>("NCRStatus").catch(() => none),
		listAll<AnyFields>("ReviewStatus").catch(() => none),
	]);

	const sd: StatusData = {
		ncrNames: buildNames("NCRStatus", ncrStatus),
		reviewNames: buildNames("ReviewStatus", reviewStatus),
		history: ncrStatus,
	};

	/* Items, suppliers and quantities live in related tables, so fetch them
	   the same way the edit form does. */
	const details = await mapPool(records, 6, async (rec) => {
		try {
			return await loadNcrForEdit(rec);
		} catch {
			return null;
		}
	});

	const rows = records.map((rec, i) => toRow(rec, details[i], sd));
	if (rows.length > 0 && (rows.some((r) => !r.date) || rows.some((r) => !r.status))) {
		console.warn("NCRs page: could not find a date or status for some rows. First rows of the tables involved:", {
			NCR: records[0]?.fields,
			NCRStatus: ncrStatus[0]?.fields,
			ReviewStatus: reviewStatus[0]?.fields,
		});
	}
	rows.sort((a, b) => Number(b.record.id) - Number(a.record.id)); // newest first
	return rows;
}

/* ------------------------------------------------------------------ */
/* Filter options and formatting                                       */
/* ------------------------------------------------------------------ */
const ALL_STATUSES = "All";
const DATE_OPTIONS = [
	{ label: "Last 7 Days", days: 7 },
	{ label: "Last 30 Days", days: 30 },
	{ label: "Last 90 Days", days: 90 },
	{ label: "All Time", days: null },
];
const ALL_SUPPLIERS = "All Suppliers";
const DEFAULT_DATE = "Last 30 Days";

const formatDate = (d: Date | null) =>
	d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";

/** Which colour a status pill gets. */
const statusTone = (s: string) =>
	/clos|complet|resolv|approv/i.test(s) ? "closed" : /open|new|pending/i.test(s) ? "open" : "other";

/* ------------------------------------------------------------------ */
/* Small icons                                                         */
/* ------------------------------------------------------------------ */
function SearchIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<circle cx="11" cy="11" r="7" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	);
}

function ChevronIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

/* ------------------------------------------------------------------ */
/* A filter "pill": shows  Label: Value  and uses a real <select>      */
/* laid invisibly on top so it works with mouse, touch and keyboard.   */
/* ------------------------------------------------------------------ */
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
			<select className="ncrs-pill-select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
				{options.map((o) => (
					<option key={o} value={o}>
						{o}
					</option>
				))}
			</select>
		</label>
	);
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */
const NCRs = () => {
	const [rows, setRows] = useState<NcrRow[]>([]);
	const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
	const [loadError, setLoadError] = useState("");

	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<string>(ALL_STATUSES);
	const [dateRange, setDateRange] = useState<string>(DEFAULT_DATE);
	const [supplier, setSupplier] = useState<string>(ALL_SUPPLIERS);

	const [editing, setEditing] = useState<NcRecord<NcrFields> | null>(null);
	const [editDirty, setEditDirty] = useState(false);

	/** quiet = refresh the rows without showing the loading message. */
	const load = useCallback(async (quiet = false) => {
		if (!quiet) {
			setLoadState("loading");
			setLoadError("");
		}
		try {
			setRows(await loadRows());
			setLoadState("ready");
		} catch (err) {
			if (quiet) return;
			setLoadError(err instanceof Error ? err.message : String(err));
			setLoadState("error");
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const closeEditor = useCallback(() => {
		if (editDirty && !window.confirm("Some changes are not saved. Close anyway?")) return;
		setEditing(null);
		setEditDirty(false);
	}, [editDirty]);

	/* While the edit popup is open: Escape closes it and the page behind it does not scroll. */
	useEffect(() => {
		if (!editing) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeEditor();
		};
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener("keydown", onKey);
		};
	}, [editing, closeEditor]);

	const statusOptions = useMemo(
		() => [ALL_STATUSES, ...Array.from(new Set(rows.map((r) => r.status).filter(Boolean))).sort()],
		[rows],
	);
	const supplierOptions = useMemo(
		() => [ALL_SUPPLIERS, ...Array.from(new Set(rows.map((r) => r.supplier).filter((s) => s && s !== "-"))).sort()],
		[rows],
	);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		const days = DATE_OPTIONS.find((d) => d.label === dateRange)?.days ?? null;
		const cutoff = days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		return rows.filter((r) => {
			if (status !== ALL_STATUSES && r.status !== status) return false;
			if (supplier !== ALL_SUPPLIERS && r.supplier !== supplier) return false;
			if (cutoff && r.date && r.date < cutoff) return false;
			if (term) {
				const haystack = [r.ncrNumber, r.supplier, r.product, r.defect].join(" ").toLowerCase();
				if (!haystack.includes(term)) return false;
			}
			return true;
		});
	}, [rows, search, status, dateRange, supplier]);

	const clearFilters = () => {
		setSearch("");
		setStatus(ALL_STATUSES);
		setDateRange(DEFAULT_DATE);
		setSupplier(ALL_SUPPLIERS);
	};

	return (
		<main className="ncrs-page">
			<header className="ncrs-heading">
				<h1>Non-Conformance Reports</h1>
				<p>Track, inspect, and process supply chain material quality issues</p>
			</header>

			{/* Search and filter bar */}
			<section className="ncrs-filters" aria-label="Search and filter NCRs">
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
					<FilterPill label="Date" value={dateRange} options={DATE_OPTIONS.map((d) => d.label)} onChange={setDateRange} />
					<FilterPill label="Supplier" value={supplier} options={supplierOptions} onChange={setSupplier} />
					<button type="button" className="ncrs-clear" onClick={clearFilters}>
						Clear
					</button>
				</div>
			</section>

			{/* Table */}
			<div className="ncrs-scroll">
				<div className="ncrs-table" role="table" aria-label="Non-conformance reports">
					<div className="ncrs-row ncrs-head" role="row">
						<span role="columnheader">NCR Number</span>
						<span role="columnheader">Date Created</span>
						<span role="columnheader">Supplier Name</span>
						<span role="columnheader">Product Description</span>
						<span role="columnheader">Qty Rec.</span>
						<span role="columnheader">Qty Def.</span>
						<span role="columnheader">Description of Defect</span>
						<span role="columnheader">Status</span>
						<span role="columnheader" className="ncrs-edit-col">Edit</span>
					</div>

					<div className="ncrs-body">
						{loadState === "loading" && <p className="ncrs-empty" role="status">Loading NCRs...</p>}

						{loadState === "error" && (
							<div className="ncrs-empty" role="alert">
								<p>The NCRs could not be loaded. {loadError}</p>
								<button type="button" className="ncrs-edit-btn" onClick={() => void load()}>
									Try again
								</button>
							</div>
						)}

						{loadState === "ready" &&
							filtered.map((n) => (
								<div key={String(n.record.id)} className="ncrs-row ncrs-card" role="row">
									<span role="cell" className="ncrs-number">{n.ncrNumber}</span>
									<span role="cell" className="ncrs-muted">{formatDate(n.date)}</span>
									<span role="cell" className="ncrs-strong">{n.supplier}</span>
									<span role="cell" className="ncrs-strong">{n.product}</span>
									<span role="cell">{n.qtyReceived}</span>
									<span role="cell">{n.qtyDefective}</span>
									<span role="cell" className="ncrs-clamp" title={n.defect}>{n.defect}</span>
									<span role="cell">
										<span className={`ncrs-status ncrs-status-${statusTone(n.status)}`}>
											<span className="ncrs-dot" aria-hidden="true" />
											{n.status || "-"}
										</span>
									</span>
									<span role="cell" className="ncrs-edit-col">
										<button
											type="button"
											className="ncrs-edit-btn"
											aria-label={`Edit NCR ${n.ncrNumber}`}
											onClick={() => setEditing(n.record)}
										>
											Edit
										</button>
									</span>
								</div>
							))}

						{loadState === "ready" && filtered.length === 0 && (
							<p className="ncrs-empty">
								{rows.length === 0
									? "No NCRs have been submitted yet."
									: "No NCRs match your search. Change the filters or choose Clear."}
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Edit popup */}
			{editing && (
				<div
					className="ncrs-overlay"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) closeEditor();
					}}
				>
					<div className="ncrs-modal" role="dialog" aria-modal="true" aria-label="Edit NCR">
						<div className="ncrs-modal-bar">
							<button type="button" className="ncrs-clear" onClick={closeEditor}>
								Close
							</button>
						</div>
						<NcrForm
							key={String(editing.id)}
							edit
							data={editing}
							onClose={closeEditor}
							onSaved={() => void load(true)}
							onDirtyChange={setEditDirty}
						/>
					</div>
				</div>
			)}

			<style>{css}</style>
		</main>
	);
};

export default NCRs;

/* ------------------------------------------------------------------ */
/* Styles (colours come from the variables in index.css)               */
/* ------------------------------------------------------------------ */
const css = `
	.ncrs-page {
		--ink: var(--text-h);
		--muted: var(--text);
		--line: var(--border);
		--surface: var(--bg);
		--field: var(--nav-bg);
		--head-bg: var(--nav-bg);
		--blue: #3b5fe7;
		--blue-hover: #2f4fd0;
		--blue-text: #2b4fd6;
		--red: #d92d20;
		--red-bg: rgba(217, 45, 32, 0.08);
		--red-line: rgba(217, 45, 32, 0.3);
		--green: #3a9d26;
		--green-bg: rgba(63, 174, 41, 0.08);
		--green-line: rgba(63, 174, 41, 0.35);
		--cols: 100px 88px minmax(0, 1fr) minmax(0, 1fr) 48px 48px minmax(0, 1.4fr) 88px 64px;

		box-sizing: border-box;
		padding: 24px 28px 32px;
		color: var(--ink);
		font-family: var(--sans);
		font-size: 14px;
		line-height: 1.4;
		letter-spacing: normal;
		text-align: left;
	}
	@media (prefers-color-scheme: dark) {
		.ncrs-page {
			--surface: var(--code-bg);
			--field: rgba(255, 255, 255, 0.06);
			--head-bg: rgba(255, 255, 255, 0.04);
			--blue-text: #8ea2ff;
			--red: #f97066;
			--red-bg: rgba(249, 112, 102, 0.12);
			--red-line: rgba(249, 112, 102, 0.4);
			--green: #6fd35c;
			--green-bg: rgba(111, 211, 92, 0.1);
			--green-line: rgba(111, 211, 92, 0.4);
		}
	}
	.ncrs-page *, .ncrs-page *::before, .ncrs-page *::after { box-sizing: border-box; }
	.ncrs-page :focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; }

	/* Heading */
	.ncrs-heading h1 { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
	.ncrs-heading p { margin: 6px 0 0; font-size: 15px; color: var(--muted); }

	/* Filter bar */
	.ncrs-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-top: 22px;
		padding: 18px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
	}
	.ncrs-search {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1 1 280px;
		max-width: 440px;
		height: 40px;
		padding: 0 14px;
		background: var(--field);
		border: 1px solid var(--line);
		border-radius: 8px;
		color: var(--muted);
	}
	.ncrs-search:focus-within { outline: 3px solid var(--blue); outline-offset: 2px; }
	.ncrs-search input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: transparent;
		font: inherit;
		color: var(--ink);
	}
	.ncrs-search input::placeholder { color: var(--muted); }
	.ncrs-filter-group { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }

	.ncrs-pill {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		padding: 0 14px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 8px;
		color: var(--muted);
		cursor: pointer;
		white-space: nowrap;
	}
	.ncrs-pill:focus-within { outline: 3px solid var(--blue); outline-offset: 2px; }
	.ncrs-pill-value { color: var(--ink); font-weight: 600; }
	.ncrs-pill svg { margin-left: 6px; }
	.ncrs-pill-select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font: inherit; }

	.ncrs-clear {
		height: 38px;
		padding: 0 14px;
		border: 0;
		background: transparent;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}
	.ncrs-clear:hover { color: var(--ink); }

	/* Table. The page itself never scrolls; only a very narrow window scrolls the table sideways. */
	.ncrs-scroll { margin-top: 24px; overflow-x: auto; }
	.ncrs-table { min-width: 800px; }
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
		border: 1px solid var(--line);
		border-radius: 14px;
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.ncrs-head span { line-height: 1.25; overflow-wrap: anywhere; }
	.ncrs-body { display: flex; flex-direction: column; gap: 14px; margin-top: 14px; }
	.ncrs-card {
		min-height: 62px;
		padding-top: 10px;
		padding-bottom: 10px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 12px;
		font-size: 14px;
		color: var(--ink);
	}
	.ncrs-card > span { min-width: 0; overflow-wrap: anywhere; }
	.ncrs-number {
		font-family: var(--mono);
		font-size: 13px;
		font-weight: 700;
		color: var(--blue-text);
	}
	.ncrs-muted { color: var(--muted); }
	.ncrs-strong { font-weight: 500; }
	.ncrs-clamp {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		color: var(--muted);
	}
	.ncrs-edit-col { justify-self: end; text-align: right; }

	/* Status pill */
	.ncrs-status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		border: 1px solid;
		border-radius: 999px;
		font-size: 12.5px;
		font-weight: 500;
		overflow-wrap: normal;
	}
	.ncrs-dot { width: 6px; height: 6px; flex: none; border-radius: 50%; background: currentColor; }
	.ncrs-status-open { color: var(--red); background: var(--red-bg); border-color: var(--red-line); }
	.ncrs-status-closed { color: var(--green); background: var(--green-bg); border-color: var(--green-line); }
	.ncrs-status-other { color: var(--muted); background: transparent; border-color: var(--line); }

	/* Blue Edit button */
	.ncrs-edit-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 36px;
		padding: 0 18px;
		border: 0;
		border-radius: 8px;
		background: var(--blue);
		color: #fff;
		font: inherit;
		font-weight: 500;
		cursor: pointer;
	}
	.ncrs-edit-btn:hover { background: var(--blue-hover); }

	.ncrs-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin: 8px 0 0;
		padding: 28px 20px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 12px;
		color: var(--muted);
		text-align: center;
	}

	/* Edit popup */
	.ncrs-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 24px;
		background: rgba(0, 0, 0, 0.55);
	}
	.ncrs-modal {
		width: min(52rem, 100%);
		max-height: calc(100vh - 48px);
		overflow-y: auto;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 14px;
		color: var(--ink);
	}
	.ncrs-modal-bar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		justify-content: flex-end;
		padding: 8px 12px 0;
		background: var(--bg);
	}
  
	@media (max-width: 40rem) {
		.ncrs-page { padding: 16px; }
		.ncrs-search { max-width: none; }
		.ncrs-overlay { padding: 8px; }
	}
`;