// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — EngineModel
// Small external-store state primitive. Components subscribe only to the model
// keys they consume; unrelated schema branches do not need to become client-side.
// ─────────────────────────────────────────────────────────────────────────────

export type EngineModelState = Record<string, unknown>;
export type EngineModelListener = () => void;
export type EngineModelKeyListener<T> = (value: T, previous: T) => void;
export type EngineModelAction<TState extends EngineModelState, TArgs extends unknown[] = unknown[], TResult = unknown> =
	(model: EngineModel<TState>, ...args: TArgs) => TResult;

export interface EngineModelOptions {
	name?: string;
}

export interface EngineModelConsumerInspection {
	id: string;
	keys: readonly string[];
}

export interface EngineModelInspection<TState extends EngineModelState = EngineModelState> {
	name: string;
	version: number;
	state: Readonly<TState>;
	computed: readonly string[];
	actions: readonly string[];
	consumers: readonly EngineModelConsumerInspection[];
}

export class EngineModel<TState extends EngineModelState = EngineModelState> {
	private state: TState;
	private readonly initialState: TState;
	private version = 0;
	private listeners = new Set<EngineModelListener>();
	private keyListeners = new Map<keyof TState, Set<EngineModelKeyListener<any>>>();
	private computedValues = new Map<string, (state: Readonly<TState>) => unknown>();
	private actions = new Map<string, EngineModelAction<TState, any[], any>>();
	private readonly debugName: string;
	private debugConsumers = new Map<string, Set<string>>();
	private debugListeners = new Set<EngineModelListener>();

	constructor(initialState: TState, options: EngineModelOptions = {}) {
		this.initialState = { ...initialState };
		this.state = { ...initialState };
		this.debugName = options.name?.trim() || "EngineModel";
	}

	private notifyDebug(): void {
		if (process.env.NODE_ENV === "production") return;
		for (const listener of [...this.debugListeners]) listener();
	}

	get<K extends keyof TState>(key: K): TState[K] {
		return this.state[key];
	}

	has(key: keyof TState): boolean {
		return Object.prototype.hasOwnProperty.call(this.state, key);
	}

	set<K extends keyof TState>(key: K, value: TState[K]): void {
		const previous = this.state[key];
		if (Object.is(previous, value)) return;
		this.state = { ...this.state, [key]: value };
		this.version += 1;
		for (const listener of [...(this.keyListeners.get(key) ?? [])]) listener(value, previous);
		for (const listener of [...this.listeners]) listener();
		this.notifyDebug();
	}

	update<K extends keyof TState>(key: K, updater: (current: TState[K]) => TState[K]): void {
		this.set(key, updater(this.state[key]));
	}

	patch(values: Partial<TState>): void {
		let changed = false;
		const previous = this.state;
		const next = { ...previous };
		const changedKeys: Array<keyof TState> = [];
		for (const [rawKey, value] of Object.entries(values)) {
			const key = rawKey as keyof TState;
			if (Object.is(previous[key], value)) continue;
			(next as Record<string, unknown>)[rawKey] = value;
			changedKeys.push(key);
			changed = true;
		}
		if (!changed) return;
		this.state = next;
		this.version += 1;
		for (const key of changedKeys) {
			for (const listener of [...(this.keyListeners.get(key) ?? [])]) {
				listener(this.state[key], previous[key]);
			}
		}
		for (const listener of [...this.listeners]) listener();
		this.notifyDebug();
	}

	reset(): void {
		this.patch(this.initialState);
	}

	computed<TResult>(name: string, resolver: (state: Readonly<TState>) => TResult): EngineModel<TState> {
		this.computedValues.set(name, resolver);
		return this;
	}

	read<TResult = unknown>(name: string): TResult {
		const resolver = this.computedValues.get(name);
		if (!resolver) throw new Error(`[EngineModel] Unknown computed value "${name}".`);
		return resolver(this.state) as TResult;
	}

	action<TArgs extends unknown[], TResult>(
		name: string,
		handler: EngineModelAction<TState, TArgs, TResult>,
	): EngineModel<TState> {
		this.actions.set(name, handler as EngineModelAction<TState, any[], any>);
		return this;
	}

	run<TResult = unknown>(name: string, ...args: unknown[]): TResult {
		const action = this.actions.get(name);
		if (!action) throw new Error(`[EngineModel] Unknown action "${name}".`);
		return action(this, ...args) as TResult;
	}

	watch<K extends keyof TState>(key: K, listener: EngineModelKeyListener<TState[K]>): () => void {
		let listeners = this.keyListeners.get(key);
		if (!listeners) {
			listeners = new Set();
			this.keyListeners.set(key, listeners);
		}
		listeners.add(listener);
		return () => {
			listeners!.delete(listener);
			if (listeners!.size === 0) this.keyListeners.delete(key);
		};
	}

	subscribe(listener: EngineModelListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	snapshot(): Readonly<TState> {
		return this.state;
	}

	getVersion(): number {
		return this.version;
	}

	registerDebugConsumer(id: string, key: keyof TState | "*"): () => void {
		if (process.env.NODE_ENV === "production") return () => undefined;
		const normalizedId = id.trim();
		if (!normalizedId) return () => undefined;
		const normalizedKey = String(key);
		const keys = this.debugConsumers.get(normalizedId) ?? new Set<string>();
		keys.add(normalizedKey);
		this.debugConsumers.set(normalizedId, keys);
		this.notifyDebug();
		return () => {
			const current = this.debugConsumers.get(normalizedId);
			if (!current) return;
			current.delete(normalizedKey);
			if (current.size === 0) this.debugConsumers.delete(normalizedId);
			this.notifyDebug();
		};
	}

	subscribeDebug(listener: EngineModelListener): () => void {
		if (process.env.NODE_ENV === "production") {
			throw new Error("[EngineModel] Debug subscriptions are development-only.");
		}
		this.debugListeners.add(listener);
		return () => this.debugListeners.delete(listener);
	}

	inspect(): EngineModelInspection<TState> {
		if (process.env.NODE_ENV === "production") {
			throw new Error("[EngineModel] State inspection is development-only.");
		}
		return Object.freeze({
			name: this.debugName,
			version: this.version,
			state: Object.freeze({ ...this.state }),
			computed: Object.freeze([...this.computedValues.keys()].sort()),
			actions: Object.freeze([...this.actions.keys()].sort()),
			consumers: Object.freeze([...this.debugConsumers.entries()]
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([id, keys]) => Object.freeze({ id, keys: Object.freeze([...keys].sort()) }))),
		});
	}

	debugSet(key: keyof TState, value: unknown): void {
		if (process.env.NODE_ENV === "production") {
			throw new Error("[EngineModel] State editing is development-only.");
		}
		if (!this.has(key)) throw new Error(`[EngineModel] Cannot edit unknown key "${String(key)}".`);
		this.set(key, value as TState[keyof TState]);
	}

	static create<T extends EngineModelState>(initialState: T, options?: EngineModelOptions): EngineModel<T> {
		return new EngineModel(initialState, options);
	}
}
