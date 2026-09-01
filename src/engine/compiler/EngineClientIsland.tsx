"use client";

import type { ReactNode } from "react";
import type { EngineConfig, SchemaNode } from "../schema/types";
import { SchemaRenderer } from "../core/SchemaRenderer";
import { EngineCollectedStyles, EngineProvider } from "../providers/EngineProvider";
import { EngineScrollProvider } from "../core/enginescroll";

const SERVER_CHILDREN_SLOT = "__gen3_server_children";

export interface EngineClientIslandProps {
	node: SchemaNode;
	config?: EngineConfig;
	slots?: Record<string, ReactNode>;
	children?: ReactNode;
}

export function EngineClientIsland({ node, config, slots, children }: EngineClientIslandProps) {
	const hasServerChildren = children !== undefined && children !== null;
	const islandNode: SchemaNode = hasServerChildren
		? {
			...node,
			children: [{
				type: "slot",
				props: { name: SERVER_CHILDREN_SLOT },
			}],
		}
		: node;
	const islandSlots = hasServerChildren
		? { ...(slots ?? {}), [SERVER_CHILDREN_SLOT]: children }
		: slots;

	return (
		<EngineScrollProvider>
			<EngineProvider config={config} slots={islandSlots}>
				<SchemaRenderer schema={{ root: islandNode }} />
				<EngineCollectedStyles />
			</EngineProvider>
		</EngineScrollProvider>
	);
}
