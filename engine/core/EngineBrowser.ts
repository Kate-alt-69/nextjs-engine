"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineBrowser
//
//  Browser detection, feature detection, conditional execution, and a full
//  suite of browser-native interaction subsystems.
//
//  SUBSYSTEMS:
//    EngineBrowser.is / .supports / .name / .engine / .version
//      → Detection (unchanged from v1)
//    EngineBrowser.run() / .pick() / .prefixed()
//      → Conditional execution (unchanged from v1)
//    EngineBrowser.clipboard
//      → copy, copyHtml, paste, read, canRead, canWrite
//    EngineBrowser.interact
//      → share, notify, vibrate, pickFile, download, badge, clearBadge,
//         fullscreen, exitFullscreen, wakeLock, location, lockOrientation
//    EngineBrowser.media
//      → camera, microphone, screen, stop
//    EngineBrowser.speech
//      → speak, stopSpeaking, listen, stopListening, voices
//    EngineBrowser.network
//      → online, type, onchange
//
//  SSR SAFETY:
//    All subsystems guard `typeof window === "undefined"` and return
//    null / false / [] / "" rather than throwing. Safe to call anywhere.
//
//  PERMISSIONS:
//    Methods that require permissions (clipboard-read, camera, microphone,
//    notifications, geolocation) request them automatically on first call
//    and return null/false if the user denies. No call site try/catch needed.
//
//  SUPPORTED BROWSERS:
//    Chrome, Chromium, Edge, Brave, Opera GX, Osmium,
//    Firefox, Safari, Samsung Internet, WebView, and unknowns.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

// ═════════════════════════════════════════════════════════════════════════════
//  TYPE DEFINITIONS
// ═════════════════════════════════════════════════════════════════════════════

// ── Browser identity ──────────────────────────────────────────────────────────

export type BrowserName =
	| "chrome" | "edge" | "opera" | "brave" | "osmium"
	| "samsung" | "webview" | "firefox" | "safari"
	| "unknown" | "server";

export type RenderingEngine = "blink" | "gecko" | "webkit" | "unknown" | "server";

export interface BrowserIs {
	chromium:  boolean;
	chrome:    boolean;
	edge:      boolean;
	opera:     boolean;
	brave:     boolean;
	osmium:    boolean;
	samsung:   boolean;
	webview:   boolean;
	firefox:   boolean;
	safari:    boolean;
	webkit:    boolean;
	gecko:     boolean;
	mobile:    boolean;
	tablet:    boolean;
	desktop:   boolean;
	apple:     boolean;
	android:   boolean;
	windows:   boolean;
	linux:     boolean;
}

// ── Feature support ───────────────────────────────────────────────────────────

export interface BrowserSupports {
	// Scroll & animation
	nativeSmoothScroll:  boolean;
	viewTransitions:     boolean;
	scrollTimeline:      boolean;
	scrollSnap:          boolean;

	// CSS features
	containerQueries:    boolean;
	cssHas:              boolean;
	cssNesting:          boolean;
	cssLayer:            boolean;
	colorMix:            boolean;
	subgrid:             boolean;
	masonry:             boolean;

	// Canvas & GPU
	webgl:               boolean;
	webgl2:              boolean;
	offscreenCanvas:     boolean;

	// Input & display
	touchPrimary:        boolean;
	mousePrimary:        boolean;
	reducedMotion:       boolean;
	prefersDark:         boolean;
	hdr:                 boolean;
	fullscreen:          boolean;

	// Core APIs
	webWorkers:          boolean;
	serviceWorker:       boolean;
	storage:             boolean;
	vibration:           boolean;
	geolocation:         boolean;
	webShare:            boolean;
	wakeLock:            boolean;
	deviceOrientation:   boolean;
	battery:             boolean;
	webAuthn:            boolean;

	// Clipboard
	/** Clipboard API exists — does NOT imply read permission is granted */
	clipboard:           boolean;
	clipboardRead:       boolean;
	clipboardWrite:      boolean;

	// Notifications & PWA
	notifications:       boolean;
	badgeApi:            boolean;
	fileSystemAccess:    boolean;

	// Media capture
	camera:              boolean;
	microphone:          boolean;
	screenCapture:       boolean;

	// Speech
	speechSynthesis:     boolean;
	speechRecognition:   boolean;

	// Network
	networkInfo:         boolean;
}

// ── Full browser info ─────────────────────────────────────────────────────────

