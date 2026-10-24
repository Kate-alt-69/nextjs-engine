"use strict";

const STATE_KEY = Symbol.for("nextjs-engine.nenc-terminal-logger-state");
const STATUS_REFRESH_MS = 500;

function getState() {
	if (!globalThis[STATE_KEY]) globalThis[STATE_KEY] = { status: "", timer: null, rows: 0, active: false };
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

function paintStatus() {
	const state = getState();
	if (!state.status || !supportsPinnedStatus()) return;
	const rows = Math.max(2, Number(process.stdout.rows) || 24);
	try {
		// Reserve the terminal's last row for progress; normal Next.js output scrolls above it.
		process.stdout.write("\u001b[1;" + (rows - 1) + "r");
		process.stdout.write("\u001b[" + (rows - 1) + ";1H");
		process.stdout.write("\u001b[" + rows + ";1H\u001b[2K" + formatStatusLine(state.status));
		process.stdout.write("\u001b[" + (rows - 1) + ";1H");
		state.rows = rows;
		state.active = true;
	} catch {
		// Logging must never break a compiler or an asset request.
	}
}

function setStatus(message) {
	const state = getState();
	state.status = cleanMessage(message);
	if (!supportsPinnedStatus()) return;
	paintStatus();
	if (!state.timer) {
		state.timer = setInterval(paintStatus, STATUS_REFRESH_MS);
		state.timer.unref?.();
	}
}

function writeLine(line) {
	try {
		process.stdout.write(cleanMessage(line) + "\n");
		paintStatus();
	} catch {
		// Logging must never break a compiler or an asset request.
	}
}

function done(message) {
	writeLine(formatDoneLine(message));
}

function failed(message) {
	writeLine(formatFailedLine(message));
}

function clearStatus() {
	const state = getState();
	if (state.timer) clearInterval(state.timer);
	state.timer = null;
	const wasActive = state.active;
	const rows = Math.max(2, state.rows || Number(process.stdout.rows) || 24);
	state.status = "";
	state.active = false;
	state.rows = 0;
	if (!wasActive || !supportsPinnedStatus()) return;
	try {
		process.stdout.write("\u001b[r\u001b[" + rows + ";1H\u001b[2K");
	} catch {
		// Cleanup must not hide the compiler result.
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
	setStatus(message);
}

module.exports = {
	cleanMessage,
	clearStatus,
	dispatchCompilerLine,
	done,
	failed,
	formatDoneLine,
	formatFailedLine,
	formatStatusLine,
	setStatus,
	supportsPinnedStatus,
};
