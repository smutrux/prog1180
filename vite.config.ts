import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const proxy = {
		"/db": {
			target: env.NC_BASE_URL || "https://db.steve.lv",
			changeOrigin: true,
			rewrite: (path: string) => path.replace(/^\/db/, ""),
			headers: { "xc-token": env.NC_TOKEN ?? "" },
		},
	};
	return {
		plugins: [react()], // keep your existing plugin setup here
		server: { proxy },
		preview: { proxy },
	};
});

