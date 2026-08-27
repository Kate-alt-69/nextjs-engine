"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const compilerBase = require("./engineShaderCompilerBase");

const GENERATED_LOCAL_DECLARATION = /^(\s*)(float|vec2|vec3|vec4|int|bool)\s+(e_[A-Za-z0-9_]+)(\s*=)/;

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeGeneratedLocals(fragment) {
	const lines = String(fragment).split("\n");
	const declarationCounts = new Map();

	for (const line of lines) {
		const match = line.match(GENERATED_LOCAL_DECLARATION);
		if (!match) continue;
		declarationCounts.set(match[3], (declarationCounts.get(match[3]) ?? 0) + 1);
	}

	const repeatedNames = new Set(
		[...declarationCounts]
			.filter(([, count]) => count > 1)
			.map(([name]) => name),
	);
	if (repeatedNames.size === 0) return fragment;

	const activeAliases = new Map();
	let localIndex = 0;
	return lines.map((line) => {
		const declaration = line.match(GENERATED_LOCAL_DECLARATION);
		if (declaration && repeatedNames.has(declaration[3])) {
			const originalName = declaration[3];
			const alias = `esh_local_${localIndex++}`;
			activeAliases.set(originalName, alias);
			return line.replace(new RegExp(`\\b${escapeRegExp(originalName)}\\b`, "g"), alias);
		}

		let normalizedLine = line;
		for (const [originalName, alias] of activeAliases) {
			normalizedLine = normalizedLine.replace(
				new RegExp(`\\b${escapeRegExp(originalName)}\\b`, "g"),
				alias,
			);
		}
		return normalizedLine;
	}).join("\n");
}

function normalizeCompiledPlan(plan) {
	const fragment = normalizeGeneratedLocals(plan.fragment);
	return fragment === plan.fragment ? plan : { ...plan, fragment };
}

function compileEngineShaderSource(source, logicalName = "inline", filename = "<inline>") {
	return normalizeCompiledPlan(
		compilerBase.compileEngineShaderSource(source, logicalName, filename),
	);
}

function listShaderFiles(directory) {
	if (!fs.existsSync(directory)) return [];
	const files = [];
	const visit = (currentDirectory) => {
		for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
			const absolutePath = path.join(currentDirectory, entry.name);
			if (entry.isDirectory()) visit(absolutePath);
			else if (entry.isFile() && entry.name.endsWith(".shed")) files.push(absolutePath);
		}
	};
	visit(directory);
	return files.sort();
}

function removeStaleShaderArtifacts(outputDirectory, activeFiles) {
	if (!fs.existsSync(outputDirectory)) return;
	const visit = (currentDirectory) => {
		for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
			const absolutePath = path.join(currentDirectory, entry.name);
			if (entry.isDirectory()) {
				visit(absolutePath);
				if (absolutePath !== outputDirectory && fs.readdirSync(absolutePath).length === 0) fs.rmdirSync(absolutePath);
				continue;
			}
			if (!entry.isFile() || !entry.name.endsWith(".shed.dat")) continue;
			const relative = path.relative(outputDirectory, absolutePath).replace(/\\/g, "/");
			if (!activeFiles.has(relative)) fs.rmSync(absolutePath, { force: true });
		}
	};
	visit(outputDirectory);
}

function compileShaderDirectory({
	projectRoot,
	shaderDir = "data/shader/public",
	outputDir = "public/_static/shader",
} = {}) {
	const root = path.resolve(projectRoot || process.cwd());
	const sourceDirectory = path.resolve(root, shaderDir);
	const outputDirectory = path.resolve(root, outputDir);
	const compiledShaders = [];
	const shaders = Object.create(null);

	// Compile every source before touching the last-known-good output directory.
	for (const filename of listShaderFiles(sourceDirectory)) {
		const relative = path.relative(sourceDirectory, filename).replace(/\\/g, "/");
		const logicalName = compilerBase.normalizeLogicalName(relative);
		const plan = compileEngineShaderSource(fs.readFileSync(filename, "utf8"), logicalName, relative);
		const artifact = compilerBase.encodeArtifact(plan);
		const hash = crypto.createHash("sha256").update(artifact).digest("hex").slice(0, 12);
		const parsedPath = path.posix.parse(logicalName);
		const artifactRelativePath = path.posix.join(parsedPath.dir, `${parsedPath.base}-${hash}.shed.dat`);
		compiledShaders.push({ artifact, artifactRelativePath });
		shaders[logicalName] = {
			hash,
			file: artifactRelativePath,
			execution: plan.execution,
			dependencies: plan.dependencies,
		};
	}

	fs.mkdirSync(outputDirectory, { recursive: true });
	for (const { artifact, artifactRelativePath } of compiledShaders) {
		const artifactPath = path.join(outputDirectory, ...artifactRelativePath.split("/"));
		fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
		fs.writeFileSync(artifactPath, artifact);
	}

	const revision = crypto.createHash("sha256").update(JSON.stringify(shaders)).digest("hex").slice(0, 12);
	fs.writeFileSync(
		path.join(outputDirectory, "manifest.json"),
		`${JSON.stringify({ version: compilerBase.SHADER_FORMAT_VERSION, revision, shaders }, null, "\t")}\n`,
		"utf8",
	);
	removeStaleShaderArtifacts(
		outputDirectory,
		new Set(compiledShaders.map(({ artifactRelativePath }) => artifactRelativePath)),
	);
	return { revision, shaders };
}

module.exports = {
	SHADER_FORMAT_VERSION: compilerBase.SHADER_FORMAT_VERSION,
	compileEngineShaderSource,
	compileShaderDirectory,
	decodeArtifact: compilerBase.decodeArtifact,
	encodeArtifact: compilerBase.encodeArtifact,
	normalizeLogicalName: compilerBase.normalizeLogicalName,
	parseEngineShaderSource: compilerBase.parseEngineShaderSource,
};
