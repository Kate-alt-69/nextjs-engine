import type {
  EngineThemeDefinition,
  EngineThemeJsonObject,
  EngineThemeJsonValue,
  EngineThemeScope,
  EngineTheme,
} from "../schema/types";

const MAX_THEME_DEPTH = 32;
const MAX_THEME_NODES = 10_000;
const MAX_THEME_LENGTH = 512 * 1024;
const GROUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

interface RegisteredTheme {
  definition: Readonly<EngineThemeDefinition>;
  canonical: string;
}

export interface ResolvedEngineThemeGroup {
  group: Readonly<EngineThemeDefinition>;
  componentId?: string;
  components: Record<string, EngineThemeJsonObject>;
}

const globalThemes = new Map<string, RegisteredTheme>();
const NON_COMPONENT_KEYS = new Set([
  "id", "scope", "sourceUrl", "name", "metadata", "version",
  "vars", "fonts", "globalStyles", "tokens", "components",
]);

function isJsonObject(value: unknown): value is EngineThemeJsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalThemeJson(value: EngineThemeJsonValue | EngineThemeDefinition): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((item) => canonicalThemeJson(item)).join(",") + "]";
  const record = value as Record<string, EngineThemeJsonValue>;
  return "{" + Object.keys(record).sort().map((key) =>
    JSON.stringify(key) + ":" + canonicalThemeJson(record[key])).join(",") + "}";
}

function mergeThemeObjects(base: EngineThemeJsonObject, overlay: EngineThemeJsonObject): EngineThemeJsonObject {
  const merged: Record<string, EngineThemeJsonValue> = { ...base };
  for (const key of Object.keys(overlay)) {
    const previous = merged[key];
    const next = overlay[key];
    // Syntax palettes are complete replacements by contract. Inheriting
    // unspecified token colors from a parent palette would violate that rule.
    merged[key] = key !== "palette" && isJsonObject(previous) && isJsonObject(next)
      ? mergeThemeObjects(previous, next)
      : next;
  }
  return merged;
}

function getGroupComponents(group: EngineTheme): Record<string, EngineThemeJsonObject> {
  const components: Record<string, EngineThemeJsonObject> = Object.create(null);
  if (isJsonObject(group.components)) {
    for (const [name, definition] of Object.entries(group.components)) {
      if (isJsonObject(definition)) components[name] = definition;
    }
  }
  for (const [name, definition] of Object.entries(group)) {
    if (NON_COMPONENT_KEYS.has(name) || !isJsonObject(definition)) continue;
    components[name] = definition;
  }
  return components;
}

/** Return a group's direct component namespaces without performing resolution. */
export function getEngineThemeComponentDefinitions(theme: EngineTheme): Record<string, EngineThemeJsonObject> {
  return getGroupComponents(theme);
}

/**
 * Resolve an ID-only PageSchema reference against globally registered theme
 * groups. This is deliberately synchronous and performs no network access.
 */
export function resolveRegisteredEngineTheme(id: string): ResolvedEngineThemeGroup {
  const parsed = parseEngineThemeId(id);
  const registered = globalThemes.get(parsed.groupId);
  if (!registered) {
    throw new Error(
      "EngineTheme group '" + parsed.groupId + "' is not globally registered. "
      + "Import its createTheme() definition before creating the page. Remote URL resolution is handled separately.",
    );
  }
  const group = registered.definition;
  if (group.scope !== "global") {
    throw new Error("EngineTheme ID references require scope global; local themes must be supplied as theme objects.");
  }

  if (!parsed.componentId) {
    return { group, components: getGroupComponents(group) };
  }

  const groupRecord = group as Record<string, unknown>;
  const rawComponent = groupRecord[parsed.componentId]
    ?? (isJsonObject(group.components) ? group.components[parsed.componentId] : undefined);
  if (!isJsonObject(rawComponent)) {
    throw new Error("EngineTheme '" + id + "' references missing component '" + parsed.componentId + "'.");
  }

  let activeVariant: EngineThemeJsonObject = rawComponent;
  let merged: EngineThemeJsonObject = { ...rawComponent };
  for (const segment of parsed.subthemes) {
    const variants = activeVariant.variants;
    const variant = isJsonObject(variants) ? variants[segment] : undefined;
    if (!isJsonObject(variant)) {
      throw new Error("EngineTheme '" + id + "' references missing subtheme '" + segment + "'.");
    }
    merged = mergeThemeObjects(merged, variant);
    activeVariant = variant;
  }
  delete merged.variants;

  return {
    group,
    componentId: parsed.componentId,
    components: { [parsed.componentId]: merged },
  };
}

export interface ParsedEngineThemeId {
  groupId: string;
  componentId?: string;
  subthemes: string[];
}

/**
 * Parse a group or qualified component-theme ID.
 *
 * Grammar: <group>[.<component>[.<subtheme>...]]
 * A component can have at most three subtheme segments.
 */
