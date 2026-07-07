# EngineBrowser

> Browser detection, feature flags, clipboard, interactions, media capture,
> speech synthesis/recognition, and network status — all in one module.

---

## EngineBrowser — Browser Detection, Interactions & Media

`EngineBrowser` is a client-side module (safe on SSR — returns defaults when `window` is undefined).

### Detection

```ts
import { EngineBrowser } from "@/engine";

// Browser identity
EngineBrowser.is.chrome     // boolean
EngineBrowser.is.firefox    // boolean
EngineBrowser.is.safari     // boolean
EngineBrowser.is.edge       // boolean
EngineBrowser.is.opera      // boolean
EngineBrowser.is.brave      // boolean
EngineBrowser.is.osmium     // boolean  ← yes, Osmium is detected
EngineBrowser.is.chromium   // any Chromium-based browser
EngineBrowser.is.mobile     // touch-primary device
EngineBrowser.is.desktop    // mouse-primary device

// Feature support (selection — see BrowserSupports for full list)
EngineBrowser.supports.viewTransitions    // View Transitions API
EngineBrowser.supports.containerQueries  // CSS @container
EngineBrowser.supports.cssHas            // CSS :has()
EngineBrowser.supports.reducedMotion     // prefers-reduced-motion: reduce
EngineBrowser.supports.prefersDark       // prefers-color-scheme: dark
EngineBrowser.supports.webgl2            // WebGL 2
EngineBrowser.supports.clipboard         // Clipboard API present
EngineBrowser.supports.clipboardRead     // clipboard.readText available
EngineBrowser.supports.clipboardWrite    // clipboard.writeText available
EngineBrowser.supports.camera            // getUserMedia video
EngineBrowser.supports.microphone        // getUserMedia audio
EngineBrowser.supports.screenCapture     // getDisplayMedia
EngineBrowser.supports.speechSynthesis   // TTS available
EngineBrowser.supports.speechRecognition // STT available
EngineBrowser.supports.wakeLock          // Screen Wake Lock API
EngineBrowser.supports.notifications     // Web Notifications API
EngineBrowser.supports.fullscreen        // Fullscreen API
EngineBrowser.supports.networkInfo       // Network Information API
EngineBrowser.supports.battery           // Battery Status API
EngineBrowser.supports.webAuthn          // WebAuthn / Passkeys
EngineBrowser.supports.fileSystemAccess  // showOpenFilePicker (Chrome/Edge)
EngineBrowser.supports.badgeApi          // navigator.setAppBadge (PWA)
```

### Conditional execution

```ts
EngineBrowser.run({
  safari:  () => applySafariScrollFix(),
  firefox: () => applyFirefoxFix(),
  default: () => {},
});

const cls = EngineBrowser.pick({
  safari:  "scroll-ios",
  default: "scroll-standard",
});
```

### Clipboard — `EngineBrowser.clipboard`

All methods return `null` / `false` / `[]` on failure — never throw.

```ts
// Write plain text (falls back to execCommand on old WebViews)
const ok = await EngineBrowser.clipboard.copy("Hello, world!");

// Write HTML + plain-text fallback (Chrome 86+, Edge 86+)
await EngineBrowser.clipboard.copyHtml("<b>Bold</b>", "Bold");

// Read plain text — may prompt for "clipboard-read" permission in Chrome
const text = await EngineBrowser.clipboard.paste();

// Read raw ClipboardItems — for images, mixed content
const items = await EngineBrowser.clipboard.read();
for (const item of items) {
  if (item.types.includes("image/png")) {
    const blob = await item.getType("image/png");
  }
}

// Check permissions before reading
if (await EngineBrowser.clipboard.canRead()) {
  const items = await EngineBrowser.clipboard.read();
}
```

| Method | Returns | Notes |
|--------|---------|-------|
| `copy(text)` | `Promise<boolean>` | Falls back to `execCommand("copy")` |
| `copyHtml(html, plain?)` | `Promise<boolean>` | Chrome 86+, Edge 86+ |
| `paste()` | `Promise<string \| null>` | Prompts `clipboard-read` in Chrome |
| `read()` | `Promise<ClipboardItem[]>` | For images and mixed content |
| `canRead()` | `Promise<boolean>` | Checks current permission state |
| `canWrite()` | `Promise<boolean>` | `granted` or auto-grantable |

### Browser Interactions — `EngineBrowser.interact`

```ts
// Native OS share sheet
await EngineBrowser.interact.share({ title: "Check this", url: location.href });

// Desktop/mobile notification (auto-requests permission on first call)
await EngineBrowser.interact.notify("Upload complete", {
  body: "Your file has been saved.",
  icon: "/icon-192.png",
});

// Vibrate (mobile only)
EngineBrowser.interact.vibrate(200);            // 200ms single buzz
EngineBrowser.interact.vibrate([100, 50, 100]); // buzz-pause-buzz pattern

// File picker (File System Access API or hidden <input> fallback)
const files = await EngineBrowser.interact.pickFile({ accept: "image/*", multiple: true });

// Trigger file download
EngineBrowser.interact.download("export.json", JSON.stringify(data), "application/json");
EngineBrowser.interact.download("photo.png", imageBlob);

// Fullscreen
await EngineBrowser.interact.fullscreen();        // default: document.documentElement
await EngineBrowser.interact.fullscreen(videoEl); // specific element
await EngineBrowser.interact.exitFullscreen();

// Screen Wake Lock — keeps display on (recipe apps, workout trackers, kiosk)
const lock = await EngineBrowser.interact.wakeLock();
// ... later:
await lock?.release();

// Geolocation — clean Promise wrapper over the callback API
const pos = await EngineBrowser.interact.location({ enableHighAccuracy: true });
if (pos) console.log(pos.coords.latitude, pos.coords.longitude);

// Lock screen orientation (requires fullscreen on most browsers)
await EngineBrowser.interact.lockOrientation("portrait");

// PWA app badge
await EngineBrowser.interact.badge(3);      // show "3" on app icon
await EngineBrowser.interact.clearBadge();  // remove badge
```

