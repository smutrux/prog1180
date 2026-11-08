import PageHeader from "../components/pageHeader";
import { NewNcrButton } from "../components/ncrModal";
import { Show } from "@clerk/react";
import Login from "../components/login";
import Button from "../components/button";
import { notifySuccess, notifyError } from "../components/toast";

/** The dashboard: four headline numbers and the list of NCRs. */
const Dashboard = () => {
	return (
		<div className="page">
			<PageHeader
				title="Welcome to NCR Manager"
				description="Quality Control Dashboard"
			/>
			<Show when="signed-in" fallback={<Login />}>
				<NewNcrButton />
			</Show>
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
