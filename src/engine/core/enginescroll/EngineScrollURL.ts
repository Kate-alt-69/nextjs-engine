// ============================================================================
// EngineScrollURL.ts — EngineScroll URL protocol
// ============================================================================
//
//  Protocol format:   #-es?<params>
//
//  Examples:
//    #-es?move=hero
//    #-es?move=pricing&offset=25
//    #-es?move=current&offset=-10
//    #-es?move=120.5
//    #-es?move=footer&duration=600
//    #-es?move=top
//    #-es?move=bottom
//
//  After execution the protocol is removed from the address bar with
//  history.replaceState() so the URL stays clean.
//
//  Standard browser anchors (#about) are untouched.
// ============================================================================

import type { EngineScrollTarget } from "./EngineScrollNavigator";
import { EngineScrollNavigator }   from "./EngineScrollNavigator";

const PROTOCOL = "#-es";

export class EngineScrollURL {

	/* ── Detection ─────────────────────────────────────────────────────────── */

	/** True when the current URL contains an EngineScroll command. */
	public static has(): boolean {
		if (typeof window === "undefined") return false;
		return window.location.hash.startsWith(PROTOCOL);
	}

	/* ── Execution ─────────────────────────────────────────────────────────── */

	/**
	 * Parse the current URL command, execute it, then clean the address bar.
	 * Returns false if there is no valid command to execute.
	 */
	public static execute(): boolean {

		if (!this.has()) return false;

		const hash     = window.location.hash;            // "#-es?move=hero&offset=25"
		const queryStr = hash.slice(PROTOCOL.length + 1); // "move=hero&offset=25"
		const params   = new URLSearchParams(queryStr);

		const move     = params.get("move");
		const offset   = parseFloat(params.get("offset")   ?? "0") || 0;
		const duration = params.has("duration")
			? parseInt(params.get("duration")!, 10)
			: undefined;

		this.clean();

		if (!move) return false;

		const target = this.resolveTarget(move);
		return EngineScrollNavigator.move(target, offset, duration);

	}

	/* ── Listener ──────────────────────────────────────────────────────────── */

	/**
	 * Subscribe to future hash changes and auto-execute ES commands.
	 * Returns an unsubscribe function.
	 */
	public static listen(): () => void {

		const handler = (): void => {
			if (this.has()) this.execute();
		};

		window.addEventListener("hashchange", handler);
		return () => window.removeEventListener("hashchange", handler);

	}

	/* ── Helpers ───────────────────────────────────────────────────────────── */

	private static resolveTarget(move: string): EngineScrollTarget {

		// Named positions
		if (
			move === "top"     ||
			move === "bottom"  ||
			move === "current"
		) {
			return move;
		}

		// Explicit DOM hash
		if (move.startsWith("#")) {
			return move as `#${string}`;
		}

		// Numeric absolute point
		const num = parseFloat(move);
		if (!isNaN(num)) return num;

		// Semantic name → treat as DOM id
		return `#${move}` as `#${string}`;

	}

	/** Remove the #-es protocol from the address bar. */
	private static clean(): void {

		if (typeof history === "undefined") return;

		history.replaceState(
			null,
			"",
			window.location.pathname + window.location.search,
		);

	}

}