| Method | Returns | Notes |
|--------|---------|-------|
| `share(data)` | `Promise<boolean>` | Returns false if unavailable or user cancels |
| `notify(title, opts?)` | `Promise<Notification \| null>` | Auto-requests permission |
| `vibrate(pattern)` | `boolean` | No-ops on desktop |
| `pickFile(opts?)` | `Promise<File[] \| null>` | Falls back to `<input type="file">` |
| `download(name, data, mime?)` | `void` | Works with string or Blob |
| `fullscreen(el?)` | `Promise<boolean>` | Default: `document.documentElement` |
| `exitFullscreen()` | `Promise<void>` | No-op if not fullscreen |
| `wakeLock()` | `Promise<WakeLockSentinel \| null>` | Call `.release()` when done |
| `location(opts?)` | `Promise<GeolocationPosition \| null>` | Returns null on denial |
| `lockOrientation(type)` | `Promise<boolean>` | Needs fullscreen on most browsers |
| `badge(count)` | `Promise<boolean>` | PWA only |
| `clearBadge()` | `Promise<boolean>` | PWA only |

### Media Capture — `EngineBrowser.media`

```ts
// Camera — front or rear
const stream = await EngineBrowser.media.camera({ facing: "environment" });
if (stream) {
  videoEl.srcObject = stream;
  // always stop when done to release the device and kill the indicator light:
  EngineBrowser.media.stop(stream);
}

// Microphone
const audioStream = await EngineBrowser.media.microphone();

// Screen capture — shows browser's built-in screen/window/tab picker
const screenStream = await EngineBrowser.media.screen();
```

| Method | Returns | Notes |
|--------|---------|-------|
| `camera(opts?)` | `Promise<MediaStream \| null>` | `opts.facing: "user" \| "environment"` |
| `microphone(opts?)` | `Promise<MediaStream \| null>` | Standard `MediaTrackConstraints` |
| `screen(opts?)` | `Promise<MediaStream \| null>` | Shows browser's native picker |
| `stop(stream)` | `void` | Stops all tracks, releases hardware |

**Always call `media.stop(stream)`** when done — leaving tracks running keeps the camera/mic indicator active in the browser tab bar.

### Speech — `EngineBrowser.speech`

```ts
// Text-to-speech — resolves when finished
await EngineBrowser.speech.speak("Hello!", { lang: "en-US", rate: 1.1, pitch: 1 });

// Stop mid-speech
EngineBrowser.speech.stopSpeaking();
EngineBrowser.speech.isSpeaking(); // boolean

// Speech-to-text — returns final transcript or null
const text = await EngineBrowser.speech.listen(
  { lang: "en-US" },
  (partial) => console.log("Interim:", partial), // optional live transcript callback
);
if (text) handleVoiceCommand(text);

EngineBrowser.speech.stopListening();

// Available TTS voices (may be empty on first call — loads async in some browsers)
const voices = EngineBrowser.speech.voices();
const japanese = voices.find(v => v.lang === "ja-JP");
await EngineBrowser.speech.speak("こんにちは", { voice: japanese });
```

| Method | Returns | Notes |
|--------|---------|-------|
| `speak(text, opts?)` | `Promise<void>` | Resolves when speech ends |
| `stopSpeaking()` | `void` | Cancels in-progress TTS |
| `isSpeaking()` | `boolean` | True while TTS is active |
| `listen(opts?, onInterim?)` | `Promise<string \| null>` | Returns final transcript |
| `stopListening()` | `void` | Cancels active recognition |
| `voices()` | `SpeechSynthesisVoice[]` | May be empty until async load |

**`SpeakOptions`:** `voice`, `lang` (BCP 47 e.g. `"en-US"`), `rate` (0.1–10, default 1), `pitch` (0–2, default 1), `volume` (0–1, default 1).

**`ListenOptions`:** `lang` (BCP 47), `interim` (boolean — enables partial results callback).

### Network — `EngineBrowser.network`

```ts
// Snapshot
const { online, type, downlink, rtt, saveData } = EngineBrowser.network.status();

// Subscribe to changes — returns an unsubscribe function
const unsubscribe = EngineBrowser.network.onchange((status) => {
  if (!status.online) showOfflineBanner();
  if (status.type === "2g" || status.saveData) enableDataSaverMode();
});

// Cleanup
unsubscribe();
```

`NetworkStatus` fields:

| Field | Type | Source |
|-------|------|--------|
| `online` | `boolean` | `navigator.onLine` |
| `type` | `NetworkType` | Network Information API |
| `downlink` | `number?` | Bandwidth estimate in Mbit/s |
| `rtt` | `number?` | Round-trip time in ms |
| `saveData` | `boolean?` | Data-saver mode active |

`type` values: `"wifi"` | `"ethernet"` | `"4g"` | `"3g"` | `"2g"` | `"slow-2g"` | `"bluetooth"` | `"none"` | `"unknown"`.

### React hook

```tsx
import { useBrowser } from "@/engine";

function MyComponent() {
  const browser = useBrowser();  // SSR-safe, updates after mount
  if (browser.is.safari) return <SafariVariant />;
  return <StandardVariant />;
}
```

---
