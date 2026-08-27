# EngineBrowser

`EngineBrowser` exposes browser detection plus clipboard, interaction, media,
speech, and network helpers.

The public `nextjs-engine` entrypoint exports the SSR-safe facade from
`core/EngineBrowserSafe`. The lower-level detector remains internal-compatible,
but application code should import from the package/root engine entrypoint.

## SSR contract

Detection is safe during server rendering:

```ts
EngineBrowser.name
// "server"

EngineBrowser.info
// server-safe BrowserInfo
```

Browser-only subsystems do not synchronously touch `window`, `document`,
`navigator`, `screen`, or other DOM globals when no DOM exists.

Server/default results are:

| Call | Server result |
|---|---|
| clipboard writes | `false` |
| clipboard reads | `null` / `[]` |
| interaction capability calls | `false` / `null` |
| camera/microphone/screen capture | `null` |
| speech recognition | `null` |
| `speech.isSpeaking()` | `false` |
| `speech.voices()` | `[]` |
| network status | `{ online: true, type: "unknown" }` |

`EngineBrowser.speech.speak()` is the one deliberate exception to the
"default-value" pattern: its return type is `Promise<void>`, so an unavailable
speech-synthesis API returns a **rejected promise** with
`Speech synthesis not supported`. It does not synchronously throw while merely
evaluating browser globals.

## Detection

```ts
import { EngineBrowser } from "nextjs-engine"

EngineBrowser.is.chrome
EngineBrowser.is.firefox
EngineBrowser.is.safari
EngineBrowser.is.edge
EngineBrowser.is.opera
EngineBrowser.is.brave
EngineBrowser.is.osmium
EngineBrowser.is.chromium

EngineBrowser.is.mobile
EngineBrowser.is.tablet
EngineBrowser.is.desktop

EngineBrowser.name
EngineBrowser.engine
EngineBrowser.version
```

Feature flags are available under `supports`:

```ts
EngineBrowser.supports.viewTransitions
EngineBrowser.supports.containerQueries
EngineBrowser.supports.cssHas
EngineBrowser.supports.cssNesting
EngineBrowser.supports.cssLayer
EngineBrowser.supports.webgl2
EngineBrowser.supports.clipboard
EngineBrowser.supports.camera
EngineBrowser.supports.screenCapture
EngineBrowser.supports.speechSynthesis
EngineBrowser.supports.speechRecognition
```

The public facade uses condition-form `CSS.supports(...)` checks for `:has()`
and nesting instead of treating selectors as CSS property names. Cascade-layer
support is based on the browser's `CSSLayerBlockRule` exposure.

Detection is cached. Call `EngineBrowser.invalidate()` in tests or after
deliberately changing the emulated browser environment.

## Conditional execution

```ts
EngineBrowser.run({
	safari: () => applySafariFix(),
	firefox: () => applyFirefoxFix(),
	default: () => applyDefault(),
})

const value = EngineBrowser.pick({
	mobile: "compact",
	default: "desktop",
})
```

`prefixed(property, value)` returns the normal declaration and adds the WebKit
form for the small set of properties that still need it.

## Clipboard

```ts
await EngineBrowser.clipboard.copy("Hello")

await EngineBrowser.clipboard.copyHtml(
	"<strong>Hello</strong>",
	"Hello",
)

const text = await EngineBrowser.clipboard.paste()
const items = await EngineBrowser.clipboard.read()

const mayRead = await EngineBrowser.clipboard.canRead()
const mayWrite = await EngineBrowser.clipboard.canWrite()
```

Clipboard helpers catch permission/API failures and return `false`, `null`, or
`[]`. Plain-text copying retains the legacy `execCommand("copy")` fallback.

## Interactions

```ts
await EngineBrowser.interact.share({
	title: "Next.js Engine",
	url: location.href,
})

const notification = await EngineBrowser.interact.notify("Done", {
	body: "Export complete",
})

EngineBrowser.interact.vibrate([100, 50, 100])

const files = await EngineBrowser.interact.pickFile({
	accept: "image/*",
	multiple: true,
})

EngineBrowser.interact.download(
	"export.json",
	JSON.stringify(data),
	"application/json",
)

await EngineBrowser.interact.fullscreen()
await EngineBrowser.interact.exitFullscreen()

const lock = await EngineBrowser.interact.wakeLock()
await lock?.release()

const position = await EngineBrowser.interact.location({
	enableHighAccuracy: true,
})

await EngineBrowser.interact.lockOrientation("portrait")

await EngineBrowser.interact.badge(3)
await EngineBrowser.interact.clearBadge()
```

Unavailable APIs and rejected permission prompts resolve to their documented
false/null/no-op result rather than leaking browser-global errors into SSR.

## Media

```ts
const camera = await EngineBrowser.media.camera({
	facing: "environment",
	width: 1920,
	height: 1080,
})

const microphone = await EngineBrowser.media.microphone()
const display = await EngineBrowser.media.screen()

EngineBrowser.media.stop(camera!)
```

Always stop capture streams when finished. `media.stop()` is defensive: passing
an already-ended or invalid stream does not turn cleanup into an application
error.

## Speech synthesis

```ts
await EngineBrowser.speech.speak("Hello", {
	lang: "en-US",
	rate: 1.1,
	pitch: 1,
	volume: 1,
})

EngineBrowser.speech.stopSpeaking()
EngineBrowser.speech.isSpeaking()
```

Ranges are normalized before assigning the native utterance:

| Option | Range |
|---|---:|
| `rate` | `0.1` – `10` |
| `pitch` | `0` – `2` |
| `volume` | `0` – `1` |

`0` is a valid pitch/volume value and is not discarded by truthiness checks.

Starting a new `speak()` call settles/cancels the previous engine-owned
utterance first. Calling `stopSpeaking()` also settles the engine-owned promise
before asking the browser to cancel playback, avoiding promises that hang after
a cancellation event.

## Speech recognition

```ts
const text = await EngineBrowser.speech.listen(
	{
		lang: "en-US",
		interim: true,
		maxSilence: 4,
	},
	(partial) => {
		console.log(partial)
	},
)
```

`maxSilence` is implemented by the facade. The timer starts with recognition and
is reset as speech/results arrive. On timeout the recognition session is
stopped and the transcript collected so far is returned.

Only one engine-owned recognition session is active at a time. Starting a new
`listen()` call aborts and resolves the previous one with `null`. This prevents
an older `onend`/`onerror` callback from clearing or resolving a newer session.

`stopListening()` aborts the active session and resolves its pending call with
`null`.

```ts
EngineBrowser.speech.stopListening()
```

## Voices

```ts
const voices = EngineBrowser.speech.voices()
const japanese = voices.find((voice) => voice.lang === "ja-JP")
```

Some browsers populate synthesis voices asynchronously, so an early call can
legitimately return an empty array.

## Network

```ts
const status = EngineBrowser.network.status()

const unsubscribe = EngineBrowser.network.onchange((next) => {
	console.log(next.online, next.type)
})

// later
unsubscribe()
```

`NetworkStatus.type` is normalized to the documented `NetworkType` union.
Unknown browser-specific strings become `"other"` while offline unknowns become
`"none"`.

Known values include:

```text
wifi
ethernet
4g
3g
2g
slow-2g
bluetooth
wimax
other
none
unknown
```

## React hook

```tsx
import { useBrowser } from "nextjs-engine"

function BrowserAware() {
	const browser = useBrowser()

	if (browser.is.safari) return <SafariVariant />
	return <StandardVariant />
}
```

The hook keeps the exact server snapshot on the client's first render, then
updates after mount. This avoids changing feature flags during hydration merely
because DOM globals became available.
