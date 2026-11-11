import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({}) => {
	const proxy = {};
	return {
		plugins: [react()], // keep your existing plugin setup here
		server: { proxy },
		preview: { proxy },
	};
});