export interface BrowserInfo {
	name:      BrowserName;
	engine:    RenderingEngine;
	version:   string;
	is:        BrowserIs;
	supports:  BrowserSupports;
}

// ── Clipboard subsystem ───────────────────────────────────────────────────────

export interface BrowserClipboard {
	/** Write plain text to clipboard. Returns true on success. Falls back to execCommand. */
	copy(text: string): Promise<boolean>;
	/** Write HTML + optional plain-text fallback. Chrome 86+, Edge 86+. */
	copyHtml(html: string, plainText?: string): Promise<boolean>;
	/** Read plain text from clipboard. Triggers permission prompt in Chrome. Returns null on denial. */
	paste(): Promise<string | null>;
	/** Read raw ClipboardItems — useful for image or mixed-type content. Returns [] on failure. */
	read(): Promise<ClipboardItem[]>;
	/** Returns true if clipboard-read permission is currently granted. */
	canRead(): Promise<boolean>;
	/** Returns true if clipboard-write permission is granted or auto-grantable. */
	canWrite(): Promise<boolean>;
}

// ── Interact subsystem ────────────────────────────────────────────────────────

export interface ShareData {
	title?: string;
	text?:  string;
	url?:   string;
}

export interface PickFileOptions {
	/** MIME type or extension filter, e.g. "image/*" or ".pdf" */
	accept?:   string;
	multiple?: boolean;
}

export type OrientationLock =
	| "any" | "natural" | "landscape" | "portrait"
	| "portrait-primary" | "portrait-secondary"
	| "landscape-primary" | "landscape-secondary";

export interface BrowserInteract {
	/** Trigger the native OS share sheet. Returns true on success. */
	share(data: ShareData): Promise<boolean>;
	/** Show a Web Notification. Auto-requests permission. Returns null if denied. */
	notify(title: string, options?: NotificationOptions): Promise<Notification | null>;
	/** Vibrate device. Number = single duration ms. Array = on/off pattern. */
	vibrate(pattern: number | number[]): boolean;
	/** Open file picker. Falls back to hidden <input> on browsers without File System Access API. */
	pickFile(options?: PickFileOptions): Promise<File[] | null>;
	/** Trigger a browser file download from a string or Blob. */
	download(filename: string, data: string | Blob, mimeType?: string): void;
	/** Set PWA app badge count. No-ops silently on non-PWA browsers. */
	badge(count: number): Promise<boolean>;
	/** Clear PWA app badge. */
	clearBadge(): Promise<boolean>;
	/** Enter fullscreen on an element (default: document.documentElement). */
	fullscreen(element?: Element): Promise<boolean>;
	/** Exit fullscreen. */
	exitFullscreen(): Promise<void>;
	/**
	 * Request a Screen Wake Lock — keeps the screen on while held.
	 * Returns a WakeLockSentinel (call .release() to free it) or null if unavailable.
	 *
	 * @example
	 * const lock = await EngineBrowser.interact.wakeLock();
	 * // ... later:
	 * await lock?.release();
	 */
	wakeLock(): Promise<WakeLockSentinel | null>;
	/**
	 * Get the device's current GPS position.
	 * Prompts for geolocation permission on first call.
	 * Returns null on denial or error.
	 */
	location(options?: PositionOptions): Promise<GeolocationPosition | null>;
	/**
	 * Lock screen orientation. Only works in fullscreen on most browsers.
	 * Returns true on success.
	 */
	lockOrientation(orientation: OrientationLock): Promise<boolean>;
}

// ── Media subsystem ───────────────────────────────────────────────────────────

export interface MediaCameraOptions {
	/** Pixel width hint */
	width?:  number;
	/** Pixel height hint */
	height?: number;
	/** "user" = front camera, "environment" = rear camera */
	facing?: "user" | "environment";
}

export interface BrowserMedia {
	/**
	 * Request camera access. Returns a MediaStream or null if denied.
	 * Stop the stream with EngineBrowser.media.stop(stream) when done.
	 *
	 * @example
	 * const stream = await EngineBrowser.media.camera();
	 * videoEl.srcObject = stream;
	 * // later:
	 * EngineBrowser.media.stop(stream);
	 */
	camera(options?: MediaCameraOptions): Promise<MediaStream | null>;
	/**
	 * Request microphone access. Returns a MediaStream or null if denied.
	 */
	microphone(options?: MediaTrackConstraints): Promise<MediaStream | null>;
	/**
	 * Request screen capture (getDisplayMedia).
	 * Shows the browser's built-in screen/window/tab picker.
	 * Returns a MediaStream or null if the user cancels.
	 *
	 * @example
	 * const stream = await EngineBrowser.media.screen();
	 * // record or display the stream
	 */
	screen(options?: DisplayMediaStreamOptions): Promise<MediaStream | null>;
	/**
	 * Stop all tracks in a MediaStream and release the device.
	 * Always call this when you're done with a camera/mic/screen stream.
	 */
	stop(stream: MediaStream): void;
}

