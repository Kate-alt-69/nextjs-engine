"use strict";

const STATE_KEY = Symbol.for("nextjs-engine.nenc-terminal-logger-state");
const STATUS_REFRESH_MS = 400;

function getState() {
	if (!globalThis[STATE_KEY]) {
		globalThis[STATE_KEY] = {
			status: "",
			source: "",
			statuses: {},
			statusSequence: 0,
			activeRoutes: new Map(),
			routeBatchStartedAt: 0,
			timer: null,
			rows: 0,
			active: false,
			painting: false,
			internalWrite: false,
			bridgeBusy: false,
		};
	}
	return globalThis[STATE_KEY];
}

function cleanMessage(value) {
	return String(value ?? "")
		.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
		.replace(/[\r\n\t]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function clip(message, maxLength) {
	if (message.length <= maxLength) return message;
	if (maxLength <= 1) return message.slice(0, maxLength);
	return message.slice(0, maxLength - 1) + "…";
}

function formatStatusLine(message, columns = process.stdout.columns || 120) {
	const prefix = "[NENC] ";
	const width = Math.max(1, Math.floor(Number(columns) || 120) - 1);
	return prefix + clip(cleanMessage(message), Math.max(0, width - prefix.length));
}

function formatDoneLine(message) {
	return "[NENC] DONE " + cleanMessage(message);
}

function formatFailedLine(message) {
	return "[NENC] FAILED " + cleanMessage(message);
}

function supportsPinnedStatus(stream = process.stdout) {
	return Boolean(stream && stream.isTTY
		&& process.env.CI !== "true"
		&& process.env.TERM !== "dumb"
		&& process.env.NENC_NO_STATUS_LINE !== "1");
}

function terminalRows() {
	const stdoutRows = Number(process.stdout.rows);
	const errorRows = Number(process.stderr && process.stderr.rows);
	const outputSize = typeof process.stdout.getWindowSize === "function"
		? process.stdout.getWindowSize()[1] : 0;
	return Math.max(2, stdoutRows || errorRows || outputSize || Number(process.env.LINES) || 24);
}

function restoreLatestStatus(state) {
	const latest = Object.entries(state.statuses)
		.sort((left, right) => right[1].sequence - left[1].sequence)[0];
	if (!latest) {
		state.status = "";
		state.source = "";
		return false;
	}
	state.source = latest[0];
	state.status = latest[1].message;
	return Boolean(state.status);
}

function paintStatus() {
	const state = getState();
	if (!state.status || !supportsPinnedStatus()) return;
	const rows = terminalRows();
	state.painting = true;
	try {
		// Keep ordinary stdout/stderr output inside a scroll region that excludes the last row.
		process.stdout.write("\u001b[1;" + (rows - 1) + "r");
		process.stdout.write("\u001b[" + (rows - 1) + ";1H");
		const liveStatus = state.source === "nextjs" && state.activeRoutes.size && state.routeBatchStartedAt
			? state.status + " · " + ((Date.now() - state.routeBatchStartedAt) / 1000).toFixed(1) + "s"
			: state.status;
		process.stdout.write("\u001b[" + rows + ";1H\u001b[2K" + formatStatusLine(liveStatus));
		process.stdout.write("\u001b[" + (rows - 1) + ";1H");
		state.rows = rows;
		state.active = true;
	} catch {
		// Logging must never break the compiler or an asset request.
	} finally {
		state.painting = false;
	}
}

function sendIPCEvent(level, message, source = "engine") {
	if (process.env.NENC_LOG_TRANSPORT !== "ipc" || typeof process.send !== "function") return false;
	try {
		process.send({ type: "nenc-log", level, message: cleanMessage(message), source });
		return true;
	} catch {
		return false;
	}
}

function setStatus(message, source = "engine") {
	const state = getState();
	const normalized = cleanMessage(message);
	state.statuses[source] = { message: normalized, sequence: ++state.statusSequence };
	state.status = normalized;
	state.source = source;
	if (sendIPCEvent("status", normalized, source)) return;
	if (!supportsPinnedStatus()) return;
	paintStatus();
	if (!state.timer) {
		state.timer = setInterval(paintStatus, STATUS_REFRESH_MS);
		state.timer.unref?.();
	}
}

function writeLine(line) {
	const state = getState();
	try {
		state.internalWrite = true;
		process.stdout.write(cleanMessage(line) + "\n");
	} catch {
		// Logging must never break a compiler or an asset request.
	} finally {
		state.internalWrite = false;
	}
	paintStatus();
}

function done(message) {
	if (sendIPCEvent("done", message, "engine")) return;
	writeLine(formatDoneLine(message));
}

function failed(message) {
	if (sendIPCEvent("failed", message, "engine")) return;
	writeLine(formatFailedLine(message));
}

function clearStatus(source) {
	const state = getState();
	const effectiveSource = source || (process.env.NENC_LOG_TRANSPORT === "ipc" ? "engine" : undefined);
	if (sendIPCEvent("clear", "", effectiveSource || "engine")) {
		delete state.statuses[effectiveSource || "engine"];
		if (state.source === (effectiveSource || "engine")) restoreLatestStatus(state);
		return;
	}

	if (source) {
		delete state.statuses[source];
		if (state.source !== source) return;
		if (restoreLatestStatus(state)) {
			paintStatus();
			return;
		}
	} else {
		state.statuses = {};
		state.status = "";
		state.source = "";
	}

	if (state.timer) clearInterval(state.timer);
	state.timer = null;
	const wasActive = state.active;
	const rows = Math.max(2, state.rows || terminalRows());
	state.status = "";
	state.source = "";
	state.active = false;
	state.rows = 0;
	if (!wasActive || !supportsPinnedStatus()) return;
	state.painting = true;
	try {
		process.stdout.write("\u001b[r\u001b[" + rows + ";1H\u001b[2K");
	} catch {
		// Cleanup must not hide the compiler result.
	} finally {
		state.painting = false;
	}
}

function dispatchCompilerLine(line) {
	const message = cleanMessage(line).replace(/^nextjs-engine\s*\|\s*/i, "");
	if (!message) return;
	if (/^DONE\b/i.test(message)) {
		done(message.replace(/^DONE\s*/i, ""));
		return;
	}
	if (/^(?:FAILED|ERROR)\b/i.test(message)) {
		failed(message.replace(/^(?:FAILED|ERROR)\s*/i, ""));
		return;
	}
	setStatus(message, "engine");
}

function classifyNextBuildLine(line) {
	const message = cleanMessage(line);
	if (!message || /^\[NENC\]/i.test(message)) return null;

	const compilingRoutes = message.match(/^(?:[○◯]\s*)?Compiling\s+(.+?)(?:\s*\.{3}|…)?$/i);
	if (compilingRoutes) {
		const routes = compilingRoutes[1].replace(/\s*\.{3}$/, "").replace(/…$/, "")
			.split(/,\s*/).map((route) => route.trim()).filter(Boolean);
		if (routes.length) return { level: "route-start", routes, message: "Compiling " + routes.join(", "), suppressible: true };
	}
	const compiledRoute = message.match(/^(?:✓\s*)?Compiled\s+(.+?)\s+in\s+([\d.]+)\s*(ms|s)(?:\s+\((\d+)\s+modules?\))?$/i);
	if (compiledRoute && !/^(?:✓\s*)?Compiled successfully\b/i.test(message)) {
		const duration = compiledRoute[2] + compiledRoute[3];
		const modules = compiledRoute[4] ? Number(compiledRoute[4]) : null;
		return { level: "route-done", route: compiledRoute[1].trim(), message: "compiled " + compiledRoute[1].trim() + " (" + duration + (modules === null ? "" : ", " + modules + " modules") + ")", suppressible: true };
	}

	if (/failed to compile|compilation failed|build failed|error occurred prerendering/i.test(message)) {
		return { level: "failed", message: "NEXT.JS BUILD FAILED", suppressible: true };
	}
	if (/compiled successfully(?:\s+in\b|\b)/i.test(message)) {
		return { level: "done", message: "NEXT.JS COMPILED APPLICATION", suppressible: true };
	}
	const staticPages = message.match(/generating static pages\s*\((\d+)\s*\/\s*(\d+)\)(.*)/i);
	if (staticPages) {
		const current = Number(staticPages[1]);
		const total = Number(staticPages[2]);
		const percent = total > 0 ? Math.floor((current / total) * 100) : 0;
		if (total > 0 && current >= total && /\bin\s+\d+/i.test(staticPages[3])) {
			return { level: "done", message: "GENERATED STATIC PAGES (" + current + "/" + total + ", 100%)", suppressible: true };
		}
		return { level: "status", message: "NEXT.JS GENERATING STATIC PAGES (" + current + "/" + total + ", " + percent + "%)", suppressible: true };
	}
	if (/creating an optimized production build/i.test(message)) {
		return { level: "status", message: "NEXT.JS COMPILING APPLICATION", suppressible: true };
	}
	if (/linting and checking validity of types|checking validity of types|running typescript/i.test(message)) {
		return { level: "status", message: "NEXT.JS CHECKING TYPES", suppressible: true };
	}
	if (/collecting page data/i.test(message)) {
		return { level: "status", message: "NEXT.JS COLLECTING PAGE DATA", suppressible: true };
	}
	if (/finalizing page optimization/i.test(message)) {
		return { level: "status", message: "NEXT.JS FINALIZING PAGE OUTPUTS", suppressible: true };
	}
	if (/collecting build traces/i.test(message)) {
		return { level: "status", message: "NEXT.JS COLLECTING BUILD TRACES", suppressible: true };
	}
	if (/exporting static pages|exporting routes/i.test(message)) {
		return { level: "status", message: "NEXT.JS EXPORTING OUTPUTS", suppressible: true };
	}
	if (/^compiling\b/i.test(message)) {
		return { level: "status", message: "NEXT.JS COMPILING MODULES", suppressible: true };
	}
	if (/build completed successfully/i.test(message)) {
		return { level: "done", message: "NEXT.JS BUILD COMPLETED", suppressible: true };
	}
	return null;
}

function asText(chunk, encoding) {
	if (typeof chunk === "string") return chunk;
	if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
		return Buffer.from(chunk).toString(typeof encoding === "string" ? encoding : "utf8");
	}
	return "";
}

function writeCallback(args) {
	if (typeof args[1] === "function") return args[1];
	if (typeof args[2] === "function") return args[2];
	return null;
}

function dispatchNextBuildEvent(event) {
	const state = getState();
	state.bridgeBusy = true;
	try {
		if (event.level === "route-start") {
			if (state.activeRoutes.size === 0) state.routeBatchStartedAt = Date.now();
			for (const route of event.routes) state.activeRoutes.set(route, Date.now());
			const routes = [...state.activeRoutes.keys()];
			setStatus("Compiling " + routes.join(", ") + ". [" + routes.length + " active]", "nextjs");
		} else if (event.level === "route-done") {
			state.activeRoutes.delete(event.route);
			if (state.activeRoutes.size) {
				const routes = [...state.activeRoutes.keys()];
				setStatus("Compiling " + routes.join(", ") + ". [" + routes.length + " active]", "nextjs");
			} else {
				state.routeBatchStartedAt = 0;
				clearStatus("nextjs");
			}
			done(event.message);
		} else if (event.level === "status") setStatus(event.message, "nextjs");
		else if (event.level === "done") done(event.message);
		else if (event.level === "failed") failed(event.message);
	} finally {
		state.bridgeBusy = false;
	}
}

function installNextBuildOutputBridge() {
	const state = getState();
	const streams = [process.stdout, process.stderr].filter(Boolean);
	const installed = [];
	let stopped = false;

	for (const stream of streams) {
		if (installed.some((entry) => entry.stream === stream)) continue;
		const originalWrite = stream.write;
		const wrappedWrite = function (...args) {
			const bypass = stopped || state.painting || state.internalWrite || state.bridgeBusy;
			const raw = bypass ? "" : asText(args[0], args[1]);
			const normalized = cleanMessage(raw);
			if (!bypass && raw && !/^\[NENC\]/i.test(normalized)) {
				const isSingleLine = /(?:\r\n|\r|\n)$/.test(raw)
					&& !/[\r\n]/.test(raw.replace(/(?:\r\n|\r|\n)+$/, ""));
				const event = isSingleLine ? classifyNextBuildLine(raw.replace(/(?:\r\n|\r|\n)+$/, "")) : null;
				if (event) {
					dispatchNextBuildEvent(event);
					if (event.suppressible) {
						const callback = writeCallback(args);
						if (callback) process.nextTick(callback);
						return true;
					}
				} else if (!isSingleLine) {
					for (const line of raw.split(/[\r\n]+/)) {
						const nestedEvent = classifyNextBuildLine(line);
						if (nestedEvent && nestedEvent.level === "status") dispatchNextBuildEvent(nestedEvent);
					}
				}
			}

			const result = originalWrite.apply(this, args);
			if (!bypass && state.status && supportsPinnedStatus()) paintStatus();
			return result;
		};
		try {
			stream.write = wrappedWrite;
			installed.push({ stream, originalWrite, wrappedWrite });
		} catch {
			// A non-writable stream must not prevent Next.js or Engine from building.
		}
	}

	setStatus("NEXT.JS STARTING", "nextjs");
	return function stopNextBuildOutputBridge() {
		if (stopped) return;
		stopped = true;
		for (const item of installed) {
			if (item.stream.write === item.wrappedWrite) item.stream.write = item.originalWrite;
		}
	};
}

module.exports = {
	cleanMessage,
	clearStatus,
	classifyNextBuildLine,
	dispatchCompilerLine,
	done,
	failed,
	formatDoneLine,
	formatFailedLine,
	formatStatusLine,
	installNextBuildOutputBridge,
	setStatus,
	supportsPinnedStatus,
};
