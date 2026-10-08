import { useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* Types and sample data                                               */
/* ------------------------------------------------------------------ */
type Status = "Open" | "Closed";

interface NcrRow {
	ncrNumber: string;
	dateCreated: string; // ISO date, e.g. "2026-10-02"
	supplier: string;
	productDescription: string;
	qtyReceived: number;
	qtyDefective: number;
	defectDescription: string;
	status: Status;
}

interface NCRsProps {
	/** Called when the pencil button on a row is clicked. */
	onEdit?: (ncr: NcrRow) => void;
}

const daysAgo = (n: number) => {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString().slice(0, 10);
};

/* TODO: replace this with data loaded from your API / NocoDB. */
const SAMPLE_NCRS: NcrRow[] = [
	{
		ncrNumber: "NCR-2026-001",
		dateCreated: daysAgo(6),
		supplier: "Random blah blah",
		productDescription: "Yada Yada Yada",
		qtyReceived: 50,
		qtyDefective: 3,
		defectDescription: "Scratches on sealing surface",
		status: "Open",
	},
	{
		ncrNumber: "NCR-2026-002",
		dateCreated: daysAgo(6),
		supplier: "Random blah blah",
		productDescription: "Yada Yada Yada",
		qtyReceived: 120,
		qtyDefective: 8,
		defectDescription: "Thread pitch out of tolerance",
		status: "Closed",
	},
];

/* ------------------------------------------------------------------ */
/* Filter options                                                      */
/* ------------------------------------------------------------------ */
const STATUS_OPTIONS = ["All", "Open", "Closed"] as const;
const DATE_OPTIONS = [
	{ label: "Last 7 Days", days: 7 },
	{ label: "Last 30 Days", days: 30 },
	{ label: "Last 90 Days", days: 90 },
	{ label: "All Time", days: null },
];
const ALL_SUPPLIERS = "All Suppliers";
const DEFAULT_DATE = "Last 30 Days";

const formatDate = (iso: string) =>
	new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

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

function PencilIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M12 20h9" />
			<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
		</svg>
	);
}

/* ------------------------------------------------------------------ */
/* A filter "pill": shows  Label: Value ▾  and uses a real <select>    */
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
		</label>
	);
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */
const NCRs = ({ onEdit }: NCRsProps) => {
	const ncrs = SAMPLE_NCRS;

	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<string>("All");
	const [dateRange, setDateRange] = useState<string>(DEFAULT_DATE);
	const [supplier, setSupplier] = useState<string>(ALL_SUPPLIERS);

	const supplierOptions = useMemo(
		() => [ALL_SUPPLIERS, ...Array.from(new Set(ncrs.map((n) => n.supplier))).sort()],
		[ncrs],
	);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		const days = DATE_OPTIONS.find((d) => d.label === dateRange)?.days ?? null;
		const cutoff = days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		return ncrs.filter((n) => {
			if (status !== "All" && n.status !== status) return false;
			if (supplier !== ALL_SUPPLIERS && n.supplier !== supplier) return false;
			if (cutoff && new Date(`${n.dateCreated}T00:00:00`) < cutoff) return false;
			if (term) {
				const haystack = [n.ncrNumber, n.supplier, n.productDescription, n.defectDescription]
					.join(" ")
					.toLowerCase();
				if (!haystack.includes(term)) return false;
			}
			return true;
		});
	}, [ncrs, search, status, dateRange, supplier]);

	const clearFilters = () => {
		setSearch("");
		setStatus("All");
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
					<FilterPill label="Status" value={status} options={[...STATUS_OPTIONS]} onChange={setStatus} />
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
						{filtered.map((n) => (
							<div key={n.ncrNumber} className="ncrs-row ncrs-card" role="row">
								<span role="cell" className="ncrs-number">{n.ncrNumber}</span>
								<span role="cell" className="ncrs-muted">{formatDate(n.dateCreated)}</span>
								<span role="cell" className="ncrs-strong">{n.supplier}</span>
								<span role="cell" className="ncrs-strong">{n.productDescription}</span>
								<span role="cell">{n.qtyReceived}</span>
								<span role="cell">{n.qtyDefective}</span>
								<span role="cell" className="ncrs-ellipsis" title={n.defectDescription}>{n.defectDescription}</span>
								<span role="cell">
									<span className={`ncrs-status ncrs-status-${n.status.toLowerCase()}`}>
										<span className="ncrs-dot" aria-hidden="true" />
										{n.status}
									</span>
								</span>
								<span role="cell" className="ncrs-edit-col">
									<button
										type="button"
										className="ncrs-edit-btn"
										aria-label={`Edit ${n.ncrNumber}`}
										onClick={() => onEdit?.(n)}
									>
										<PencilIcon />
									</button>
								</span>
							</div>
						))}

						{filtered.length === 0 && (
							<p className="ncrs-empty">No NCRs match your search. Change the filters or choose Clear.</p>
						)}
					</div>
				</div>
			</div>

			<style>{css}</style>
		</main>
	);
};

