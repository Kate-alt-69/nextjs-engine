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

const shorthandSafetySource = [
	'const wrap = (value: string) => "wrapped:" + value',
	'const holder = { wrap: ["member-value"] }',
	'',
	'createEndpoint([',
	'\t{',
	'\t\tname: "safe"',
	'\t\tinput: {',
	'\t\t\tvalue: "string"',
	'\t\t}',
	'\t\trun.input({',
	'\t\t\tliteral: "wrap[input.value]",',
	'\t\t\tcommentProbe: 1, // wrap[input.value] must remain comment text',
	'\t\t\tregexProbe: /wrap\\[input\\.value\\]/.test("wrap[input.value]"),',
	'\t\t\tmember: holder.wrap[0],',
	'\t\t\ttemplate: `literal wrap[input.value] / ${wrap[input.value]}`,',
	'\t\t\tcalled: wrap[input.value]',
	'\t\t})',
	'\t}',
	'])',
].join("\n");

async function waitFor(check, timeoutMs = 2_000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error("Timed out waiting for APIStatic watcher output.");
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

	const safetyCompiled = compileAPIStaticSource(shorthandSafetySource, "safe-shorthand");
	assert.match(safetyCompiled.code, /wrap\(input\.value\)/);
	assert.match(safetyCompiled.code, /wrap\[input\.value\]/);
	assert.match(safetyCompiled.code, /holder\.wrap\[0\]/);

	const safetyContext = vm.createContext({ Map, globalThis: {} });
	safetyContext.globalThis = safetyContext;
	vm.runInContext(safetyCompiled.code, safetyContext, { filename: "safe-shorthand.js" });
	const safetyRoute = safetyContext.__NEXTJS_ENGINE_API_STATIC__.get("safe-shorthand");
	const safetyResult = await safetyRoute.operations[0].run({
		query: {},
		body: {},
		input: { value: "abc" },
		proxy: async () => undefined,
	});
	assert.deepEqual(JSON.parse(JSON.stringify(safetyResult)), {
		literal: "wrap[input.value]",
		commentProbe: 1,
		regexProbe: true,
		member: "member-value",
		template: "literal wrap[input.value] / wrapped:abc",
		called: "wrapped:abc",
	});

	const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engine-api-static-"));
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

	console.log("APIStatic compiler/runtime watcher smoke test passed");
}

main()
	.then(() => process.exit(0))
	.catch((reason) => {
		console.error(reason);
		process.exit(1);
	});
