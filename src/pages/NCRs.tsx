import Ncrs from "../components/Ncrs";

const NCRs = () => {
	return (
		<main className="ncrsPage">
			<header className="ncrsHeading">
				<h1>Non-Conformance Reports</h1>
				<p>Track, inspect, and process supply chain material quality issues</p>
			</header>

			<Ncrs show="all" />

			<style jsx>{`
				.ncrsPage {
					box-sizing: border-box;
					padding: 24px 28px 32px;
					color: var(--text-h);
					font-family: var(--sans);
					line-height: 1.5;
					text-align: left;
				}

				.ncrsHeading { margin-bottom: 22px; }
				.ncrsHeading h1 { margin: 0; font-size: 1.875rem; font-weight: 700; letter-spacing: -0.01em; color: var(--text-h); }
				.ncrsHeading p { margin: 6px 0 0; max-width: 60ch; font-size: 1rem; color: var(--text); }

				@media (max-width: 40rem) {
					.ncrsPage { padding: 16px; }
				}
			`}</style>
		</main>
	);
};

export default NCRs;
