import crossfireLogo from '../assets/crossfireLogo.svg'
import { LuLayoutDashboard } from "react-icons/lu";
import { FiAlertTriangle } from "react-icons/fi";
import { FaRegChartBar } from "react-icons/fa";
import { IoTrashOutline } from "react-icons/io5";

var SidebarNav = () => {
  return (
    <nav style={{
      display: "flex",
      flexDirection: "column",
      width: "250px",
      height: "100vh",
      overflowY: "auto",
      position: "fixed",
      top: "0",
      left: "0",
      gap: "5rem",
      background: "#151825",
      padding: "2rem"
    }} aria-label="Sidebar Navigation">

      <div style={{display: "flex", gap: "1rem"}}>
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
          
          <a href="#"> <LuLayoutDashboard aria-hidden="true"/>Dashboard</a>
        </li>
        <li className="sidebarLink">  
      
          <a href="#"> <FiAlertTriangle aria-hidden="true"/>NCRs</a>
        </li>
        <li className="sidebarLink">  
          <a href="#"> <FaRegChartBar aria-hidden="true"/>Reports</a>
        </li>
        <li className="sidebarLink">  
          <a href="#"> <IoTrashOutline aria-hidden="true"/>Archive</a>
        </li>
      </ul>
    </nav>
  )
}

export default SidebarNav

