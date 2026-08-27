import type { CSSProperties } from "react";

export type EngineShaderExecution = "static" | "event" | "animated";
export type EngineShaderVariableValue = number | boolean | string | readonly number[];

export interface EngineShaderVariableDefinition {
	name: string;
	type: "float" | "bool" | "vec2" | "vec3" | "vec4" | "color";
	defaultValue: EngineShaderVariableValue;
}

export interface EngineShaderRenderPlan {
	version: 1;
	name: string;
	logicalName: string;
	execution: EngineShaderExecution;
	dependencies: string[];
	variables: EngineShaderVariableDefinition[];
	constants: Record<string, unknown>;
	render: {
		resolution: number;
		filter: "linear" | "nearest";
	};
	fallback: string;
	vertex: string;
	fragment: string;
	flows: Array<{ from: string; to: string }>;
}

export interface EngineShaderManifestEntry {
	hash: string;
	file: string;
	execution: EngineShaderExecution;
	dependencies: string[];
}

export interface EngineShaderManifest {
	version: 1;
	revision: string;
	shaders: Record<string, EngineShaderManifestEntry>;
}

export interface EngineShaderConfig {
	src: string;
	variables?: Record<string, EngineShaderVariableValue>;
	fps?: number;
	maxDpr?: number;
	adaptive?: boolean;
	pauseWhenOffscreen?: boolean;
	pauseWhenHidden?: boolean;
	respectReducedMotion?: boolean;
	powerPreference?: "default" | "high-performance" | "low-power";
	className?: string;
	style?: CSSProperties;
}

export type EngineShaderInput = string | EngineShaderConfig;