// ── Speech subsystem ──────────────────────────────────────────────────────────

export interface SpeakOptions {
	/** Voice to use — get a list from EngineBrowser.speech.voices() */
	voice?:    SpeechSynthesisVoice;
	/** BCP 47 language tag, e.g. "en-US", "ja-JP" */
	lang?:     string;
	/** Playback speed 0.1 – 10, default 1 */
	rate?:     number;
	/** Pitch 0 – 2, default 1 */
	pitch?:    number;
	/** Volume 0 – 1, default 1 */
	volume?:   number;
}

export interface ListenOptions {
	/** BCP 47 language tag. Defaults to browser language. */
	lang?:         string;
	/** Return partial results as the user speaks (default false) */
	interim?:      boolean;
	/** Max seconds of silence before auto-stop (not supported everywhere) */
	maxSilence?:   number;
}

export interface BrowserSpeech {
	/**
	 * Speak text aloud using the Web Speech Synthesis API.
	 * Resolves when speech finishes, rejects if the API is unavailable.
	 *
	 * @example
	 * await EngineBrowser.speech.speak("Hello, world!", { lang: "en-US", rate: 1.1 });
	 */
	speak(text: string, options?: SpeakOptions): Promise<void>;
	/** Stop any in-progress speech immediately. */
	stopSpeaking(): void;
	/** Returns true if speech synthesis is currently active. */
	isSpeaking(): boolean;
	/**
	 * Listen for speech and return the recognized text string.
	 * Returns null if recognition is unavailable or the user says nothing.
	 * Calls the optional onInterim callback with partial transcripts as they arrive.
	 *
	 * @example
	 * const text = await EngineBrowser.speech.listen({ lang: "en-US" });
	 * if (text) handleCommand(text);
	 */
	listen(options?: ListenOptions, onInterim?: (text: string) => void): Promise<string | null>;
	/** Stop any in-progress speech recognition. */
	stopListening(): void;
	/**
	 * Returns all available SpeechSynthesisVoice objects.
	 * May be empty on first call — voices load asynchronously in some browsers.
	 *
	 * @example
	 * const voices = EngineBrowser.speech.voices();
	 * const japanese = voices.find(v => v.lang === "ja-JP");
	 */
	voices(): SpeechSynthesisVoice[];
}

// ── Network subsystem ─────────────────────────────────────────────────────────

export type NetworkType =
	| "wifi" | "ethernet" | "4g" | "3g" | "2g" | "slow-2g"
	| "bluetooth" | "wimax" | "other" | "none" | "unknown";

export interface NetworkStatus {
	/** Device currently has a network connection */
	online:    boolean;
	/** Connection type reported by Network Information API */
	type:      NetworkType;
	/** Effective bandwidth estimate in Mbit/s (Network Information API) */
	downlink?: number;
	/** Round-trip time estimate in ms */
	rtt?:      number;
	/** Data-saver mode active */
	saveData?: boolean;
}

export interface BrowserNetwork {
	/** Current network status snapshot. */
	status(): NetworkStatus;
	/**
	 * Subscribe to online/offline/type changes.
	 * Returns an unsubscribe function — call it to stop listening.
	 *
	 * @example
	 * const off = EngineBrowser.network.onchange((status) => {
	 *   if (!status.online) showOfflineBanner();
	 * });
	 * // cleanup:
	 * off();
	 */
	onchange(callback: (status: NetworkStatus) => void): () => void;
}

// ═════════════════════════════════════════════════════════════════════════════
//  SERVER-SIDE DEFAULTS
// ═════════════════════════════════════════════════════════════════════════════

const SERVER_IS: BrowserIs = {
	chromium: false, chrome: false, edge: false, opera: false,
	brave: false, osmium: false, samsung: false, webview: false,
	firefox: false, safari: false, webkit: false, gecko: false,
	mobile: false, tablet: false, desktop: false,
	apple: false, android: false, windows: false, linux: false,
};

