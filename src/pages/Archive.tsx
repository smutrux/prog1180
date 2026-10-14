import Ncrs from "../components/ncrList";
import PageHeader from "../components/pageHeader";
import { NewNcrButton } from "../components/ncrModal";

/** The archive page: NCRs that have been closed, with search and filters. */
const Archive = () => (
	<div className="page">
		<PageHeader title="Archive" description="Closed NCRs, kept for reference" />

		<NewNcrButton />

		<Ncrs show="archived" />
	</div>
);

export default Archive;
