import Ncrs from "../components/ncrList";
import PageHeader from "../components/pageHeader";

/** The NCRs page: every NCR, with search and filters. */
const NCRs = () => (
	<div className="page">
		<PageHeader
			title="Non-Conformance Reports"
			description="Track, inspect, and process supply chain material quality issues"
		/>
		<Ncrs show="all" />
	</div>
);

export default NCRs;
