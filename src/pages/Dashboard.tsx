import PageHeader from "../components/pageHeader";

/** The dashboard: four headline numbers and the list of NCRs. */
const Dashboard = () => {
	return (
		<div className="page">
			<PageHeader
				title="Welcome to NCR Manager"
				description="Quality Control Dashboard"
			/>
		</div>
	);
};

export default Dashboard;
