import { BrowserRouter, Routes, Route } from "react-router-dom";
import SidebarNav from "./components/sidebarnav";
import Dashboard from "./pages/Dashboard";
import NCRs from "./pages/NCRs";
import Reports from "./pages/Reports";
import Archive from "./pages/Archive";

/** The app shell: a skip link, the navigation and the page for the current route. */
const App = () => (
	<BrowserRouter>
		<a className="skip-link" href="#main-content">
			Skip to main content
		</a>
		<SidebarNav />

		<main id="main-content" tabIndex={-1}>
			<Routes>
				<Route path="/" element={<Dashboard />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path="/ncrs" element={<NCRs />} />
				<Route path="/reports" element={<Reports />} />
				<Route path="/archive" element={<Archive />} />
			</Routes>
		</main>
	</BrowserRouter>
);

export default App;