const SERVER_SUPPORTS: BrowserSupports = {
	nativeSmoothScroll: false, viewTransitions: false,
	scrollTimeline: false, scrollSnap: true,
	containerQueries: false, cssHas: false, cssNesting: false,
	cssLayer: false, colorMix: false, subgrid: false, masonry: false,
	webgl: false, webgl2: false, offscreenCanvas: false,
	touchPrimary: false, mousePrimary: true,
	reducedMotion: false, prefersDark: false, hdr: false, fullscreen: false,
	webWorkers: false, serviceWorker: false, storage: false,
	vibration: false, geolocation: false, webShare: false,
	wakeLock: false, deviceOrientation: false, battery: false, webAuthn: false,
	clipboard: false, clipboardRead: false, clipboardWrite: false,
	notifications: false, badgeApi: false, fileSystemAccess: false,
	camera: false, microphone: false, screenCapture: false,
	speechSynthesis: false, speechRecognition: false,
	networkInfo: false,
};

const SERVER_INFO: BrowserInfo = {
	name: "server", engine: "server", version: "0",
	is: SERVER_IS, supports: SERVER_SUPPORTS,
};

// ═════════════════════════════════════════════════════════════════════════════
//  UA + FEATURE DETECTION
// ═════════════════════════════════════════════════════════════════════════════

