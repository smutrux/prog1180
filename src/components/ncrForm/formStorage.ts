import {
	SAVED_IDS,
	sectionsFor,
	type FormValues,
	type SectionId,
} from "./formModel";

export const CREATE_PREFIX = "ncr-draft-v3";

export const savedAll = (value: boolean) =>
	Object.fromEntries(SAVED_IDS.map((id) => [id, value])) as Record<
		SectionId,
		boolean
	>;

const sectionKey = (prefix: string, id: SectionId) => `${prefix}:${id}`;

function readSection(prefix: string, id: SectionId): unknown {
	try {
		const raw = window.localStorage.getItem(sectionKey(prefix, id));
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function writeSection(
	prefix: string,
	id: SectionId,
	data: unknown,
): boolean {
	try {
		window.localStorage.setItem(sectionKey(prefix, id), JSON.stringify(data));
		return true;
	} catch {
		return false;
	}
}

export function clearDrafts(prefix: string) {
	try {
		SAVED_IDS.forEach((id) =>
			window.localStorage.removeItem(sectionKey(prefix, id)),
		);
	} catch {
		/* storage unavailable */
	}
}

export function loadDrafts(
	prefix: string,
	base: FormValues,
	restoreLocalSections = true,
) {
	const values: FormValues = JSON.parse(JSON.stringify(base));
	const saved = Object.fromEntries(
		SAVED_IDS.map((id) => [id, false]),
	) as Record<SectionId, boolean>;
	let any = false;
	if (restoreLocalSections) {
		for (const id of SAVED_IDS) {
			const stored = readSection(prefix, id);
			if (stored && typeof stored === "object") {
				(values as Record<SectionId, unknown>)[id] = {
					...values[id],
					...stored,
				};
				saved[id] = true;
				any = true;
			}
		}
	}
	if (
		!Array.isArray(values.evidence.links) ||
		values.evidence.links.length === 0
	)
		values.evidence.links = [""];
	if (!Array.isArray(values.defect.problemTypeIds))
		values.defect.problemTypeIds = [];
	const sections = sectionsFor(values.defect.engineeringRequired === "yes");
	const activeIds = sections.flatMap((section) =>
		section.id === "review" ? [] : [section.id],
	);
	const firstUnsaved = activeIds.find((id) => !saved[id]);
	const step = firstUnsaved
		? sections.findIndex((section) => section.id === firstUnsaved)
		: sections.length - 1;
	return { values, saved, any, step };
}