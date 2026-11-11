import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { useUser } from "@clerk/react";
import { supabase } from "../utils/supabase";

/** The role.role_name that new users get. Must exist in the role table. */
export const PENDING_ROLE = "Pending";

/** Where the lookup stands. Pending users are view-only. */
export type CurrentUser =
	| { status: "loading" | "signed-out" }
	| { status: "error"; message: string }
	| {
			status: "ready";
			/** The signed-in person's person.person_id. */
			personId: number;
			/** A person has one role now. Kept as a list so existing checks still work. */
			roles: string[];
			isPending: boolean;
	  };

const CurrentUserContext = createContext<CurrentUser>({ status: "loading" });

/** Reads the logged-in user's lookup state. Use inside {@link CurrentUserProvider}. */
export const useCurrentUser = () => useContext(CurrentUserContext);

interface Synced {
	personId: number;
	roles: string[];
}

/** Lookups in progress, by email, so StrictMode's double effect creates one person, not two. */
const inFlight = new Map<string, Promise<Synced>>();

/** Escapes % _ and \ so an email is matched exactly by ilike. */
const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function findPerson(email: string): Promise<Synced | null> {
	const { data, error } = await supabase
		.from("person")
		.select("person_id, role ( role_name )")
		.ilike("person_email", likeExact(email))
		.maybeSingle();
	if (error) throw new Error(error.message);
	if (!data) return null;
	const roleName = data.role?.role_name ?? "";
	return { personId: data.person_id, roles: roleName ? [roleName] : [] };
}

/** Finds the person by email (or creates them as Pending) and returns their id and role. */
async function syncPerson(
	email: string,
	first: string,
	last: string,
	phone: string,
): Promise<Synced> {
	const existing = inFlight.get(email);
	if (existing) return existing;

	const work = (async () => {
		const found = await findPerson(email);
		if (found) return found;

		const { data: pending, error: roleError } = await supabase
			.from("role")
			.select("role_id")
			.eq("role_name", PENDING_ROLE)
			.maybeSingle();
		if (roleError) throw new Error(roleError.message);
		if (!pending) throw new Error(`The role table has no "${PENDING_ROLE}" role.`);

		const { data: created, error } = await supabase
			.from("person")
			.insert({
				person_email: email,
				person_first_name: first,
				person_middle_name: null,
				person_last_name: last,
				person_phone: phone || null,
				role_id: pending.role_id,
			})
			.select("person_id")
			.single();
		if (error) {
			// Another tab created the same person a moment ago.
			if (error.code === "23505") {
				const again = await findPerson(email);
				if (again) return again;
			}
			throw new Error(error.message);
		}
		return { personId: created.person_id, roles: [PENDING_ROLE] };
	})();

	inFlight.set(email, work);
	try {
		return await work;
	} finally {
		inFlight.delete(email);
	}
}

/**
 * Looks up (or creates) the database person for the signed-in Clerk user and
 * shares their id and role with the app. Children render straight away; the
 * details fill in once the lookup finishes.
 */
export const CurrentUserProvider = ({ children }: { children: ReactNode }) => {
	const { isLoaded, user } = useUser();
	const [state, setState] = useState<CurrentUser>({ status: "loading" });

	useEffect(() => {
		if (!isLoaded) return;
		const address = user?.primaryEmailAddress;
		if (!user || !address) {
			setState({ status: "signed-out" });
			return;
		}
		if (address.verification?.status !== "verified") {
			setState({ status: "error", message: "Verify your email address first." });
			return;
		}

		let cancelled = false;
		setState({ status: "loading" });
		syncPerson(
			address.emailAddress.trim().toLowerCase(),
			user.firstName ?? "",
			user.lastName ?? "",
			user.primaryPhoneNumber?.phoneNumber ?? "",
		)
			.then(({ personId, roles }) => {
				if (cancelled) return;
				const isPending =
					roles.length === 0 || roles.every((r) => r === PENDING_ROLE);
				setState({ status: "ready", personId, roles, isPending });
			})
			.catch((err) => {
				if (cancelled) return;
				setState({
					status: "error",
					message: err instanceof Error ? err.message : "Could not load your account.",
				});
			});
		return () => {
			cancelled = true;
		};
	}, [isLoaded, user]);

	return (
		<CurrentUserContext.Provider value={state}>
			{children}
		</CurrentUserContext.Provider>
	);
};