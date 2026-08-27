// ============================================================================
// EngineScrollURL.ts — EngineScroll URL protocol
// ============================================================================

import type { EngineScrollTarget } from "./EngineScrollNavigator";
import { EngineScrollNavigator } from "./EngineScrollNavigator";

const PROTOCOL = "#-es";
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
		return window.location.hash.startsWith(PROTOCOL);
	}

	public static execute(): boolean {
		if (!this.has()) return false;

		const queryString = window.location.hash.slice(PROTOCOL.length + 1);
		const params = new URLSearchParams(queryString);
		const move = params.get("move");
		const offset = parseProtocolNumber(params.get("offset")) ?? 0;
		const parsedDuration = parseProtocolNumber(params.get("duration"));
		const duration = parsedDuration === undefined
			? undefined
			: Math.max(0, parsedDuration);

		this.clean();
		if (!move) return false;

		return EngineScrollNavigator.move(
			this.resolveTarget(move),
			offset,
			duration,
		);
	}

	public static listen(): () => void {
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
		if (typeof history === "undefined") return;
		history.replaceState(
			null,
			"",
			window.location.pathname + window.location.search,
		);
	}
}
