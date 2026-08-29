// ============================================================================
// EngineScrollURL.ts — EngineScroll URL protocol
// ============================================================================

import type { EngineScrollTarget } from "./EngineScrollNavigator";
import { EngineScrollNavigator } from "./EngineScrollNavigator";

const PROTOCOL = "#-es";
const PROTOCOL_QUERY = `${PROTOCOL}?`;
const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function parseProtocolNumber(value: string | null): number | undefined {
	if (value === null) return undefined;
	const trimmed = value.trim();
	if (!DECIMAL_NUMBER.test(trimmed)) return undefined;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export class EngineScrollURL {
	public static has(): boolean {
		if (typeof window === "undefined") return false;
		return window.location.hash.startsWith(PROTOCOL_QUERY);
	}

	public static execute(): boolean {
		if (!this.has()) return false;

		const queryString = window.location.hash.slice(PROTOCOL_QUERY.length);
		const params = new URLSearchParams(queryString);
		const move = params.get("move");
		const offset = parseProtocolNumber(params.get("offset")) ?? 0;
		const parsedDuration = parseProtocolNumber(params.get("duration"));
		const duration = parsedDuration === undefined
			? undefined
			: Math.max(0, parsedDuration);

		if (!move) return false;
		const moved = EngineScrollNavigator.move(
			this.resolveTarget(move),
			offset,
			duration,
		);
		if (moved) this.clean();
		return moved;
	}

	public static listen(): () => void {
		if (typeof window === "undefined") return () => {};
		const handler = (): void => {
			if (this.has()) this.execute();
		};
		window.addEventListener("hashchange", handler);
		return () => window.removeEventListener("hashchange", handler);
	}

	private static resolveTarget(move: string): EngineScrollTarget {
		if (move === "top" || move === "bottom" || move === "current") return move;
		if (move.startsWith("#")) return move as `#${string}`;

		const numericTarget = parseProtocolNumber(move);
		if (numericTarget !== undefined) return numericTarget;

		return `#${move}` as `#${string}`;
	}

	private static clean(): void {
		if (typeof history === "undefined" || typeof window === "undefined") return;
		history.replaceState(
			null,
			"",
			window.location.pathname + window.location.search,
		);
	}
}