function detectName(ua: string): { name: BrowserName; version: string } {
	const match = (p: RegExp) => p.exec(ua)?.[1] ?? "0";

	if (/Osmium/i.test(ua))
		return { name: "osmium",  version: match(/Osmium\/([\d.]+)/i) };
	if (/OPR\/|Opera Mini/i.test(ua))
		return { name: "opera",   version: match(/OPR\/([\d.]+)/i) };
	if (/Edg\/|EdgA\//i.test(ua))
		return { name: "edge",    version: match(/Edg\/([\d.]+)/i) };
	if (typeof navigator !== "undefined" && (navigator as any).brave)
		return { name: "brave",   version: match(/Chrome\/([\d.]+)/) };
	if (/SamsungBrowser/i.test(ua))
		return { name: "samsung", version: match(/SamsungBrowser\/([\d.]+)/i) };
	if (/\bwv\b/.test(ua) && /Chrome/i.test(ua))
		return { name: "webview", version: match(/Chrome\/([\d.]+)/) };
	if (/Firefox/i.test(ua))
		return { name: "firefox", version: match(/Firefox\/([\d.]+)/i) };
	if (/Safari/i.test(ua) && !/Chrome/i.test(ua))
		return { name: "safari",  version: match(/Version\/([\d.]+)/i) };
	if (/Chrome/i.test(ua))
		return { name: "chrome",  version: match(/Chrome\/([\d.]+)/) };

	return { name: "unknown", version: "0" };
}

function detectEngine(name: BrowserName): RenderingEngine {
	const blink: BrowserName[] = ["chrome","edge","opera","brave","osmium","samsung","webview"];
	if (blink.includes(name)) return "blink";
	if (name === "firefox")   return "gecko";
	if (name === "safari")    return "webkit";
	return "unknown";
}

function css(property: string, value: string): boolean {
	if (typeof CSS === "undefined" || !CSS.supports) return false;
	return CSS.supports(property, value);
}

function detectSupports(): BrowserSupports {
	const win = typeof window    !== "undefined" ? window    : null;
	const nav = typeof navigator !== "undefined" ? navigator : null;
	const mq  = (q: string) => win?.matchMedia(q).matches ?? false;

	const glCtx = (type: "webgl" | "webgl2") => {
		try { return !!win?.document.createElement("canvas").getContext(type); }
		catch { return false; }
	};

	const clip  = (nav as any)?.clipboard;
	const media = (nav as any)?.mediaDevices;

	return {
		nativeSmoothScroll: css("scroll-behavior", "smooth"),
		viewTransitions:    typeof (win?.document as any)?.startViewTransition === "function",
		scrollTimeline:     typeof (win as any)?.ScrollTimeline === "function",
		scrollSnap:         css("scroll-snap-type", "y mandatory"),

		containerQueries:   css("container-type", "inline-size"),
		cssHas:             css("selector(:has(*))", ""),
		cssNesting:         css("&", "color:red"),
		cssLayer:           css("@layer", "base {}"),
		colorMix:           css("color", "color-mix(in srgb,red,blue)"),
		subgrid:            css("grid-template-rows", "subgrid"),
		masonry:            css("grid-template-rows", "masonry"),

		webgl:              glCtx("webgl"),
		webgl2:             glCtx("webgl2"),
		offscreenCanvas:    typeof (win as any)?.OffscreenCanvas === "function",

		touchPrimary:       mq("(pointer: coarse)"),
		mousePrimary:       mq("(pointer: fine)"),
		reducedMotion:      mq("(prefers-reduced-motion: reduce)"),
		prefersDark:        mq("(prefers-color-scheme: dark)"),
		hdr:                mq("(dynamic-range: high)"),
		fullscreen:         typeof win?.document.documentElement.requestFullscreen === "function",

		webWorkers:         typeof Worker !== "undefined",
		serviceWorker:      typeof (nav as any)?.serviceWorker !== "undefined",
		storage:            typeof localStorage !== "undefined",
		vibration:          typeof (nav as any)?.vibrate === "function",
		geolocation:        typeof (nav as any)?.geolocation !== "undefined",
		webShare:           typeof (nav as any)?.share === "function",
		wakeLock:           typeof (nav as any)?.wakeLock !== "undefined",
		deviceOrientation:  typeof win?.DeviceOrientationEvent !== "undefined",
		battery:            typeof (nav as any)?.getBattery === "function",
		webAuthn:           typeof (win as any)?.PublicKeyCredential !== "undefined",

		clipboard:          typeof clip !== "undefined",
		clipboardRead:      typeof clip?.readText === "function",
		clipboardWrite:     typeof clip?.writeText === "function",

		notifications:      typeof Notification !== "undefined",
		badgeApi:           typeof (nav as any)?.setAppBadge === "function",
		fileSystemAccess:   typeof (win as any)?.showOpenFilePicker === "function",

		camera:             typeof media?.getUserMedia === "function",
		microphone:         typeof media?.getUserMedia === "function",
		screenCapture:      typeof media?.getDisplayMedia === "function",

		speechSynthesis:    typeof win?.speechSynthesis !== "undefined",
		speechRecognition:  typeof (win as any)?.SpeechRecognition !== "undefined" ||
		                    typeof (win as any)?.webkitSpeechRecognition !== "undefined",

		networkInfo:        typeof (nav as any)?.connection !== "undefined",
	};
}

// ── Detection cache ───────────────────────────────────────────────────────────

let _cache: BrowserInfo | null = null;

function detectBrowser(): BrowserInfo {
	if (typeof window === "undefined") return SERVER_INFO;
	if (_cache) return _cache;

	const ua                = navigator.userAgent;
	const { name, version } = detectName(ua);
	const engine            = detectEngine(name);
	const s                 = detectSupports();
	const platform          = navigator.platform ?? "";
	const isAndroid         = /Android/i.test(ua);
	const isMobile          = s.touchPrimary && /Mobi|Android|iPhone/i.test(ua);
	const blinkFamily       = ["chrome","edge","opera","brave","osmium","samsung","webview"];

	const is: BrowserIs = {
		chromium: blinkFamily.includes(name),
		chrome:   name === "chrome", edge:    name === "edge",
		opera:    name === "opera",  brave:   name === "brave",
		osmium:   name === "osmium", samsung: name === "samsung",
		webview:  name === "webview",firefox: name === "firefox",
		safari:   name === "safari", webkit:  engine === "webkit",
		gecko:    engine === "gecko",
		mobile:   isMobile, tablet: s.touchPrimary && !isMobile,
		desktop:  !s.touchPrimary,
		apple:    /Mac|iPhone|iPad|iPod/i.test(platform),
		android:  isAndroid,
		windows:  /Win/i.test(platform),
		linux:    /Linux/i.test(platform) && !isAndroid,
	};

	_cache = { name, engine, version, is, supports: s };
	return _cache;
}

// ═════════════════════════════════════════════════════════════════════════════
//  CLIPBOARD IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════

function execCommandCopy(text: string): boolean {
	try {
		const el          = document.createElement("textarea");
		el.value          = text;
		el.style.position = "fixed";
		el.style.opacity  = "0";
		document.body.appendChild(el);
		el.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(el);
		return ok;
	} catch { return false; }
}

async function queryPermission(name: string): Promise<PermissionState | null> {
	try {
		const r = await navigator.permissions.query({ name: name as PermissionName });
		return r.state;
	} catch { return null; }
}

const clipboardImpl: BrowserClipboard = {
	async copy(text) {
		if (typeof navigator === "undefined") return false;
		if (typeof navigator.clipboard?.writeText === "function") {
			try { await navigator.clipboard.writeText(text); return true; }
			catch { /* fall through */ }
		}
		return execCommandCopy(text);
	},

	async copyHtml(html, plainText) {
		if (typeof navigator === "undefined") return false;
		const plain = plainText ?? html.replace(/<[^>]*>/g, "");
		if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function") {
			try {
				await navigator.clipboard.write([
					new ClipboardItem({
						"text/html":  new Blob([html],  { type: "text/html" }),
						"text/plain": new Blob([plain], { type: "text/plain" }),
					}),
				]);
				return true;
			} catch { /* fall through */ }
		}
		return clipboardImpl.copy(plain);
	},

	async paste() {
		if (typeof navigator?.clipboard?.readText !== "function") return null;
		try { return await navigator.clipboard.readText(); }
		catch { return null; }
	},

	async read() {
		if (typeof navigator?.clipboard?.read !== "function") return [];
		try { return await navigator.clipboard.read(); }
		catch { return []; }
	},

	async canRead() {
		const s = await queryPermission("clipboard-read");
		return s === "granted";
	},

	async canWrite() {
		const s = await queryPermission("clipboard-write");
		return s === "granted" || s === "prompt";
	},
};

