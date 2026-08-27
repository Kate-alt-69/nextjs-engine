"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
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

async function main() {
	const root = fs.mkdtempSync(path.join(process.cwd(), ".engine-browser-smoke-"));
	const basePath = path.join(root, "EngineBrowser.js");
	const safePath = path.join(root, "EngineBrowserSafe.js");

	const originalWindow = globalThis.window;
	const originalDocument = globalThis.document;
	const originalScreen = globalThis.screen;
	const originalSpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance;

	try {
		transpile(path.join(process.cwd(), "src", "engine", "core", "EngineBrowser.ts"), basePath);
		transpile(path.join(process.cwd(), "src", "engine", "core", "EngineBrowserSafe.ts"), safePath);

		delete globalThis.window;
		delete globalThis.document;
		delete globalThis.screen;
		delete globalThis.SpeechSynthesisUtterance;

		const { EngineBrowser } = require(safePath);

		assert.equal(EngineBrowser.info.name, "server");
		assert.equal(await EngineBrowser.clipboard.paste(), null);
		assert.deepEqual(await EngineBrowser.clipboard.read(), []);
		assert.equal(await EngineBrowser.clipboard.canRead(), false);
		assert.equal(await EngineBrowser.clipboard.canWrite(), false);
		assert.equal(await EngineBrowser.interact.share({ title: "test" }), false);
		assert.equal(EngineBrowser.interact.vibrate(10), false);
		assert.equal(await EngineBrowser.interact.badge(1), false);
		assert.equal(await EngineBrowser.interact.clearBadge(), false);
		assert.equal(await EngineBrowser.interact.wakeLock(), null);
		assert.equal(await EngineBrowser.interact.location(), null);
		assert.equal(await EngineBrowser.interact.lockOrientation("portrait"), false);
		assert.equal(await EngineBrowser.media.camera(), null);
		assert.equal(await EngineBrowser.media.microphone(), null);
		assert.equal(await EngineBrowser.media.screen(), null);
		assert.equal(EngineBrowser.speech.isSpeaking(), false);
		assert.deepEqual(EngineBrowser.speech.voices(), []);
		assert.equal(await EngineBrowser.speech.listen(), null);
		await assert.rejects(
			EngineBrowser.speech.speak("server"),
			/Speech synthesis not supported/,
		);
		assert.deepEqual(EngineBrowser.network.status(), { online: true, type: "unknown" });

		const utterances = [];
		class FakeUtterance {
			constructor(text) {
				this.text = text;
				this.rate = 1;
				this.pitch = 1;
				this.volume = 1;
				this.onend = null;
				this.onerror = null;
			}
		}
		const synthesis = {
			speaking: false,
			cancel() {
				this.speaking = false;
			},
			speak(utterance) {
				this.speaking = true;
				utterances.push(utterance);
				queueMicrotask(() => {
					this.speaking = false;
					utterance.onend?.();
				});
			},
			getVoices() {
				return [{ name: "fake", lang: "en-US" }];
			},
		};

		const recognitionInstances = [];
		class FakeRecognition {
			constructor() {
				this.interimResults = false;
				this.continuous = false;
				this.maxAlternatives = 1;
				this.stopped = false;
				this.aborted = false;
				recognitionInstances.push(this);
			}
			start() {}
			stop() {
				this.stopped = true;
				queueMicrotask(() => this.onend?.());
			}
			abort() {
				this.aborted = true;
			}
		}

		globalThis.document = {};
		globalThis.window = {
			speechSynthesis: synthesis,
			SpeechRecognition: FakeRecognition,
		};
		globalThis.SpeechSynthesisUtterance = FakeUtterance;

		await EngineBrowser.speech.speak("silent", {
			rate: 50,
			pitch: 0,
			volume: 0,
		});
		assert.equal(utterances.length, 1);
		assert.equal(utterances[0].rate, 10);
		assert.equal(utterances[0].pitch, 0);
		assert.equal(utterances[0].volume, 0);

		const firstListen = EngineBrowser.speech.listen();
		const secondListen = EngineBrowser.speech.listen();
		assert.equal(recognitionInstances[0].aborted, true);
		assert.equal(await firstListen, null);
		recognitionInstances[1].onresult?.({
			resultIndex: 0,
			results: [{ 0: { transcript: "hello" }, isFinal: true }],
		});
		recognitionInstances[1].onend?.();
		assert.equal(await secondListen, "hello");

		const silenceListen = EngineBrowser.speech.listen({ maxSilence: 0.01 });
		const silenceRecognition = recognitionInstances.at(-1);
		await new Promise((resolve) => setTimeout(resolve, 30));
		assert.equal(silenceRecognition.stopped, true);
		assert.equal(await silenceListen, null);

		console.log("EngineBrowser SSR/speech smoke test passed");
	} finally {
		if (originalWindow === undefined) delete globalThis.window;
		else globalThis.window = originalWindow;
		if (originalDocument === undefined) delete globalThis.document;
		else globalThis.document = originalDocument;
		if (originalScreen === undefined) delete globalThis.screen;
		else globalThis.screen = originalScreen;
		if (originalSpeechSynthesisUtterance === undefined) delete globalThis.SpeechSynthesisUtterance;
		else globalThis.SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
		fs.rmSync(root, { recursive: true, force: true });
	}
}

main().catch((reason) => {
	console.error(reason);
	process.exit(1);
});
