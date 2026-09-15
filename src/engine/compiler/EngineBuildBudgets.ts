// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — optional build budgets (D.18)
// ─────────────────────────────────────────────────────────────────────────────

export type EngineBuildBudgetMetric =
	| "initial-js"
	| "route-js"
	| "critical-css"
	| "request-count"
	| "hydrated-islands";

export interface EngineBuildBudgetLimits {
	initialJS?: number;
	routeJS?: number;
	criticalCSS?: number;
	requestCount?: number;
	hydratedIslands?: number;
}

export interface EngineBuildMeasurements {
	initialJS?: number;
	routeJS?: number;
	criticalCSS?: number;
	requestCount?: number;
	hydratedIslands?: number;
}

export interface EngineBuildAttribution {
	name: string;
	value: number;
}

export interface EngineBuildBudgetResult {
	metric: EngineBuildBudgetMetric;
	status: "PASS" | "FAIL";
	actual: number;
	limit: number;
	unit: "bytes" | "requests" | "islands";
	attribution: readonly EngineBuildAttribution[];
}

export interface EngineBuildBudgetReport {
	status: "PASS" | "FAIL";
	results: readonly EngineBuildBudgetResult[];
	failures: readonly EngineBuildBudgetResult[];
}

const METRICS = Object.freeze([
	{ metric: "initial-js", key: "initialJS", unit: "bytes" },
	{ metric: "route-js", key: "routeJS", unit: "bytes" },
	{ metric: "critical-css", key: "criticalCSS", unit: "bytes" },
	{ metric: "request-count", key: "requestCount", unit: "requests" },
	{ metric: "hydrated-islands", key: "hydratedIslands", unit: "islands" },
] as const);

function assertMeasurement(name: string, value: number | undefined): asserts value is number {
	if (value === undefined || !Number.isFinite(value) || value < 0) {
		throw new Error(`[Next.js Engine] A finite non-negative ${name} measurement is required when its build budget is configured.`);
	}
}

export function evaluateEngineBuildBudgets(
	measurements: EngineBuildMeasurements,
	limits: EngineBuildBudgetLimits,
	attribution: Partial<Record<EngineBuildBudgetMetric, readonly EngineBuildAttribution[]>> = {},
): EngineBuildBudgetReport {
	const results: EngineBuildBudgetResult[] = [];
	for (const definition of METRICS) {
		const limit = limits[definition.key];
		if (limit === undefined) continue;
		assertMeasurement(definition.key, limit);
		const actual = measurements[definition.key];
		assertMeasurement(definition.key, actual);
		results.push(Object.freeze({
			metric: definition.metric,
			status: actual <= limit ? "PASS" as const : "FAIL" as const,
			actual,
			limit,
			unit: definition.unit,
			attribution: Object.freeze([...(attribution[definition.metric] ?? [])]
				.filter((entry) => Number.isFinite(entry.value) && entry.value >= 0)
				.sort((left, right) => right.value - left.value)),
		}));
	}
	const failures = Object.freeze(results.filter((result) => result.status === "FAIL"));
	return Object.freeze({
		status: failures.length === 0 ? "PASS" as const : "FAIL" as const,
		results: Object.freeze(results),
		failures,
	});
}

export function assertEngineBuildBudgets(report: EngineBuildBudgetReport): void {
	if (report.status === "PASS") return;
	const details = report.failures
		.map((failure) => `${failure.metric} ${failure.actual}/${failure.limit} ${failure.unit}`)
		.join(", ");
	throw new Error(`[Next.js Engine] Build budget failed: ${details}.`);
}
