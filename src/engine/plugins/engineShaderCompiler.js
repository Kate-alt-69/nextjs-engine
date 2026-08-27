"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SHADER_FORMAT_VERSION = 1;
const BINARY_MAGIC = Buffer.from("ESH1", "ascii");
const PIPELINE_ROOTS = new Set(["before", "render", "after", "overlay", "frame", "screen"]);
const DYNAMIC_ROOTS = new Set(["system", "pointer", "scroll", "viewport"]);
const UNSUPPORTED_FRAME_SOURCES = new Set([
	"frame.depth",
	"frame.normal",
	"frame.velocity",
	"frame.previous",
	"frame.history",
]);

const DEFAULT_VERTEX_SHADER = [
	"attribute vec2 a_position;",
	"void main(){",
	"\tgl_Position=vec4(a_position,0.0,1.0);",
	"}",
].join("\n");

function normalizeLogicalName(value) {
	const normalized = String(value || "")
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\.shed$/i, "");
	if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
		throw new Error(`[EngineShaderCompiler] Invalid shader name: ${value}`);
	}
	return normalized;
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

function stripComment(line) {
	const trimmed = line.trimStart();
	return trimmed.startsWith("#") ? "" : line;
}

function parseInlineList(raw) {
	const content = raw.trim().slice(1, -1).trim();
	if (!content) return [];
	const values = [];
	let token = "";
	let quote = null;
	for (let index = 0; index < content.length; index += 1) {
		const character = content[index];
		if (quote) {
			token += character;
			if (character === quote && content[index - 1] !== "\\") quote = null;
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			token += character;
			continue;
		}
		if (/\s|,/.test(character)) {
			if (token.trim()) {
				values.push(parseValue(token.trim()));
				token = "";
			}
			continue;
		}
		token += character;
	}
	if (token.trim()) values.push(parseValue(token.trim()));
	return values;
}

function parseValue(raw) {
	const value = String(raw).trim();
	if (!value) return "";
	if (value.startsWith("[") && value.endsWith("]")) return parseInlineList(value);
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;
	const numeric = Number(value);
	if (Number.isFinite(numeric)) return numeric;
	return value;
}

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function setNested(target, pathValue, value) {
	const parts = pathValue.split(".").filter(Boolean);
	let current = target;
	for (let index = 0; index < parts.length - 1; index += 1) {
		const part = parts[index];
		if (!isObject(current[part])) current[part] = {};
		current = current[part];
	}
	current[parts[parts.length - 1]] = value;
}

function getNested(target, pathValue) {
	const parts = pathValue.split(".").filter(Boolean);
	let current = target;
	for (const part of parts) {
		if (!isObject(current) && !Array.isArray(current)) return undefined;
		current = current[part];
	}
	return current;
}

function topSegment(value) {
	return String(value).split(".")[0];
}

function resolveScopedPath(scopePath, rawPath) {
	const pathValue = rawPath.trim();
	const root = topSegment(pathValue);
	if (PIPELINE_ROOTS.has(root) || DYNAMIC_ROOTS.has(root) || root === "var" || root === "const") return pathValue;
	return scopePath ? `${scopePath}.${pathValue}` : pathValue;
}

function isPipelineReference(value) {
	return PIPELINE_ROOTS.has(topSegment(value));
}

