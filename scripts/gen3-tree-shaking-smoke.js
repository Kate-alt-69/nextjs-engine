"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, ".nextjs-engine", "tree-shaking-proof");
const appRoot = path.join(fixtureRoot, "app");
const distRoot = path.join(fixtureRoot, "proof-dist");

fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.mkdirSync(appRoot, { recursive: true });
fs.writeFileSync(path.join(fixtureRoot, "next.config.js"), "module.exports = { distDir: 'proof-dist' };\n");
fs.writeFileSync(path.join(fixtureRoot, "package.json"), JSON.stringify({ private: true }, null, 2));
fs.copyFileSync(
	path.join(repoRoot, "src", "engine", "compiler", "EngineBuildBudgets.ts"),
	path.join(appRoot, "EngineBuildBudgets.ts"),
);
fs.writeFileSync(path.join(appRoot, "layout.tsx"), [
	'import type { ReactNode } from "react";',
	'export default function Layout({ children }: { children: ReactNode }) { return <html><body>{children}</body></html>; }',
	'',
].join("\n"));
fs.writeFileSync(path.join(appRoot, "page.tsx"), [
	'"use client";',
	'import { evaluateEngineBuildBudgets } from "./EngineBuildBudgets";',
	'export default function Page() {',
	'\tconst report = evaluateEngineBuildBudgets({ requestCount: 1 }, { requestCount: 2 });',
	'\treturn <main data-proof={report.status}>tree shaking proof</main>;',
	'}',
	'',
].join("\n"));

try {
	const result = spawnSync(process.execPath, [path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"), "build", fixtureRoot], {
		cwd: repoRoot,
		encoding: "utf8",
		env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
	});
	if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);

	const chunkRoot = path.join(distRoot, "static", "chunks");
	const chunks = fs.readdirSync(chunkRoot, { recursive: true })
		.filter((filename) => typeof filename === "string" && filename.endsWith(".js"));
	const source = chunks.map((filename) => fs.readFileSync(path.join(chunkRoot, filename), "utf8")).join("\n");
	for (const marker of [
		"NENCClient", "NENCTransport", "EngineModel]", "Unknown computed value",
		"EngineCanvas]", "adaptiveTargetFps", "EngineBrowser]", "browserInfo",
		"EngineCookies]", "EngineCookieVault", "inspectEngineNENC",
	]) {
		assert.equal(source.includes(marker), false, `Unused production marker leaked: ${marker}`);
	}
	assert.match(source, /Build budget failed|request-count/, "The selected budget runtime was not emitted.");
	console.log("Generation 3 D.20 production tree-shaking smoke: ok");
} finally {
	fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