// ═════════════════════════════════════════════════════════════════════════════
//  INTERACT IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════

const interactImpl: BrowserInteract = {
	async share(data) {
		if (typeof (navigator as any)?.share !== "function") return false;
		try { await (navigator as any).share(data); return true; }
		catch { return false; }
	},

	async notify(title, options) {
		if (typeof Notification === "undefined") return null;
		if (Notification.permission === "default") {
			const r = await Notification.requestPermission();
			if (r !== "granted") return null;
		}
		if (Notification.permission !== "granted") return null;
		try { return new Notification(title, options); }
		catch { return null; }
	},

	vibrate(pattern) {
		if (typeof (navigator as any)?.vibrate !== "function") return false;
		try { return (navigator as any).vibrate(pattern); }
		catch { return false; }
	},

	async pickFile(options = {}) {
		if (typeof window === "undefined") return null;

		// File System Access API (Chrome 86+, Edge 86+)
		if (typeof (window as any).showOpenFilePicker === "function") {
			try {
				const opts: Record<string, unknown> = { multiple: options.multiple ?? false };
				if (options.accept) {
					opts.types = [{ description: "Files", accept: { [options.accept]: [] } }];
				}
				const handles: FileSystemFileHandle[] = await (window as any).showOpenFilePicker(opts);
				return await Promise.all(handles.map((h) => h.getFile()));
			} catch { return null; }
		}

		// Hidden <input type="file"> fallback
		return new Promise((resolve) => {
			const input    = document.createElement("input");
			input.type     = "file";
			input.multiple = options.multiple ?? false;
			if (options.accept) input.accept = options.accept;
			input.style.display = "none";
			document.body.appendChild(input);

			input.addEventListener("change", () => {
				document.body.removeChild(input);
				const files = input.files;
				resolve(files && files.length > 0 ? Array.from(files) : null);
			}, { once: true });

			window.addEventListener("focus", () => {
				setTimeout(() => {
					if (document.body.contains(input)) {
						document.body.removeChild(input);
						resolve(null);
					}
				}, 300);
			}, { once: true });

			input.click();
		});
	},

	download(filename, data, mimeType = "text/plain") {
		if (typeof window === "undefined") return;
		const blob   = data instanceof Blob ? data : new Blob([data], { type: mimeType });
		const url    = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href     = url;
		anchor.download = filename;
		anchor.style.display = "none";
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	},

	async badge(count) {
		if (typeof (navigator as any)?.setAppBadge !== "function") return false;
		try { await (navigator as any).setAppBadge(count); return true; }
		catch { return false; }
	},

	async clearBadge() {
		if (typeof (navigator as any)?.clearAppBadge !== "function") return false;
		try { await (navigator as any).clearAppBadge(); return true; }
		catch { return false; }
	},

	async fullscreen(element) {
		if (typeof window === "undefined") return false;
		const el = element ?? document.documentElement;
		try { await el.requestFullscreen(); return true; }
		catch { return false; }
	},

	async exitFullscreen() {
		if (typeof document !== "undefined" && document.fullscreenElement) {
			try { await document.exitFullscreen(); }
			catch { /* already exited */ }
		}
	},

	async wakeLock() {
		if (typeof (navigator as any)?.wakeLock === "undefined") return null;
		try { return await (navigator as any).wakeLock.request("screen"); }
		catch { return null; }
	},

	async location(options) {
		if (typeof navigator === "undefined") return null;
		if (typeof navigator.geolocation === "undefined") return null;
		return new Promise((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(pos) => resolve(pos),
				()    => resolve(null),
				options,
			);
		});
	},

	async lockOrientation(orientation) {
		try {
			await (screen.orientation as any).lock(orientation);
			return true;
		} catch { return false; }
	},
};

