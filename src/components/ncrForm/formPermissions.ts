import type { SectionId } from "./formModel";

/** The role_name values in the role table. */
export const ROLE = {
	admin: "Administrator",
	quality: "Quality",
	engineering: "Engineering",
	operations: "Operations",
	procurement: "Procurement",
} as const;

/**
 * The sections each role may edit. Administrator edits every section, so it
 * is not listed. Pending and any unknown role edit nothing. Everyone can
 * still read every section.
 */
const EDITABLE: Record<string, readonly SectionId[]> = {
	[ROLE.quality]: [
		"process",
		"item",
		"defect",
		"evidence",
		"inspector",
		"qualityFinalReview",
	],
	[ROLE.engineering]: ["engineering"],
	[ROLE.operations]: ["operations"],
	[ROLE.procurement]: ["procurement"],
};

/** True when one of these roles may change this section. */
export const canEditSection = (roles: readonly string[], id: SectionId) =>
	roles.includes(ROLE.admin) || roles.some((r) => EDITABLE[r]?.includes(id));

/**
 * True when one of these roles may start a new NCR. A new NCR needs the
 * process, item and defect answers, which only Quality and Administrator fill in.
 */
export const canCreateNcr = (roles: readonly string[]) =>
	roles.includes(ROLE.admin) || roles.includes(ROLE.quality);

/** The role names that may edit a section, for the note shown on read-only sections. */
export const rolesThatEdit = (id: SectionId): string[] => [
	...Object.keys(EDITABLE).filter((role) => EDITABLE[role].includes(id)),
	ROLE.admin,
];