import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fkValue, listAll, refId, type NcRecord, type TableName } from "./api";
import { loadNcrForEdit, type NcrEditData, type NcrFields } from "./ncrService";
import { FaSyncAlt } from "react-icons/fa";
import { FaPlus } from "react-icons/fa6";
import Button from "./button";
/* The form that creates and edits NCRs. If your NcrForm lives in a different
   file than submitForm.tsx, change this one line. */
import NcrForm from "./submitForm";

/* ------------------------------------------------------------------ */
/* Settings you may need to touch                                      */
/* ------------------------------------------------------------------ */
/* The table finds the "date created" and "status" columns of the NCR table
   by guessing from their names. If a column shows "-" and you know its exact
   name, type it here (for example status: "NCRStatusId"). Leave "" to guess. */
const COLUMN_OVERRIDES = { date: "", status: "" };

/* Elements the keyboard can reach inside the popup (for the focus trap). */
const FOCUSABLE =
	"button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */
/** Which NCRs the table lists. */
export type NcrShow = "all" | "archived";

// this function takes in a string and a number and returns a string
// it will cap the length of the string to the number provided and append "..." to the end
function truncateString(str: string, num: number): string {
	if (str.length > num) {
		return str.slice(0, num) + "...";
	} else {
		return str;
	}
}

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

/* ------------------------------------------------------------------ */
/* Filter options and formatting                                       */
/* ------------------------------------------------------------------ */
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
	/clos|complet|resolv|approv/i.test(s)
		? "closed"
		: /open|new|pending/i.test(s)
			? "open"
			: "other";

/** An NCR is archived when its status is a closed one. Change this one line to change the rule. */
const isArchived = (status: string) => statusTone(status) === "closed";

/* ------------------------------------------------------------------ */
/* Loading data from the database                                      */
/* ------------------------------------------------------------------ */

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

function findStatus(rec: NcRecord<NcrFields>, sd: StatusData): string {
	const fields = rec.fields as unknown as AnyFields;

	/* 1. A status column on the NCR itself. */
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

	/* 2. Status rows that point back at this NCR (newest one wins). */
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

/* ------------------------------------------------------------------ */
/* Paged fetching                                                      */
/*                                                                     */
/* fetchNcrPage() is the ONE place that talks to the database for the  */
/* table. Right now it is built on listAll(), so it works without any  */
/* API changes: it only loads the heavy details (items, suppliers,     */
/* quantities) for the rows being shown.                               */
/*                                                                     */
/* Once api.ts has a real paged call (offset/limit + total count), swap */
/* the body of fetchNcrPage for that call and pass the filters to it.  */
/* The rest of the component does not need to change.                  */
/* ------------------------------------------------------------------ */

/* Small lookup tables: load once and reuse for every page and every table on the screen. */
let lookups: Promise<StatusData> | null = null;
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
		if (lookups === p) lookups = null; // allow a retry after a failure
	});
	return p;
}

/* The plain NCR records, newest first. */
let allNcrs: Promise<NcRecord<NcrFields>[]> | null = null;
function getAllNcrs(): Promise<NcRecord<NcrFields>[]> {
	const p = (allNcrs ??= listAll<NcrFields>("NCR").then((recs) =>
		[...recs].sort((a, b) => Number(b.id) - Number(a.id)),
	));
	p.catch(() => {
		if (allNcrs === p) allNcrs = null;
	});
	return p;
}

/* Rows whose details were already loaded, so no row is fetched twice. */
const rowCache = new Map<string, NcrRow>();

/* Every mounted table listens here, so a save in one table refreshes all of them. */
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
		if (ed) rowCache.set(key, row); // don't remember failures
		return row;
	});
}

