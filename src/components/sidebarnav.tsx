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
      background: "var(--nav-bg)",
      padding: "2rem"
    }} aria-label="Sidebar Navigation">

      <div style={{display: "flex", gap: "1rem", alignItems: "center"}}>
        <img src={crossfireLogo} style={{width: "40px"}} alt="" />
        <p style={{
          fontWeight: "bold",
          fontSize: "1.75rem",
          color: "var(--sidebar-title)"
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
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100..900;1,100..900&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        #root {
          display: grid;
          grid-template-columns: 300px 1fr;
          min-height: 100vh;
          font-family: "Geist", sans-serif;
          background-color: #F5F5F5;
        }

        #root > nav {
          box-sizing: border-box;
          height: 100vh;
          position: sticky;
          top: 0;
        }

        main {
          min-width: 0;
          padding: 2rem;
        }

        .sidebarLink {
          position: relative;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .sidebarLink > a {
          padding: 0.9rem 1rem;
          color: var(--sidebar-link-clr);
          font-size: 1.3rem;
          font-weight: 500;
          text-decoration: none;  
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          height: 100%;
        }

        .sidebarLink > a:hover,
        .sidebarLink:has(a.active) > a {
          color: var(--sidebar-link-hover-clr);
          text-decoration: underline;
        }

        .sidebarLink:hover,
        .sidebarLink:has(a.active) {
          background-color: var(--sidebar-link-hover);
        }

        .sidebarLink::after {
          content: "";
          position: absolute;

          right: 8%;
          top: 50%;
          transform: translateY(-50%);

          width: 5px;
          height: 22px;
          background-color: #4F6FED;
          border-radius: 10px;
          opacity: 0;
        }

        .sidebarLink:has(a.active)::after  {
          opacity: 1;
        } 

        .sidebarLink img {
          color: #94A3B8;
        }
      `}</style>
    </nav>
  )
}

export default SidebarNav

