import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import type { IconType } from "react-icons";
import { LuLayoutDashboard, LuMenu, LuX } from "react-icons/lu";
import { FiAlertTriangle } from "react-icons/fi";
import { FaRegChartBar } from "react-icons/fa";
import { IoTrashOutline } from "react-icons/io5";
import crossfireLogo from "../assets/crossfireLogo.svg";

const links: { to: string; label: string; icon: IconType }[] = [
	{ to: "/dashboard", label: "Dashboard", icon: LuLayoutDashboard },
	{ to: "/ncrs", label: "NCRs", icon: FiAlertTriangle },
	{ to: "/reports", label: "Reports", icon: FaRegChartBar },
	{ to: "/archive", label: "Archive", icon: IoTrashOutline },
];

/**
 * The site navigation. On wide screens it is a fixed sidebar. On narrow
 * screens it is a menu button that opens a drawer. Escape closes the drawer
 * and moves focus back to the menu button, and a closed drawer cannot be
 * reached with the keyboard.
 *
 * @returns The mobile header, the overlay and the navigation list.
 */
const SidebarNav = () => {
	const [isOpen, setIsOpen] = useState(false);
	const menuButton = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			setIsOpen(false);
			menuButton.current?.focus();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isOpen]);

	return (
		<>
			<header className="mobileHeader">
				<div className="mobileBrand">
					<img src={crossfireLogo} alt="" />
					<NavLink to="/dashboard">Crossfire</NavLink>
				</div>

				<button
					ref={menuButton}
					className="menuButton"
					onClick={() => setIsOpen(!isOpen)}
					aria-label="Navigation menu"
					aria-expanded={isOpen}
					aria-controls="sidebar-navigation"
				>
					{isOpen ? <LuX aria-hidden="true" /> : <LuMenu aria-hidden="true" />}
				</button>
			</header>

			{isOpen && (
				<div
					className="sidebarOverlay"
					onClick={() => setIsOpen(false)}
					aria-hidden="true"
				/>
			)}

			<nav
				id="sidebar-navigation"
				className={`sidebar ${isOpen ? "open" : ""}`}
				aria-label="Main navigation"
			>
				<div className="sidebarBrand">
					<img src={crossfireLogo} alt="" />
					<NavLink to="/dashboard">Crossfire</NavLink>
				</div>

				<ul>
					{links.map(({ to, label, icon: Icon }) => (
						<li key={to} className="sidebarLink">
							<NavLink
								to={to}
								className={({ isActive }) => (isActive ? "active" : "")}
								onClick={() => setIsOpen(false)}
							>
								<Icon aria-hidden="true" />
								{label}
							</NavLink>
						</li>
					))}
				</ul>
			</nav>

			<style jsx global>{`
				#root > nav {
					height: 100vh;
					position: sticky;
					top: 0;
				}

				.sidebar {
					display: flex;
					flex-direction: column;
					gap: 5rem;
					padding: 2rem;
					background-color: var(--lifted-bg);
				}

				.sidebarBrand,
				.mobileBrand {
					display: flex;
					align-items: center;
				}

				.sidebarBrand {
					gap: 1rem;
				}

				.sidebarBrand img {
					width: 40px;
					height: 40px;
				}

				.sidebarBrand a,
				.mobileBrand a {
					color: var(--text-h);
					font-weight: bold;
					text-decoration: none;
				}

				.sidebarBrand a {
					font-size: 1.75rem;
				}

				.sidebar ul {
					display: flex;
					flex-direction: column;
					gap: 1rem;
					list-style: none;
				}

				.sidebarLink {
					position: relative;
					border-radius: 8px;
				}

				.sidebarLink > a {
					display: flex;
					align-items: center;
					gap: 0.75rem;
					width: 100%;
					padding: 0.9rem 1rem;
					color: var(--text);
					font-size: 1.3rem;
					font-weight: 500;
					text-decoration: none;
				}

				.sidebarLink > a:hover,
				.sidebarLink > a.active {
					color: var(--text-h);
					text-decoration: underline;
				}

				.sidebarLink:hover,
				.sidebarLink:has(a.active) {
					background-color: var(--hover);
				}

				.sidebarLink::after {
					content: "";
					position: absolute;
					right: 8%;
					top: 50%;
					width: 5px;
					height: 22px;
					transform: translateY(-50%);
					background-color: var(--link);
					border-radius: 10px;
					opacity: 0;
				}

				.sidebarLink:has(a.active)::after {
					opacity: 1;
				}

				.mobileHeader {
					display: none;
				}

				.mobileBrand {
					gap: 0.75rem;
				}

				.mobileBrand img {
					width: 35px;
					height: 35px;
				}

				.mobileBrand a {
					font-size: 1.5rem;
				}

				.menuButton {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 53px;
					height: 53px;
					border: none;
					border-radius: 8px;
					background: transparent;
					color: var(--text-h);
					font-size: 1.7rem;
					cursor: pointer;
				}

				.menuButton:hover {
					background-color: var(--hover);
				}

				@media (max-width: 768px) {
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
						background-color: var(--lifted-bg);
						border-bottom: 1px solid var(--border);
					}

					.sidebarBrand {
						display: none;
					}

					#sidebar-navigation.sidebar {
						position: fixed;
						top: 0;
						left: 0;
						z-index: 1002;
						width: min(300px, 85vw);
						height: 100vh;
						transform: translateX(-100%);
						visibility: hidden;
						transition:
							transform 0.15s ease-out,
							visibility 0s linear 0.15s;
						box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
					}

					#sidebar-navigation.sidebar.open {
						transform: translateX(0);
						visibility: visible;
						transition: transform 0.15s ease-out;
					}

					.sidebarOverlay {
						position: fixed;
						inset: 0;
						z-index: 1001;
						background-color: rgba(0, 0, 0, 0.45);
					}
				}
			`}</style>
		</>
	);
};

export default SidebarNav;
