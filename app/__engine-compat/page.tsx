"use client";

import { useState } from "react";
import { EngineDialog } from "../../src/engine/components/EngineOverlay";
import { EngineNav } from "../../src/engine/components/EngineNav";
import { EngineTransitionLink } from "../../src/engine/components/EngineTransitionLink";
import { useEngineTransitions } from "../../src/engine/core/enginetransitions";
import { EngineCollectedStyles, EngineProvider } from "../../src/engine/providers/EngineProvider";

export default function EngineCompatibilityPage() {
	const transitions = useEngineTransitions();
	const [count, setCount] = useState(0);
	const [sameUrlStatus, setSameUrlStatus] = useState("idle");

	const runLiquid = async () => {
		await transitions.run(() => setCount((value) => value + 1), "liquid");
	};

	const runSameUrl = async () => {
		setSameUrlStatus("pending");
		await transitions.push("/__engine-compat", "portal");
		setSameUrlStatus("done");
	};

	return (
		<EngineProvider>
			<main style={{ minHeight: "140vh", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
				<EngineNav
					items={[
						{ label: "Compat", href: "/__engine-compat" },
						{ label: "Near prefix", href: "/__engine" },
					]}
				/>

				<h1>Engine browser compatibility harness</h1>
				<p data-testid="count">{count}</p>
				<button data-testid="liquid" type="button" onClick={() => void runLiquid()}>
					Run liquid transition
				</button>
				<button data-testid="same-url" type="button" onClick={() => void runSameUrl()}>
					Same URL
				</button>
				<p data-testid="same-url-status">{sameUrlStatus}</p>

				<EngineTransitionLink href="/__engine-compat/target" transition="portal">
					Target page
				</EngineTransitionLink>

				<EngineDialog
					defaultOpen
					triggerLabel="Compatibility dialog"
					title="Hydration-safe dialog"
				>
					<p data-testid="dialog-body">Dialog body</p>
				</EngineDialog>
			</main>
			<EngineCollectedStyles id="__engine_compat_styles__" />
		</EngineProvider>
	);
}
