import type { CSSProperties } from "react";
import type { BaseNodeProps, EngineStyleObject } from "../schema/types";
import { usePropStyles } from "./usePropStyles";

export interface PrimitiveStyleLayers {
	/** Lowest-priority built-in styles supplied by the component. */
	defaults?: CSSProperties;
	/** Semantic component props such as variant/layout flags. */
	derived?: CSSProperties;
	/** Explicit caller style; intentionally wins over schema props. */
	style?: CSSProperties | EngineStyleObject;
	/** Required live state such as disabled/overlay positioning. */
	runtime?: CSSProperties;
}

/**
 * Resolves the public Engine styling contract without mixing component defaults
 * into usePropStyles' explicit-style layer.
 *
 * Precedence: defaults < derived component state < schema props < style < runtime.
 */
export function usePrimitiveStyles(
	props: Partial<BaseNodeProps> & Record<string, unknown>,
	layers: PrimitiveStyleLayers = {},
): CSSProperties {
	const resolvedUserStyle = usePropStyles(props, layers.style);
	return {
		...(layers.defaults ?? {}),
		...(layers.derived ?? {}),
		...resolvedUserStyle,
		...(layers.runtime ?? {}),
	};
}
