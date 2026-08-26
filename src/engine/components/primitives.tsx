"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Built-in Components
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	forwardRef,
	memo,
	type ReactNode,
	type CSSProperties,
	type ElementType,
} from "react";
import type {
	BoxProps,
	StackProps,
	GridProps,
	TextProps,
	TextPart,
	TextVariant,
	HeadingProps,
	SectionProps,
	ButtonProps,
	SpacerProps,
	DividerProps,
	CardProps,
	SlotProps,
	OptionProps,
	OptGroupProps,
	ResponsiveValue,
} from "../schema/types";
import { usePropStyles, cpropClass, staticClass } from "../hooks/usePropStyles";
import { useEngineContext, useHandler } from "../providers/EngineProvider";

interface HrefWrapperProps {
	href: string;
	children: ReactNode;
}

function HrefWrapper({ href, children }: HrefWrapperProps) {
	const isExternal = /^https?:\/\//.test(href);
	return (
		<a
			href={href}
			target={isExternal ? "_blank" : undefined}
			rel={isExternal ? "noopener noreferrer" : undefined}
			style={{ display: "contents", textDecoration: "none", color: "inherit" }}
		>
			{children}
		</a>
	);
}

function useNodeClickHandler(handlerName: string | undefined) {
	const handler = useHandler(handlerName ?? "");
	return handler
		? (event: React.MouseEvent<HTMLElement>) => handler(event)
		: undefined;
}

function normalizeStackDirection(
	direction: StackProps["direction"],
): ResponsiveValue<CSSProperties["flexDirection"]> {
	if (direction && typeof direction === "object" && !Array.isArray(direction)) {
		return Object.fromEntries(
			Object.entries(direction).map(([breakpoint, value]) => [
				breakpoint,
				value === "horizontal" ? "row" : "column",
			]),
		) as ResponsiveValue<CSSProperties["flexDirection"]>;
	}
	return direction === "horizontal" ? "row" : "column";
}

function normalizeFullWidth(
	fullWidth: ButtonProps["fullWidth"],
): ResponsiveValue<string> | undefined {
	if (fullWidth === undefined) return undefined;
	if (typeof fullWidth === "boolean") return fullWidth ? "100%" : "auto";
	return Object.fromEntries(
		Object.entries(fullWidth).map(([breakpoint, value]) => [breakpoint, value ? "100%" : "auto"]),
	) as ResponsiveValue<string>;
}

// ── Box ───────────────────────────────────────────────────────────────────────

export interface EngineBoxProps extends BoxProps {
	children?: ReactNode;
	as?: ElementType;
}

export const EngineBox = memo(
	forwardRef<HTMLElement, EngineBoxProps>(function EngineBox(
		{
			children,
			as: Tag = "div",
			style,
			className,
			id,
			point,
			href,
			cprop,
			onClick,
			...props
		},
		ref,
	) {
		const resolvedStyle = usePropStyles(props as any, style);
		const stateClass = cpropClass(cprop);
		const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point;
		const clickHandler = useNodeClickHandler(onClick);

		const element = (
			<Tag
				ref={ref}
				id={resolvedId}
				className={mergedClass}
				style={resolvedStyle}
				onClick={clickHandler}
			>
				{children}
			</Tag>
		);

		return href ? <HrefWrapper href={href}>{element}</HrefWrapper> : element;
	}),
);

// ── Stack ─────────────────────────────────────────────────────────────────────

export interface EngineStackProps extends StackProps {
	children?: ReactNode;
}

export const EngineStack = memo(
	forwardRef<HTMLDivElement, EngineStackProps>(function EngineStack(
		{
			children,
			direction = "vertical",
			gap,
			align,
			justify,
			wrap,
			dividers = false,
			style,
			className,
			id,
			point,
			href,
			cprop,
			onClick,
			...props
		},
		ref,
	) {
		const resolvedStyle = usePropStyles(
			{
				flexDir: normalizeStackDirection(direction),
				gap,
				align,
				justify,
				...props,
			} as any,
			{
				display: "flex",
				...(wrap ? { flexWrap: "wrap" } : {}),
				...style,
			},
		);
		const stateClass = cpropClass(cprop);
		const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point;
		const clickHandler = useNodeClickHandler(onClick);
		const childArray = React.Children.toArray(children);

		const element = (
			<div
				ref={ref}
				id={resolvedId}
				className={mergedClass}
				style={resolvedStyle}
				onClick={clickHandler}
			>
				{dividers
					? childArray.map((child, index) => (
						<React.Fragment key={index}>
							{child}
							{index < childArray.length - 1 && (
								<hr
									style={{
										border: "none",
										borderTop: "1px solid var(--e-divider, rgba(0,0,0,.1))",
										margin: 0,
									}}
								/>
							)}
						</React.Fragment>
					))
					: children}
			</div>
		);

		return href ? <HrefWrapper href={href}>{element}</HrefWrapper> : element;
	}),
);

