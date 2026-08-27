"use client";

// Public safety/lifecycle facade for EngineBrowser.
//
// The original detection implementation remains in EngineBrowser.ts so existing
// internal imports stay compatible. The package/root entrypoint exports this
// facade, which hardens browser-only methods against SSR/Node globals and owns
// the speech lifecycle explicitly.

import { EngineBrowser as BaseEngineBrowser, useBrowser as useBaseBrowser } from "./EngineBrowser";
import type {
	BrowserInfo,
	BrowserIs,
	BrowserSupports,
	BrowserName,
	RenderingEngine,
	BrowserConditions,
	BrowserClipboard,
	BrowserInteract,
	ShareData,
	PickFileOptions,
	OrientationLock,
	BrowserMedia,
	MediaCameraOptions,
	BrowserSpeech,
	SpeakOptions,
	ListenOptions,
	BrowserNetwork,
	NetworkStatus,
	NetworkType,
} from "./EngineBrowser";

export type {
	BrowserInfo,
	BrowserIs,
	BrowserSupports,
	BrowserName,
	RenderingEngine,
	BrowserConditions,
	BrowserClipboard,
	BrowserInteract,
	ShareData,
	PickFileOptions,
	OrientationLock,
	BrowserMedia,
	MediaCameraOptions,
	BrowserSpeech,
	SpeakOptions,
	ListenOptions,
	BrowserNetwork,
	NetworkStatus,
	NetworkType,
};

function hasDOM(): boolean {
	return typeof window !== "undefined" && typeof document !== "undefined";
}

