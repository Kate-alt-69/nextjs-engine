const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".style-smoke");

function compileStyleRuntime() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/hooks/usePropStyles.ts",
		"--outDir", outDir,
		"--rootDir", "src/engine",
		"--module", "commonjs",
		"--moduleResolution", "node",
		"--target", "es2022",
		"--jsx", "react-jsx",
		"--esModuleInterop",
		"--skipLibCheck",
		"--incremental", "false",
	], {
		cwd: repoRoot,
		stdio: "inherit",
	});
}

function assertIncludes(css, expected, message) {
	assert.ok(css.includes(expected), `${message}\nExpected: ${expected}\nActual: ${css}`);
}

try {
	compileStyleRuntime();

	const { StyleCollector } = require(path.join(outDir, "core", "StyleCollector.js"));
	const { cpropClass, staticClass } = require(path.join(outDir, "hooks", "usePropStyles.js"));

	const firstCollector = new StyleCollector();
	const secondCollector = new StyleCollector();

	const firstClass = staticClass({ color: "red" }, firstCollector);
	const secondClass = staticClass({ color: "blue" }, secondCollector);
	assertIncludes(firstCollector.collect(), `.${firstClass}{color:red}`, "first collector should contain its own rule");
	assert.ok(!firstCollector.collect().includes(`.${secondClass}{color:blue}`), "first collector must not inherit second collector CSS");
	assertIncludes(secondCollector.collect(), `.${secondClass}{color:blue}`, "second collector should contain its own rule");
	assert.ok(!secondCollector.collect().includes(`.${firstClass}{color:red}`), "second collector must not inherit first collector CSS");

	const nestedCollector = new StyleCollector();
	const nestedClass = staticClass({
		color: "black",
		"@media(min-width: 700px)": {
			color: "blue",
			"@supports(display:grid)": { display: "grid" },
		},
	}, nestedCollector);
	const nestedCss = nestedCollector.collect();
	assertIncludes(
		nestedCss,
		`@media(min-width: 700px){.${nestedClass}{color:blue}@supports(display:grid){.${nestedClass}{display:grid}}}`,
		"nested conditional at-rules should retain parent scope",
	);

	const keyframeCollector = new StyleCollector();
	const keyframeClass = staticClass({
		animation: "e-smoke 1s linear",
		"@keyframes e-smoke": {
			from: { opacity: 0, transform: "scale(.8)" },
			to: { opacity: 1, transform: "scale(1)" },
		},
	}, keyframeCollector);
	const keyframeCss = keyframeCollector.collect();
	assertIncludes(keyframeCss, `.${keyframeClass}{animation:e-smoke 1s linear}`, "base animation declaration should survive");
	assertIncludes(
		keyframeCss,
		"@keyframes e-smoke{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}",
		"keyframe frame selectors should be serialized instead of discarded",
	);

	const declarationCollector = new StyleCollector();
	staticClass({
		color: "black",
		"@font-face": {
			fontFamily: "EngineSmoke",
			src: "url(engine-smoke.woff2)",
		},
	}, declarationCollector);
	const declarationCss = declarationCollector.collect();
	assertIncludes(
		declarationCss,
		"@font-face{font-family:EngineSmoke;src:url(engine-smoke.woff2)}",
		"declaration at-rules should emit declarations directly",
	);
	assert.ok(!declarationCss.includes("@font-face{:root"), "declaration at-rules must never be wrapped in :root");

	const cpropCollector = new StyleCollector();
	const cpropClasses = cpropClass({
		onHover: {
			color: "red",
			"@media(min-width: 900px)": { color: "blue" },
		},
	}, cpropCollector);
	assert.ok(cpropClasses, "cprop should return a generated class");
	const hoverClass = cpropClasses.split(" ")[0];
	const cpropCss = cpropCollector.collect();
	assertIncludes(cpropCss, `.${hoverClass}:hover{color:red}`, "cprop base pseudo rule should compile");
	assertIncludes(
		cpropCss,
		`@media(min-width: 900px){.${hoverClass}:hover{color:blue}}`,
		"cprop at-rules should remain scoped to the pseudo selector",
	);

	console.log("style compiler smoke: ok");
} finally {
	fs.rmSync(outDir, { recursive: true, force: true });
}