// ── Grid ──────────────────────────────────────────────────────────────────────

export interface EngineGridProps extends GridProps {
	children?: ReactNode;
}

export const EngineGrid = memo(
	forwardRef<HTMLDivElement, EngineGridProps>(function EngineGrid(
		{
			children,
			columns = 1,
			rows,
			gap,
			colGap,
			rowGap,
			align,
			justify,
			autoFit = false,
			minColWidth = "200px",
			style,
			className,
			id,
			point,
			href,
			cprop,
			onClick,
			...props
		},
		ref,
	) {
		const resolvedColumns = autoFit
			? `repeat(auto-fit, minmax(${minColWidth}, 1fr))`
			: columns;
		const resolvedStyle = usePropStyles(
			{
				columns: resolvedColumns as any,
				rows: rows as any,
				gap,
				colGap,
				rowGap,
				align,
				justify,
				...props,
			} as any,
			{ display: "grid", ...style },
		);
		const stateClass = cpropClass(cprop);
		const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point;
		const clickHandler = useNodeClickHandler(onClick);

		const element = (
			<div
				ref={ref}
				id={resolvedId}
				className={mergedClass}
				style={resolvedStyle}
				onClick={clickHandler}
			>
				{children}
			</div>
		);

		return href ? <HrefWrapper href={href}>{element}</HrefWrapper> : element;
	}),
);

// ── Text ──────────────────────────────────────────────────────────────────────

const VARIANT_TAG: Record<TextVariant, ElementType> = {
	h1: "h1",
	h2: "h2",
	h3: "h3",
	h4: "h4",
	h5: "h5",
	h6: "h6",
	body: "p",
	"body-sm": "p",
	lead: "p",
	caption: "span",
	label: "label",
	mono: "code",
	overline: "span",
};

