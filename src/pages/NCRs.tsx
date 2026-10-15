import Ncrs from "../components/ncrList";
import PageHeader from "../components/pageHeader";
import { NewNcrButton } from "../components/ncrModal";

/** The NCRs page: every NCR, with search and filters. */
const NCRs = () => {

	
	return (
		<div className="page">
			<PageHeader
				title="Non-Conformance Reports"
				description="Track, inspect, and process supply chain material quality issues"
			/>

			<NewNcrButton />

			<Ncrs show="all" />
		</div>
	);
};

export default NCRs;
