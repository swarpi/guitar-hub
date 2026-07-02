import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		passWithNoTests: true,
		setupFiles: ["./src/test-setup.ts"],
		exclude: ["**/node_modules/**", "**/.claude/worktrees/**"],
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
});