async function fetchNcrPage(
	page: number,
	pageSize: number,
	filters: Filters,
): Promise<PageResult> {
	const [all, sd] = await Promise.all([getAllNcrs(), getLookups()]);

	/* Cheap filters first: status and date only need the NCR record itself. */
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
		/* Search and supplier live in related tables, so these have to look at
		   the details of every remaining candidate (cached after the first time). */
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

/* ------------------------------------------------------------------ */
/* Small icons                                                         */
/* ------------------------------------------------------------------ */
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
					background: var(--surface);
					border: 1px solid var(--line);
					border-radius: 8px;
					color: var(--muted);
					cursor: pointer;
					white-space: nowrap;
				}
				.ncrs-pill:focus-within {
					outline: 3px solid var(--focus);
					outline-offset: 2px;
				}
				.ncrs-pill-value {
					color: var(--ink);
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

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

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
	/* Archived and simple tables start on "All Time", so older NCRs are not hidden by default. */
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
	const [creating, setCreating] = useState(false);
	const [editDirty, setEditDirty] = useState(false);

	const [statusNames, setStatusNames] = useState<string[]>([]);
	const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);

	const modalRef = useRef<HTMLDivElement>(null);
	const openerRef = useRef<HTMLElement | null>(null);

	/* Wait for a short pause in typing before searching. */
	useEffect(() => {
		const t = window.setTimeout(() => setDebouncedSearch(search), 300);
		return () => window.clearTimeout(t);
	}, [search]);

	/* A simple table ignores the search box and the filters entirely. */
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

	/* The page number belongs to one set of filters. When the filters change,
	   it is automatically back on page 1 (no extra fetch of the old page). */
	const [pageState, setPageState] = useState({ sig: "", page: 0 });
	const page = pageState.sig === sig ? pageState.page : 0;
	const goTo = useCallback(
		(p: number) => setPageState({ sig, page: p }),
		[sig],
	);

	const pageCount = Math.max(1, Math.ceil(data.total / pageSize));

	/* Pages already requested (or being requested), by filters + page number. */
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
					if (cache.current.get(key) === failed) cache.current.delete(key); // don't cache failures
				});
			}
			return hit;
		},
		[sig, filters, pageSize],
	);

	/* Hover, keyboard focus or a touch on Previous/Next starts the fetch early. */
	const prefetch = (p: number) => {
		if (p >= 0 && p < pageCount) void getPage(p).catch(() => {});
	};

	/* Load the page being shown. A stale response is thrown away. */
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

	/* If rows were removed and the current page no longer exists, go to the last one. */
	useEffect(() => {
		if (loadState === "ready" && page > pageCount - 1) goTo(pageCount - 1);
	}, [loadState, page, pageCount, goTo]);

	/* Status choices come from the small status tables. Simple tables have no filters, so skip them. */
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

	/* When any table saves, forget this table's loaded pages and fetch again. */
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

	const closeEditor = useCallback(() => {
		if (
			editDirty &&
			!window.confirm("Some changes are not saved. Close anyway?")
		)
			return;
		setEditing(null);
		setCreating(false);
		setEditDirty(false);
	}, [editDirty]);

	/* The popup effect below must not restart when closeEditor changes, so it reads it from here. */
	const closeRef = useRef(closeEditor);
	useEffect(() => {
		closeRef.current = closeEditor;
	}, [closeEditor]);

	const openEditor = (record: NcRecord<NcrFields> | null) => {
		openerRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setEditing(record);
		setCreating(record === null);
	};

	const modalOpen = editing !== null || creating;

	/* While the popup is open: focus moves into it and stays inside it, Escape closes it,
	   the page behind it does not scroll, and focus returns to the button that opened it. */
	useEffect(() => {
		if (!modalOpen) return;
		const dialog = modalRef.current;
		const opener = openerRef.current;
		dialog?.focus();

		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				closeRef.current();
				return;
			}
			if (e.key !== "Tab" || !dialog) return;
			const items = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
			if (items.length === 0) {
				e.preventDefault();
				return;
			}
			const first = items[0];
			const last = items[items.length - 1];
			if (
				e.shiftKey &&
				(document.activeElement === first || document.activeElement === dialog)
			) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener("keydown", onKey);
			if (opener?.isConnected) opener.focus();
		};
	}, [modalOpen]);

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

	/* Keep showing the old rows while the next page loads. */
	const showRows =
		loadState === "ready" || (loadState === "loading" && data.rows.length > 0);
	const updating = loadState === "loading" && data.rows.length > 0;
	const firstShown = data.total === 0 ? 0 : page * pageSize + 1;
	const lastShown = Math.min(data.total, page * pageSize + data.rows.length);

	/* True when nothing is narrowing the list, so an empty table means there is nothing to show. */
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
			{/* Search and filter bar */}
			{!simple && (
				<section
					className="ncrs-filters"
					aria-label={`Search and filter: ${label}`}
				>
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
						<FilterPill
							label="Status"
							value={status}
							options={statusOptions}
							onChange={setStatus}
						/>
						<FilterPill
							label="Date"
							value={dateRange}
							options={DATE_OPTIONS.map((d) => d.label)}
							onChange={setDateChoice}
						/>
						<FilterPill
							label="Supplier"
							value={supplier}
							options={supplierOptions}
							onChange={setSupplier}
						/>
						<button type="button" className="ncrs-clear" onClick={clearFilters}>
							Clear filters
						</button>
					</div>
				</section>
			)}

			{/* Table. The scroll area can take keyboard focus, so a narrow window can still scroll it sideways. */}
			<div
				className="ncrs-scroll"
				role="region"
				tabIndex={0}
				aria-label={`Scrollable area: ${label}`}
			>
				<div
					className="ncrs-table"
					role="table"
					aria-label={label}
					aria-busy={loadState === "loading"}
				>
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

					<div className="ncrs-body">
						{loadState === "loading" && data.rows.length === 0 && (
							<p className="ncrs-empty" role="status">
								Loading NCRs...
							</p>
						)}

						{loadState === "error" && (
							<div className="ncrs-empty" role="alert">
								<p>The NCRs could not be loaded. {loadError}</p>
								<Button
									text="Try again"
									aria="Try again"
									icon={FaSyncAlt}
									onClick={resetLoaders}
								/>
							</div>
						)}

						{showRows &&
							data.rows.map((n) => (
								<div
									key={String(n.record.id)}
									className="ncrs-row ncrs-card"
									role="row"
								>
									<span role="cell" className="ncrs-number truncate-this">
										{n.ncrNumber}
									</span>
									<span role="cell" className="ncrs-muted truncate-this">
										{formatDate(n.date)}
									</span>
									<span role="cell" className="ncrs-strong truncate-this">
										{n.supplier}
									</span>
									<span role="cell" className="ncrs-strong truncate-this">
										{n.product}
									</span>
									<span role="cell" className="truncate-this">
										{n.qtyReceived}
									</span>
									<span role="cell" className="truncate-this">
										{n.qtyDefective}
									</span>
									<span role="cell" className="truncate-this">
										{n.defect}
									</span>
									<span role="cell" className="truncate-this">
										<span
											className={`ncrs-status ncrs-status-${statusTone(n.status)}`}
										>
											<span className="ncrs-dot" aria-hidden="true" />
											{n.status || "-"}
										</span>
									</span>
									{editable && (
										<span role="cell" className="ncrs-edit-col">
											<Button
												text="Edit"
												aria={`Edit NCR ${n.ncrNumber}`}
												onClick={() => openEditor(n.record)}
											/>
										</span>
									)}
								</div>
							))}

						{loadState === "ready" && data.rows.length === 0 && (
							<p className="ncrs-empty">{emptyText}</p>
						)}
					</div>
				</div>
			</div>

			{/* Pagination and New NCR button */}
			<div className={`ncrs-footer${editable ? " ncrs-footer-padded" : ""}`}>
				{loadState !== "error" && (
					<nav className="ncrs-pager" aria-label={`Pagination: ${label}`}>
						<p className="ncrs-pager-info" role="status">
							Showing <strong>{firstShown}</strong> to{" "}
							<strong>{lastShown}</strong> of <strong>{data.total}</strong>{" "}
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
									<span
										key={`gap-${i}`}
										className="ncrs-page-gap"
										aria-hidden="true"
									>
										…
									</span>
								) : (
									<button
										key={p}
										type="button"
										className={`ncrs-page-btn ncrs-page-num${p === page ? " ncrs-page-active" : ""}`}
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
					<div className="ncrs-new-btn">
						<Button
							text="New NCR"
							aria="New NCR"
							size="1rem"
							icon={FaPlus}
							onClick={() => openEditor(null)}
						/>
					</div>
				)}
			</div>

			{/* Create / edit popup */}
			{editable && modalOpen && (
				<div
					className="ncrs-overlay"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) closeEditor();
					}}
				>
					<div
						ref={modalRef}
						className="ncrs-modal"
						role="dialog"
						aria-modal="true"
						aria-label={editing ? "Edit NCR" : "New NCR"}
						tabIndex={-1}
					>
						<div className="ncrs-modal-bar">
							<button
								type="button"
								className="ncrs-clear"
								onClick={closeEditor}
							>
								Close
							</button>
						</div>
						{editing ? (
							<NcrForm
								key={String(editing.id)}
								edit
								data={editing}
								onClose={closeEditor}
								onSaved={resetLoaders}
								onDirtyChange={setEditDirty}
							/>
						) : (
							<NcrForm
								key="new"
								onClose={closeEditor}
								onSaved={resetLoaders}
								onDirtyChange={setEditDirty}
							/>
						)}
					</div>
				</div>
			)}

			<style jsx>{`
				.ncrs {
					--ink: var(--text-h);
					--muted: var(--text);
					--line: var(--border);
					--surface: var(--bg);
					--field: var(--nav-bg);
					--head-bg: var(--nav-bg);
					--blue: #2a43b8;
					--blue-hover: #1f3396;
					--blue-text: #263fa6;
					--focus: #2a43b8;
					--red: #9b1208;
					--red-bg: rgba(217, 45, 32, 0.08);
					--red-line: rgba(155, 18, 8, 0.45);
					--green: #17540c;
					--green-bg: rgba(63, 174, 41, 0.08);
					--green-line: rgba(23, 84, 12, 0.45);
					--cols: 7rem 6.5rem minmax(0, 1fr) minmax(0, 1fr) 6rem 6rem
						minmax(0, 1.4fr) 7rem 5rem;

					box-sizing: border-box;
					color: var(--ink);
					font-family: var(--sans);
					font-size: 0.9375rem;
					line-height: 1.5;
					letter-spacing: normal;
					text-align: left;
				}
				@media (prefers-color-scheme: dark) {
					.ncrs {
						--surface: var(--code-bg);
						--field: rgba(255, 255, 255, 0.06);
						--head-bg: rgba(255, 255, 255, 0.04);
						--blue-text: #a9b8ff;
						--focus: #a9b8ff;
						--red: #ffb4ac;
						--red-bg: rgba(249, 112, 102, 0.12);
						--red-line: rgba(255, 180, 172, 0.5);
						--green: #8fe57d;
						--green-bg: rgba(111, 211, 92, 0.1);
						--green-line: rgba(143, 229, 125, 0.5);
					}
				}
				.ncrs :global(*),
				.ncrs :global(*::before),
				.ncrs :global(*::after) {
					box-sizing: border-box;
				}
				.ncrs :global(:focus-visible) {
					outline: 3px solid var(--focus);
					outline-offset: 2px;
				}
				/* The search box and filter pills already show a highlight on their outer
	   wrapper, so hide the inner one to avoid a double outline. */
				.ncrs-search input:focus-visible {
					outline: none;
				}

				/* Filter bar */
				.ncrs-filters {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					justify-content: space-between;
					gap: 16px;
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
					min-height: 44px;
					padding: 0 14px;
					background: var(--field);
					border: 1px solid var(--line);
					border-radius: 8px;
					color: var(--muted);
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
					color: var(--ink);
				}
				.ncrs-search input::placeholder {
					color: var(--muted);
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
					color: var(--muted);
					font: inherit;
					text-decoration: underline;
					cursor: pointer;
				}
				.ncrs-clear:hover {
					color: var(--ink);
				}

				/* Table. The page itself never scrolls; only a very narrow window scrolls the table sideways. */
				.ncrs-scroll {
					margin-top: 24px;
					overflow-x: auto;
				}
				.ncrs-filters + .ncrs-scroll {
					margin-top: 24px;
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
					border: 1px solid var(--line);
					border-radius: 14px;
					font-size: 0.8125rem;
					font-weight: 600;
					letter-spacing: 0.02em;
					text-transform: uppercase;
					color: var(--muted);
				}
				.ncrs-head span {
					line-height: 1.25;
					overflow-wrap: anywhere;
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
					background: var(--surface);
					border: 1px solid var(--line);
					border-radius: 12px;
					font-size: 0.9375rem;
					color: var(--ink);
				}
				.ncrs-card > span {
					min-width: 0;
					overflow-wrap: anywhere;
				}
				.ncrs-number {
					font-family: var(--mono);
					font-size: 0.875rem;
					font-weight: 700;
					color: var(--blue-text);
				}
				.ncrs-muted {
					color: var(--muted);
				}
				.ncrs-strong {
					font-weight: 500;
				}
				.ncrs-edit-col {
					justify-self: end;
					text-align: right;
				}

				/* Status pill */
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
					color: var(--red);
					background: var(--red-bg);
					border-color: var(--red-line);
				}
				.ncrs-status-closed {
					color: var(--green);
					background: var(--green-bg);
					border-color: var(--green-line);
				}
				.ncrs-status-other {
					color: var(--muted);
					background: transparent;
					border-color: var(--line);
				}

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

				.truncate-this {
					display: block;
					max-width: 100%;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				/* Pagination */
				.ncrs-footer {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					gap: 14px 18px;
					margin-top: 20px;
				}
				/* Leaves room so the fixed New NCR button never covers the pager. */
				.ncrs-footer-padded {
					padding-bottom: 4.5rem;
				}
				.ncrs-new-btn {
					position: fixed;
					bottom: 1rem;
					right: 1rem;
					z-index: 1000;
				}
				.ncrs-pager {
					flex: 1 1 360px;
					min-width: 0;
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					justify-content: space-between;
					gap: 12px 16px;
					padding: 14px 20px;
					background: var(--surface);
					border: 1px solid var(--line);
					border-radius: 14px;
				}
				.ncrs-pager-info {
					margin: 0;
					font-size: 0.875rem;
					color: var(--muted);
				}
				.ncrs-pager-info strong {
					color: var(--ink);
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
					color: var(--muted);
					font: inherit;
					font-size: 0.875rem;
					cursor: pointer;
				}
				.ncrs-page-edge {
					padding: 0 14px;
					border-color: var(--line);
					background: var(--surface);
				}
				.ncrs-page-btn:hover:not(:disabled):not(.ncrs-page-active) {
					background: var(--field);
					color: var(--ink);
				}
				/* The current page has a border and bold text as well as a colour, so colour is not the only cue. */
				.ncrs-page-active {
					background: color-mix(in srgb, var(--blue) 14%, transparent);
					border-color: var(--blue-text);
					color: var(--blue-text);
					font-weight: 700;
					cursor: default;
				}
				.ncrs-page-btn:disabled {
					opacity: 0.45;
					cursor: default;
				}
				.ncrs-page-gap {
					padding: 0 4px;
					color: var(--muted);
				}

				/* Create / edit popup */
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
				.ncrs-modal:focus-visible {
					outline-offset: -3px;
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
					.ncrs-search {
						max-width: none;
					}
					.ncrs-overlay {
						padding: 8px;
					}
				}
			`}</style>
		</div>
	);
};

export default Ncrs;