export default NCRs;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const css = `
	.ncrs-page {
		--bg: #f5f5f5;
		--card: #ffffff;
		--ink: #111827;
		--muted: #6b7280;
		--line: #e5e7eb;
		--head-bg: #f8fafc;
		--blue: #2b4fd6;
		--red: #d92d20;
		--red-bg: #fef3f2;
		--red-line: #fecdca;
		--green: #3fae29;
		--green-bg: #f3fbf0;
		--green-line: #b9e6ad;
		--cols: 150px 130px minmax(150px, 1.2fr) minmax(170px, 1.5fr) 100px 80px minmax(150px, 1.3fr) 110px 64px;

		box-sizing: border-box;
		min-height: 100vh;
		padding: 56px 44px 44px;
		background: var(--bg);
		color: var(--ink);
		font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		font-size: 14px;
		line-height: 1.4;
		text-align: left;
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
		padding: 18px 18px;
		background: var(--card);
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
		background: #f3f4f6;
		border: 1px solid var(--line);
		border-radius: 8px;
		color: #4b5563;
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
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		color: #4b5563;
		cursor: pointer;
		white-space: nowrap;
	}
	.ncrs-pill:focus-within { outline: 3px solid var(--blue); outline-offset: 2px; }
	.ncrs-pill-label { color: var(--muted); }
	.ncrs-pill-value { color: var(--ink); font-weight: 600; }
	.ncrs-pill svg { margin-left: 6px; color: #4b5563; }
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

	/* Table */
	.ncrs-scroll { margin-top: 24px; overflow-x: auto; }
	.ncrs-table { min-width: 1290px; }
	.ncrs-row {
		display: grid;
		grid-template-columns: var(--cols);
		align-items: center;
		column-gap: 16px;
		padding: 0 26px;
	}
	.ncrs-head {
		min-height: 58px;
		background: var(--head-bg);
		border: 1px solid var(--line);
		border-radius: 14px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: #5b6577;
	}
	.ncrs-head span { line-height: 1.25; }
	.ncrs-body { display: flex; flex-direction: column; gap: 14px; margin-top: 14px; }
	.ncrs-card {
		min-height: 62px;
		background: var(--card);
		border-radius: 12px;
		font-size: 14px;
		color: var(--ink);
	}
	.ncrs-card > span { min-width: 0; }
	.ncrs-number {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 13.5px;
		font-weight: 700;
		color: var(--blue);
	}
	.ncrs-muted { color: #4b5563; }
	.ncrs-strong { font-weight: 500; }
	.ncrs-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #374151; }
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
	}
	.ncrs-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
	.ncrs-status-open { color: var(--red); background: var(--red-bg); border-color: var(--red-line); }
	.ncrs-status-closed { color: var(--green); background: var(--green-bg); border-color: var(--green-line); }

	/* Edit button */
	.ncrs-edit-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		color: #374151;
		cursor: pointer;
	}
	.ncrs-edit-btn:hover { background: #f3f4f6; }

	.ncrs-empty {
		margin: 8px 0 0;
		padding: 28px 26px;
		background: var(--card);
		border-radius: 12px;
		color: var(--muted);
		text-align: center;
	}

	@media (max-width: 40rem) {
		.ncrs-page { padding: 32px 16px; }
		.ncrs-search { max-width: none; }
	}
`;