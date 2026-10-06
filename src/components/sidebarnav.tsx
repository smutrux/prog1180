import crossfireLogo from '../assets/crossfireLogo.svg'
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
        gap: "2rem"
      }}>
        <a href="#" className="sidebarLink">Dashboard</a>
        <a href="#" className="sidebarLink">NCRs</a>
        <a href="#" className="sidebarLink">Reports</a>
        <a href="#" className="sidebarLink">Archive </a>
      </ul>
    </div>
  )
}

export default SidebarNav

