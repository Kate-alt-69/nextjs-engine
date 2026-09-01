"use client";

import type { ReactNode } from "react";
import type { EngineConfig, SchemaNode } from "../schema/types";
import { SchemaRenderer } from "../core/SchemaRenderer";
import { EngineCollectedStyles, EngineProvider } from "../providers/EngineProvider";
import { EngineScrollProvider } from "../core/enginescroll";

export interface EngineClientIslandProps {
	node: SchemaNode;
	config?: EngineConfig;
	slots?: Record<string, ReactNode>;
}

export function EngineClientIsland({ node, config, slots }: EngineClientIslandProps) {
	return (
		<EngineScrollProvider>
			<EngineProvider config={config} slots={slots}>
				<SchemaRenderer schema={{ root: node }} />
				<EngineCollectedStyles />
			</EngineProvider>
		</EngineScrollProvider>
	);
}
