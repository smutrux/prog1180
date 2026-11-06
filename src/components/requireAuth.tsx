import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@clerk/react";

/**
 * Wraps routes that need a signed-in user. Signed-out visitors are sent to
 * the dashboard, where the log in button is. Nothing is rendered until Clerk
 * has loaded, so a signed-in user refreshing a protected page isn't bounced.
 *
 * @returns The child route, a redirect, or nothing while Clerk loads.
 */
const RequireAuth = () => {
	const { isLoaded, isSignedIn } = useAuth();

	if (!isLoaded) return null;
	if (!isSignedIn) return <Navigate to="/dashboard" replace />;

	return <Outlet />;
};

export default RequireAuth;