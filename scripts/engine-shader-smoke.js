"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
	compileEngineShaderSource,
	compileShaderDirectory,
	decodeArtifact,
	parseEngineShaderSource,
} = require("../src/engine/plugins/engineShaderCompiler");
const { resolveShaderBasePath } = require("../src/engine/plugins/engineShaderPlugin");

assert.strictEqual(resolveShaderBasePath("/project", "public/_static/shader"), "/_static/shader");
assert.strictEqual(resolveShaderBasePath("/project", "public/assets/esh"), "/assets/esh");
assert.strictEqual(resolveShaderBasePath("/project", "public/assets/esh", "/custom/esh/"), "/custom/esh");
assert.strictEqual(resolveShaderBasePath("/project", "public/assets/esh", "https://cdn.example.com/esh/"), "https://cdn.example.com/esh");
assert.throws(
	() => resolveShaderBasePath("/project", "dist/shader"),
	/shaderOutputDir must be inside public/,
);

const animatedSource = `
shader <= pixelAurora => [
	var <= speed => .55
	const <= pixelSize => 4
	const <= unused => 99

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
assert.deepStrictEqual({ ...animated.constants }, { pixelSize: 4 });
assert.strictEqual(animated.render.resolution, 0.25);
assert.strictEqual(animated.render.filter, "nearest");
assert.ok(animated.fragment.includes("uniform float e_time;"));
assert.ok(!animated.fragment.includes("uniform vec2 e_pointer;"));
assert.ok(!animated.fragment.includes("uniform float e_scroll;"));
assert.ok(animated.fragment.includes("u_var_speed"));
assert.ok(!animated.fragment.includes("u_var_pixelSize"));
assert.ok(animated.fragment.includes("4.0"));
assert.ok(animated.fragment.indexOf("e_pixelGrid_pixel") < animated.fragment.indexOf("e_aurora"));
assert.deepStrictEqual(animated.flows, [
	{ from: "frame.color", to: "after.pixel" },
	{ from: "after.pixel", to: "screen" },
]);

const multilineColorSource = `
shader <= multilineColors => [
	before.gradient => [
		colors => [
			#071126
			#5b21b6
			#06b6d4
		]
	]
]
`;
const parsedMultilineColors = parseEngineShaderSource(multilineColorSource, "multiline-colors.shed");
assert.deepStrictEqual(parsedMultilineColors.ast.before.gradient.colors, ["#071126", "#5b21b6", "#06b6d4"]);
const multilineColorPlan = compileEngineShaderSource(multilineColorSource, "multiline-colors");
assert.strictEqual(multilineColorPlan.execution, "static");
assert.ok(multilineColorPlan.fragment.includes("color=mix(vec3("));
assert.ok(!multilineColorPlan.fragment.includes("uniform float e_time;"));
assert.ok(!multilineColorPlan.fragment.includes("uniform vec2 e_pointer;"));
assert.ok(!multilineColorPlan.fragment.includes("uniform float e_scroll;"));
assert.ok(!multilineColorPlan.fragment.includes("float e_hash("));

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
assert.ok(eventPlan.fragment.includes("uniform vec2 e_pointer;"));
assert.ok(!eventPlan.fragment.includes("uniform float e_time;"));

const staticSource = `
shader <= staticGradient => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
]
`;
const staticPlan = compileEngineShaderSource(staticSource, "static-gradient");
assert.strictEqual(staticPlan.execution, "static");
assert.ok(!staticPlan.fragment.includes("uniform float e_time;"));
assert.ok(!staticPlan.fragment.includes("uniform float e_delta;"));
assert.ok(!staticPlan.fragment.includes("uniform float e_frame;"));
assert.ok(!staticPlan.fragment.includes("uniform vec2 e_pointer;"));
assert.ok(!staticPlan.fragment.includes("uniform float e_scroll;"));
assert.ok(!staticPlan.fragment.includes("float e_hash("));

const orderedSource = `
shader <= ordered => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
	after.grade => [
		use => palette
		colors => 12
	]
	after.noise => [
		use => dither
		strength => .02
	]
	frame.color => after.noise
	after.noise => after.grade
	after.grade => screen
]
`;
const orderedPlan = compileEngineShaderSource(orderedSource, "ordered");
assert.ok(orderedPlan.fragment.indexOf("e_hash(floor(gl_FragCoord.xy))") < orderedPlan.fragment.indexOf("floor(color*max(12.0"));
assert.ok(orderedPlan.fragment.includes("float e_hash("));

const crossStageSource = `
shader <= crossStage => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
	after.grade => [
		use => palette
		colors => 8
	]
	overlay.scan => [
		use => scanlines
		strength => .04
	]
	frame.color => after.grade
	after.grade => overlay.scan
	overlay.scan => screen
]
`;
const crossStagePlan = compileEngineShaderSource(crossStageSource, "cross-stage");
assert.deepStrictEqual(crossStagePlan.flows, [
	{ from: "frame.color", to: "after.grade" },
	{ from: "after.grade", to: "overlay.scan" },
	{ from: "overlay.scan", to: "screen" },
]);

const deadPassSource = `
shader <= deadPass => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
	after.used => [
		use => palette
		colors => 8
	]
	after.orphan => [
		use => dither
		strength => .91
		position <= pointer.x
	]
	overlay.orphanGrain => [
		use => grain
		strength => .73
		time <= system.time
	]
	frame.color => after.used
	after.used => screen
]
`;
const deadPassPlan = compileEngineShaderSource(deadPassSource, "dead-pass");
assert.strictEqual(deadPassPlan.execution, "static");
assert.deepStrictEqual(deadPassPlan.dependencies, []);
assert.ok(!deadPassPlan.fragment.includes("0.91"));
assert.ok(!deadPassPlan.fragment.includes("0.73"));
assert.ok(!deadPassPlan.fragment.includes("uniform vec2 e_pointer;"));
assert.ok(!deadPassPlan.fragment.includes("uniform float e_time;"));
assert.ok(!deadPassPlan.fragment.includes("float e_hash("));
assert.deepStrictEqual(deadPassPlan.flows, [
	{ from: "frame.color", to: "after.used" },
	{ from: "after.used", to: "screen" },
]);

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

assert.throws(() => compileEngineShaderSource(`
shader <= invalidSource => [
	before.gradient => [
		value <= pointer.z
	]
]
`, "invalid-source"), /unsupported runtime source pointer\.z/);

assert.throws(() => compileEngineShaderSource(`
shader <= invalidFlow => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
	after.one => [
		use => palette
	]
	after.two => [
		use => dither
	]
	after.one => after.two
	after.two => after.one
]
`, "invalid-flow"), /render graph contains a cycle/);

assert.throws(() => compileEngineShaderSource(`
shader <= backwardFlow => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
	after.grade => [
		use => palette
	]
	overlay.scan => [
		use => scanlines
	]
	overlay.scan => after.grade
]
`, "backward-flow"), /cannot flow backward/);

assert.throws(() => compileEngineShaderSource(`
shader <= beforeFlow => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
	after.grade => [
		use => palette
	]
	before.gradient => after.grade
]
`, "before-flow"), /connect frame\.color instead of before\.\*/);

assert.throws(() => compileEngineShaderSource(`
shader <= invalidDeadEffect => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
	after.bad => [
		use => definitely-not-an-effect
	]
	after.good => [
		use => palette
	]
	frame.color => after.good
	after.good => screen
]
`, "invalid-dead-effect"), /unsupported after effect/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-shader-"));
try {
	const sourceDir = path.join(root, "data", "shader", "public");
	const outputDir = path.join(root, "public", "_static", "shader");
	const manifestPath = path.join(outputDir, "manifest.json");
	fs.mkdirSync(sourceDir, { recursive: true });
	fs.writeFileSync(path.join(sourceDir, "aurora.shed"), animatedSource);
	const manifest = compileShaderDirectory({ projectRoot: root });
	assert.ok(manifest.shaders.aurora);
	assert.ok(manifest.shaders.aurora.file.endsWith(".shed.dat"));
	const firstArtifactPath = path.join(outputDir, manifest.shaders.aurora.file);
	const artifact = fs.readFileSync(firstArtifactPath);
	assert.strictEqual(artifact.subarray(0, 4).toString("ascii"), "ESH1");
	const decoded = decodeArtifact(artifact);
	assert.strictEqual(decoded.name, "pixelAurora");
	assert.strictEqual(decoded.execution, "animated");
	assert.deepStrictEqual({ ...decoded.constants }, { pixelSize: 4 });

	const firstHash = manifest.shaders.aurora.hash;
	const firstFile = manifest.shaders.aurora.file;
	fs.writeFileSync(path.join(sourceDir, "aurora.shed"), animatedSource.replace(".55", ".75"));
	const nextManifest = compileShaderDirectory({ projectRoot: root });
	assert.notStrictEqual(nextManifest.shaders.aurora.hash, firstHash);
	assert.notStrictEqual(nextManifest.shaders.aurora.file, firstFile);
	assert.ok(!fs.existsSync(path.join(outputDir, firstFile)));
	assert.ok(fs.existsSync(path.join(outputDir, nextManifest.shaders.aurora.file)));

	const lastGoodManifest = fs.readFileSync(manifestPath, "utf8");
	const lastGoodArtifactPath = path.join(outputDir, nextManifest.shaders.aurora.file);
	const lastGoodArtifact = fs.readFileSync(lastGoodArtifactPath);
	fs.writeFileSync(path.join(sourceDir, "broken.shed"), "shader <= broken => [\n\tbefore.gradient => [\n");
	assert.throws(() => compileShaderDirectory({ projectRoot: root }), /missing a closing/);
	assert.strictEqual(fs.readFileSync(manifestPath, "utf8"), lastGoodManifest);
	assert.deepStrictEqual(fs.readFileSync(lastGoodArtifactPath), lastGoodArtifact);
} finally {
	fs.rmSync(root, { recursive: true, force: true });
}

console.log("EngineShader compiler smoke tests passed");