export function parseEngineThemeId(id: string): ParsedEngineThemeId {
  if (typeof id !== "string" || id.length === 0 || id.length > 240) {
    throw new TypeError("EngineTheme ID must be a non-empty string of at most 240 characters.");
  }

  const segments = id.split(".");
  if (segments.some((segment) => !SEGMENT_PATTERN.test(segment) || DANGEROUS_KEYS.has(segment))) {
    throw new TypeError("Invalid EngineTheme ID: use dot-separated alphanumeric, underscore, or hyphen segments.");
  }
  if (segments.length > 5) {
    throw new TypeError("EngineTheme ID supports a component plus at most three subtheme segments.");
  }

  return {
    groupId: segments[0],
    ...(segments.length >= 2 ? { componentId: segments[1] } : {}),
    subthemes: segments.slice(2),
  };
}

function assertJsonData(
  value: unknown,
  path: string,
  state: { nodes: number; active: Set<object> },
  depth: number,
): void {
  state.nodes += 1;
  if (state.nodes > MAX_THEME_NODES) {
    throw new TypeError("EngineTheme exceeds the maximum of " + MAX_THEME_NODES + " values.");
  }
  if (depth > MAX_THEME_DEPTH) {
    throw new TypeError("EngineTheme nesting exceeds " + MAX_THEME_DEPTH + " levels at " + path + ".");
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("EngineTheme contains a non-finite number at " + path + ".");
    return;
  }
  if (typeof value !== "object") {
    throw new TypeError("EngineTheme must be JSON data; unsupported value at " + path + ".");
  }

  const object = value as object;
  if (state.active.has(object)) {
    throw new TypeError("EngineTheme contains a cyclic reference at " + path + ".");
  }
  const prototype = Object.getPrototypeOf(object);
  if (!Array.isArray(object) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("EngineTheme values must use plain objects or arrays at " + path + ".");
  }
  if (Object.getOwnPropertySymbols(object).length > 0) {
    throw new TypeError("EngineTheme cannot contain symbol keys at " + path + ".");
  }

  state.active.add(object);
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      throw new TypeError("EngineTheme arrays cannot have extra properties or sparse entries at " + path + ".");
    }
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new TypeError("EngineTheme arrays cannot contain holes at " + path + ".");
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) {
        throw new TypeError("EngineTheme arrays cannot contain accessors at " + path + "[" + index + "].");
      }
      assertJsonData(descriptor.value, path + "[" + index + "]", state, depth + 1);
    }
  } else {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(key)) {
        throw new TypeError("EngineTheme contains a reserved property name at " + path + "." + key + ".");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) {
        throw new TypeError("EngineTheme cannot contain accessors at " + path + "." + key + ".");
      }
      assertJsonData(descriptor.value, path + "." + key, state, depth + 1);
    }
  }
  state.active.delete(object);
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Define a serializable theme group. Construction performs local validation
 * only: it never fetches URLs, downloads assets, publishes the theme, or
 * evaluates code. NENC extracts statically resolvable calls into .etr files.
 */
export function createTheme<T extends EngineThemeDefinition>(
  definition: T,
): Readonly<T & { scope: EngineThemeScope }> {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new TypeError("createTheme() expects a plain theme definition object.");
  }

  // Validate before reading properties so getters cannot execute during
  // construction; themes are plain data, not user-defined runtime objects.
  assertJsonData(definition, "theme", { nodes: 0, active: new Set<object>() }, 0);
  const candidate = definition as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !GROUP_ID_PATTERN.test(candidate.id) || DANGEROUS_KEYS.has(candidate.id)) {
    throw new TypeError("createTheme() requires a group ID without dots, such as mycoolthemes.");
  }

  const scope = candidate.scope === undefined ? "local" : candidate.scope;
  if (scope !== "local" && scope !== "global" && scope !== "remote") {
    throw new TypeError("EngineTheme scope must be local, global, or remote.");
  }

  const normalized = { ...definition, scope } as T & { scope: EngineThemeScope };

  let serialized: string;
  try {
    serialized = JSON.stringify(normalized);
  } catch {
    throw new TypeError("EngineTheme could not be serialized as JSON data.");
  }
  if (serialized.length > MAX_THEME_LENGTH) {
    throw new TypeError("EngineTheme exceeds the " + MAX_THEME_LENGTH + "-character size limit.");
  }

  // Clone once so later mutations to the caller's object cannot change a
  // registered/build-time definition. Themes are generally created once at
  // module initialization, so this bounded copy is cheaper than runtime work.
  const clone = JSON.parse(serialized) as T & { scope: EngineThemeScope };
  const frozen = freezeDeep(clone);

  if (scope === "global") {
    const canonical = canonicalThemeJson(frozen);
    const existing = globalThemes.get(frozen.id);
    if (existing && existing.canonical !== canonical) {
      throw new Error("EngineTheme group ID '" + frozen.id + "' is already registered with a different definition.");
    }
    if (!existing) {
      globalThemes.set(frozen.id, {
        definition: frozen as Readonly<EngineThemeDefinition>,
        canonical,
      });
    }
  }

  return frozen;
}
