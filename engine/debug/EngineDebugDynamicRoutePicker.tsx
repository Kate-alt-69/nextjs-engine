"use client";

import { useMemo, useState } from "react";
import {
	buildEngineDebugDynamicRoute,
	getEngineDebugDynamicParameters,
	matchesEngineDebugRoutePattern,
} from "./EngineDebugDynamicRoutes";

interface EngineDebugDynamicRoutePickerProps {
	pattern: string;
	availablePaths: readonly string[];
	onChoose: (path: string) => void;
	onClose: () => void;
}

export function EngineDebugDynamicRoutePicker({ pattern, availablePaths, onChoose, onClose }: EngineDebugDynamicRoutePickerProps) {
	const parameters = useMemo(() => getEngineDebugDynamicParameters(pattern), [pattern]);
	const available = useMemo(
		() => [...new Set(availablePaths)].filter(path => matchesEngineDebugRoutePattern(pattern, path)).slice(0, 80),
		[availablePaths, pattern],
	);
	const [values, setValues] = useState<Record<string, string>>(() =>
		Object.fromEntries(parameters.map(parameter => [
			parameter.name,
			parameter.kind === "single" ? "example" : "example/child",
		])),
	);
	const [error, setError] = useState("");

	const previewCustomPath = () => {
		const result = buildEngineDebugDynamicRoute(pattern, values);
		if (result.error) {
			setError(result.error);
			return;
		}
		setError("");
		onChoose(result.path);
	};

	return (
		<div className="ed-dynamic-route-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="ed-dynamic-route-dialog" role="dialog" aria-modal="true" aria-labelledby="ed-dynamic-route-title">
				<div className="ed-dynamic-route-heading">
					<div>
						<div className="ed-sidebar-subtitle">DYNAMIC ROUTE PREVIEW</div>
						<h2 id="ed-dynamic-route-title">Choose a route for {pattern}</h2>
						<p>Next.js defines this as a route pattern. Pick a concrete path it has generated, or enter parameter values to preview another instance.</p>
					</div>
					<button type="button" className="ed-button" aria-label="Close dynamic route picker" onClick={onClose}>✕</button>
				</div>

				{available.length > 0 ? (
					<section className="ed-dynamic-route-section" aria-label="Available generated routes">
						<div className="ed-dynamic-route-section-title">Available paths from Next.js and this preview</div>
						<div className="ed-dynamic-route-options">
							{available.map(path => (
								<button key={path} type="button" className="ed-dynamic-route-option" title={path} onClick={() => onChoose(path)}>
									<span>{path}</span>
									<span aria-hidden="true">↗</span>
								</button>
							))}
						</div>
					</section>
				) : (
					<div className="ed-dynamic-route-empty">
						No concrete paths for this pattern have been recorded in Next.js' current prerender manifest or this session yet.
					</div>
				)}

				<form className="ed-dynamic-route-form" onSubmit={event => { event.preventDefault(); previewCustomPath(); }}>
					<div className="ed-dynamic-route-section-title">Preview a custom parameter value</div>
					{parameters.map(parameter => (
						<label className="ed-dynamic-route-field" key={parameter.name}>
							<span>{parameter.name}{parameter.kind === "optional-catch-all" ? " (optional)" : ""}</span>
							<input
								aria-label={parameter.name}
								value={values[parameter.name] ?? ""}
								onChange={event => setValues(current => ({ ...current, [parameter.name]: event.target.value }))}
								placeholder={parameter.kind === "single" ? "example" : "example/child"}
								autoComplete="off"
								spellCheck={false}
							/>
							<small>{parameter.kind === "single" ? "One path segment" : parameter.kind === "catch-all" ? "One or more slash-separated path segments" : "Zero or more slash-separated path segments"}</small>
						</label>
					))}
					{error && <p className="ed-dynamic-route-error" role="alert">{error}</p>}
					<div className="ed-dynamic-route-actions">
						<button type="button" className="ed-button" onClick={onClose}>Cancel</button>
						<button type="submit" className="ed-button ed-dynamic-route-submit">Preview route</button>
					</div>
				</form>
				<p className="ed-dynamic-route-footnote">Available paths come from Next.js' prerender manifest and routes observed in this preview. Dynamic values are not guessed by executing the app's generateStaticParams() function.</p>
			</section>
		</div>
	);
}
