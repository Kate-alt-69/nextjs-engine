"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
	compileEngineShaderSource,
	compileShaderDirectory,
	decodeArtifact,
} = require("../src/engine/plugins/engineShaderCompiler");

const animatedSource = `
shader <= pixelAurora => [
	var <= speed => .55
	const <= pixelSize => 4

	render => [
		resolution => .25
		filter => nearest
	]

	before.aurora => [
		time <= system.time
		speed <= var.speed
		colors => [#071126 #5b21b6]
	]

	after.pixel => [
		use => pixelate
		size <= const.pixelSize
	]

	overlay.scanlines => [
		strength => .05
	]

	frame.color => after.pixel
	after.pixel => screen
]
`;

const animated = compileEngineShaderSource(animatedSource, "pixel-aurora", "pixel-aurora.shed");
assert.strictEqual(animated.execution, "animated");
assert.deepStrictEqual(animated.dependencies, ["system.time"]);
assert.strictEqual(animated.render.resolution, 0.25);
assert.strictEqual(animated.render.filter, "nearest");
assert.ok(animated.fragment.includes("u_var_speed"));
assert.ok(!animated.fragment.includes("u_var_pixelSize"));
assert.ok(animated.fragment.includes("4.0"));
assert.deepStrictEqual(animated.flows, [
	{ from: "frame.color", to: "after.pixel" },
	{ from: "after.pixel", to: "screen" },
]);

const eventSource = `
shader <= pointerGlow => [
	var <= strength => .3
	before.gradient => [
		colors => [#111827 #312e81]
	]
	overlay.vignette => [
		strength <= var.strength
		position <= pointer.x
	]
]
`;
const eventPlan = compileEngineShaderSource(eventSource, "pointer-glow");
assert.strictEqual(eventPlan.execution, "event");
assert.deepStrictEqual(eventPlan.dependencies, ["pointer.x"]);

const staticSource = `
shader <= staticGradient => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
]
`;
const staticPlan = compileEngineShaderSource(staticSource, "static-gradient");
assert.strictEqual(staticPlan.execution, "static");

assert.throws(() => compileEngineShaderSource(`
shader <= invalid => [
	before.gradient => [
		depth <= frame.depth
	]
]
`, "invalid"), /frame\.depth requires/);

assert.throws(() => compileEngineShaderSource(`
shader <= invalidConst => [
	const <= quality => 1
	const.quality => 2
]
`, "invalid-const"), /constants cannot be reassigned/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-shader-"));
try {
	const sourceDir = path.join(root, "data", "shader", "public");
	const outputDir = path.join(root, "public", "_static", "shader");
	fs.mkdirSync(sourceDir, { recursive: true });
	fs.writeFileSync(path.join(sourceDir, "aurora.shed"), animatedSource);
	const manifest = compileShaderDirectory({ projectRoot: root });
	assert.ok(manifest.shaders.aurora);
	assert.ok(manifest.shaders.aurora.file.endsWith(".shed.dat"));
	const artifact = fs.readFileSync(path.join(outputDir, manifest.shaders.aurora.file));
	assert.strictEqual(artifact.subarray(0, 4).toString("ascii"), "ESH1");
	const decoded = decodeArtifact(artifact);
	assert.strictEqual(decoded.name, "pixelAurora");
	assert.strictEqual(decoded.execution, "animated");

	const firstHash = manifest.shaders.aurora.hash;
	fs.writeFileSync(path.join(sourceDir, "aurora.shed"), animatedSource.replace(".55", ".75"));
	const nextManifest = compileShaderDirectory({ projectRoot: root });
	assert.notStrictEqual(nextManifest.shaders.aurora.hash, firstHash);
} finally {
	fs.rmSync(root, { recursive: true, force: true });
}

console.log("EngineShader compiler smoke tests passed");