const VARIANT_STYLE: Record<TextVariant, CSSProperties> = {
	h1: { fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" },
	h2: { fontSize: "clamp(1.5rem, 4vw, 2.5rem)", fontWeight: 700, lineHeight: 1.2 },
	h3: { fontSize: "clamp(1.25rem, 3vw, 1.875rem)", fontWeight: 600, lineHeight: 1.3 },
	h4: { fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", fontWeight: 600, lineHeight: 1.4 },
	h5: { fontSize: "1.125rem", fontWeight: 600 },
	h6: { fontSize: "1rem", fontWeight: 600 },
	body: { fontSize: "1rem", lineHeight: 1.6 },
	"body-sm": { fontSize: "0.875rem", lineHeight: 1.6 },
	lead: { fontSize: "1.25rem", lineHeight: 1.7, fontWeight: 400 },
	caption: { fontSize: "0.75rem", lineHeight: 1.5, color: "var(--e-caption-color, #64748b)" },
	label: { fontSize: "0.875rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
	mono: { fontFamily: "var(--e-font-mono, monospace)", fontSize: "0.9em", background: "var(--e-code-bg, rgba(0,0,0,.06))", padding: "0.1em 0.3em", borderRadius: "4px" },
	overline: { fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" },
};

export interface EngineTextProps extends TextProps {
	children?: ReactNode;
}

function renderPart(part: TextPart, index: number): ReactNode {
	if (part.href) {
		const isExternal = part.href.startsWith("http://") || part.href.startsWith("https://");
		const target = part.target ?? (isExternal ? "_blank" : "_self");
		const rel = target === "_blank" || isExternal
			? (part.rel ?? "noopener noreferrer")
			: part.rel;
		return (
			<a key={index} href={part.href} target={target} rel={rel} style={part.style}>
				{part.text}
			</a>
		);
	}
	return part.style
		? <span key={index} style={part.style}>{part.text}</span>
		: part.text;
}

export const EngineText = memo(
	forwardRef<HTMLElement, EngineTextProps>(function EngineText(
		{
			children,
			variant = "body",
			content,
			parts,
			as,
			size,
			weight,
			align,
			lineHeight,
			letterSpacing,
			truncate,
			italic,
			underline,
			gradient,
			style,
			className,
			id,
			point,
			href,
			cprop,
			onClick,
			...props
		},
		ref,
	) {
		const Tag = (as ?? VARIANT_TAG[variant] ?? "p") as ElementType;
		const variantBaseStyle = VARIANT_STYLE[variant] ?? {};
		const truncateStyle: CSSProperties = truncate === true
			? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
			: typeof truncate === "number"
				? {
					overflow: "hidden",
					display: "-webkit-box",
					WebkitLineClamp: truncate,
					WebkitBoxOrient: "vertical",
				}
				: {};
		const gradientStyle: CSSProperties = gradient
			? {
				backgroundImage: gradient,
				WebkitBackgroundClip: "text",
				WebkitTextFillColor: "transparent",
				backgroundClip: "text",
			}
			: {};
		const resolvedStyle = usePropStyles(
			{
				size,
				weight,
				align,
				lineHeight,
				letterSpacing,
				...props,
			} as any,
			{
				...variantBaseStyle,
				...(italic ? { fontStyle: "italic" } : {}),
				...(underline ? { textDecoration: "underline" } : {}),
				...truncateStyle,
				...gradientStyle,
				...style,
			},
		);
		const stateClass = cpropClass(cprop);
		const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point;
		const clickHandler = useNodeClickHandler(onClick);
		const renderedContent: ReactNode = parts && parts.length > 0
			? parts.map(renderPart)
			: (content ?? children);

		const element = (
			<Tag
				ref={ref}
				id={resolvedId}
				className={mergedClass}
				style={resolvedStyle}
				onClick={clickHandler}
			>
				{renderedContent}
			</Tag>
		);

		return href ? <HrefWrapper href={href}>{element}</HrefWrapper> : element;
	}),
);

// ── Heading ───────────────────────────────────────────────────────────────────

export interface EngineHeadingProps extends HeadingProps {
	children?: ReactNode;
}

export const EngineHeading = memo(function EngineHeading({
	level = 2,
	subheading,
	subheadingProps,
	children,
	content,
	...props
}: EngineHeadingProps) {
	const variant = `h${level}` as TextVariant;
	return (
		<>
			<EngineText variant={variant} content={content} {...props}>
				{children}
			</EngineText>
			{subheading && (
				<EngineText variant="lead" color="var(--e-muted, #64748b)" mt="0.5rem" {...subheadingProps}>
					{subheading}
				</EngineText>
			)}
		</>
	);
});

// ── Section ───────────────────────────────────────────────────────────────────

export interface EngineSectionProps extends SectionProps {
	children?: ReactNode;
}

export const EngineSection = memo(
	forwardRef<HTMLElement, EngineSectionProps>(function EngineSection(
		{
			children,
			contentMaxWidth = "1200px",
			centered = true,
			fullViewport = false,
			snapAlign,
			style,
			className,
			id,
			point,
			href,
			cprop,
			onClick,
			px,
			py,
			...props
		},
		ref,
	) {
		const innerLayoutClass = staticClass({
			width: "100%",
			...(centered ? { marginLeft: "auto", marginRight: "auto" } : {}),
		});
		const resolvedOuter = usePropStyles(props as any, {
			width: "100%",
			...(fullViewport ? { minHeight: "100svh" } : {}),
			...(snapAlign ? { scrollSnapAlign: snapAlign } : {}),
			...style,
		});
		const resolvedInner = usePropStyles({
			maxW: contentMaxWidth,
			px: px ?? "1.5rem",
			py: py ?? "4rem",
		} as any);
		const stateClass = cpropClass(cprop);
		const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point;
		const clickHandler = useNodeClickHandler(onClick);

		const element = (
			<section
				ref={ref}
				id={resolvedId}
				className={mergedClass}
				style={resolvedOuter}
				onClick={clickHandler}
			>
				<div className={innerLayoutClass} style={resolvedInner}>{children}</div>
			</section>
		);

		return href ? <HrefWrapper href={href}>{element}</HrefWrapper> : element;
	}),
);

// ── Button ────────────────────────────────────────────────────────────────────

const BUTTON_BASE: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: "0.5rem",
	border: "none",
	fontFamily: "inherit",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	transition: "opacity 0.15s, transform 0.15s, box-shadow 0.15s",
	userSelect: "none",
};

const BUTTON_SIZES: Record<string, CSSProperties> = {
	xs: { fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderRadius: "6px" },
	sm: { fontSize: "0.875rem", padding: "0.5rem 1rem", borderRadius: "6px" },
	md: { fontSize: "1rem", padding: "0.625rem 1.5rem", borderRadius: "8px" },
	lg: { fontSize: "1.125rem", padding: "0.75rem 2rem", borderRadius: "10px" },
	xl: { fontSize: "1.25rem", padding: "1rem 2.5rem", borderRadius: "12px" },
};

export interface EngineButtonProps extends ButtonProps {
	children?: ReactNode;
}

export const EngineButton = memo(function EngineButton({
	children,
	label,
	variant = "solid",
	size = "md",
	accentColor = "var(--e-accent, #4f46e5)",
	href,
	disabled = false,
	fullWidth,
	type = "button",
	style,
	className,
	id,
	point,
	cprop,
	onClick,
	...props
}: EngineButtonProps) {
	const variantStyle: CSSProperties = variant === "solid"
		? { background: accentColor, color: "#fff" }
		: variant === "outline"
			? { background: "transparent", color: accentColor, border: `2px solid ${accentColor}` }
			: variant === "ghost"
				? { background: "transparent", color: accentColor }
				: variant === "elevated"
					? { background: accentColor, color: "#fff", boxShadow: `0 4px 14px ${accentColor}55` }
					: { background: "transparent", color: accentColor, textDecoration: "underline", padding: 0 };
	const sizeStyle = BUTTON_SIZES[size] ?? BUTTON_SIZES.md;
	const resolvedStyle = usePropStyles(
		{
			...props,
			width: normalizeFullWidth(fullWidth),
		} as any,
		{
			...BUTTON_BASE,
			...sizeStyle,
			...variantStyle,
			...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
			...style,
		},
	);
	const stateClass = cpropClass(cprop);
	const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
	const resolvedId = id ?? point;
	const namedClickHandler = useNodeClickHandler(onClick);
	const Tag = href ? "a" : "button";
	const handleClick = (event: React.MouseEvent<HTMLElement>) => {
		if (disabled) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		namedClickHandler?.(event);
	};

	return (
		<Tag
			type={!href ? type : undefined}
			href={href}
			id={resolvedId}
			disabled={!href && disabled}
			aria-disabled={disabled || undefined}
			tabIndex={href && disabled ? -1 : undefined}
			className={mergedClass}
			style={resolvedStyle}
			onClick={disabled || namedClickHandler ? handleClick : undefined}
		>
			{label ?? children}
		</Tag>
	);
});

// ── Card ──────────────────────────────────────────────────────────────────────

export interface EngineCardProps extends CardProps {
	children?: ReactNode;
	coverClassName?: string;
}

export const EngineCard = memo(
	forwardRef<HTMLDivElement, EngineCardProps>(function EngineCard(
		{
			children,
			variant = "elevated",
			interactive = false,
			cover,
			coverAlt = "",
			coverRatio = "16/9",
			coverFit = "cover",
			coverClassName,
			direction = "vertical",
			innerPadding = "1.25rem",
			coverWidth = "40%",
			style,
			className,
			id,
			point,
			href,
			cprop,
			onClick,
			...props
		},
		ref,
	) {
		const variantStyle: CSSProperties = variant === "elevated"
			? { background: "var(--e-card-bg, #fff)", boxShadow: "0 2px 12px rgba(0,0,0,.08)" }
			: variant === "outlined"
				? { background: "var(--e-card-bg, #fff)", border: "1px solid var(--e-border, rgba(0,0,0,.12))" }
				: variant === "filled"
					? { background: "var(--e-card-filled, #f8fafc)" }
					: { background: "var(--e-card-bg, #fff)" };
		const isHorizontal = direction === "horizontal";
		const resolvedStyle = usePropStyles(props as any, {
			borderRadius: "12px",
			overflow: "hidden",
			display: "flex",
			flexDirection: isHorizontal ? "row" : "column",
			...variantStyle,
			...(interactive ? { cursor: "pointer", transition: "transform 0.2s ease, box-shadow 0.2s ease" } : {}),
			...style,
		});
		const stateClass = cpropClass(cprop);
		const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point;
		const clickHandler = useNodeClickHandler(onClick);

		const element = (
			<div
				ref={ref}
				id={resolvedId}
				className={mergedClass}
				style={resolvedStyle}
				onClick={clickHandler}
				onMouseEnter={interactive ? (event) => {
					const element = event.currentTarget as HTMLDivElement;
					element.style.transform = "translateY(-4px)";
					if (variant === "elevated") element.style.boxShadow = "0 8px 28px rgba(0,0,0,.15)";
				} : undefined}
				onMouseLeave={interactive ? (event) => {
					const element = event.currentTarget as HTMLDivElement;
					element.style.transform = "";
					if (variant === "elevated") element.style.boxShadow = "0 2px 12px rgba(0,0,0,.08)";
				} : undefined}
			>
				{cover && (
					<div
						className={staticClass({
							flexShrink: 0,
							width: isHorizontal ? coverWidth : "100%",
							aspectRatio: isHorizontal ? undefined : coverRatio,
							minHeight: isHorizontal ? "100%" : undefined,
							overflow: "hidden",
							position: "relative",
						})}
					>
						<img
							src={cover}
							alt={coverAlt}
							className={[
								coverClassName,
								staticClass({
									width: "100%",
									height: "100%",
									objectFit: coverFit as any,
									display: "block",
									position: isHorizontal ? "absolute" : "static",
									top: isHorizontal ? 0 : undefined,
									left: isHorizontal ? 0 : undefined,
								}),
							].filter(Boolean).join(" ") || undefined}
						/>
					</div>
				)}
				<div
					className={staticClass({
						flex: 1,
						padding: innerPadding,
						display: "flex",
						flexDirection: "column",
						minWidth: 0,
					})}
				>
					{children}
				</div>
			</div>
		);

		return href ? <HrefWrapper href={href}>{element}</HrefWrapper> : element;
	}),
);

// ── Spacer ────────────────────────────────────────────────────────────────────

export const EngineSpacer = memo(function EngineSpacer({
	size = "2rem",
	axis = "y",
}: SpacerProps) {
	const resolvedStyle = axis === "x"
		? usePropStyles({ width: size } as any, { display: "inline-block" })
		: usePropStyles({ height: size } as any, { display: "block" });
	return <span aria-hidden="true" style={resolvedStyle} />;
});

// ── Divider ───────────────────────────────────────────────────────────────────

export const EngineDivider = memo(function EngineDivider({
	orientation = "horizontal",
	color = "var(--e-divider, rgba(0,0,0,.1))",
	thickness = "1px",
	style: styleVariant = "solid",
	my,
}: DividerProps) {
	if (orientation === "horizontal") {
		const resolvedStyle = usePropStyles({ my: my ?? "1rem" } as any, {
			border: "none",
			borderTop: `${thickness} ${styleVariant} ${color}`,
			width: "100%",
		});
		return <hr style={resolvedStyle} />;
	}

	const resolvedStyle = usePropStyles({ mx: my ?? "1rem" } as any, {
		border: "none",
		borderLeft: `${thickness} ${styleVariant} ${color}`,
		height: "auto",
		alignSelf: "stretch",
	});
	return <hr style={resolvedStyle} />;
});

// ── Option ────────────────────────────────────────────────────────────────────

export interface EngineOptionProps extends OptionProps {
	children?: ReactNode;
}

export const EngineOption = memo(
	forwardRef<HTMLOptionElement, EngineOptionProps>(function EngineOption(
		{
			children,
			value,
			label,
			disabled = false,
			selected,
			style,
			className,
			id,
			point,
			cprop,
			...props
		},
		ref,
	) {
		const resolvedStyle = usePropStyles(props as any, style);
		const stateClass = cpropClass(cprop);
		const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point;
		return (
			<option
				ref={ref}
				id={resolvedId}
				value={value}
				label={label}
				disabled={disabled}
				selected={selected}
				className={mergedClass}
				style={resolvedStyle}
			>
				{children}
			</option>
		);
	}),
);

// ── Slot ──────────────────────────────────────────────────────────────────────

export interface EngineSlotProps extends SlotProps {}

export const EngineSlot = memo(function EngineSlot({ name }: EngineSlotProps) {
	const { slots } = useEngineContext();
	return (slots?.[name] as React.ReactNode) || null;
});

// ── OptGroup ──────────────────────────────────────────────────────────────────

export interface EngineOptGroupProps extends OptGroupProps {
	children?: ReactNode;
}

export const EngineOptGroup = memo(
	forwardRef<HTMLOptGroupElement, EngineOptGroupProps>(function EngineOptGroup(
		{
			children,
			label,
			disabled = false,
			style,
			className,
			id,
			point,
			cprop,
			...props
		},
		ref,
	) {
		const resolvedStyle = usePropStyles(props as any, style);
		const stateClass = cpropClass(cprop);
		const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point;
		return (
			<optgroup
				ref={ref}
				id={resolvedId}
				label={label}
				disabled={disabled}
				className={mergedClass}
				style={resolvedStyle}
			>
				{children}
			</optgroup>
		);
	}),
);
