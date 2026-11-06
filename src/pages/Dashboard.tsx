import PageHeader from "../components/pageHeader";
import { NewNcrButton } from "../components/ncrModal";
import { Show } from "@clerk/react";
import Login from "../components/login";

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
		</div>
	);
};

export default Dashboard;
