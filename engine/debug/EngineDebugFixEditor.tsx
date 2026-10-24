"use client";

import { useEffect, useMemo, useState } from "react";
import type { EngineDebugDiagnostic } from "./EngineDebugDiagnostics";
import { parseEngineDebugSourceLocation } from "./EngineDebugInlineCallout";

interface SourcePreview {
	path: string;
	startLine: number;
	highlightLine: number;
	totalLines: number;
	lines: Array<{ number: number; text: string }>;
}

interface EngineDebugFixEditorProps {
	diagnostic: EngineDebugDiagnostic;
	onApplied: () => void;
}

function describeQuickFix(diagnostic: EngineDebugDiagnostic): string {
	const message = diagnostic.message + "\n" + diagnostic.detail;
	if (/hydration|text content does not match|did not match/i.test(message)) {
		return "Hydration mismatch: compare the server-rendered value with the first client render. Check browser-only values, locale/time formatting, random IDs, and client state initialized differently during hydration.";
	}
	if (/module not found|cannot find module|cannot resolve/i.test(message)) {
		return "Module resolution failed: verify the import path and filename casing. If this is a package import, check package.json and the lockfile before installing or changing dependencies.";
	}
	if (/syntaxerror|unexpected token|expected .* before/i.test(message)) {
		return "Syntax issue detected: review the highlighted line and the few lines before it for a missing delimiter, unclosed string, or malformed JSX. No source was changed automatically.";
	}
	if (/cannot read propert(?:y|ies) of (?:undefined|null) \(reading ['"]?([A-Za-z_$][\w$]*)['"]?\)/i.test(message)) {
		return "A property access may be running before its value exists. The editor will only suggest an optional-chain change when the reported property appears exactly once on the highlighted line.";
	}
	return "No safe automatic edit could be inferred from this diagnostic. Inspect the source context below; any proposed change remains in the editor until you explicitly apply it.";
}

export function EngineDebugFixEditor({ diagnostic, onApplied }: EngineDebugFixEditorProps) {
	const source = useMemo(
		() => parseEngineDebugSourceLocation(diagnostic),
		[diagnostic.id, diagnostic.location, diagnostic.message, diagnostic.detail],
	);
	const [preview, setPreview] = useState<SourcePreview | null>(null);
	const [draft, setDraft] = useState("");
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [suggestion, setSuggestion] = useState("");
	const [status, setStatus] = useState("");
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let active = true;
		setPreview(null);
		setDraft("");
		setSuggestion("");
		setStatus("");
		setFailed(false);
		if (!source) {
			setLoading(false);
			return () => { active = false; };
		}
		setLoading(true);
		const query = new URLSearchParams({ file: source.path, line: String(source.line) });
		void fetch("/_engine/debug/source?" + query.toString(), { cache: "no-store" })
			.then(async response => {
				const body = await response.json() as SourcePreview & { error?: string };
				if (!response.ok) throw new Error(body.error || "Source preview could not be loaded.");
				return body;
			})
			.then(body => {
				if (!active) return;
				setPreview(body);
				setDraft(body.lines.map(line => line.text).join("\n"));
			})
			.catch(error => {
				if (!active) return;
				setFailed(true);
				setStatus(error instanceof Error ? error.message : "Source preview could not be loaded.");
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => { active = false; };
	}, [source?.path, source?.line, diagnostic.id]);

	const originalText = preview?.lines.map(line => line.text).join("\n") ?? "";
	const dirty = Boolean(preview && draft !== originalText);
	const diffLines = useMemo(() => {
		if (!dirty || !preview) return [] as Array<{ kind: "removed" | "added"; line: number; text: string }>;
		const before = originalText.split("\n");
		const after = draft.split("\n");
		const rows: Array<{ kind: "removed" | "added"; line: number; text: string }> = [];
		for (let index = 0; index < Math.max(before.length, after.length); index++) {
			if (before[index] === after[index]) continue;
			if (before[index] !== undefined) rows.push({ kind: "removed", line: preview.startLine + index, text: before[index] });
			if (after[index] !== undefined) rows.push({ kind: "added", line: preview.startLine + index, text: after[index] });
		}
		return rows;
	}, [dirty, draft, originalText, preview]);
	const quickFix = () => {
		if (!preview) return;
		const lines = draft.split("\n");
		const relativeLine = preview.highlightLine - preview.startLine;
		const highlighted = lines[relativeLine];
		if (highlighted === undefined) {
			setSuggestion("The highlighted line is outside the edited range. Restore the original lines or reload the source.");
			return;
		}
		const propertyMatch = diagnostic.message.match(/Cannot read propert(?:y|ies) of (?:undefined|null) \(reading ['"]?([A-Za-z_$][\w$]*)['"]?\)/i);
		if (propertyMatch?.[1]) {
			const property = propertyMatch[1];
			const escapedProperty = property.replace(/\$/g, "\\$");
			const access = new RegExp("(?<![?.])\\." + escapedProperty + "\\b", "g");
			const matches = highlighted.match(access) ?? [];
			if (matches.length === 1) {
				lines[relativeLine] = highlighted.replace(access, "?." + property);
				setDraft(lines.join("\n"));
				setSuggestion("Suggested optional chaining for ." + property + ". Review the diff before applying; this is a proposal, not proof that the value is safe to omit.");
				setStatus("");
				return;
			}
			setSuggestion("The reported property does not appear exactly once on the highlighted line, so no automatic edit was drafted. Edit the source manually if you know the intended behaviour.");
			return;
		}
		setSuggestion(describeQuickFix(diagnostic));
	};

	const save = async () => {
		if (!preview || !dirty || saving) return;
		setSaving(true);
		setStatus("");
		setFailed(false);
		try {
			const response = await fetch("/_engine/debug/source", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					file: preview.path,
					startLine: preview.startLine,
					highlightLine: preview.highlightLine,
					originalLines: preview.lines.map(line => line.text),
					replacementLines: draft.split("\n"),
				}),
				cache: "no-store",
			});
			const body = await response.json() as { error?: string; preview?: SourcePreview };
			if (response.status === 409) throw new Error(body.error || "The source changed in the workspace. Reload it before saving.");
			if (!response.ok || !body.preview) throw new Error(body.error || "Source changes could not be saved.");
			setPreview(body.preview);
			setDraft(body.preview.lines.map(line => line.text).join("\n"));
			setSuggestion("");
			setStatus("Saved. The preview is reloading so you can verify the change.");
			onApplied();
		} catch (error) {
			setFailed(true);
			setStatus(error instanceof Error ? error.message : "Source changes could not be saved.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<section className="ed-fix-editor" aria-label="Source fix editor">
			<div className="ed-fix-head">
				<div>
					<h4>Source &amp; quick fix</h4>
					<div className="ed-fix-path" title={source?.path ?? "No source path found"}>{source ? source.path + ":" + source.line : "No source location found"}</div>
				</div>
				<span className="ed-fix-dev-badge">LOCAL DEV</span>
			</div>
			{!source ? (
				<p className="ed-explain">This diagnostic has no mapped app/source line. The editor will not guess a file path. Inspect the full stack or add a source map to connect this issue to editable code.</p>
			) : (
				<>
					{loading && <p className="ed-explain" role="status">Loading source context…</p>}
					{failed && <p className="ed-fix-status is-error" role="alert">{status}</p>}
					{preview && (
						<>
							<div className="ed-fix-toolbar">
								<span>Lines {preview.startLine}–{preview.startLine + preview.lines.length - 1} of {preview.totalLines}</span>
								<button type="button" className="ed-button" onClick={quickFix} disabled={loading || saving}>Suggest auto-fix</button>
							</div>
							<textarea
								className="ed-fix-textarea"
								aria-label="Editable source context"
								value={draft}
								onChange={event => { setDraft(event.target.value); setStatus(""); }}
								spellCheck={false}
								autoCapitalize="off"
								autoCorrect="off"
							/>
							{suggestion && <p className="ed-fix-suggestion" aria-live="polite">{suggestion}</p>}
							{dirty && <div className="ed-fix-diff" aria-label="Proposed source diff">
								<div className="ed-fix-diff-title">Unapplied changes · {diffLines.filter(line => line.kind === "added").length} additions / {diffLines.filter(line => line.kind === "removed").length} removals</div>
								{diffLines.map((line, index) => <div key={line.kind + ":" + line.line + ":" + index} className={"ed-fix-diff-line " + line.kind}><span>{line.kind === "added" ? "+" : "−"}{line.line}</span><code>{line.text || " "}</code></div>)}
							</div>}
							<div className="ed-fix-actions">
								<button type="button" className="ed-button" onClick={() => { setDraft(originalText); setSuggestion(""); setStatus(""); }} disabled={!dirty || saving}>Discard edits</button>
								<button type="button" className="ed-button ed-fix-apply" onClick={() => void save()} disabled={!dirty || saving}>{saving ? "Saving…" : "Apply changes"}</button>
							</div>
							{status && !failed && <p className="ed-fix-status" role="status">{status}</p>}
							<p className="ed-fix-note">Changes are written only to the local development workspace. The save checks that this exact source context has not changed, and never runs a suggested fix without your click.</p>
						</>
					)}
				</>
			)}
		</section>
	);
}
