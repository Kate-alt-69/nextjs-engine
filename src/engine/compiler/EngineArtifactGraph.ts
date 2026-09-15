// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — dependency-aware incremental artifact graph
// ─────────────────────────────────────────────────────────────────────────────

export type EngineArtifactKind =
	| "schema"
	| "style"
	| "asset"
	| "command"
	| "model"
	| "device"
	| "capability";

export interface EngineArtifactReference {
	kind: EngineArtifactKind;
	id: string;
}

export interface EngineArtifactDescriptor extends EngineArtifactReference {
	input: unknown;
	dependencies?: readonly EngineArtifactReference[];
}

export interface EngineArtifactResult<T> {
	value: T;
	cacheHit: boolean;
	fingerprint: string;
}

export interface EngineArtifactInspection extends EngineArtifactReference {
	fingerprint: string;
	dependencies: readonly string[];
	hits: number;
	rebuilds: number;
}

interface EngineArtifactEntry extends EngineArtifactInspection {
	value: unknown;
	lastUsed: number;
}

interface EngineArtifactGraphState {
	entries: Map<string, EngineArtifactEntry>;
	clock: number;
}

const GRAPH_STATE_KEY = Symbol.for("nextjs-engine.gen3-artifact-graph");
const MAX_ARTIFACTS = 512;

function graphState(): EngineArtifactGraphState {
	const root = globalThis as typeof globalThis & { [GRAPH_STATE_KEY]?: EngineArtifactGraphState };
	if (!root[GRAPH_STATE_KEY]) root[GRAPH_STATE_KEY] = { entries: new Map(), clock: 0 };
	return root[GRAPH_STATE_KEY]!;
}

function artifactKey(reference: EngineArtifactReference): string {
	return `${reference.kind}:${reference.id}`;
}

function stableSerialize(value: unknown, seen = new WeakSet<object>()): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
	if (typeof value === "function") return `function:${value.toString()}`;
	if (typeof value !== "object") return `${typeof value}:${String(value)}`;
	if (seen.has(value)) return "[circular]";
	seen.add(value);
	if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry, seen)).join(",")}]`;
	if (value instanceof Date) return `date:${value.toISOString()}`;
	const entries = Object.entries(value as Record<string, unknown>)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry, seen)}`);
	return `{${entries.join(",")}}`;
}

export function fingerprintEngineArtifact(value: unknown): string {
	const source = stableSerialize(value);
	let first = 2166136261;
	let second = 0x9e3779b9;
	for (let index = 0; index < source.length; index += 1) {
		const code = source.charCodeAt(index);
		first = Math.imul(first ^ code, 16777619);
		second = Math.imul(second ^ code, 2246822519);
	}
	return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

function invalidateKeys(initialKeys: readonly string[]): number {
	const state = graphState();
	const pending = [...initialKeys];
	const removed = new Set<string>();
	while (pending.length > 0) {
		const key = pending.pop()!;
		if (removed.has(key)) continue;
		removed.add(key);
		for (const [candidateKey, entry] of state.entries) {
			if (entry.dependencies.includes(key)) pending.push(candidateKey);
		}
	}
	for (const key of removed) state.entries.delete(key);
	return removed.size;
}

function evictOldArtifacts(): void {
	const state = graphState();
	if (state.entries.size <= MAX_ARTIFACTS) return;
	const oldest = [...state.entries.entries()]
		.sort(([, left], [, right]) => left.lastUsed - right.lastUsed)
		.slice(0, state.entries.size - MAX_ARTIFACTS)
		.map(([key]) => key);
	invalidateKeys(oldest);
}

export function compileEngineArtifact<T>(
	descriptor: EngineArtifactDescriptor,
	compile: () => T,
): EngineArtifactResult<T> {
	const state = graphState();
	const key = artifactKey(descriptor);
	const fingerprint = fingerprintEngineArtifact(descriptor.input);
	const dependencies = Object.freeze((descriptor.dependencies ?? []).map(artifactKey).sort());
	const existing = state.entries.get(key);
	state.clock += 1;
	if (
		existing
		&& existing.fingerprint === fingerprint
		&& existing.dependencies.length === dependencies.length
		&& existing.dependencies.every((dependency, index) => dependency === dependencies[index])
	) {
		existing.hits += 1;
		existing.lastUsed = state.clock;
		return { value: existing.value as T, cacheHit: true, fingerprint };
	}
	const rebuilds = (existing?.rebuilds ?? 0) + 1;
	if (existing) invalidateKeys([key]);
	const value = compile();
	state.entries.set(key, {
		kind: descriptor.kind,
		id: descriptor.id,
		fingerprint,
		dependencies,
		hits: existing?.hits ?? 0,
		rebuilds,
		value,
		lastUsed: state.clock,
	});
	evictOldArtifacts();
	return { value, cacheHit: false, fingerprint };
}

export function invalidateEngineArtifacts(reference?: Partial<EngineArtifactReference>): number {
	const state = graphState();
	if (!reference?.kind && !reference?.id) {
		const count = state.entries.size;
		state.entries.clear();
		return count;
	}
	const matches = [...state.entries.keys()].filter((key) => {
		const entry = state.entries.get(key)!;
		return (reference.kind === undefined || entry.kind === reference.kind)
			&& (reference.id === undefined || entry.id === reference.id);
	});
	return invalidateKeys(matches);
}

export function inspectEngineArtifactGraph(): readonly EngineArtifactInspection[] {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[Next.js Engine] Artifact graph inspection is development-only.");
	}
	return Object.freeze([...graphState().entries.values()]
		.sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))
		.map((entry) => Object.freeze({
			kind: entry.kind,
			id: entry.id,
			fingerprint: entry.fingerprint,
			dependencies: Object.freeze([...entry.dependencies]),
			hits: entry.hits,
			rebuilds: entry.rebuilds,
		})));
}
