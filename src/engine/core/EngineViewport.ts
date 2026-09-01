// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — shared viewport runtime
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineViewportSnapshot {
	width: number;
	height: number;
	layoutWidth: number;
	layoutHeight: number;
	offsetLeft: number;
	offsetTop: number;
	scale: number;
	orientation: "portrait" | "landscape";
	keyboardInset: number;
}

type ViewportListener = () => void;

const SERVER_SNAPSHOT: EngineViewportSnapshot = Object.freeze({
	width: 0,
	height: 0,
	layoutWidth: 0,
	layoutHeight: 0,
	offsetLeft: 0,
	offsetTop: 0,
	scale: 1,
	orientation: "portrait",
	keyboardInset: 0,
});

class EngineViewportRuntime {
	private listeners = new Set<ViewportListener>();
	private snapshot: EngineViewportSnapshot = SERVER_SNAPSHOT;
	private listening = false;
	private raf = 0;

	getSnapshot = (): EngineViewportSnapshot => this.snapshot;
	getServerSnapshot = (): EngineViewportSnapshot => SERVER_SNAPSHOT;

	subscribe = (listener: ViewportListener): (() => void) => {
		this.listeners.add(listener);
		if (!this.listening) this.start();
		return () => {
			this.listeners.delete(listener);
			if (this.listeners.size === 0) this.stop();
		};
	};

	private measure(): EngineViewportSnapshot {
		if (typeof window === "undefined") return SERVER_SNAPSHOT;
		const visual = window.visualViewport;
		const layoutWidth = window.innerWidth;
		const layoutHeight = window.innerHeight;
		const width = visual?.width ?? layoutWidth;
		const height = visual?.height ?? layoutHeight;
		const offsetLeft = visual?.offsetLeft ?? 0;
		const offsetTop = visual?.offsetTop ?? 0;
		const scale = visual?.scale ?? 1;
		return {
			width,
			height,
			layoutWidth,
			layoutHeight,
			offsetLeft,
			offsetTop,
			scale,
			orientation: width >= height ? "landscape" : "portrait",
			keyboardInset: Math.max(0, layoutHeight - height - offsetTop),
		};
	}

	private scheduleMeasure = (): void => {
		if (this.raf !== 0 || typeof window === "undefined") return;
		this.raf = window.requestAnimationFrame(() => {
			this.raf = 0;
			const next = this.measure();
			const current = this.snapshot;
			if (
				current.width === next.width &&
				current.height === next.height &&
				current.layoutWidth === next.layoutWidth &&
				current.layoutHeight === next.layoutHeight &&
				current.offsetLeft === next.offsetLeft &&
				current.offsetTop === next.offsetTop &&
				current.scale === next.scale &&
				current.orientation === next.orientation &&
				current.keyboardInset === next.keyboardInset
			) return;
			this.snapshot = Object.freeze(next);
			for (const listener of [...this.listeners]) listener();
		});
	};

	private start(): void {
		if (this.listening || typeof window === "undefined") return;
		this.listening = true;
		this.snapshot = Object.freeze(this.measure());
		window.addEventListener("resize", this.scheduleMeasure, { passive: true });
		window.addEventListener("orientationchange", this.scheduleMeasure, { passive: true });
		window.visualViewport?.addEventListener("resize", this.scheduleMeasure, { passive: true });
		window.visualViewport?.addEventListener("scroll", this.scheduleMeasure, { passive: true });
	}

	private stop(): void {
		if (!this.listening || typeof window === "undefined") return;
		this.listening = false;
		window.removeEventListener("resize", this.scheduleMeasure);
		window.removeEventListener("orientationchange", this.scheduleMeasure);
		window.visualViewport?.removeEventListener("resize", this.scheduleMeasure);
		window.visualViewport?.removeEventListener("scroll", this.scheduleMeasure);
		if (this.raf !== 0) window.cancelAnimationFrame(this.raf);
		this.raf = 0;
	}
}

export const EngineViewport = new EngineViewportRuntime();
