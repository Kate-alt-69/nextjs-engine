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

function generatedLocalDeclarations(fragment) {
	return [...String(fragment).matchAll(
		/^\s*(?:float|vec2|vec3|vec4|int|bool)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/gm,
	)].map((match) => match[1]);
}

function assertUniqueGeneratedLocals(fragment) {
	const declarations = generatedLocalDeclarations(fragment);
	const duplicates = declarations.filter((name, index) => declarations.indexOf(name) !== index);
	assert.deepStrictEqual([...new Set(duplicates)], []);
}

const collisionSource = `
shader <= collisionProof => [
	before.firstAurora => [
		use => aurora
		time <= system.time
		colors => [#101020 #502080]
	]
	before.secondAurora => [
		use => aurora
		time <= system.time
		colors => [#001020 #205080]
	]
	before.firstNoise => [
		use => noise
		time <= system.time
		amount => .08
	]
	before.secondNoise => [
		use => noise
		time <= system.time
		amount => .04
	]
	after.a-b => [
		use => pixelate
		size => 2
	]
	after.a_b => [
		use => pixelate
		size => 3
	]
	frame.color => after.a-b
	after.a-b => after.a_b
	after.a_b => screen
]
`;

const directPlan = compileEngineShaderSource(collisionSource, "collision-proof", "collision-proof.shed");
assertUniqueGeneratedLocals(directPlan.fragment);
assert.ok(directPlan.fragment.includes("esh_local_"));
assert.strictEqual((directPlan.fragment.match(/float\s+e_aurora\s*=/g) || []).length, 0);
assert.strictEqual((directPlan.fragment.match(/float\s+e_noise\s*=/g) || []).length, 0);
assert.strictEqual((directPlan.fragment.match(/vec2\s+e_pixelGrid_a_b\s*=/g) || []).length, 0);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-shader-locals-"));
try {
	const sourceDirectory = path.join(root, "data", "shader", "public");
	const outputDirectory = path.join(root, "public", "_static", "shader");
	fs.mkdirSync(sourceDirectory, { recursive: true });
	fs.writeFileSync(path.join(sourceDirectory, "collision.shed"), collisionSource);

	const manifest = compileShaderDirectory({ projectRoot: root });
	const entry = manifest.shaders.collision;
	assert.ok(entry);
	const artifact = fs.readFileSync(path.join(outputDirectory, entry.file));
	const artifactPlan = decodeArtifact(artifact);
	assertUniqueGeneratedLocals(artifactPlan.fragment);
	assert.strictEqual(artifactPlan.fragment, directPlan.fragment);
} finally {
	fs.rmSync(root, { recursive: true, force: true });
}

console.log("EngineShader generated-local collision smoke tests passed");
