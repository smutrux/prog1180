import './App.css'
import SidebarNav from './components/sidebarnav'


import Dashboard from './pages/Dashboard'
import NCRs from './pages/NCRs'
import Reports from './pages/Reports'
import Archive from './pages/Archive'


function App() {
  const path = window.location.pathname;

  return (
    <>
      <SidebarNav></SidebarNav>
      <main>
        {path === "/" && <Dashboard />}
        {path === "/dashboard" && <Dashboard />}
        {path === "/ncrs" && <NCRs />}
        {path === "/reports" && <Reports />}
        {path === "/archive" && <Archive />}
      </main>
      
    </>
  )
}

export default App;