function cssSupportsCondition(condition: string): boolean {
	if (!hasDOM() || typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
	try {
		return CSS.supports(condition);
	} catch {
		return false;
	}
}

let patchedSupportsSource: BrowserSupports | null = null;
let patchedSupportsValue: BrowserSupports | null = null;

function patchSupports(source: BrowserSupports): BrowserSupports {
	if (!hasDOM()) return source;
	if (patchedSupportsSource === source && patchedSupportsValue) return patchedSupportsValue;

	patchedSupportsSource = source;
	patchedSupportsValue = {
		...source,
		cssHas: cssSupportsCondition("selector(:has(*))"),
		cssNesting: cssSupportsCondition("selector(&)"),
		cssLayer: typeof (globalThis as any).CSSLayerBlockRule !== "undefined",
	};
	return patchedSupportsValue;
}

function browserInfo(): BrowserInfo {
	const info = BaseEngineBrowser.info;
	if (!hasDOM()) return info;
	const supports = patchSupports(info.supports);
	return supports === info.supports ? info : { ...info, supports };
}

export function useBrowser(): BrowserInfo {
	const info = useBaseBrowser();
	// Preserve the exact SSR snapshot on the client's first render so hydration
	// cannot diverge before the base hook updates after mount.
	if (!hasDOM() || info.name === "server") return info;
	const supports = patchSupports(info.supports);
	return supports === info.supports ? info : { ...info, supports };
}

const clipboard: BrowserClipboard = {
	copy(text) {
		if (!hasDOM()) return Promise.resolve(false);
		return BaseEngineBrowser.clipboard.copy(text);
	},
	copyHtml(html, plainText) {
		if (!hasDOM()) return Promise.resolve(false);
		return BaseEngineBrowser.clipboard.copyHtml(html, plainText);
	},
	paste() {
		if (!hasDOM()) return Promise.resolve(null);
		return BaseEngineBrowser.clipboard.paste();
	},
	read() {
		if (!hasDOM()) return Promise.resolve([]);
		return BaseEngineBrowser.clipboard.read();
	},
	canRead() {
		if (!hasDOM()) return Promise.resolve(false);
		return BaseEngineBrowser.clipboard.canRead();
	},
	canWrite() {
		if (!hasDOM()) return Promise.resolve(false);
		return BaseEngineBrowser.clipboard.canWrite();
	},
};

const interact: BrowserInteract = {
	share(data) {
		if (!hasDOM()) return Promise.resolve(false);
		return BaseEngineBrowser.interact.share(data);
	},
	notify(title, options) {
		if (!hasDOM()) return Promise.resolve(null);
		return BaseEngineBrowser.interact.notify(title, options);
	},
	vibrate(pattern) {
		if (!hasDOM()) return false;
		return BaseEngineBrowser.interact.vibrate(pattern);
	},
	pickFile(options) {
		if (!hasDOM()) return Promise.resolve(null);
		return BaseEngineBrowser.interact.pickFile(options);
	},
	download(filename, data, mimeType) {
		if (!hasDOM()) return;
		BaseEngineBrowser.interact.download(filename, data, mimeType);
	},
	badge(count) {
		if (!hasDOM()) return Promise.resolve(false);
		return BaseEngineBrowser.interact.badge(count);
	},
	clearBadge() {
		if (!hasDOM()) return Promise.resolve(false);
		return BaseEngineBrowser.interact.clearBadge();
	},
	fullscreen(element) {
		if (!hasDOM()) return Promise.resolve(false);
		return BaseEngineBrowser.interact.fullscreen(element);
	},
	exitFullscreen() {
		if (!hasDOM()) return Promise.resolve();
		return BaseEngineBrowser.interact.exitFullscreen();
	},
	wakeLock() {
		if (!hasDOM()) return Promise.resolve(null);
		return BaseEngineBrowser.interact.wakeLock();
	},
	location(options) {
		if (!hasDOM()) return Promise.resolve(null);
		return BaseEngineBrowser.interact.location(options);
	},
	lockOrientation(orientation) {
		if (!hasDOM() || typeof screen === "undefined") return Promise.resolve(false);
		return BaseEngineBrowser.interact.lockOrientation(orientation);
	},
};

const media: BrowserMedia = {
	camera(options) {
		if (!hasDOM()) return Promise.resolve(null);
		return BaseEngineBrowser.media.camera(options);
	},
	microphone(options) {
		if (!hasDOM()) return Promise.resolve(null);
		return BaseEngineBrowser.media.microphone(options);
	},
	screen(options) {
		if (!hasDOM()) return Promise.resolve(null);
		return BaseEngineBrowser.media.screen(options);
	},
	stop(stream) {
		try {
			BaseEngineBrowser.media.stop(stream);
		} catch {
			// Stopping an already-ended/invalid stream should remain a no-op.
		}
	},
};

function finiteNumber(value: number | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

interface ActiveSpeech {
	utterance: SpeechSynthesisUtterance;
	resolve(): void;
}

let activeSpeech: ActiveSpeech | null = null;

function settleActiveSpeech(): void {
	const current = activeSpeech;
	if (!current) return;
	activeSpeech = null;
	current.resolve();
}

interface ActiveRecognition {
	instance: any;
	finish(value: string | null): void;
}

let activeRecognition: ActiveRecognition | null = null;

function cancelActiveRecognition(): void {
	const current = activeRecognition;
	if (!current) return;
	current.finish(null);
	try {
		if (typeof current.instance.abort === "function") current.instance.abort();
		else if (typeof current.instance.stop === "function") current.instance.stop();
	} catch {
		// The recognition session was already ended.
	}
}

const speech: BrowserSpeech = {
	speak(text, options = {}) {
		if (!hasDOM() || typeof window.speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
			return Promise.reject(new Error("Speech synthesis not supported"));
		}

		const synthesis = window.speechSynthesis;
		settleActiveSpeech();
		try {
			synthesis.cancel();
		} catch {
			// Some engines throw while no utterance is active.
		}

		return new Promise<void>((resolve, reject) => {
			const utterance = new SpeechSynthesisUtterance(text);
			if (options.voice) utterance.voice = options.voice;
			if (options.lang) utterance.lang = options.lang;
			if (finiteNumber(options.rate)) utterance.rate = clamp(options.rate, 0.1, 10);
			if (finiteNumber(options.pitch)) utterance.pitch = clamp(options.pitch, 0, 2);
			if (finiteNumber(options.volume)) utterance.volume = clamp(options.volume, 0, 1);

			let settled = false;
			const finish = (reason?: unknown) => {
				if (settled) return;
				settled = true;
				utterance.onend = null;
				utterance.onerror = null;
				if (activeSpeech?.utterance === utterance) activeSpeech = null;
				if (reason === undefined) resolve();
				else reject(reason);
			};

			activeSpeech = {
				utterance,
				resolve: () => finish(),
			};

			utterance.onend = () => finish();
			utterance.onerror = (event) => {
				const code = (event as any)?.error;
				if (code === "canceled" || code === "interrupted") finish();
				else finish(code ? new Error(`Speech synthesis failed: ${code}`) : event);
			};

			try {
				synthesis.speak(utterance);
			} catch (reason) {
				finish(reason);
			}
		});
	},

	stopSpeaking() {
		if (!hasDOM() || typeof window.speechSynthesis === "undefined") return;
		settleActiveSpeech();
		try {
			window.speechSynthesis.cancel();
		} catch {
			// Already stopped.
		}
	},

	isSpeaking() {
		if (!hasDOM() || typeof window.speechSynthesis === "undefined") return false;
		return window.speechSynthesis.speaking;
	},

	listen(options = {}, onInterim) {
		if (!hasDOM()) return Promise.resolve(null);

		const Recognition =
			(window as any).SpeechRecognition ??
			(window as any).webkitSpeechRecognition;
		if (typeof Recognition !== "function") return Promise.resolve(null);

		cancelActiveRecognition();

		return new Promise<string | null>((resolve) => {
			let recognition: any;
			try {
				recognition = new Recognition();
			} catch {
				resolve(null);
				return;
			}

			recognition.lang = options.lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US") ?? "en-US";
			recognition.interimResults = options.interim ?? false;
			recognition.continuous = false;
			recognition.maxAlternatives = 1;

			let transcript = "";
			let settled = false;
			let silenceTimer: ReturnType<typeof setTimeout> | null = null;
			let stopFallback: ReturnType<typeof setTimeout> | null = null;
			const silenceMs = finiteNumber(options.maxSilence) && options.maxSilence > 0
				? Math.max(1, options.maxSilence * 1000)
				: 0;

			const clearTimers = () => {
				if (silenceTimer !== null) clearTimeout(silenceTimer);
				if (stopFallback !== null) clearTimeout(stopFallback);
				silenceTimer = null;
				stopFallback = null;
			};

			const finish = (value: string | null) => {
				if (settled) return;
				settled = true;
				clearTimers();
				recognition.onresult = null;
				recognition.onend = null;
				recognition.onerror = null;
				recognition.onspeechstart = null;
				if (activeRecognition?.instance === recognition) activeRecognition = null;
				resolve(value);
			};

			const stopForSilence = () => {
				try {
					recognition.stop();
					stopFallback = setTimeout(() => finish(transcript.trim() || null), 250);
				} catch {
					finish(transcript.trim() || null);
				}
			};

			const resetSilenceTimer = () => {
				if (!silenceMs || settled) return;
				if (silenceTimer !== null) clearTimeout(silenceTimer);
				silenceTimer = setTimeout(stopForSilence, silenceMs);
			};

			recognition.onresult = (event: any) => {
				resetSilenceTimer();
				for (let index = event.resultIndex; index < event.results.length; index += 1) {
					const result = event.results[index];
					const value = result?.[0]?.transcript ?? "";
					if (result.isFinal) transcript += value;
					else onInterim?.(value);
				}
			};
			recognition.onspeechstart = resetSilenceTimer;
			recognition.onend = () => finish(transcript.trim() || null);
			recognition.onerror = () => finish(null);

			activeRecognition = { instance: recognition, finish };

			try {
				recognition.start();
				resetSilenceTimer();
			} catch {
				finish(null);
			}
		});
	},

	stopListening() {
		cancelActiveRecognition();
	},

	voices() {
		if (!hasDOM() || typeof window.speechSynthesis === "undefined") return [];
		try {
			return window.speechSynthesis.getVoices();
		} catch {
			return [];
		}
	},
};

const NETWORK_TYPES = new Set<NetworkType>([
	"wifi", "ethernet", "4g", "3g", "2g", "slow-2g",
	"bluetooth", "wimax", "other", "none", "unknown",
]);

function normalizeNetwork(status: NetworkStatus): NetworkStatus {
	const type = NETWORK_TYPES.has(status.type)
		? status.type
		: status.online ? "other" : "none";
	return type === status.type ? status : { ...status, type };
}

const network: BrowserNetwork = {
	status() {
		if (!hasDOM()) return { online: true, type: "unknown" };
		return normalizeNetwork(BaseEngineBrowser.network.status());
	},
	onchange(callback) {
		if (!hasDOM()) return () => undefined;
		return BaseEngineBrowser.network.onchange((status) => callback(normalizeNetwork(status)));
	},
};

export const EngineBrowser = {
	get info(): BrowserInfo { return browserInfo(); },
	get is(): BrowserIs { return BaseEngineBrowser.is; },
	get supports(): BrowserSupports { return patchSupports(BaseEngineBrowser.supports); },
	get name(): BrowserName { return BaseEngineBrowser.name; },
	get engine(): RenderingEngine { return BaseEngineBrowser.engine; },
	get version(): string { return BaseEngineBrowser.version; },

	run: BaseEngineBrowser.run,
	pick: BaseEngineBrowser.pick,
	prefixed: BaseEngineBrowser.prefixed,

	clipboard,
	interact,
	media,
	speech,
	network,

	invalidate(): void {
		BaseEngineBrowser.invalidate();
		patchedSupportsSource = null;
		patchedSupportsValue = null;
	},
} as const;