function parseEngineShaderSource(source, filename = "<inline>") {
	const lines = String(source).replace(/\r\n/g, "\n").split("\n");
	const ast = {};
	const variables = Object.create(null);
	const constants = Object.create(null);
	const bindings = [];
	const flows = [];
	const stack = [{ path: "", node: ast, listItems: [] }];
	let shaderName = null;
	let shaderOpen = false;
	let shaderClosed = false;

	const currentScope = () => stack[stack.length - 1];
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = stripComment(lines[lineIndex]).trim();
		if (!line) continue;

		if (line === "]") {
			if (stack.length === 1) {
				if (shaderOpen && !shaderClosed) {
					shaderClosed = true;
					continue;
				}
				throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} unexpected ].`);
			}
			const closed = stack.pop();
			if (closed.listItems.length > 0) {
				if (Object.keys(closed.node).length > 0) {
					throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} cannot mix list values and named fields in one [].`);
				}
				const parentPath = closed.path.split(".").slice(0, -1).join(".");
				const key = closed.path.split(".").pop();
				const parentNode = parentPath ? getNested(ast, parentPath) : ast;
				parentNode[key] = closed.listItems;
			}
			continue;
		}

		const shaderDeclaration = line.match(/^shader\s*<=\s*([A-Za-z_][A-Za-z0-9_-]*)\s*=>\s*\[$/);
		if (shaderDeclaration) {
			if (shaderName) throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} only one shader declaration is allowed.`);
			shaderName = shaderDeclaration[1];
			shaderOpen = true;
			continue;
		}

		const declaration = line.match(/^(var|const)\s*<=\s*([A-Za-z_][A-Za-z0-9_]*)\s*=>\s*(.+)$/);
		if (declaration) {
			const [, kind, name, rawValue] = declaration;
			const table = kind === "var" ? variables : constants;
			if (Object.prototype.hasOwnProperty.call(table, name)) throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} duplicate ${kind} ${name}.`);
			if (kind === "const" && Object.prototype.hasOwnProperty.call(variables, name)) throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} ${name} is already declared as var.`);
			if (kind === "var" && Object.prototype.hasOwnProperty.call(constants, name)) throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} ${name} is already declared as const.`);
			table[name] = parseValue(rawValue);
			continue;
		}

		const scopeAssignment = line.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*=>\s*\[$/);
		if (scopeAssignment) {
			const pathValue = resolveScopedPath(currentScope().path, scopeAssignment[1]);
			const node = {};
			setNested(ast, pathValue, node);
			stack.push({ path: pathValue, node, listItems: [] });
			continue;
		}

		const binding = line.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*<=\s*([A-Za-z_][A-Za-z0-9_.-]*)$/);
		if (binding) {
			const target = resolveScopedPath(currentScope().path, binding[1]);
			const sourcePath = binding[2];
			if (sourcePath.startsWith("const.")) {
				const name = sourcePath.slice(6);
				if (!Object.prototype.hasOwnProperty.call(constants, name)) throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} unknown const ${name}.`);
			}
			if (sourcePath.startsWith("var.")) {
				const name = sourcePath.slice(4);
				if (!Object.prototype.hasOwnProperty.call(variables, name)) throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} unknown var ${name}.`);
			}
			if (UNSUPPORTED_FRAME_SOURCES.has(sourcePath)) throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} ${sourcePath} requires an EngineCanvas/compositor buffer that surface ESH v1 does not provide yet.`);
			bindings.push({ target, source: sourcePath });
			continue;
		}

		const assignment = line.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*=>\s*(.+)$/);
		if (assignment) {
			const left = resolveScopedPath(currentScope().path, assignment[1]);
			const rawRight = assignment[2].trim();
			if (left.startsWith("const.")) throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} constants cannot be reassigned.`);
			if (left.startsWith("var.")) {
				const name = left.slice(4);
				if (!Object.prototype.hasOwnProperty.call(variables, name)) throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} unknown var ${name}.`);
				variables[name] = parseValue(rawRight);
				continue;
			}
			if (/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(rawRight) && isPipelineReference(left) && isPipelineReference(rawRight)) {
				flows.push({ from: left, to: rawRight });
				continue;
			}
			setNested(ast, left, parseValue(rawRight));
			continue;
		}

		if (!line.includes("=>") && !line.includes("<=")) {
			currentScope().listItems.push(parseValue(line));
			continue;
		}
		throw new Error(`[EngineShaderCompiler] ${filename}:${lineIndex + 1} could not parse: ${line}`);
	}

	if (stack.length !== 1 || (shaderOpen && !shaderClosed)) throw new Error(`[EngineShaderCompiler] ${filename} is missing a closing ].`);
	if (!shaderName) throw new Error(`[EngineShaderCompiler] ${filename} requires: shader <= name => [`);
	return { shaderName, ast, variables, constants, bindings, flows };
}

function glslNumber(value, fallback = 0) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return `${Number(fallback).toFixed(6)}`;
	return Number.isInteger(numeric) ? `${numeric}.0` : String(numeric);
}

function parseHexColor(value) {
	const normalized = String(value || "").trim().replace(/^#/, "");
	if (![3, 4, 6, 8].includes(normalized.length) || !/^[0-9a-f]+$/i.test(normalized)) return null;
	const expanded = normalized.length <= 4 ? normalized.split("").map((character) => `${character}${character}`).join("") : normalized;
	return [
		parseInt(expanded.slice(0, 2), 16) / 255,
		parseInt(expanded.slice(2, 4), 16) / 255,
		parseInt(expanded.slice(4, 6), 16) / 255,
		expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
	];
}

function inferUniformType(value) {
	if (typeof value === "boolean") return "bool";
	if (typeof value === "number") return "float";
	if (typeof value === "string" && parseHexColor(value)) return "color";
	if (Array.isArray(value)) {
		if (value.length === 2) return "vec2";
		if (value.length === 3) return "vec3";
		if (value.length >= 4) return "vec4";
	}
	return "float";
}

function literalExpression(value, preferred = "float") {
	if (preferred === "color") {
		const color = parseHexColor(value) || (Array.isArray(value) ? value : [0, 0, 0, 1]);
		return `vec3(${glslNumber(color[0])},${glslNumber(color[1])},${glslNumber(color[2])})`;
	}
	if (Array.isArray(value)) {
		const length = Math.max(2, Math.min(4, value.length));
		return `vec${length}(${value.slice(0, length).map((entry) => glslNumber(entry)).join(",")})`;
	}
	return glslNumber(value);
}

function compilePlan(parsed, logicalName) {
	const bindings = new Map(parsed.bindings.map((binding) => [binding.target, binding.source]));
	const dependencies = new Set();
	for (const binding of parsed.bindings) {
		if (["system.", "pointer.", "scroll.", "viewport."].some((prefix) => binding.source.startsWith(prefix))) dependencies.add(binding.source);
	}
	const referencedVariables = new Set(parsed.bindings.filter((binding) => binding.source.startsWith("var.")).map((binding) => binding.source.slice(4)));
	const variables = [...referencedVariables].map((name) => ({ name, type: inferUniformType(parsed.variables[name]), defaultValue: parsed.variables[name] }));

	const resolveProperty = (pathValue, fallback, preferred = "float") => {
		const sourcePath = bindings.get(pathValue);
		if (sourcePath?.startsWith("const.")) return literalExpression(parsed.constants[sourcePath.slice(6)], preferred);
		if (sourcePath?.startsWith("var.")) {
			const name = sourcePath.slice(4);
			return inferUniformType(parsed.variables[name]) === "color" ? `u_var_${name}.rgb` : `u_var_${name}`;
		}
		if (sourcePath === "system.time") return "e_time";
		if (sourcePath === "system.delta") return "e_delta";
		if (sourcePath === "system.frame") return "e_frame";
		if (sourcePath === "pointer.x") return "e_pointer.x";
		if (sourcePath === "pointer.y") return "e_pointer.y";
		if (sourcePath === "scroll.position") return "e_scroll";
		if (sourcePath === "viewport.width") return "e_resolution.x";
		if (sourcePath === "viewport.height") return "e_resolution.y";
		const assigned = getNested(parsed.ast, pathValue);
		return literalExpression(assigned === undefined ? fallback : assigned, preferred);
	};

	const renderResolution = Number(getNested(parsed.ast, "render.resolution") ?? 1);
	const renderFilter = String(getNested(parsed.ast, "render.filter") ?? "linear");
	const fallback = String(getNested(parsed.ast, "render.fallback") ?? getNested(parsed.ast, "fallback") ?? "transparent");
	const glsl = [
		"precision highp float;",
		"uniform vec2 e_resolution;",
		"uniform float e_time;",
		"uniform float e_delta;",
		"uniform float e_frame;",
		"uniform vec2 e_pointer;",
		"uniform float e_scroll;",
	];
	for (const definition of variables) {
		const type = definition.type === "color" ? "vec4" : definition.type === "bool" ? "float" : definition.type;
		glsl.push(`uniform ${type} u_var_${definition.name};`);
	}
	glsl.push("float e_hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}");
	glsl.push("void main(){");
	glsl.push("\tvec2 uv=gl_FragCoord.xy/max(e_resolution.xy,vec2(1.0));");
	glsl.push("\tvec2 p=uv-0.5;");
	glsl.push("\tvec3 color=vec3(0.0);");
	glsl.push("\tfloat alpha=1.0;");

	const before = getNested(parsed.ast, "before") || {};
	for (const key of isObject(before) ? Object.keys(before) : []) {
		const node = before[key];
		if (!isObject(node)) continue;
		const effect = String(node.use || key).toLowerCase();
		const base = `before.${key}`;
		if (effect === "gradient") {
			const colors = Array.isArray(node.colors) ? node.colors : [];
			glsl.push(`\tcolor=mix(${literalExpression(colors[0] ?? node.start ?? node.from ?? "#050510", "color")},${literalExpression(colors[1] ?? node.end ?? node.to ?? "#22105f", "color")},clamp(uv.y,0.0,1.0));`);
		} else if (effect === "aurora") {
			const colors = Array.isArray(node.colors) ? node.colors : [];
			const speed = resolveProperty(`${base}.speed`, 0.6);
			const scale = resolveProperty(`${base}.scale`, 1.3);
			const intensity = resolveProperty(`${base}.intensity`, 1);
			const time = resolveProperty(`${base}.time`, 0);
			glsl.push(`\tfloat e_aurora=sin((p.x*4.0*${scale})+(${time})*${speed})+cos((p.y*3.0*${scale})-(${time})*${speed}*0.7);`);
			glsl.push(`\tcolor=mix(${literalExpression(colors[0] ?? node.colorA ?? "#6d5dfc", "color")},${literalExpression(colors[1] ?? node.colorB ?? "#20d9c2", "color")},smoothstep(-1.3,1.3,e_aurora))*${intensity};`);
		} else if (effect === "noise") {
			const amount = resolveProperty(`${base}.amount`, 0.12);
			const time = resolveProperty(`${base}.time`, 0);
			glsl.push(`\tfloat e_noise=e_hash(floor(gl_FragCoord.xy)+floor((${time})*60.0));`);
			glsl.push(`\tcolor=vec3(0.08,0.10,0.16)+(e_noise-0.5)*${amount};`);
		} else throw new Error(`[EngineShaderCompiler] Shader ${logicalName} uses unsupported before effect: ${effect}`);
	}

	const after = getNested(parsed.ast, "after") || {};
	for (const key of isObject(after) ? Object.keys(after) : []) {
		const node = after[key];
		if (!isObject(node)) continue;
		const effect = String(node.use || key).toLowerCase();
		const base = `after.${key}`;
		if (effect === "pixel" || effect === "pixelate") {
			const size = resolveProperty(`${base}.size`, 4);
			glsl.push(`\tvec2 e_pixelGrid=max(e_resolution/max(${size},1.0),vec2(1.0));`);
			glsl.push("\tuv=floor(uv*e_pixelGrid)/e_pixelGrid;");
		} else if (effect === "palette") {
			const count = resolveProperty(`${base}.colors`, 24);
			glsl.push(`\tcolor=floor(color*max(${count},2.0))/max(${count}-1.0,1.0);`);
		} else if (effect === "dither") {
			glsl.push(`\tcolor+=(e_hash(floor(gl_FragCoord.xy))-0.5)*${resolveProperty(`${base}.strength`, 0.04)};`);
		} else if (effect === "glow" || effect === "bloom") {
			glsl.push(`\tcolor+=color*max(${resolveProperty(`${base}.strength`, 0.2)},0.0);`);
		} else throw new Error(`[EngineShaderCompiler] Shader ${logicalName} uses unsupported after effect: ${effect}`);
	}

	const overlay = getNested(parsed.ast, "overlay") || {};
	for (const key of isObject(overlay) ? Object.keys(overlay) : []) {
		const node = overlay[key];
		if (!isObject(node)) continue;
		const effect = String(node.use || key).toLowerCase();
		const base = `overlay.${key}`;
		if (effect === "grain") {
			glsl.push(`\tcolor+=(e_hash(gl_FragCoord.xy+(${resolveProperty(`${base}.time`, 0)}*23.0))-0.5)*${resolveProperty(`${base}.strength`, 0.02)};`);
		} else if (effect === "scanlines") {
			glsl.push(`\tcolor*=1.0-${resolveProperty(`${base}.strength`, 0.05)}*(0.5+0.5*sin(gl_FragCoord.y*3.14159265));`);
		} else if (effect === "vignette") {
			glsl.push(`\tcolor*=1.0-${resolveProperty(`${base}.strength`, 0.25)}*smoothstep(0.25,0.75,length(p));`);
		} else throw new Error(`[EngineShaderCompiler] Shader ${logicalName} uses unsupported overlay effect: ${effect}`);
	}
	glsl.push("\tgl_FragColor=vec4(clamp(color,0.0,1.0),alpha);");
	glsl.push("}");

	const animated = [...dependencies].some((dependency) => ["system.time", "system.delta", "system.frame"].includes(dependency));
	return {
		version: SHADER_FORMAT_VERSION,
		name: parsed.shaderName,
		logicalName,
		execution: animated ? "animated" : dependencies.size > 0 ? "event" : "static",
		dependencies: [...dependencies].sort(),
		variables,
		constants: parsed.constants,
		render: {
			resolution: Number.isFinite(renderResolution) ? Math.max(0.125, Math.min(2, renderResolution)) : 1,
			filter: renderFilter === "nearest" ? "nearest" : "linear",
		},
		fallback,
		vertex: DEFAULT_VERTEX_SHADER,
		fragment: glsl.join("\n"),
		flows: parsed.flows,
	};
}

function encodeArtifact(plan) {
	const payload = Buffer.from(JSON.stringify(plan), "utf8");
	const header = Buffer.allocUnsafe(8);
	BINARY_MAGIC.copy(header, 0);
	header.writeUInt32LE(payload.length, 4);
	return Buffer.concat([header, payload]);
}

function decodeArtifact(buffer) {
	const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
	if (data.length < 8 || data.subarray(0, 4).compare(BINARY_MAGIC) !== 0) throw new Error("[EngineShaderCompiler] Invalid ESH binary header.");
	const length = data.readUInt32LE(4);
	if (length !== data.length - 8) throw new Error("[EngineShaderCompiler] Invalid ESH binary payload length.");
	const plan = JSON.parse(data.subarray(8).toString("utf8"));
	if (!plan || plan.version !== SHADER_FORMAT_VERSION) throw new Error("[EngineShaderCompiler] Unsupported ESH artifact version.");
	return plan;
}

function compileEngineShaderSource(source, logicalName = "inline", filename = "<inline>") {
	return compilePlan(parseEngineShaderSource(source, filename), normalizeLogicalName(logicalName));
}

function compileShaderDirectory({ projectRoot, shaderDir = "data/shader/public", outputDir = "public/_static/shader" } = {}) {
	const root = path.resolve(projectRoot || process.cwd());
	const sourceDirectory = path.resolve(root, shaderDir);
	const outputDirectory = path.resolve(root, outputDir);
	fs.mkdirSync(outputDirectory, { recursive: true });
	const shaders = Object.create(null);
	for (const filename of listShaderFiles(sourceDirectory)) {
		const relative = path.relative(sourceDirectory, filename).replace(/\\/g, "/");
		const logicalName = normalizeLogicalName(relative);
		const plan = compileEngineShaderSource(fs.readFileSync(filename, "utf8"), logicalName, relative);
		const artifact = encodeArtifact(plan);
		const hash = crypto.createHash("sha256").update(artifact).digest("hex").slice(0, 12);
		const parsedPath = path.posix.parse(logicalName);
		const artifactRelativePath = path.posix.join(parsedPath.dir, `${parsedPath.base}-${hash}.shed.dat`);
		const artifactPath = path.join(outputDirectory, ...artifactRelativePath.split("/"));
		fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
		fs.writeFileSync(artifactPath, artifact);
		shaders[logicalName] = { hash, file: artifactRelativePath, execution: plan.execution, dependencies: plan.dependencies };
	}
	const revision = crypto.createHash("sha256").update(JSON.stringify(shaders)).digest("hex").slice(0, 12);
	fs.writeFileSync(path.join(outputDirectory, "manifest.json"), `${JSON.stringify({ version: SHADER_FORMAT_VERSION, revision, shaders }, null, "\t")}\n`, "utf8");
	return { revision, shaders };
}

module.exports = {
	SHADER_FORMAT_VERSION,
	compileEngineShaderSource,
	compileShaderDirectory,
	decodeArtifact,
	encodeArtifact,
	normalizeLogicalName,
	parseEngineShaderSource,
};
