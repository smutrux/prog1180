import { useClerk } from "@clerk/react";
import { FiLogIn } from "react-icons/fi";
import Button from "./button";
import clerkSignInAppearance from "./clerkSignInAppearance";

/** Shows a log in button when signed out and the user menu when signed in. */
const Login = () => {
	const { openSignIn } = useClerk();

	return (
		<>
			<Button
				text="Log in"
				aria="Log in"
				icon={FiLogIn}
				onClick={() => openSignIn({ appearance: clerkSignInAppearance })}
			/>

			<style jsx>{`
				button {
					margin: 0 auto;
				}
			`}</style>
		</>
	);
};

export default Login;