// ═════════════════════════════════════════════════════════════════════════════
//  MEDIA IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════

const mediaImpl: BrowserMedia = {
	async camera(options = {}) {
		if (typeof navigator?.mediaDevices?.getUserMedia !== "function") return null;
		try {
			return await navigator.mediaDevices.getUserMedia({
				video: {
					...(options.width  ? { width:  { ideal: options.width  } } : {}),
					...(options.height ? { height: { ideal: options.height } } : {}),
					facingMode: options.facing ?? "user",
				},
				audio: false,
			});
		} catch { return null; }
	},

	async microphone(options = {}) {
		if (typeof navigator?.mediaDevices?.getUserMedia !== "function") return null;
		try {
			return await navigator.mediaDevices.getUserMedia({
				audio: Object.keys(options).length > 0 ? options : true,
				video: false,
			});
		} catch { return null; }
	},

	async screen(options = {}) {
		if (typeof (navigator?.mediaDevices as any)?.getDisplayMedia !== "function") return null;
		try {
			return await (navigator.mediaDevices as any).getDisplayMedia({
				video: true,
				audio: false,
				...options,
			});
		} catch { return null; }
	},

	stop(stream) {
		stream.getTracks().forEach((track) => track.stop());
	},
};

// ═════════════════════════════════════════════════════════════════════════════
//  SPEECH IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════

// Active recognition instance — stored outside the impl so stopListening can reach it
let _activeRecognition: any = null;

const speechImpl: BrowserSpeech = {
	speak(text, options = {}) {
		return new Promise((resolve, reject) => {
			if (typeof window?.speechSynthesis === "undefined") {
				reject(new Error("Speech synthesis not supported"));
				return;
			}

			const utterance      = new SpeechSynthesisUtterance(text);
			if (options.voice)   utterance.voice  = options.voice;
			if (options.lang)    utterance.lang   = options.lang;
			if (options.rate)    utterance.rate   = options.rate;
			if (options.pitch)   utterance.pitch  = options.pitch;
			if (options.volume)  utterance.volume = options.volume;

			utterance.onend   = () => resolve();
			utterance.onerror = (e) => reject(e);

			window.speechSynthesis.cancel(); // cancel any in-progress speech first
			window.speechSynthesis.speak(utterance);
		});
	},

	stopSpeaking() {
		if (typeof window?.speechSynthesis !== "undefined") {
			window.speechSynthesis.cancel();
		}
	},

	isSpeaking() {
		return window?.speechSynthesis?.speaking ?? false;
	},

	listen(options = {}, onInterim) {
		return new Promise((resolve) => {
			const SpeechRecognition =
				(window as any).SpeechRecognition ??
				(window as any).webkitSpeechRecognition;

			if (typeof SpeechRecognition === "undefined") {
				resolve(null);
				return;
			}

			const rec: any = new SpeechRecognition();
			_activeRecognition = rec;

			rec.lang             = options.lang    ?? navigator.language ?? "en-US";
			rec.interimResults   = options.interim ?? false;
			rec.continuous       = false;
			rec.maxAlternatives  = 1;

			let finalTranscript = "";

			rec.onresult = (event: any) => {
				for (let i = event.resultIndex; i < event.results.length; i++) {
					const result = event.results[i];
					if (result.isFinal) {
						finalTranscript += result[0].transcript;
					} else if (onInterim) {
						onInterim(result[0].transcript);
					}
				}
			};

			rec.onend  = () => { _activeRecognition = null; resolve(finalTranscript || null); };
			rec.onerror = () => { _activeRecognition = null; resolve(null); };

			rec.start();
		});
	},

	stopListening() {
		if (_activeRecognition) {
			_activeRecognition.stop();
			_activeRecognition = null;
		}
	},

	voices() {
		if (typeof window?.speechSynthesis === "undefined") return [];
		return window.speechSynthesis.getVoices();
	},
};

