import PageHeader from "../components/pageHeader";
import { NewNcrButton } from "../components/ncrModal";

/** The dashboard: four headline numbers and the list of NCRs. */
const Dashboard = () => {
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
