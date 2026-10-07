import { BrowserRouter, Routes, Route } from "react-router-dom";

import SidebarNav from "./components/sidebarnav";

import Dashboard from "./pages/Dashboard";
import NCRs from "./pages/NCRs";
import Reports from "./pages/Reports";
import Archive from "./pages/Archive";

function App() {
  return (
    <BrowserRouter>
      <SidebarNav />

      <main>
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
}

export default App;