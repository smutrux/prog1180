const BASE = process.env.NC_BASE_URL || "https://db.steve.lv";
const TOKEN = process.env.NC_TOKEN;
if (!TOKEN) {
	console.error("Set NC_TOKEN first.");
	process.exit(1);
}
const BASE_ID = "pjrhlnbmxrjbf8f";
const T = {
	Role: "mawdfj3jgoxahqr", NCRStatus: "mmrmn0gp32ls43j", ReviewStatus: "mzi096idp0c4nb6",
	ProblemType: "mqa5dc86j9ld0vm", Supplier: "m0gvekbgv8kiahd", Person: "m8ls0bg2ylqqi2g",
	RolePerson: "m5epgvk5qzq09ui",
};

async function api(method, table, body, query = "") {
	const res = await fetch(`${BASE}/api/v3/data/${BASE_ID}/${T[table]}/records${query}`, {
		method,
		headers: { "xc-token": TOKEN, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json().catch(() => null);
	if (!res.ok) throw new Error(`${method} ${table}: ${data?.message ?? res.status}`);
	return data;
}

async function all(table) {
	const seen = new Set();
	const out = [];
	for (let page = 1; page <= 100; page++) {
		const data = await api("GET", table, null);
		const fresh = (data.records ?? []).filter((r) => !seen.has(String(r.id)));
		if (!fresh.length) break;
		fresh.forEach((r) => seen.add(String(r.id)));
		out.push(...fresh);
	}
	return out;
}

/* Returns the record (existing or new) for every row. */
async function ensure(table, nameField, rows) {
	const existing = await all(table);
	const result = [];
	for (const row of rows) {
		let rec = existing.find((r) => (r.fields[nameField] ?? "").trim().toLowerCase() === row[nameField].toLowerCase());
		if (!rec) {
			rec = (await api("POST", table, { fields: row })).records[0];
			console.log(`  + ${table}: ${row[nameField]}`);
		}
		result.push(rec);
	}
	return result;
}

console.log("Roles");
const roles = await ensure("Role", "RoleName", [
	{ RoleName: "Quality Representative", RoleDesc: "Raises NCRs and records the initial inspection." },
	{ RoleName: "Engineer", RoleDesc: "Decides the disposition and any drawing updates." },
	{ RoleName: "Operations Manager", RoleDesc: "Reviews the effect on production." },
	{ RoleName: "Purchasing Agent", RoleDesc: "Handles supplier contact, returns and corrective actions." },
]);

console.log("NCR statuses");
await ensure("NCRStatus", "NCRStatusName", [
	{ NCRStatusName: "Active" }, { NCRStatusName: "On Hold" }, { NCRStatusName: "Closed" },
]);

console.log("Review statuses");
await ensure("ReviewStatus", "ReviewStatusName", [
	{ ReviewStatusName: "Submitted" }, { ReviewStatusName: "Pending" }, { ReviewStatusName: "In Review" },
	{ ReviewStatusName: "Approved" }, { ReviewStatusName: "Rejected" },
]);

console.log("Problem types");
await ensure("ProblemType", "ProblemTypeLabel", [
	{ ProblemTypeLabel: "Dimension out of tolerance", ProblemTypeDesc: "A measurement is outside the tolerance on the drawing." },
	{ ProblemTypeLabel: "Wrong material", ProblemTypeDesc: "The material does not match the order or the drawing." },
	{ ProblemTypeLabel: "Surface finish or coating", ProblemTypeDesc: "Scratches, rust, poor plating, paint or coating faults." },
	{ ProblemTypeLabel: "Damaged in shipping", ProblemTypeDesc: "The item was damaged on the way to us." },
	{ ProblemTypeLabel: "Wrong item or quantity", ProblemTypeDesc: "We received a different item, or a different amount than ordered." },
	{ ProblemTypeLabel: "Missing paperwork or certificates", ProblemTypeDesc: "Material certificates or other required documents are missing." },
	{ ProblemTypeLabel: "Other", ProblemTypeDesc: "Anything not covered above. Explain it in the defect description." },
]);

console.log("Suppliers");
await ensure("Supplier", "SupplierName", [
	{ SupplierName: "In-house production" }, // used for WIP reports with no supplier
	{ SupplierName: "Acme Fasteners Ltd." },
	{ SupplierName: "Northern Steel Supply" },
	{ SupplierName: "Precision Castings Inc." },
]);

console.log("Inspectors (sample people, replace with real ones)");
const quality = roles.find((r) => r.fields.RoleName === "Quality Representative");
const people = [
	{ PersonFirstName: "Jordan", PersonMiddleName: "", PersonLastName: "Smith", PersonEmail: "jordan.smith@example.com", PersonPhone: "555-0101" },
	{ PersonFirstName: "Priya", PersonMiddleName: "R.", PersonLastName: "Nair", PersonEmail: "priya.nair@example.com", PersonPhone: "555-0102" },
	{ PersonFirstName: "Marc", PersonMiddleName: "", PersonLastName: "Tremblay", PersonEmail: "marc.tremblay@example.com", PersonPhone: "555-0103" },
];
const existingPeople = await all("Person");
const existingLinks = await all("RolePerson");
for (const person of people) {
	let rec = existingPeople.find((r) => r.fields.PersonEmail === person.PersonEmail);
	if (!rec) {
		rec = (await api("POST", "Person", { fields: person })).records[0];
		console.log(`  + Person: ${person.PersonFirstName} ${person.PersonLastName}`);
	}
	// Foreign keys use the record id. If your database expects the PersonId/RoleId fields instead, change these two lines.
	const linked = existingLinks.some((l) => Number(l.fields.PersonId) === Number(rec.id) && Number(l.fields.RoleId) === Number(quality.id));
	if (!linked) {
		await api("POST", "RolePerson", { fields: { RoleId: quality.id, PersonId: rec.id } });
		console.log(`  + RolePerson: ${person.PersonFirstName} -> Quality Representative`);
	}
}
console.log("Done.");