// ═════════════════════════════════════════════════════════════════════════════
//  NETWORK IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════

function readNetworkStatus(): NetworkStatus {
	if (typeof navigator === "undefined") {
		return { online: true, type: "unknown" };
	}

	const conn    = (navigator as any).connection;
	const online  = navigator.onLine ?? true;
	const type: NetworkType = conn?.type ?? conn?.effectiveType ?? "unknown";

	return {
		online,
		type,
		downlink: conn?.downlink,
		rtt:      conn?.rtt,
		saveData: conn?.saveData,
	};
}

const networkImpl: BrowserNetwork = {
	status() {
		return readNetworkStatus();
	},

	onchange(callback) {
		if (typeof window === "undefined") return () => undefined;

		const handler = () => callback(readNetworkStatus());
		const conn    = (navigator as any).connection;

		window.addEventListener("online",  handler);
		window.addEventListener("offline", handler);
		conn?.addEventListener("change", handler);

		// Return unsubscribe function
		return () => {
			window.removeEventListener("online",  handler);
			window.removeEventListener("offline", handler);
			conn?.removeEventListener("change", handler);
		};
	},
};

// ═════════════════════════════════════════════════════════════════════════════
//  CONDITIONAL EXECUTION
// ═════════════════════════════════════════════════════════════════════════════

type BrowserConditions<T> = Partial<
	Record<BrowserName | "chromium" | "webkit" | "gecko" | "mobile" | "desktop" | "default", T>
>;

function run(conditions: BrowserConditions<() => void>): void {
	if (typeof window === "undefined") return;
	const info = detectBrowser();
	for (const key of Object.keys(conditions) as Array<keyof typeof conditions>) {
		if (key === "default") continue;
		const hit =
			key === "chromium" ? info.is.chromium :
			key === "webkit"   ? info.is.webkit   :
			key === "gecko"    ? info.is.gecko     :
			key === "mobile"   ? info.is.mobile    :
			key === "desktop"  ? info.is.desktop   :
			info.name === key;
		if (hit) { conditions[key]?.(); return; }
	}
	conditions.default?.();
}

function pick<T>(conditions: BrowserConditions<T>): T | undefined {
	if (typeof window === "undefined") return conditions.default;
	const info = detectBrowser();
	for (const key of Object.keys(conditions) as Array<keyof typeof conditions>) {
		if (key === "default") continue;
		const hit =
			key === "chromium" ? info.is.chromium :
			key === "webkit"   ? info.is.webkit   :
			key === "gecko"    ? info.is.gecko     :
			key === "mobile"   ? info.is.mobile    :
			key === "desktop"  ? info.is.desktop   :
			info.name === key;
		if (hit) return conditions[key] as T;
	}
	return conditions.default;
}

function prefixed(property: string, value: string): string {
	const needsWebkit = detectBrowser().is.webkit && (
		property === "backdrop-filter" ||
		property === "mask"            ||
		property === "text-stroke"
	);
	return needsWebkit
		? `-webkit-${property}:${value};${property}:${value}`
		: `${property}:${value}`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  REACT HOOK
// ═════════════════════════════════════════════════════════════════════════════

export function useBrowser(): BrowserInfo {
	const [info, setInfo] = useState<BrowserInfo>(SERVER_INFO);
	useEffect(() => { setInfo(detectBrowser()); }, []);
	return info;
}

// ═════════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

export const EngineBrowser = {
	// Detection
	get info():     BrowserInfo     { return detectBrowser(); },
	get is():       BrowserIs       { return detectBrowser().is; },
	get supports(): BrowserSupports { return detectBrowser().supports; },
	get name():     BrowserName     { return detectBrowser().name; },
	get engine():   RenderingEngine { return detectBrowser().engine; },
	get version():  string          { return detectBrowser().version; },

	// Conditional execution
	run, pick, prefixed,

	/** Clipboard — copy, paste, read, permission checks. All async, never throw. */
	clipboard: clipboardImpl,

	/** Browser interactions — share, notify, vibrate, fullscreen, wake lock, location, file picker, download, badge. */
	interact: interactImpl,

	/** Media capture — camera, microphone, screen recording. */
	media: mediaImpl,

	/** Speech — text-to-speech and speech-to-text. */
	speech: speechImpl,

	/** Network — online status, connection type, change events. */
	network: networkImpl,

	/** Invalidate cached detection (useful in tests). */
	invalidate(): void { _cache = null; },
} as const;

export type { BrowserConditions };
