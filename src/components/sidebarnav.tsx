import { useState } from "react";
import { NavLink } from "react-router-dom";

import crossfireLogo from "../assets/crossfireLogo.svg";

import { LuLayoutDashboard, LuMenu, LuX } from "react-icons/lu";
import { FiAlertTriangle } from "react-icons/fi";
import { FaRegChartBar } from "react-icons/fa";
import { IoTrashOutline } from "react-icons/io5";

var SidebarNav = () => {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="mobileHeader">
        <div className="mobileBrand">
          <img src={crossfireLogo} alt="" />

          <NavLink to="/dashboard">
            Crossfire
          </NavLink>
        </div>

        <button
          className="menuButton"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isOpen}
          aria-controls="sidebar-navigation"
        >
          {isOpen ? (
            <LuX aria-hidden="true" />
          ) : (
            <LuMenu aria-hidden="true" />
          )}
        </button>
      </header>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="sidebarOverlay"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <nav
        id="sidebar-navigation"
        className={`sidebar ${isOpen ? "open" : ""}`}
        aria-label="Sidebar Navigation"
      >
        {/* Logo */}
        <div className="sidebarBrand">
          <img src={crossfireLogo} alt="" />

          <NavLink to="/dashboard">
            Crossfire
          </NavLink>
        </div>

        {/* Navigation */}
        <ul>
          <li className="sidebarLink">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
              onClick={closeMenu}
            >
              <LuLayoutDashboard aria-hidden="true" />
              Dashboard
            </NavLink>
          </li>

          <li className="sidebarLink">
            <NavLink
              to="/ncrs"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
              onClick={closeMenu}
            >
              <FiAlertTriangle aria-hidden="true" />
              NCRs
            </NavLink>
          </li>

          <li className="sidebarLink">
            <NavLink
              to="/reports"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
              onClick={closeMenu}
            >
              <FaRegChartBar aria-hidden="true" />
              Reports
            </NavLink>
          </li>

          <li className="sidebarLink">
            <NavLink
              to="/archive"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
              onClick={closeMenu}
            >
              <IoTrashOutline aria-hidden="true" />
              Archive
            </NavLink>
          </li>
        </ul>
      </nav>

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

        /* =========================
           SIDEBAR
        ========================= */

        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 5rem;

          padding: 2rem;

          background-color: var(--nav-bg);
        }

        /* =========================
           BRAND
        ========================= */

        .sidebarBrand {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .sidebarBrand img {
          width: 40px;
          height: 40px;
        }

        .sidebarBrand a {
          color: var(--sidebar-title);

          font-size: 1.75rem;
          font-weight: bold;

          text-decoration: none;
        }

        /* =========================
           NAVIGATION
        ========================= */

        .sidebar ul {
          display: flex;
          flex-direction: column;

          padding: 0;

          gap: 1rem;

          list-style: none;
        }

        .sidebarLink {
          position: relative;

          display: flex;
          align-items: center;

          border-radius: 8px;

          gap: 0.75rem;
        }

        .sidebarLink > a {
          display: flex;
          align-items: center;

          width: 100%;
          height: 100%;

          padding: 0.9rem 1rem;

          gap: 0.75rem;

          color: var(--sidebar-link-clr);

          font-size: 1.3rem;
          font-weight: 500;

          text-decoration: none;
        }

        .sidebarLink > a:hover,
        .sidebarLink > a.active {
          color: var(--sidebar-link-hover-clr);
          text-decoration: underline;
        }

        .sidebarLink:hover,
        .sidebarLink:has(a.active) {
          background-color: var(--sidebar-link-hover);
        }

        /* Active indicator */

        .sidebarLink::after {
          content: "";

          position: absolute;

          right: 8%;
          top: 50%;

          width: 5px;
          height: 22px;

          transform: translateY(-50%);

          background-color: #4F6FED;

          border-radius: 10px;

          opacity: 0;
        }

        .sidebarLink:has(a.active)::after {
          opacity: 1;
        }

        /* =========================
           MOBILE HEADER
        ========================= */

        .mobileHeader {
          display: none;
        }

        .mobileBrand {
          display: flex;
          align-items: center;

          gap: 0.75rem;
        }

        .mobileBrand img {
          width: 35px;
          height: 35px;
        }

        .mobileBrand a {
          color: var(--sidebar-title);

          font-size: 1.5rem;
          font-weight: bold;

          text-decoration: none;
        }

        .menuButton {
          display: flex;
          align-items: center;
          justify-content: center;

          width: 44px;
          height: 44px;

          padding: 0;

          border: none;
          border-radius: 8px;

          background: transparent;

          color: var(--sidebar-title);

          font-size: 1.7rem;

          cursor: pointer;
        }

        .menuButton:hover {
          background-color: var(--sidebar-link-hover);
        }

        .menuButton:focus-visible {
          outline: 3px solid #4F6FED;
          outline-offset: 2px;
        }

        /* =========================
           MOBILE
        ========================= */

        @media (max-width: 768px) {

          #root {
            display: block;
            min-height: 100vh;
          }

          main {
            min-width: 0;

            padding: 1rem;
            padding-top: 5rem;
          }

          /* Mobile top bar */

          .mobileHeader {
            position: fixed;

            top: 0;
            left: 0;
            right: 0;

            z-index: 1000;

            display: flex;
            align-items: center;
            justify-content: space-between;

            height: 64px;

            padding: 0 1rem;

            background-color: var(--nav-bg);

            border-bottom: 1px solid rgba(128, 128, 128, 0.15);
          }

          /* Hide desktop logo */

          .sidebarBrand {
            display: none;
          }

          /* Mobile drawer */

          #sidebar-navigation.sidebar {
            position: fixed;

            top: 0;
            left: 0;

            z-index: 1002;

            width: min(300px, 85vw);
            height: 100vh;

            padding: 2rem;

            background-color: var(--nav-bg);

            transform: translateX(-100%);

            transition: transform 0.15s ease-out;

            box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
          }

          #sidebar-navigation.sidebar.open {
            transform: translateX(0);
          }

          /* Make sure children use the sidebar theme */

          #sidebar-navigation.sidebar ul,
          #sidebar-navigation.sidebar li,
          #sidebar-navigation.sidebar .sidebarBrand {
            background-color: transparent;
          }

          #sidebar-navigation.sidebar .sidebarBrand a {
            color: var(--sidebar-title);
          }

          #sidebar-navigation.sidebar .sidebarLink > a {
            color: var(--sidebar-link-clr);
          }

          #sidebar-navigation.sidebar .sidebarLink > a:hover,
          #sidebar-navigation.sidebar .sidebarLink > a.active {
            color: var(--sidebar-link-hover-clr);
          }

          #sidebar-navigation.sidebar .sidebarLink:hover,
          #sidebar-navigation.sidebar .sidebarLink:has(a.active) {
            background-color: var(--sidebar-link-hover);
          }

          /* Overlay */

          .sidebarOverlay {
            position: fixed;

            inset: 0;

            z-index: 1001;

            background-color: rgba(0, 0, 0, 0.45);
          }
        }

        /* =========================
           REDUCED MOTION
        ========================= */

        @media (prefers-reduced-motion: reduce) {
          .sidebar {
            transition: none;
          }
        }
      `}</style>
    </>
  );
};

export default SidebarNav;