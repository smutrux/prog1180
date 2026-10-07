/* Low-level NocoDB v3 client.
   Every call goes to API_ROOT (default "/db"), which the Vite proxy forwards
   to the database and adds the xc-token header. The token never ships in
   browser code. See vite.config.ts. */

export const BASE_ID = "pjrhlnbmxrjbf8f";

export const TABLES = {
	NCR: "m9a85hhm1b89jve",
	Attachment: "m36ku89zkzxhsod",
	Person: "m8ls0bg2ylqqi2g",
	RolePerson: "m5epgvk5qzq09ui",
	Role: "mawdfj3jgoxahqr",
	NCRStatus: "mmrmn0gp32ls43j",
	NCRPerson: "m10intz3j2v4bxj",
	ReviewStatus: "mzi096idp0c4nb6",
	NCRProblemType: "moysmsnfgemrnv1",
	ProblemType: "mqa5dc86j9ld0vm",
	SOLineItem: "m98136e6umqze4t",
	SalesOrder: "mkjekxim9051b26",
	Item: "ml2j7xe9b1qau26",
	POLineItem: "m6lc7tn4vijqt5p",
	PurchaseOrder: "m0tbdn2n3e33ouj",
	Supplier: "m0gvekbgv8kiahd",
} as const;
export type TableName = keyof typeof TABLES;

const API_ROOT = (import.meta.env.VITE_API_ROOT as string | undefined) ?? "/db";

/* Which value do foreign keys point at?
   "recordId": the record's `id` (the `Id` column). Most likely.
   "pkField":  the table's own key field, e.g. NCRStatusId.
   If the first inserts fail with foreign key problems, flip this one switch. */
export const FK_MODE: "recordId" | "pkField" = "recordId";

export interface NcRecord<F extends object = Record<string, unknown>> {
	id: number | string;
	id_fields?: Record<string, number | string>;
	fields: F;
}

/** The value to store in another table's foreign key column. */
export function refId(table: TableName, rec: NcRecord<object>): number {
	const raw =
		FK_MODE === "recordId"
			? rec.id
			: (rec.fields as Record<string, unknown>)[`${table}Id`];
	return Number(raw);
}

export class ApiError extends Error {
	status: number;
	code: string;
	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

type Query = Record<string, string | number | undefined>;

async function request<T>(
	method: "GET" | "POST" | "DELETE",
	table: TableName,
	suffix: string,
	opts: { query?: Query; body?: unknown } = {},
): Promise<T> {
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(opts.query ?? {})) {
		if (v !== undefined && v !== "") qs.set(k, String(v));
	}
	const q = qs.toString();
	const url = `${API_ROOT}/api/v3/data/${BASE_ID}/${TABLES[table]}/${suffix}${q ? `?${q}` : ""}`;

	let res: Response;
	try {
		res = await fetch(url, {
			method,
			headers: {
				accept: "application/json",
				...(opts.body ? { "content-type": "application/json" } : {}),
			},
			body: opts.body ? JSON.stringify(opts.body) : undefined,
		});
	} catch {
		throw new ApiError(
			"Could not reach the database. Check your connection and that the proxy is running.",
			0,
			"NETWORK",
		);
	}

	const text = await res.text();
	let data: unknown = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		/* non-JSON body */
	}
	if (!res.ok) {
		const d = data as { error?: string; message?: string } | null;
		throw new ApiError(
			d?.message ?? `The database returned an error (${res.status}).`,
			res.status,
			d?.error ?? "HTTP_ERROR",
		);
	}
	return data as T;
}

/** Build a where string: where(["A","eq",1],["B","eq","x"]) -> (A,eq,1)~and(B,eq,x).
    Values must not contain commas, parentheses or spaces. Use only for ids and digit strings. */
export const where = (...conds: [string, string, string | number][]) =>
	conds.map(([f, op, v]) => `(${f},${op},${v})`).join("~and");

/** Every record that matches, following pages until a page adds nothing new. */
export async function listAll<F extends object>(
	table: TableName,
	opts: { where?: string; fields?: string[] } = {},
): Promise<NcRecord<F>[]> {
	const pageSize = 1;
	// const pageSize = 25;
	const seen = new Set<string>();
	const out: NcRecord<F>[] = [];
	for (let page = 1; page <= 100; page++) {
		const data = await request<{ records?: NcRecord<F>[] }>("GET", table, "records", {
			query: { where: opts.where, fields: opts.fields?.join(",") },
		});
		const fresh = (data.records ?? []).filter((r) => !seen.has(String(r.id)));
		if (fresh.length === 0) break;
		fresh.forEach((r) => seen.add(String(r.id)));
		out.push(...fresh);
	}
	return out;
}

export async function findFirst<F extends object>(
	table: TableName,
	whereClause: string,
): Promise<NcRecord<F> | null> {
	const data = await request<{ records?: NcRecord<F>[] }>("GET", table, "records", {
		query: { where: whereClause, pageSize: 1 },
	});
	return data.records?.[0] ?? null;
}

export async function createRecord<F extends object = Record<string, unknown>>(
	table: TableName,
	fields: Record<string, unknown>,
): Promise<NcRecord<F>> {
	const data = await request<{ records?: NcRecord<F>[] }>("POST", table, "records", {
		body: { fields },
	});
	const rec = data.records?.[0];
	if (!rec) throw new ApiError("The database did not return the new record.", 200, "NO_RECORD");
	return rec;
}

export async function deleteRecord(table: TableName, id: number | string): Promise<void> {
	await request("DELETE", table, "records", { body: { id } });
}

/** NocoDB DateTime format, in UTC: 2026-10-07 04:00:00+00:00 */
export const ncDateTime = (d: Date = new Date()) =>
	`${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)}+00:00`;
