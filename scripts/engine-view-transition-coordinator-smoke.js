"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

function transpile(sourcePath, destinationPath) {
	const source = fs.readFileSync(sourcePath, "utf8");
	const result = ts.transpileModule(source, {
		fileName: sourcePath,
		reportDiagnostics: true,
		compilerOptions: {
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.CommonJS,
			esModuleInterop: true,
		},
	});
	const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
	if (errors.length > 0) {
		throw new Error(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"));
	}
	fs.writeFileSync(destinationPath, result.outputText, "utf8");
}

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});
	return { promise, reject, resolve };
}

function cancellationError() {
	const reason = new Error("Skipped ViewTransition due to another transition starting");
	reason.name = "AbortError";
	return reason;
}

function createNativeHarness() {
	const records = [];
	return {
		records,
		startViewTransition(update) {
			const ready = deferred();
			const updateCallbackDone = deferred();
			const finished = deferred();
			const record = {
				finished: finished.promise,
				ready: ready.promise,
				updateCallbackDone: updateCallbackDone.promise,
				finish: finished.resolve,
				skipTransition() {
					const reason = cancellationError();
					ready.reject(reason);
					finished.reject(reason);
				},
			};
			records.push(record);
			Promise.resolve().then(async () => {
				try {
					await update();
					updateCallbackDone.resolve();
					ready.resolve();
				} catch (reason) {
					updateCallbackDone.reject(reason);
					ready.reject(reason);
					finished.reject(reason);
				}
			});
			return record;
		},
	};
}

async function flushMicrotasks() {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

async function main() {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engine-view-transition-coordinator-"));
	const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
	const unhandledRejections = [];
	const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
	process.on("unhandledRejection", onUnhandledRejection);

	try {
		const sourcePath = path.join(process.cwd(), "src", "engine", "core", "enginetransitions", "ViewTransitionCoordinator.ts");
		const outputPath = path.join(tempRoot, "ViewTransitionCoordinator.js");
		transpile(sourcePath, outputPath);
		const { coordinateEngineViewTransition } = require(outputPath);

		const harness = createNativeHarness();
		globalThis.document = { startViewTransition: harness.startViewTransition.bind(harness) };
		const updates = [];
		const first = coordinateEngineViewTransition(() => updates.push("first"), { conflict: "replace" });
		await flushMicrotasks();
		const second = coordinateEngineViewTransition(() => updates.push("second"), { conflict: "replace" });
		await flushMicrotasks();
		harness.records[1].finish();

		assert.equal(await first, "cancelled", "a superseded native transition should resolve as cancellation");
		assert.equal(await second, "finished");
		assert.deepEqual(updates, ["first", "second"]);

		const third = coordinateEngineViewTransition(() => updates.push("third"), { conflict: "replace" });
		await flushMicrotasks();
		const nativeCallsBeforeSkip = harness.records.length;
		assert.equal(await coordinateEngineViewTransition(() => updates.push("theme")), "skipped");
		assert.equal(harness.records.length, nativeCallsBeforeSkip, "skip conflicts must not start a second native transition");
		harness.records.at(-1).finish();
		assert.equal(await third, "finished");
		assert.deepEqual(updates, ["first", "second", "third", "theme"]);

		globalThis.document = {};
		let unsupportedUpdates = 0;
		assert.equal(await coordinateEngineViewTransition(() => { unsupportedUpdates += 1; }), "unsupported");
		assert.equal(unsupportedUpdates, 1);

		globalThis.document = { startViewTransition: () => { throw new Error("native start failed"); } };
		let fallbackUpdates = 0;
		assert.equal(await coordinateEngineViewTransition(() => { fallbackUpdates += 1; }), "unsupported");
		assert.equal(fallbackUpdates, 1);

		const failingHarness = createNativeHarness();
		globalThis.document = { startViewTransition: failingHarness.startViewTransition.bind(failingHarness) };
		const updateError = new Error("theme update failed");
		await assert.rejects(
			coordinateEngineViewTransition(() => { throw updateError; }, { conflict: "replace" }),
			(reason) => reason === updateError,
			"actual update callback failures must still reject",
		);

		await new Promise((resolve) => setImmediate(resolve));
		assert.deepEqual(unhandledRejections, [], "native cancellation promises must always be observed");
		console.log("Engine View Transition coordinator smoke tests passed");
	} finally {
		process.off("unhandledRejection", onUnhandledRejection);
		if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
		else delete globalThis.document;
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
}

main().catch((reason) => {
	console.error(reason);
	process.exit(1);
});
