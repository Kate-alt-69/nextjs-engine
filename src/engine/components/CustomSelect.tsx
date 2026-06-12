"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — CustomSelect
//
//  A fully styled, keyboard-navigable, accessible dropdown component.
//  Registered as "custom-select" in the component registry.
//
//  WHY NOT NATIVE <select>?
//  Native <select> menus are controlled by the OS, not the browser, meaning
//  styling is extremely limited on Windows and Android. For anything beyond a
//  simple dropdown, a custom implementation is the only reliable option.
//
//  FEATURES:
//    · Full keyboard navigation: Arrow Up/Down, Enter, Escape, Tab
//    · Screen reader support: role="listbox" + aria-selected + aria-expanded
//    · Optional search/filter (searchable prop)
//    · Optional clear button (clearable prop)
//    · Three sizes: sm, md, lg
//    · Uses engine CSS variables — matches your theme automatically
//    · Outputs a hidden <input type="hidden"> so forms still work
//    · Closes on outside click and on Escape
//    · Smooth open/close animation via CSS transforms + opacity
//
//  USAGE (schema):
//    {
//      type: "custom-select",
//      props: {
//        name: "country",
//        label: "Country",
//        placeholder: "Select a country",
//        options: [
//          { value: "us", label: "United States" },
//          { value: "uk", label: "United Kingdom" },
//          { value: "ca", label: "Canada", disabled: true },
//        ],
//        searchable: true,
//        clearable: true,
//        size: "md",
//      }
//    }
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	memo,
	useState,
	useRef,
	useEffect,
	useCallback,
	useId,
	type CSSProperties,
	type KeyboardEvent,
} from "react";
import type { CustomSelectProps, SelectOption } from "../schema/types";

// ── Size config ───────────────────────────────────────────────────────────────

const SIZE_CONFIG = {
	sm: { fontSize: "0.8125rem", padding: "0.5rem 0.75rem", borderRadius: "6px",  iconSize: 14 },
	md: { fontSize: "0.9375rem", padding: "0.75rem 1rem",   borderRadius: "8px",  iconSize: 16 },
	lg: { fontSize: "1.0625rem", padding: "1rem 1.25rem",   borderRadius: "10px", iconSize: 18 },
};

// ── ChevronIcon ───────────────────────────────────────────────────────────────

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
				flexShrink:  0,
				transition:  "transform 0.2s ease",
				transform:   open ? "rotate(180deg)" : "rotate(0deg)",
				color:       "var(--e-muted, #94a3b8)",
			}}
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

// ── ClearIcon ─────────────────────────────────────────────────────────────────

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
			<line x1="6"  y1="6" x2="18" y2="18" />
		</svg>
	);
}

