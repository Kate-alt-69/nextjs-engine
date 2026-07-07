// ============================================================================
// EngineScrollPoints.ts
// ============================================================================

const registered =
	new Map<string, HTMLElement>();

export class EngineScrollPoints {

	// -------------------------------------------------------------------------

	public static register(
		name: string,
		element: HTMLElement,
	): void {

		registered.set(
			name,
			element,
		);

	}

	// -------------------------------------------------------------------------

	public static unregister(
		name: string,
	): void {

		registered.delete(name);

	}

	// -------------------------------------------------------------------------

	public static clear(): void {

		registered.clear();

	}

	// -------------------------------------------------------------------------

	public static get(
		name: string,
	): HTMLElement | undefined {

		return registered.get(name);

	}

	// -------------------------------------------------------------------------

	public static has(
		name: string,
	): boolean {

		return registered.has(name);

	}

	// -------------------------------------------------------------------------

	public static entries() {

		return registered.entries();

	}

}