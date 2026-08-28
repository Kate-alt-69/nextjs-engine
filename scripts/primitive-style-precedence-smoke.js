"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".primitive-style-smoke");

function compilePrimitives() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/components/primitives.tsx",
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

function assertStyle(markup, declaration, message) {
	assert.ok(
		markup.includes(declaration),
		`${message}\nExpected style fragment: ${declaration}\nMarkup: ${markup}`,
	);
}

function assertMixedCallersUseLayeredStyles() {
	const files = [
		"src/engine/components/primitives.tsx",
		"src/engine/components/EngineHero.tsx",
		"src/engine/components/EngineMarkdown.tsx",
		"src/engine/components/CustomSelect.tsx",
		"src/engine/components/EngineOverlay/EngineDialog.tsx",
		"src/engine/components/EngineOverlay/EngineDrawer.tsx",
		"src/engine/components/EngineOverlay/EnginePopover.tsx",
	];
	for (const relativePath of files) {
		const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
		assert.match(source, /usePrimitiveStyles/, `${relativePath} should keep defaults outside the explicit-style layer`);
	}
}

try {
	compilePrimitives();
	assertMixedCallersUseLayeredStyles();

	const { EngineProvider } = require(path.join(outDir, "providers", "EngineProvider.js"));
	const {
		EngineButton,
		EngineCard,
		EngineText,
	} = require(path.join(outDir, "components", "primitives.js"));

	const render = (element) => renderToStaticMarkup(
		React.createElement(EngineProvider, null, element),
	);

	const card = render(React.createElement(EngineCard, {
		bg: "#0b0d10",
		borderRadius: "20px",
	}, "Card"));
	assertStyle(card, "background:#0b0d10", "card schema bg should override the variant background");
	assertStyle(card, "border-radius:20px", "card schema borderRadius should override the built-in radius");

	const styledCard = render(React.createElement(EngineCard, {
		bg: "#111111",
		borderRadius: "20px",
		style: {
			background: "#222222",
			borderRadius: "30px",
		},
	}, "Styled card"));
	assertStyle(styledCard, "background:#222222", "explicit card style should override schema bg and defaults");
	assertStyle(styledCard, "border-radius:30px", "explicit card style should override schema radius and defaults");

	const button = render(React.createElement(EngineButton, {
		accentColor: "#ffffff",
		bg: "#7df0b2",
		color: "#07110b",
		fontWeight: 900,
	}, "Button"));
	assertStyle(button, "background:#7df0b2", "button schema bg should override the variant accent background");
	assertStyle(button, "color:#07110b", "button schema color should override variant text color");
	assertStyle(button, "font-weight:900", "button schema fontWeight should override the base weight");

	const styledButton = render(React.createElement(EngineButton, {
		bg: "#7df0b2",
		color: "#07110b",
		fontWeight: 900,
		style: {
			background: "#123456",
			color: "#abcdef",
			fontWeight: 700,
		},
	}, "Styled button"));
	assertStyle(styledButton, "background:#123456", "explicit button style should beat schema bg");
	assertStyle(styledButton, "color:#abcdef", "explicit button style should beat schema color");
	assertStyle(styledButton, "font-weight:700", "explicit button style should beat schema fontWeight");

	const disabledButton = render(React.createElement(EngineButton, {
		disabled: true,
		opacity: 1,
		cursor: "crosshair",
		style: { opacity: 0.9, cursor: "help" },
	}, "Disabled"));
	assertStyle(disabledButton, "opacity:0.5", "required disabled opacity should beat caller styling");
	assertStyle(disabledButton, "cursor:not-allowed", "required disabled cursor should beat caller styling");

	const heading = render(React.createElement(EngineText, {
		variant: "h1",
		fontSize: "6rem",
		fontWeight: 900,
	}, "Heading"));
	assertStyle(heading, "font-size:6rem", "text schema fontSize should override the h1 variant default");
	assertStyle(heading, "font-weight:900", "text schema fontWeight should override the h1 variant default");

	const styledHeading = render(React.createElement(EngineText, {
		variant: "h1",
		fontSize: "6rem",
		fontWeight: 900,
		style: { fontSize: "7rem", fontWeight: 950 },
	}, "Styled heading"));
	assertStyle(styledHeading, "font-size:7rem", "explicit text style should beat schema fontSize");
	assertStyle(styledHeading, "font-weight:950", "explicit text style should beat schema fontWeight");

	console.log("primitive style precedence smoke: ok");
} finally {
	fs.rmSync(outDir, { recursive: true, force: true });
}
