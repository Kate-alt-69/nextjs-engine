"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const {
	compileAPIStaticDir,
	compileAPIStaticSource,
	getRouteHash,
} = require("../src/engine/plugins/apiStaticCompiler");

const source = `
const TAX_RATE = 0.18

function calculateTotal(price: number, quantity: number) {
	const subtotal = price * quantity
	return {
		subtotal,
		tax: subtotal * TAX_RATE,
		total: subtotal * (1 + TAX_RATE)
	}
}

createEndpoint([
	{
		name: "calculate"
		query: {
			price: "number"
			quantity: "number=1"
		}
		run.query(return calculateTotal[query.price, query.quantity])
	}

	{
		name: "inline"
		query: {
			a: "number"
			b: "number"
		}
		run.query({ sum: query.a + query.b, product: query.a * query.b })
	}
])
`;

async function waitFor(check, timeoutMs = 2_000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error("Timed out waiting for APIStatic watcher output.");
}

function testParserEdgeCases() {
	const arrowSource = `
const add = (a: number, b: number) => a + b
const multiply = async (a: number, b: number) => a * b
createEndpoint([
	{ name: "add" query: { a: "number" b: "number" } run.query(add[query.a, query.b]) }
	{ name: "multiply" query: { a: "number" b: "number" } run.query(multiply[query.a, query.b]) }
])
`;
	const arrowCompiled = compileAPIStaticSource(arrowSource, "arrow");
	assert.match(arrowCompiled.code, /add\(query\.a, query\.b\)/);
	assert.match(arrowCompiled.code, /multiply\(query\.a, query\.b\)/);

	const regexSource = `
const harmless = "function error() inside a string"
// function response() inside a comment
createEndpoint([
	{
		name: "regex"
		query: { value: "string" }
		run.query(/[)}\\]]/.test(query.value))
	}
	{
		name: "divide"
		query: { a: "number" b: "number" }
		run.query(query.a / query.b)
	}
])
`;
	const regexCompiled = compileAPIStaticSource(regexSource, "regex");
	assert.deepEqual(regexCompiled.operations, ["regex", "divide"]);

	const templateSource = `
function label(value: string) { return \`value:${'${value}'}\` }
createEndpoint([{ name: "label" query: { value: "string" } run.query(label[query.value]) }])
`;
	const templateCompiled = compileAPIStaticSource(templateSource, "template");
	assert.match(templateCompiled.code, /label\(query\.value\)/);

	assert.throws(
		() => compileAPIStaticSource(
			`function error() {}\ncreateEndpoint([{ name: "bad" run.input(1) }])`,
			"reserved",
		),
		/reserved/,
	);
}

function testLastKnownGoodOutput() {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engine-api-static-transaction-"));
	try {
		const endpointDirectory = path.join(projectRoot, "data", "endpoint");
		const routePath = path.join(endpointDirectory, "math.route");
		const outputPath = path.join(
			projectRoot,
			"public",
			"_static",
			"endpoint",
			`math-${getRouteHash("math")}.js`,
		);
		fs.mkdirSync(endpointDirectory, { recursive: true });
		fs.writeFileSync(routePath, source, "utf8");
		compileAPIStaticDir({ projectRoot });
		assert.equal(fs.existsSync(outputPath), true);
		const lastKnownGood = fs.readFileSync(outputPath, "utf8");

		fs.writeFileSync(routePath, `createEndpoint([{ name: "broken" run.query( }])`, "utf8");
		assert.throws(() => compileAPIStaticDir({ projectRoot }));
		assert.equal(fs.existsSync(outputPath), true);
		assert.equal(fs.readFileSync(outputPath, "utf8"), lastKnownGood);

		fs.writeFileSync(routePath, `${source}\n// valid replacement\n`, "utf8");
		compileAPIStaticDir({ projectRoot });
		assert.notEqual(fs.readFileSync(outputPath, "utf8"), lastKnownGood);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
}

async function main() {
	const compiled = compileAPIStaticSource(source, "math");
	assert.equal(compiled.hash, getRouteHash("math"));
	assert.deepEqual(compiled.operations, ["calculate", "inline"]);
	assert.match(compiled.code, /calculateTotal\(query\.price, query\.quantity\)/);

	const context = vm.createContext({ Map, globalThis: {} });
	context.globalThis = context;
	vm.runInContext(compiled.code, context, { filename: "math.js" });
	const route = context.__NEXTJS_ENGINE_API_STATIC__.get("math");
	assert(route);
	assert.equal(route.hash, compiled.hash);

	const calculation = await route.operations[0].run({
		query: { price: 100, quantity: 2 },
		body: {},
		input: {},
		proxy: async () => undefined,
	});
	assert.deepEqual(JSON.parse(JSON.stringify(calculation)), {
		subtotal: 200,
		tax: 36,
		total: 236,
	});

	const inline = await route.operations[1].run({
		query: { a: 7, b: 3 },
		body: {},
		input: {},
		proxy: async () => undefined,
	});
	assert.deepEqual(JSON.parse(JSON.stringify(inline)), { sum: 10, product: 21 });

	testParserEdgeCases();
	testLastKnownGoodOutput();

	const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engine-api-static-watch-"));
	const endpointDirectory = path.join(temporaryRoot, "data", "endpoint", "nested");
	const outputDirectory = path.join(temporaryRoot, "public", "_static", "endpoint");
	fs.mkdirSync(endpointDirectory, { recursive: true });
	fs.writeFileSync(path.join(endpointDirectory, "calc.route"), source, "utf8");

	const directoryCompile = compileAPIStaticDir({
		projectRoot: temporaryRoot,
		endpointDir: "data/endpoint",
		outputDir: "public/_static/endpoint",
	});
	assert.equal(directoryCompile.length, 1);
	assert.equal(directoryCompile[0].route, "nested/calc");
	const generatedFile = path.join(
		outputDirectory,
		"nested",
		`calc-${getRouteHash("nested/calc")}.js`,
	);
	assert.equal(fs.existsSync(generatedFile), true);

	const originalCwd = process.cwd();
	const originalWatchOverride = process.env.NEXTJS_ENGINE_API_WATCH;
	try {
		process.chdir(temporaryRoot);
		process.env.NEXTJS_ENGINE_API_WATCH = "1";
		const withEngineAPI = require("../src/engine/plugins/engineApiPlugin");
		withEngineAPI({}, {
			configDir: ".EngineAPIConfig",
			outputFile: ".engine-api-compiled.json",
			endpointDir: "data/endpoint",
			staticOutputDir: "public/_static/endpoint",
		});

		const before = fs.statSync(generatedFile).mtimeMs;
		await new Promise((resolve) => setTimeout(resolve, 75));
		fs.appendFileSync(path.join(endpointDirectory, "calc.route"), "\n// watcher-touch\n", "utf8");
		await waitFor(() => fs.statSync(generatedFile).mtimeMs > before);
	} finally {
		process.chdir(originalCwd);
		if (originalWatchOverride === undefined) delete process.env.NEXTJS_ENGINE_API_WATCH;
		else process.env.NEXTJS_ENGINE_API_WATCH = originalWatchOverride;
		fs.rmSync(temporaryRoot, { recursive: true, force: true });
	}

	console.log("APIStatic compiler/runtime smoke test passed");
}

main()
	.then(() => process.exit(0))
	.catch((reason) => {
		console.error(reason);
		process.exit(1);
	});
