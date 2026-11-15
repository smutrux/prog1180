import { useEffect, useRef } from "react";
import PageHeader from "../components/pageHeader";
import { NewNcrButton } from "../components/ncrModal";
import { useAuth, useClerk } from "@clerk/react";
import clerkSignInAppearance from "../components/clerkSignInAppearance";

/** The dashboard: four headline numbers and the list of NCRs. */
const Dashboard = () => {
	const { isLoaded, isSignedIn } = useAuth();
	const { openSignIn } = useClerk();
	const signInOpened = useRef(false);

	useEffect(() => {
		if (!isLoaded || isSignedIn || signInOpened.current) return;

		signInOpened.current = true;
		void openSignIn({appearance: clerkSignInAppearance});
	}, [isLoaded, isSignedIn, openSignIn]);

	if (!isSignedIn) return null;

	return (
		<div className="page">
			<PageHeader
				title="Welcome to NCR Manager"
				description="Quality Control Dashboard"
			/>
			<NewNcrButton />
		</div>
		
	);
};

export default Dashboard;
