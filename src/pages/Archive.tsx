import Ncrs from "../components/ncrList";
import PageHeader from "../components/pageHeader";

/** The archive page: NCRs that have been closed, with search and filters. */
const Archive = () => (
	<div className="page">
		<PageHeader title="Archive" description="Closed NCRs, kept for reference" />
		<Ncrs show="archived" />
	</div>
);

export default Archive;
