# EngineVideo viewport lifecycle

`EngineVideo` delays media activation until the wrapper enters its configured preload margin. The default margin is `800px 0px`, so the browser can prepare the media shortly before it is needed.

## One-time source activation

The `<video>` element is not created before the component first reaches the preload margin unless `eager` is enabled.

After activation the element stays mounted. Scrolling away does not destroy the media element or force the browser to re-download/reselect its `<source>` list when the user comes back.

## Autoplay pause/resume

Viewport observation remains active after the first intersection.

For `autoPlay` videos:

```text
inside preload margin
	→ video may play

outside preload margin
	→ video.pause()

re-enter preload margin
	→ video.play() is requested again
```

Playback rejection from browser autoplay policy is treated as a normal condition; native controls remain available.

This prevents autoplay video decode/playback from continuing forever after the user has scrolled far past the media.

Videos with `autoPlay={false}` are not automatically paused or resumed. Manual playback remains under user control.

## Source changes

A stable source key is derived from every source URL/type pair. When that key changes, EngineVideo remounts the native `<video>` element so browsers reliably reselect the new source list, and resets readiness/buffering state.

## Reduced motion

The loading spinner animation is disabled under `prefers-reduced-motion: reduce`.
