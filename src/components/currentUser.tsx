import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { useUser } from "@clerk/react";
import { createRecord, fkValue, listAll, refId } from "./api";

/** The Role.RoleName that new users get. Must exist in the Role table. */
export const PENDING_ROLE = "Pending";

interface PersonFields {
	PersonEmail?: string;
}
interface RoleFields {
	RoleName?: string;
}

/** Where the lookup stands. Pending users are view-only. */
export type CurrentUser =
	| { status: "loading" | "signed-out" }
	| { status: "error"; message: string }
	| { status: "ready"; roles: string[]; isPending: boolean };

const CurrentUserContext = createContext<CurrentUser>({ status: "loading" });

/** Reads the logged-in user's lookup state. Use inside {@link CurrentUserProvider}. */
export const useCurrentUser = () => useContext(CurrentUserContext);

/** Lookups in progress, by email, so StrictMode's double effect creates one person, not two. */
const inFlight = new Map<string, Promise<string[]>>();

/** Finds the person by email (or creates them as Pending) and returns their role names. */
async function syncPerson(
	email: string,
	first: string,
	last: string,
	phone: string,
): Promise<string[]> {
	const existing = inFlight.get(email);
	if (existing) return existing;

	const work = (async () => {
		const [people, roles] = await Promise.all([
			listAll<PersonFields>("Person"),
			listAll<RoleFields>("Role"),
		]);
		const person = people.find(
			(p) => p.fields.PersonEmail?.trim().toLowerCase() === email,
		);

		if (!person) {
			const pending = roles.find((r) => r.fields.RoleName === PENDING_ROLE);
			if (!pending)
				throw new Error(`The Role table has no "${PENDING_ROLE}" role.`);
			const created = await createRecord<PersonFields>("Person", {
				PersonEmail: email,
				PersonFirstName: first,
				PersonMiddleName: "",
				PersonLastName: last,
				PersonPhone: phone,
			});
			await createRecord("RolePerson", {
				PersonId: refId("Person", created),
				RoleId: refId("Role", pending),
			});
			return [PENDING_ROLE];
		}

		const roleName = new Map(
			roles.map((r) => [refId("Role", r), r.fields.RoleName ?? ""]),
		);
		const links = await listAll<Record<string, unknown>>("RolePerson");
		const personId = refId("Person", person);
		return links
			.filter((l) => fkValue(l.fields.PersonId) === personId)
			.map((l) => roleName.get(fkValue(l.fields.RoleId) ?? -1) ?? "")
			.filter(Boolean);
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
 * shares their roles with the app. Children render straight away; the roles
 * fill in once the lookup finishes.
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
			.then((roles) => {
				if (cancelled) return;
				const isPending =
					roles.length === 0 || roles.every((r) => r === PENDING_ROLE);
				setState({ status: "ready", roles, isPending });
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