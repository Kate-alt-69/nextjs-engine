// ─────────────────────────────────────────────────────────────────────────────
// EngineDeviceShared — pure device detection, safe in server and client graphs
// ─────────────────────────────────────────────────────────────────────────────

export type DeviceOS = "ios" | "android" | "windows-phone" | "desktop" | "other";

export type DeviceBrand =
	| "apple"
	| "samsung"
	| "xiaomi"
	| "huawei"
	| "oneplus"
	| "oppo"
	| "realme"
	| "vivo"
	| "google"
	| "motorola"
	| "nokia"
	| "unknown";

export interface DeviceInfo {
	isMobile: boolean;
	isTablet: boolean;
	isDesktop: boolean;
	os: DeviceOS;
	brand: DeviceBrand;
	type: string;
}

export const DESKTOP_DEVICE: DeviceInfo = {
	isMobile: false,
	isTablet: false,
	isDesktop: true,
	os: "desktop",
	brand: "unknown",
	type: "desktop",
};

function resolveAndroidBrand(ua: string): DeviceBrand {
	if (/samsungbrowser|samsung|sm-[a-z]|gt-[a-z]|galaxy/.test(ua)) return "samsung";
	if (/xiaomi|miui|redmi|\bmi\s|\bmi\/|hmnote|poco/.test(ua)) return "xiaomi";
	if (/huawei|honor/.test(ua)) return "huawei";
	if (/oneplus|opd-|le2/.test(ua)) return "oneplus";
	if (/\boppo\b/.test(ua)) return "oppo";
	if (/realme/.test(ua)) return "realme";
	if (/\bvivo\b/.test(ua)) return "vivo";
	if (/motorola|\bmoto\b/.test(ua)) return "motorola";
	if (/\bnokia\b|hmd\s/.test(ua)) return "nokia";
	if (/pixel|nexus/.test(ua)) return "google";
	return "unknown";
}

/** Parse a User-Agent string into structured device info. Pure and side-effect free. */
export function detectDevice(ua: string): DeviceInfo {
	if (!ua) return DESKTOP_DEVICE;
	const normalized = ua.toLowerCase();

	const isIpad = /ipad/.test(normalized) || (/macintosh/.test(normalized) && /touch/.test(normalized));
	if (isIpad) {
		return {
			isMobile: false,
			isTablet: true,
			isDesktop: false,
			os: "ios",
			brand: "apple",
			type: "ipad",
		};
	}

	if (/android/.test(normalized) && !/mobile/.test(normalized)) {
		const brand = resolveAndroidBrand(normalized);
		return {
			isMobile: false,
			isTablet: true,
			isDesktop: false,
			os: "android",
			brand,
			type: `${brand}-tablet`,
		};
	}

	if (/iphone|ipod/.test(normalized)) {
		return {
			isMobile: true,
			isTablet: false,
			isDesktop: false,
			os: "ios",
			brand: "apple",
			type: "iphone",
		};
	}

	if (/windows phone/.test(normalized)) {
		const brand: DeviceBrand = /nokia|lumia/.test(normalized)
			? "nokia"
			: /samsung/.test(normalized)
				? "samsung"
				: "unknown";
		return {
			isMobile: true,
			isTablet: false,
			isDesktop: false,
			os: "windows-phone",
			brand,
			type: "windows-phone",
		};
	}

	if (/android/.test(normalized) && /mobile/.test(normalized)) {
		const brand = resolveAndroidBrand(normalized);
		return {
			isMobile: true,
			isTablet: false,
			isDesktop: false,
			os: "android",
			brand,
			type: brand === "unknown" ? "android" : brand,
		};
	}

	if (/\bmobile\b|\bphone\b/.test(normalized)) {
		return {
			isMobile: true,
			isTablet: false,
			isDesktop: false,
			os: "other",
			brand: "unknown",
			type: "mobile",
		};
	}

	return DESKTOP_DEVICE;
}
