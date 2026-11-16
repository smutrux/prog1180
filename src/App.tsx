import { BrowserRouter, Routes, Route } from "react-router-dom";
import SidebarNav from "./components/sidebarnav";
import Dashboard from "./pages/Dashboard";
import NCRs from "./pages/NCRs";
import Reports from "./pages/Reports";
import Archive from "./pages/Archive";
import RequireAuth from "./components/requireAuth";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Toaster } from 'react-hot-toast';
import { getToastHost, subscribeToastHost } from "./components/toast";

/** The app's only Toaster: at body level normally, portalled into the
 *  open NCR dialog while there is one, because a modal dialog paints in
 *  the browser's top layer, above any fixed-position container. */
const ToastHost = () => {
    const host = useSyncExternalStore(subscribeToastHost, getToastHost);
    return createPortal(
    // zIndex above Clerk's sign-in modal (~10000), whose backdrop
    // otherwise covers the sign-out and sign-in toasts.
    <Toaster position="top-center" containerStyle={{ zIndex: 100000 }} />,
    host ?? document.body,
);

};

/** The app shell: a skip link, the navigation and the page for the current route. */
const App = () => (
    <BrowserRouter>
        {/* Toast notifications container */}
        <ToastHost />

        <a className="skip-link" href="#main-content">
            Skip to main content
        </a>
        <SidebarNav />

        <main id="main-content" tabIndex={-1}>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route element={<RequireAuth />}>
                    <Route path="/ncrs" element={<NCRs />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/archive" element={<Archive />} />
                </Route>
            </Routes>
        </main>
    </BrowserRouter>
);

export default App;