import crossfireLogo from '../assets/crossfireLogo.svg'
// import { ReactComponent as ReportsIcon}  from '../assets/reportsIcon.svg'
import dashboardIcon from '../assets/dashboardIcon.svg'
import NCRsIcon from '../assets/ncrIcon.svg'
import archiveIcon from '../assets/archiveIcon.svg'
var SidebarNav = () => {
  return (
    <div style={{
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
    }}>

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
          <img src={dashboardIcon} style={{width: "25px"}} alt="" />
          <a href="#">Dashboard</a>
        </li>
        <li className="sidebarLink">  
          <img src={NCRsIcon} style={{width: "25px"}} alt="" />
          <a href="#">NCRs</a>
        </li>
        <li className="sidebarLink">  
          {/* <ReportsIcon className="sidebarIcon" /> */}
          <a href="#">Reports</a>
        </li>
        <li className="sidebarLink">  
          <img src={archiveIcon} style={{width: "25px"}} alt="" />
          <a href="#">Archive</a>
        </li>
      </ul>
    </div>
  )
}

export default SidebarNav

