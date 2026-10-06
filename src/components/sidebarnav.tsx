import crossfireLogo from '../assets/crossfireLogo.svg'
import { LuLayoutDashboard } from "react-icons/lu";
import { FiAlertTriangle } from "react-icons/fi";
import { FaRegChartBar } from "react-icons/fa";
import { IoTrashOutline } from "react-icons/io5";

var SidebarNav = () => {
  const path = window.location.pathname;
  return (
    <nav style={{
      display: "flex",
      flexDirection: "column",
      gap: "5rem",
      background: "#151825",
      padding: "2rem"
    }} aria-label="Sidebar Navigation">

      <div style={{display: "flex", gap: "1rem", alignItems: "center"}}>
        <img src={crossfireLogo} style={{width: "40px"}} alt="" />
        <p style={{
          fontWeight: "bold",
          fontSize: "1.75rem",
          color: "white"
        }}>Crossfire</p>
      </div>
     
      <ul style={{
        display: "flex",
        flexDirection: "column",
        padding: "0",
        gap: "1rem",
        listStyle: "none"
      }}>
        <li className="sidebarLink">  
          
          <a href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined} className={path === "/dashboard" ? "active" : ""}><LuLayoutDashboard aria-hidden="true"/>Dashboard</a>
        </li>
        <li className="sidebarLink">  
      
          <a href="/ncrs" aria-current={path === "/ncrs" ? "page" : undefined} className={path === "/ncrs" ? "active" : ""}><FiAlertTriangle aria-hidden="true"/>NCRs</a>
        </li>
        <li className="sidebarLink" aria-current={path === "/reports" ? "page" : undefined}>  
          <a href="/reports" aria-current={path === "/reports" ? "page" : undefined} className={path === "/reports" ? "active" : ""}><FaRegChartBar aria-hidden="true"/>Reports</a>
        </li>
        <li className="sidebarLink" aria-current={path === "/archive" ? "page" : undefined}>  
          <a href="/archive" aria-current={path === "/archive" ? "page" : undefined} className={path === "/archive" ? "active" : ""}><IoTrashOutline aria-hidden="true"/>Archive</a>
        </li>
      </ul>
    </nav>
  )
}

export default SidebarNav

