import * as esbuild from "esbuild";
import path from "node:path";

const isProd = process.argv.includes("--prod");
const version = process.env.APP_VERSION || "dev";

const define: Record<string, string> = {
  __APP_VERSION__: JSON.stringify(version),
};

if (isProd) {
  define["process.env.LOG_LEVEL"] = JSON.stringify("error");
}

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/index.js",
  alias: {
    "@": path.resolve(import.meta.dirname, "../src"),
  },
  define,
});
