import { useEffect, useRef } from "react";
import PageHeader from "../components/pageHeader";
import { NewNcrButton } from "../components/ncrModal";
import { useAuth, useClerk } from "@clerk/react";
import Button from "../components/button";
import { notifySuccess, notifyError } from "../components/toast";
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
			{/* These buttons test the toast notifications */}
			<div className="toast-test">
				<Button
					text="Demo Success Toast"
					aria="Demo Success Toast"
					onClick={() => notifySuccess("It Worked!")}
				/>
				<Button
					text="Demo Error Toast"
					aria="Demo Error Toast"
					onClick={() => notifyError("Something went wrong")}
				/>
			</div>
			<style jsx>{`
				.toast-test {
					display: flex;
					gap: 1rem;
				}
			`}</style>
		</div>
		
	);
};

export default Dashboard;