// ── SearchIcon ────────────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export const CustomSelect = memo(function CustomSelect({
	name,
	label,
	options = [],
	placeholder = "Select an option…",
	defaultValue,
	searchable = false,
	clearable  = false,
	size       = "md",
	id: externalId,
	style,
	className,
}: CustomSelectProps) {
	const generatedId           = useId();
	const inputId               = externalId ?? `cs-${generatedId}`;
	const listboxId             = `${inputId}-listbox`;

	const [isOpen, setIsOpen]   = useState(false);
	const [selected, setSelected] = useState<SelectOption | null>(() =>
		defaultValue ? (options.find((o) => o.value === defaultValue) ?? null) : null,
	);
	const [search, setSearch]   = useState("");
	const [focusedIndex, setFocusedIndex] = useState(-1);

	const containerRef  = useRef<HTMLDivElement>(null);
	const searchRef     = useRef<HTMLInputElement>(null);
	const listRef       = useRef<HTMLDivElement>(null);

	const cfg = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;

	// ── Filtered options ──────────────────────────────────────────────────────

	const filteredOptions = searchable && search
		? options.filter((o) =>
				o.label.toLowerCase().includes(search.toLowerCase()),
		  )
		: options;

	// ── Open / close ──────────────────────────────────────────────────────────

	const open = useCallback((): void => {
		setIsOpen(true);
		setFocusedIndex(selected ? options.indexOf(selected) : 0);
		// Focus search input on next tick
		if (searchable) {
			setTimeout(() => searchRef.current?.focus(), 50);
		}
	}, [selected, options, searchable]);

	const close = useCallback((): void => {
		setIsOpen(false);
		setSearch("");
		setFocusedIndex(-1);
	}, []);

	const toggle = useCallback((): void => {
		isOpen ? close() : open();
	}, [isOpen, open, close]);

	// ── Select an option ──────────────────────────────────────────────────────

	const selectOption = useCallback((option: SelectOption): void => {
		if (option.disabled) return;
		setSelected(option);
		close();
	}, [close]);

	const clearSelection = useCallback((e: React.MouseEvent): void => {
		e.stopPropagation();
		setSelected(null);
		close();
	}, [close]);

	// ── Keyboard navigation ───────────────────────────────────────────────────

	const handleKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>): void => {
		switch (e.key) {
			case "Enter":
			case " ":
				e.preventDefault();
				toggle();
				break;
			case "ArrowDown":
				e.preventDefault();
				if (!isOpen) { open(); return; }
				setFocusedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				setFocusedIndex((prev) => Math.max(prev - 1, 0));
				break;
			case "Escape":
				close();
				break;
			case "Tab":
				close();
				break;
		}
	}, [toggle, isOpen, open, close, filteredOptions.length]);

	const handleListKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setFocusedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				setFocusedIndex((prev) => Math.max(prev - 1, 0));
				break;
			case "Enter":
				e.preventDefault();
				if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
					selectOption(filteredOptions[focusedIndex]);
				}
				break;
			case "Escape":
				close();
				break;
		}
	}, [filteredOptions, focusedIndex, selectOption, close]);

	// ── Scroll focused item into view ─────────────────────────────────────────

	useEffect(() => {
		if (!isOpen || focusedIndex < 0 || !listRef.current) return;
		const items = listRef.current.querySelectorAll<HTMLDivElement>("[data-option]");
		items[focusedIndex]?.scrollIntoView({ block: "nearest" });
	}, [focusedIndex, isOpen]);

	// ── Close on outside click ────────────────────────────────────────────────

	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: MouseEvent): void => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				close();
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [isOpen, close]);

	// ── Styles ────────────────────────────────────────────────────────────────

	const containerStyle: CSSProperties = {
		position:  "relative",
		width:     "100%",
		...style,
	};

	const labelStyle: CSSProperties = {
		display:      "block",
		marginBottom: "0.4rem",
		fontSize:     "0.8125rem",
		fontWeight:   500,
		color:        "var(--e-text-color, #30475f)",
		userSelect:   "none",
	};

	const triggerStyle: CSSProperties = {
		width:           "100%",
		padding:         cfg.padding,
		background:      "var(--e-card-bg, #ffffff)",
		border:          isOpen
			? "1.5px solid var(--e-accent, #4f46e5)"
			: "1.5px solid var(--e-divider, rgba(7,17,31,0.16))",
		borderRadius:    cfg.borderRadius,
		textAlign:       "left",
		display:         "flex",
		justifyContent:  "space-between",
		alignItems:      "center",
		gap:             "0.5rem",
		cursor:          "pointer",
		fontSize:        cfg.fontSize,
		color:           selected ? "var(--e-heading-color, #07111f)" : "var(--e-muted, #94a3b8)",
		boxShadow:       isOpen
			? "0 0 0 3px var(--e-accent-soft, rgba(79,70,229,0.15))"
			: "0 1px 3px rgba(0,0,0,.04)",
		transition:      "border-color 0.15s ease, box-shadow 0.15s ease",
		userSelect:      "none",
		outline:         "none",
		fontFamily:      "inherit",
	};

	const dropdownStyle: CSSProperties = {
		position:     "absolute",
		top:          "calc(100% + 6px)",
		left:         0,
		right:        0,
		background:   "var(--e-card-bg, #ffffff)",
		border:       "1.5px solid var(--e-divider, rgba(7,17,31,0.16))",
		borderRadius: cfg.borderRadius,
		boxShadow:    "0 12px 40px rgba(7,17,31,0.12), 0 2px 8px rgba(7,17,31,0.06)",
		zIndex:       200,
		overflow:     "hidden",
		transformOrigin: "top center",
		animation:    "e-select-open 0.15s ease forwards",
	};

	const listStyle: CSSProperties = {
		maxHeight:  "240px",
		overflowY:  "auto",
		padding:    "0.3rem",
	};

	const optionStyle = (option: SelectOption, index: number): CSSProperties => {
		const isSelected = selected?.value === option.value;
		const isFocused  = index === focusedIndex;
		return {
			padding:      "0.625rem 0.75rem",
			borderRadius: "6px",
			cursor:       option.disabled ? "not-allowed" : "pointer",
			fontSize:     cfg.fontSize,
			color:        option.disabled
				? "var(--e-muted, #94a3b8)"
				: isSelected
				? "var(--e-accent, #4f46e5)"
				: "var(--e-text-color, #30475f)",
			background:   isSelected
				? "var(--e-accent-soft, rgba(79,70,229,0.08))"
				: isFocused
				? "var(--e-hover-bg, rgba(7,17,31,0.04))"
				: "transparent",
			fontWeight:   isSelected ? 500 : 400,
			transition:   "background 0.1s ease, color 0.1s ease",
			display:      "flex",
			alignItems:   "center",
			gap:          "0.5rem",
			userSelect:   "none",
			opacity:      option.disabled ? 0.5 : 1,
		};
	};

	// Inject animation keyframes once
	useEffect(() => {
		if (typeof document === "undefined") return;
		if (document.getElementById("__e_select_css__")) return;
		const s = document.createElement("style");
		s.id = "__e_select_css__";
		s.textContent = `
			@keyframes e-select-open {
				from { opacity: 0; transform: scaleY(0.92) translateY(-4px); }
				to   { opacity: 1; transform: scaleY(1) translateY(0); }
			}
			.e-select-scroll::-webkit-scrollbar { width: 4px; }
			.e-select-scroll::-webkit-scrollbar-track { background: transparent; }
			.e-select-scroll::-webkit-scrollbar-thumb {
				background: var(--e-divider, rgba(7,17,31,0.16));
				border-radius: 4px;
			}
		`.trim();
		document.head.appendChild(s);
	}, []);

	return (
		<div
			ref={containerRef}
			className={className}
			style={containerStyle}
		>
			{label && (
				<label htmlFor={inputId} style={labelStyle}>
					{label}
				</label>
			)}

			{/* Trigger button */}
			<button
				id={inputId}
				type="button"
				role="combobox"
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-controls={listboxId}
				aria-label={label ?? placeholder}
				onClick={toggle}
				onKeyDown={handleKeyDown}
				style={triggerStyle}
			>
				<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
					{selected ? selected.label : placeholder}
				</span>

				<span style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
					{clearable && selected && (
						<span
							role="button"
							aria-label="Clear selection"
							onClick={clearSelection}
							style={{
								display:     "flex",
								alignItems:  "center",
								padding:     "2px",
								borderRadius: "4px",
								color:        "var(--e-muted, #94a3b8)",
								transition:   "color 0.15s",
							}}
							onMouseEnter={(e) => {
								(e.currentTarget as HTMLElement).style.color = "var(--e-heading-color, #07111f)";
							}}
							onMouseLeave={(e) => {
								(e.currentTarget as HTMLElement).style.color = "var(--e-muted, #94a3b8)";
							}}
						>
							<ClearIcon size={cfg.iconSize - 2} />
						</span>
					)}
					<ChevronIcon size={cfg.iconSize} open={isOpen} />
				</span>
			</button>

			{/* Dropdown */}
			{isOpen && (
				<div style={dropdownStyle} aria-hidden="false">
					{searchable && (
						<div
							style={{
								padding:      "0.5rem 0.5rem 0.25rem",
								borderBottom: "1px solid var(--e-divider, rgba(7,17,31,0.08))",
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--e-hover-bg, rgba(7,17,31,0.03))", borderRadius: "6px", padding: "0.375rem 0.625rem" }}>
								<SearchIcon size={cfg.iconSize - 2} />
								<input
									ref={searchRef}
									type="text"
									placeholder="Search…"
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setFocusedIndex(0);
									}}
									style={{
										border:      "none",
										outline:     "none",
										background:  "transparent",
										fontSize:    cfg.fontSize,
										color:       "var(--e-text-color, #30475f)",
										width:       "100%",
										fontFamily:  "inherit",
									}}
								/>
							</div>
						</div>
					)}

					<div
						id={listboxId}
						ref={listRef}
						role="listbox"
						aria-label={label ?? placeholder}
						className="e-select-scroll"
						style={listStyle}
						onKeyDown={handleListKeyDown}
						tabIndex={-1}
					>
						{filteredOptions.length === 0 ? (
							<div
								style={{
									padding:    "1rem",
									textAlign:  "center",
									color:      "var(--e-muted, #94a3b8)",
									fontSize:   cfg.fontSize,
									userSelect: "none",
								}}
							>
								No options found
							</div>
						) : (
							filteredOptions.map((option, index) => (
								<div
									key={option.value}
									data-option
									role="option"
									aria-selected={selected?.value === option.value}
									aria-disabled={option.disabled}
									onClick={() => selectOption(option)}
									onMouseEnter={() => setFocusedIndex(index)}
									style={optionStyle(option, index)}
								>
									{selected?.value === option.value && (
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
											stroke="currentColor" strokeWidth="3"
											strokeLinecap="round" strokeLinejoin="round"
											aria-hidden="true"
										>
											<polyline points="20 6 9 17 4 12" />
										</svg>
									)}
									{option.label}
								</div>
							))
						)}
					</div>
				</div>
			)}

			{/* Hidden form input */}
			<input
				type="hidden"
				name={name}
				value={selected?.value ?? ""}
			/>
		</div>
	);
});
