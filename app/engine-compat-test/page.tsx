"use client";

import { useEffect, useState } from "react";
import type { EngineFallbackPlan } from "../../src/engine/compiler";
import { EngineNav } from "../../src/engine/components/EngineNav";
import { EngineTransitionLink } from "../../src/engine/components/EngineTransitionLink";
import { EngineCompatibilityDialog } from "../../src/engine/core/enginecompatibility";
import { coordinateEngineViewTransition, useEngineTransitions } from "../../src/engine/core/enginetransitions";
import { EngineCollectedStyles, EngineProvider } from "../../src/engine/providers/EngineProvider";

const COMPATIBILITY_PLAN: EngineFallbackPlan = {
	version: 1,
	pageId: "/engine-compat-test",
	features: [
		{
			feature: "css-grid",
			requiredBy: [{ nodeId: "compat-grid", path: "root", nodeType: "grid", runtime: "static" }],
			strategies: [{ id: "native", kind: "native", requires: ["css-grid"], fidelity: "full" }],
		},
		{
			feature: "view-transitions",
			requiredBy: [{ nodeId: "compat-link", path: "root.1", nodeType: "link", runtime: "client" }],
			strategies: [
				{ id: "native", kind: "native", requires: ["view-transitions"], fidelity: "full" },
				{ id: "web-animations", kind: "runtime", requires: ["web-animations"], fidelity: "close" },
				{ id: "instant-navigation", kind: "rendering", requires: [], fidelity: "close" },
			],
		},
		{
			feature: "webgl2",
			requiredBy: [{ nodeId: "compat-canvas", path: "root.2", nodeType: "canvas", runtime: "client" }],
			strategies: [{ id: "native", kind: "native", requires: ["webgl2"], fidelity: "full" }],
		},
	],
	legacy: {
		mode: "best-effort",
		preserves: ["html", "css", "text", "links"],
		clientEnhancements: [
			{ nodeId: "compat-link", path: "root.1", nodeType: "link", runtime: "client" },
			{ nodeId: "compat-canvas", path: "root.2", nodeType: "canvas", runtime: "client" },
		],
	},
};

const COMPATIBILITY_SUPPORT = {
	"css-grid": true,
	"view-transitions": false,
	"web-animations": true,
	webgl2: false,
} as const;

const NATIVE_COMPATIBILITY_PLAN: EngineFallbackPlan = {
	...COMPATIBILITY_PLAN,
	pageId: "/engine-compat-test/native",
	features: [COMPATIBILITY_PLAN.features[0]],
};

export default function EngineCompatibilityPage() {
	const transitions = useEngineTransitions();
	const [count, setCount] = useState(0);
	const [sameUrlStatus, setSameUrlStatus] = useState("idle");
	const [effectTransitionStatus, setEffectTransitionStatus] = useState("pending");

	useEffect(() => {
		void transitions.run(() => setEffectTransitionStatus("done"), "slide");
	}, [transitions]);

	const runLiquid = async () => {
		await transitions.run(() => setCount((value) => value + 1), "liquid");
	};

	const runSameUrl = async () => {
		setSameUrlStatus("pending");
		await transitions.push("/engine-compat-test", "portal");
		setSameUrlStatus("done");
	};

	const toggleTheme = () => {
		void coordinateEngineViewTransition(() => {
			const root = document.documentElement;
			root.dataset.engineCompatTheme = root.dataset.engineCompatTheme === "night" ? "day" : "night";
		});
	};

	return (
		<EngineProvider>
			<main style={{ minHeight: "140vh", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
				<EngineNav
					items={[
						{ label: "Compat", href: "/engine-compat-test" },
						{ label: "Near prefix", href: "/engine-compat" },
					]}
				/>

				<h1>Engine browser compatibility harness</h1>
				<p data-testid="effect-transition-status">{effectTransitionStatus}</p>
				<p data-testid="count">{count}</p>
				<button data-testid="liquid" type="button" onClick={() => void runLiquid()}>
					Run liquid transition
				</button>
				<button data-testid="same-url" type="button" onClick={() => void runSameUrl()}>
					Same URL
				</button>
				<button data-testid="coordinated-theme" type="button" onClick={toggleTheme}>
					Toggle coordinated theme
				</button>
				<p data-testid="same-url-status">{sameUrlStatus}</p>

				<EngineTransitionLink href="/engine-compat-test/target" transition="portal">
					Target page
				</EngineTransitionLink>

				<EngineCompatibilityDialog
					plan={COMPATIBILITY_PLAN}
					support={COMPATIBILITY_SUPPORT}
					triggerLabel="Browser compatibility"
					showSources
				/>
				<EngineCompatibilityDialog
					plan={NATIVE_COMPATIBILITY_PLAN}
					support={COMPATIBILITY_SUPPORT}
					triggerLabel="Native compatibility should stay hidden"
				/>
			</main>
			<EngineCollectedStyles id="__engine_compat_styles__" />
		</EngineProvider>
	);
}
