"use client";

import { useSyncExternalStore } from "react";
import { EngineViewport } from "../core/EngineViewport";

export function useEngineViewport() {
	return useSyncExternalStore(
		EngineViewport.subscribe,
		EngineViewport.getSnapshot,
		EngineViewport.getServerSnapshot,
	);
}
