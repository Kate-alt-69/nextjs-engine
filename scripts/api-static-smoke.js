"use strict";

const assert = require("assert/strict");
const vm = require("vm");
const {
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

Promise.resolve()
	.then(async () => {
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
		console.log("APIStatic compiler smoke test passed");
	})
	.catch((reason) => {
		console.error(reason);
		process.exitCode = 1;
	});
