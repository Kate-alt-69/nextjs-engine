// ─────────────────────────────────────────────────────────────────────────────
// Engine — usePropStyles + cpropClass
//
// The deterministic compiler lives in compiler/EngineStyleCompiler so server
// and client rendering cannot drift into separate style contracts.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, type CSSProperties } from "react";
import type { BaseNodeProps, CpropValue, EngineStyleObject } from "../schema/types";
import { globalStyleCollector, type StyleCollector } from "../core/StyleCollector";
import { useStyleCollector } from "../providers/EngineProvider";
import {
	compileCpropClass,
	compileEngineStyles,
	compileMediaClass,
	compileStaticStyleClass,
} from "../compiler/EngineStyleCompiler";

export function cpropClass(
	cprop: CpropValue | undefined,
	styleCollector: StyleCollector = globalStyleCollector,
): string | undefined {
	return compileCpropClass(cprop, styleCollector);
}

export function useCpropClass(cprop: CpropValue | undefined): string | undefined {
	const styleCollector = useStyleCollector();
	return useMemo(
		() => compileCpropClass(cprop, styleCollector),
		[cprop, styleCollector],
	);
}

export function staticClass(
	style: CSSProperties | EngineStyleObject,
	styleCollector: StyleCollector = globalStyleCollector,
): string {
	return compileStaticStyleClass(style, styleCollector);
}

export function mediaClass(
	base: CSSProperties,
	...breakpoints: Array<[string, CSSProperties]>
): string {
	return compileMediaClass(base, breakpoints, globalStyleCollector);
}

export function usePropStyles(
	props: Partial<BaseNodeProps> & Record<string, unknown>,
	extraStyle?: CSSProperties | EngineStyleObject,
): CSSProperties {
	const styleCollector = useStyleCollector();
	return compileEngineStyles(props, styleCollector, extraStyle);
}
