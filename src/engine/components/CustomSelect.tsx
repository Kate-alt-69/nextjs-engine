"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — CustomSelect
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	memo,
	useState,
	useRef,
	useEffect,
	useCallback,
	useId,
	useMemo,
	type CSSProperties,
	type KeyboardEvent,
} from "react";
import type { CustomSelectProps, SelectOption } from "../schema/types";
import { useCpropClass } from "../hooks/usePropStyles";
import { usePrimitiveStyles } from "../hooks/usePrimitiveStyles";
import { useHandler } from "../providers/EngineProvider";

const SIZE_CONFIG = {
	sm: { fontSize: "0.8125rem", padding: "0.5rem 0.75rem", borderRadius: "6px", iconSize: 14 },
	md: { fontSize: "0.9375rem", padding: "0.75rem 1rem", borderRadius: "8px", iconSize: 16 },
	lg: { fontSize: "1.0625rem", padding: "1rem 1.25rem", borderRadius: "10px", iconSize: 18 },
};

function ChevronIcon({ size, open }: { size: number; open: boolean }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			style={{
				flexShrink: 0,
				transition: "transform 0.2s ease",
				transform: open ? "rotate(180deg)" : "rotate(0deg)",
				color: "var(--e-muted, #94a3b8)",
			}}
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

function ClearIcon({ size }: { size: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			aria-hidden="true"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

function SearchIcon({ size }: { size: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			style={{ color: "var(--e-muted, #94a3b8)", flexShrink: 0 }}
		>
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	);
}

function firstEnabledIndex(options: SelectOption[]): number {
	return options.findIndex((option) => !option.disabled);
}

function filterOptions(options: SelectOption[], searchable: boolean, search: string): SelectOption[] {
	const query = search.trim().toLowerCase();
	if (!searchable || !query) return options;
	return options.filter((option) => option.label.toLowerCase().includes(query));
}

function nextEnabledIndex(
	options: SelectOption[],
	currentIndex: number,
	direction: 1 | -1,
): number {
	if (options.length === 0) return -1;
	let index = currentIndex;
	for (let attempts = 0; attempts < options.length; attempts++) {
		index = Math.max(0, Math.min(options.length - 1, index + direction));
		if (!options[index]?.disabled) return index;
		if ((direction === 1 && index === options.length - 1) || (direction === -1 && index === 0)) break;
	}
	return currentIndex;
}

export const CustomSelect = memo(function CustomSelect({
	name,
	label,
	options = [],
	placeholder = "Select an option…",
	defaultValue,
	onChange,
	searchable = false,
	clearable = false,
	size = "md",
	id: externalId,
	point,
	style,
	className,
	cprop,
	...props
}: CustomSelectProps) {
	const generatedId = useId();
	const resolvedId = externalId ?? point;
	const internalBaseId = resolvedId
		? `${resolvedId}-custom-select`
		: `cs-${generatedId.replace(/:/g, "")}`;
	const triggerId = `${internalBaseId}-trigger`;
	const listboxId = `${internalBaseId}-listbox`;
	const changeHandler = useHandler(onChange ?? "");

	const [isOpen, setIsOpen] = useState(false);
	const [selected, setSelected] = useState<SelectOption | null>(() =>
		defaultValue !== undefined
			? (options.find((option) => option.value === defaultValue) ?? null)
			: null,
	);
	const [search, setSearch] = useState("");
	const [focusedIndex, setFocusedIndex] = useState(-1);

	const containerRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const cfg = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;

	const filteredOptions = useMemo(
		() => filterOptions(options, searchable, search),
		[options, searchable, search],
	);
	const activeOptionId = isOpen && focusedIndex >= 0 && filteredOptions[focusedIndex]
		? `${listboxId}-option-${focusedIndex}`
		: undefined;

	const open = useCallback((): void => {
		setIsOpen(true);
		const selectedIndex = selected
			? options.findIndex((option) => option.value === selected.value && !option.disabled)
			: -1;
		setFocusedIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options));
		if (searchable) window.setTimeout(() => searchRef.current?.focus(), 0);
	}, [selected, options, searchable]);

	const close = useCallback((): void => {
		setIsOpen(false);
		setSearch("");
		setFocusedIndex(-1);
	}, []);

	const toggle = useCallback((): void => {
		if (isOpen) close();
		else open();
	}, [isOpen, open, close]);

	const selectOption = useCallback((option: SelectOption): void => {
		if (option.disabled) return;
		setSelected(option);
		changeHandler?.(option.value, option);
		close();
	}, [changeHandler, close]);

	const clearSelection = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		event.preventDefault();
		setSelected(null);
		changeHandler?.("", null);
		close();
	}, [changeHandler, close]);

	const moveFocus = useCallback((direction: 1 | -1): void => {
		setFocusedIndex((previousIndex) => {
			if (previousIndex < 0) return firstEnabledIndex(filteredOptions);
			return nextEnabledIndex(filteredOptions, previousIndex, direction);
		});
	}, [filteredOptions]);

	const activateFocused = useCallback((): void => {
		if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
			selectOption(filteredOptions[focusedIndex]);
		}
	}, [filteredOptions, focusedIndex, selectOption]);

	const handleNavigationKey = useCallback((key: string): boolean => {
		if (key === "ArrowDown") {
			moveFocus(1);
			return true;
		}
		if (key === "ArrowUp") {
			moveFocus(-1);
			return true;
		}
		if (key === "Enter") {
			activateFocused();
			return true;
		}
		if (key === "Escape") {
			close();
			return true;
		}
		return false;
	}, [moveFocus, activateFocused, close]);

	const handleTriggerKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>): void => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			if (isOpen) activateFocused();
			else open();
			return;
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (!isOpen) open();
			else moveFocus(event.key === "ArrowDown" ? 1 : -1);
			return;
		}
		if (event.key === "Escape") close();
		if (event.key === "Tab") close();
	}, [isOpen, activateFocused, open, close, moveFocus]);

	const handleListKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>): void => {
		if (handleNavigationKey(event.key)) event.preventDefault();
	}, [handleNavigationKey]);

	const handleSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>): void => {
		if (handleNavigationKey(event.key)) event.preventDefault();
	}, [handleNavigationKey]);

	useEffect(() => {
		if (!isOpen || focusedIndex < 0 || !listRef.current) return;
		const items = listRef.current.querySelectorAll<HTMLElement>("[data-option]");
		items[focusedIndex]?.scrollIntoView({ block: "nearest" });
	}, [focusedIndex, isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const handleOutsideClick = (event: MouseEvent): void => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) close();
		};
		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, [isOpen, close]);

	useEffect(() => {
		if (typeof document === "undefined" || document.getElementById("__e_select_css__")) return;
		const styleElement = document.createElement("style");
		styleElement.id = "__e_select_css__";
		styleElement.textContent = `
			@keyframes e-select-open {
				from { opacity: 0; transform: scaleY(0.92) translateY(-4px); }
				to { opacity: 1; transform: scaleY(1) translateY(0); }
			}
			.e-select-scroll::-webkit-scrollbar { width: 4px; }
			.e-select-scroll::-webkit-scrollbar-track { background: transparent; }
			.e-select-scroll::-webkit-scrollbar-thumb {
				background: var(--e-divider, rgba(7,17,31,0.16));
				border-radius: 4px;
			}
			@media (prefers-reduced-motion: reduce) {
				.e-select-dropdown { animation: none !important; }
			}
		`.trim();
		document.head.appendChild(styleElement);
	}, []);

	const containerStyle = usePrimitiveStyles(props as any, {
		defaults: {
			position: "relative",
			width: "100%",
		},
		style,
	});
	const stateClass = useCpropClass(cprop);
	const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;

	const labelStyle: CSSProperties = {
		display: "block",
		marginBottom: "0.4rem",
		fontSize: "0.8125rem",
		fontWeight: 500,
		color: "var(--e-text-color, #30475f)",
		userSelect: "none",
	};

	const triggerStyle: CSSProperties = {
		width: "100%",
		padding: cfg.padding,
		background: "var(--e-card-bg, #ffffff)",
		border: isOpen
			? "1.5px solid var(--e-accent, #4f46e5)"
			: "1.5px solid var(--e-divider, rgba(7,17,31,0.16))",
		borderRadius: cfg.borderRadius,
		textAlign: "left",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		gap: "0.5rem",
		cursor: "pointer",
		fontSize: cfg.fontSize,
		color: selected ? "var(--e-heading-color, #07111f)" : "var(--e-muted, #94a3b8)",
		boxShadow: isOpen
			? "0 0 0 3px var(--e-accent-soft, rgba(79,70,229,0.15))"
			: "0 1px 3px rgba(0,0,0,.04)",
		transition: "border-color 0.15s ease, box-shadow 0.15s ease",
		userSelect: "none",
		outline: "none",
		fontFamily: "inherit",
	};

	const clearButtonStyle: CSSProperties = {
		border: "1.5px solid var(--e-divider, rgba(7,17,31,0.16))",
		borderRadius: cfg.borderRadius,
		background: "var(--e-card-bg, #ffffff)",
		color: "var(--e-muted, #94a3b8)",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: "0 0.7rem",
		fontFamily: "inherit",
	};

	const dropdownStyle: CSSProperties = {
		position: "absolute",
		top: "calc(100% + 6px)",
		left: 0,
		right: 0,
		background: "var(--e-card-bg, #ffffff)",
		border: "1.5px solid var(--e-divider, rgba(7,17,31,0.16))",
		borderRadius: cfg.borderRadius,
		boxShadow: "0 12px 40px rgba(7,17,31,0.12), 0 2px 8px rgba(7,17,31,0.06)",
		zIndex: 200,
		overflow: "hidden",
		transformOrigin: "top center",
		animation: "e-select-open 0.15s ease forwards",
	};

	const listStyle: CSSProperties = {
		maxHeight: "240px",
		overflowY: "auto",
		padding: "0.3rem",
	};

	const optionStyle = (option: SelectOption, index: number): CSSProperties => {
		const isSelected = selected?.value === option.value;
		const isFocused = index === focusedIndex;
		return {
			padding: "0.625rem 0.75rem",
			borderRadius: "6px",
			cursor: option.disabled ? "not-allowed" : "pointer",
			fontSize: cfg.fontSize,
			color: option.disabled
				? "var(--e-muted, #94a3b8)"
				: isSelected
					? "var(--e-accent, #4f46e5)"
					: "var(--e-text-color, #30475f)",
			background: isSelected
				? "var(--e-accent-soft, rgba(79,70,229,0.08))"
				: isFocused
					? "var(--e-hover-bg, rgba(7,17,31,0.04))"
					: "transparent",
			fontWeight: isSelected ? 500 : 400,
			transition: "background 0.1s ease, color 0.1s ease",
			display: "flex",
			alignItems: "center",
			gap: "0.5rem",
			userSelect: "none",
			opacity: option.disabled ? 0.5 : 1,
		};
	};

	return (
		<div ref={containerRef} id={resolvedId} className={mergedClass} style={containerStyle}>
			{label && <label htmlFor={triggerId} style={labelStyle}>{label}</label>}

			<div
				style={{
					display: "grid",
					gridTemplateColumns: clearable && selected ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
					gap: "0.375rem",
				}}
			>
				<button
					id={triggerId}
					type="button"
					role="combobox"
					aria-haspopup="listbox"
					aria-expanded={isOpen}
					aria-controls={listboxId}
					aria-activedescendant={activeOptionId}
					aria-label={label ?? placeholder}
					onClick={toggle}
					onKeyDown={handleTriggerKeyDown}
					style={triggerStyle}
				>
					<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
						{selected ? selected.label : placeholder}
					</span>
					<ChevronIcon size={cfg.iconSize} open={isOpen} />
				</button>

				{clearable && selected && (
					<button
						type="button"
						aria-label="Clear selection"
						onClick={clearSelection}
						style={clearButtonStyle}
					>
						<ClearIcon size={cfg.iconSize - 2} />
					</button>
				)}
			</div>

			{isOpen && (
				<div className="e-select-dropdown" style={dropdownStyle}>
					{searchable && (
						<div style={{ padding: "0.5rem 0.5rem 0.25rem", borderBottom: "1px solid var(--e-divider, rgba(7,17,31,0.08))" }}>
							<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--e-hover-bg, rgba(7,17,31,0.03))", borderRadius: "6px", padding: "0.375rem 0.625rem" }}>
								<SearchIcon size={cfg.iconSize - 2} />
								<input
									ref={searchRef}
									type="text"
									placeholder="Search…"
									value={search}
									aria-label={`Search ${label ?? name}`}
									aria-controls={listboxId}
									aria-activedescendant={activeOptionId}
									onChange={(event) => {
										const nextSearch = event.target.value;
										setSearch(nextSearch);
										setFocusedIndex(firstEnabledIndex(filterOptions(options, searchable, nextSearch)));
									}}
									onKeyDown={handleSearchKeyDown}
									style={{ border: "none", outline: "none", background: "transparent", fontSize: cfg.fontSize, color: "var(--e-text-color, #30475f)", width: "100%", fontFamily: "inherit" }}
								/>
							</div>
						</div>
					)}

					<div
						id={listboxId}
						ref={listRef}
						role="listbox"
						aria-label={label ?? placeholder}
						aria-activedescendant={activeOptionId}
						className="e-select-scroll"
						style={listStyle}
						onKeyDown={handleListKeyDown}
						tabIndex={-1}
					>
						{filteredOptions.length === 0 ? (
							<div style={{ padding: "1rem", textAlign: "center", color: "var(--e-muted, #94a3b8)", fontSize: cfg.fontSize, userSelect: "none" }}>
								No options found
							</div>
						) : filteredOptions.map((option, index) => (
							<div
								id={`${listboxId}-option-${index}`}
								key={`${option.value}:${index}`}
								data-option
								role="option"
								aria-selected={selected?.value === option.value}
								aria-disabled={option.disabled}
								onClick={() => selectOption(option)}
								onMouseEnter={() => !option.disabled && setFocusedIndex(index)}
								style={optionStyle(option, index)}
							>
								{selected?.value === option.value && (
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
										<polyline points="20 6 9 17 4 12" />
									</svg>
								)}
								{option.label}
							</div>
						))}
					</div>
				</div>
			)}

			<input
				type="hidden"
				name={name}
				value={selected?.value ?? ""}
				data-engine-bind={name}
			/>
		</div>
	);
});
