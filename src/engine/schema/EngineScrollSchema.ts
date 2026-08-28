// ============================================================================
// EngineScrollSchema.ts — Schema-native EngineScroll point metadata
// ============================================================================

import type {
	EngineScrollPointGroupInput,
} from "../core/enginescroll/EngineScrollPointManager";
import type { EngineScrollAlignment } from "../core/enginescroll/EngineScrollTypes";

export interface EngineScrollPointSchemaProps {
	/** One or more navigation/snap groups this point participates in. */
	pointGroup?: EngineScrollPointGroupInput;
	/** Default viewport alignment used when resolving this point. */
	pointAlign?: EngineScrollAlignment;
	/** Default offset in EngineScroll point units. */
	pointOffset?: number;
}

// Keep point metadata first-class on every BaseNodeProps-derived schema type
// without forcing the already-large schema/types module to import runtime code.
declare module "./types" {
	interface BaseNodeProps extends EngineScrollPointSchemaProps {}
}
