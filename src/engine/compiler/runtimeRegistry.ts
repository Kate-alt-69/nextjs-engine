// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — built-in runtime profiles
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeType, SchemaNode } from "../schema/types";
import type { EngineRuntimeKind, EngineRuntimeProfile } from "./types";

const DEFAULT_PROFILE: EngineRuntimeProfile = {
	runtime: "auto",
	reason: "Custom components default to automatic runtime classification.",
	defaultWorkClass: "visible",
};

const profiles = new Map<NodeType, EngineRuntimeProfile>();

function setBuiltin(type: NodeType, profile: EngineRuntimeProfile): void {
	profiles.set(type, Object.freeze({ ...profile }));
}

for (const type of ["box", "stack", "grid", "text", "heading", "section", "card", "spacer", "divider", "option", "optgroup"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "static",
		reason: "This built-in renders deterministic markup and styles without browser state.",
		defaultWorkClass: "visible",
	});
}

setBuiltin("slot", {
	runtime: "server",
	reason: "Slots are resolved by the page/component owner and can remain in the server tree.",
	defaultWorkClass: "visible",
});
setBuiltin("markdown", {
	runtime: "client",
	reason: "The current Markdown renderer still owns client animation/style behavior; Gen 3 can server-compile it after the parser is split from that runtime.",
	defaultWorkClass: "near",
});
setBuiltin("image", {
	runtime: "server",
	reason: "Image markup is server-renderable while the browser owns the image resource request and decode.",
	defaultWorkClass: "near",
});
setBuiltin("video", {
	runtime: "client",
	reason: "Video loading and playback lifecycle depend on browser media state.",
	capabilities: ["dom", "intersection-observer", "media"],
	defaultWorkClass: "deferred",
	heavy: true,
});
setBuiltin("canvas", {
	runtime: "client",
	reason: "Canvas rendering requires browser drawing and frame lifecycle APIs.",
	capabilities: ["dom", "canvas", "request-animation-frame", "intersection-observer"],
	defaultWorkClass: "visible",
	heavy: true,
});
for (const type of ["manim", "EngineManim", "manim3d", "EngineManim3D"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "client",
		reason: "EngineManim owns browser-side animation/rendering state.",
		capabilities: ["dom", "canvas", "request-animation-frame", "intersection-observer"],
		defaultWorkClass: "visible",
		heavy: true,
	});
}
for (const type of ["dialog", "EngineDialog", "drawer", "EngineDrawer", "popover", "EnginePopover"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "client",
		reason: "Overlay focus, dismissal, portals and viewport positioning require browser interaction.",
		capabilities: ["dom", "visual-viewport"],
		defaultWorkClass: "visible",
	});
}
for (const type of ["form", "input", "textarea", "checkbox", "custom-select"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "client",
		reason: "This form control owns interactive browser state.",
		capabilities: ["dom"],
		defaultWorkClass: "visible",
	});
}
setBuiltin("label", {
	runtime: "static",
	reason: "Labels render as deterministic markup unless client behavior is attached.",
	defaultWorkClass: "visible",
});
setBuiltin("button", {
	runtime: "auto",
	reason: "Buttons are server-renderable when they only navigate and become client islands when handlers/model state are used.",
	defaultWorkClass: "visible",
});
for (const type of ["link", "EngineLink"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "auto",
		reason: "Ordinary links can stay server-rendered; animated transitions or handlers require a client island.",
		defaultWorkClass: "visible",
	});
}
for (const type of ["nav", "EngineNav", "scroll"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "client",
		reason: "The current navigation/scroll runtime owns browser route, viewport or interaction state.",
		capabilities: ["dom"],
		defaultWorkClass: "visible",
	});
}
setBuiltin("hero", {
	runtime: "auto",
	reason: "Hero layout is server-renderable; parallax or other browser behavior upgrades only the hero boundary.",
	defaultWorkClass: "critical",
});
setBuiltin("suspense", {
	runtime: "client",
	reason: "The current EngineSuspense preset runtime is client-owned; its static shell remains a future server split point.",
	defaultWorkClass: "near",
});

export function registerEngineRuntimeProfile(type: NodeType, profile: EngineRuntimeProfile): void {
	profiles.set(type, Object.freeze({ ...profile }));
}

export function unregisterEngineRuntimeProfile(type: NodeType): void {
	profiles.delete(type);
}

export function getEngineRuntimeProfile(type: NodeType): EngineRuntimeProfile {
	return profiles.get(type) ?? DEFAULT_PROFILE;
}

function hasClientBehavior(node: SchemaNode): boolean {
	const props = node.props ?? {};
	if (Object.values(props).some((value) => typeof value === "function")) return true;
	if (typeof props.onClick === "string" && props.onClick.length > 0) return true;
	if (typeof props.onChange === "string" && props.onChange.length > 0) return true;
	if (typeof props.onSubmit === "string" && props.onSubmit.length > 0) return true;
	if (typeof props.onSetup === "string" || typeof props.onDraw === "string" || typeof props.onResize === "string") return true;
	if (props.model !== undefined || props.modelKey !== undefined || props.bind !== undefined) return true;
	if (props.parallax === true || props.interactive === true) return true;
	if (props.shader !== undefined && props.shader !== null) return true;
	if (props.pointGroup !== undefined || props.pointAlign !== undefined || props.pointOffset !== undefined) return true;
	if (props.textAnimation && props.textAnimation !== "none") return true;
	if (props.blockAnimation && props.blockAnimation !== "none") return true;
	return false;
}

function hasAnimatedTransition(node: SchemaNode): boolean {
	const props = node.props ?? {};
	const link = props.cprop && typeof props.cprop === "object"
		? (props.cprop as Record<string, unknown>).link
		: undefined;
	const transition = link && typeof link === "object"
		? (link as Record<string, unknown>).transition
		: props.transition;
	if (transition === undefined || transition === null || transition === "instant") return false;
	return true;
}

export function resolveNodeRuntime(node: SchemaNode): {
	runtime: Exclude<EngineRuntimeKind, "auto">;
	reason: string;
	profile: EngineRuntimeProfile;
} {
	const profile = getEngineRuntimeProfile(node.type);
	if (profile.runtime !== "auto") {
		if (profile.runtime !== "client" && hasClientBehavior(node)) {
			return {
				runtime: "client",
				reason: "Browser behavior is attached to an otherwise server-renderable node.",
				profile,
			};
		}
		return { runtime: profile.runtime, reason: profile.reason, profile };
	}

	if (hasClientBehavior(node)) {
		return {
			runtime: "client",
			reason: "Automatic classification found browser-side handlers, animation, model state, shader behavior or bindings.",
			profile,
		};
	}

	if (node.type === "button" && typeof node.props?.href === "string") {
		return {
			runtime: "static",
			reason: "This button only navigates, so browser state is not required.",
			profile,
		};
	}

	if ((node.type === "link" || node.type === "EngineLink") && !hasAnimatedTransition(node)) {
		return {
			runtime: "server",
			reason: "This ordinary link has no animated transition or handler and can stay server-rendered.",
			profile,
		};
	}

	if (node.type === "hero") {
		return {
			runtime: "server",
			reason: "This hero has no browser-only behavior and can render on the server.",
			profile,
		};
	}

	return {
		runtime: "server",
		reason: profile.reason,
		profile,
	};
}
