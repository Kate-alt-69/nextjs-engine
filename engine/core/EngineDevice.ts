"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EngineDevice — client React hook
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import {
	DESKTOP_DEVICE,
	detectDevice,
	type DeviceInfo,
} from "./EngineDeviceShared";

export { detectDevice } from "./EngineDeviceShared";
export type { DeviceBrand, DeviceInfo, DeviceOS } from "./EngineDeviceShared";

/**
 * React hook that returns device info on the client.
 * SSR-safe — returns desktop defaults until after first mount.
 */
export function useMobileDevice(): DeviceInfo {
	const [info, setInfo] = useState<DeviceInfo>(DESKTOP_DEVICE);

	useEffect(() => {
		if (typeof navigator !== "undefined") {
			setInfo(detectDevice(navigator.userAgent));
		}
	}, []);

	return info;
}
