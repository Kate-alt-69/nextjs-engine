"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Engine — EngineNav
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	Suspense,
	forwardRef,
	lazy,
	memo,
	useCallback,
	useMemo,
	useState,
	type CSSProperties,
	type ReactElement,
	type ReactNode,
} from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { staticClass, useCpropClass, usePropStyles } from "../hooks/usePropStyles";
import { useStyleCollector } from "../providers/EngineProvider";
import type { BaseNodeProps } from "../schema/types";
import type { EngineTransitionInput } from "../core/enginetransitions";

// Keep the transition runtime out of ordinary links. The extra client code is
// loaded only when an animated internal link is actually rendered.
const LazyEngineTransitionLink = lazy(async () => {
	const transitionModule = await import("./EngineTransitionLink");
	return { default: transitionModule.EngineTransitionLink as React.ComponentType<any> };
});

export interface EngineAnchorConfig {
	href: string;
	target?: string;
	transition?: EngineTransitionInput;
	className?: string;
	children?: ReactNode;
	onClick?: React.MouseEventHandler<HTMLAnchorElement>;
	ref?: React.Ref<HTMLAnchorElement>;
	style?: CSSProperties;
	"aria-label"?: string;
	"aria-current"?: React.AriaAttributes["aria-current"];
}

function isExternalHref(href: string, target?: string): boolean {
	return target === "_blank"
		|| href.startsWith("//")
		|| /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function hasAnimatedTransition(transition: EngineTransitionInput | undefined): boolean {
	if (!transition) return false;
	if (typeof transition === "string") return transition.trim().length > 0 && transition !== "instant";
	return transition.type !== "instant";
}

function renderNextAnchor(cfg: EngineAnchorConfig): ReactElement {
	return (
		<NextLink
			ref={cfg.ref}
			href={cfg.href}
			target={cfg.target}
			className={cfg.className}
			onClick={cfg.onClick}
			style={cfg.style}
			aria-label={cfg["aria-label"]}
			aria-current={cfg["aria-current"]}
		>
			{cfg.children}
		</NextLink>
	);
}

export function renderEngineAnchor(cfg: EngineAnchorConfig): ReactElement {
	const {
		href,
		target,
		transition,
		className,
		children,
		onClick,
		ref,
		style,
		"aria-label": ariaLabel,
		"aria-current": ariaCurrent,
	} = cfg;

	if (isExternalHref(href, target)) {
		return (
			<a
				ref={ref}
				href={href}
				target={target ?? "_blank"}
				rel="noopener noreferrer"
				className={className}
				onClick={onClick}
				style={style}
				aria-label={ariaLabel}
				aria-current={ariaCurrent}
			>
				{children}
			</a>
		);
	}

	if (hasAnimatedTransition(transition)) {
		const nextAnchor = renderNextAnchor(cfg);
		return (
			<Suspense fallback={nextAnchor}>
				<LazyEngineTransitionLink
					ref={ref}
					href={href}
					transition={transition}
					target={target}
					className={className}
					onClick={onClick}
					style={style}
					aria-label={ariaLabel}
					aria-current={ariaCurrent}
				>
					{children}
				</LazyEngineTransitionLink>
			</Suspense>
		);
	}

	return renderNextAnchor(cfg);
}

export interface EngineNavItem {
	label: string;
	href?: string;
	target?: string;
	cprop?: { link?: { transition?: EngineTransitionInput; href?: string } };
	active?: boolean;
	children?: EngineNavItem[];
}

export interface EngineNavLogo {
	src?: string;
	href?: string;
	alt?: string;
	width?: number | string;
	height?: number | string;
}

export type EngineNavVariant = "horizontal" | "vertical" | "minimal";

export interface EngineNavProps extends Omit<BaseNodeProps, "onClick"> {
	variant?: EngineNavVariant;
	sticky?: boolean;
	logo?: EngineNavLogo;
	items?: EngineNavItem[];
	mobileBreakpoint?: number;
	children?: ReactNode;
}

interface NavItemProps {
	item: EngineNavItem;
	pathname: string;
	variant: EngineNavVariant;
}

const NavItem = memo(function NavItem({ item, pathname, variant }: NavItemProps): ReactElement {
	const styleCollector = useStyleCollector();
	const [open, setOpen] = useState(false);
	const href = item.cprop?.link?.href ?? item.href ?? "#";
	const transition = item.cprop?.link?.transition;
	const isActive = item.active
		?? (href !== "#" && pathname.startsWith(href) && (href === "/" ? pathname === "/" : true));
	const hasChildren = Boolean(item.children?.length);

	const itemClass = useMemo(() => staticClass({
		position: "relative",
		display: "inline-flex",
		alignItems: "center",
		gap: "0.25rem",
	}, styleCollector), [styleCollector]);

	const anchorClass = useMemo(() => staticClass({
		display: "inline-flex",
		alignItems: "center",
		padding: variant === "vertical" ? "0.5rem 1rem" : "0.375rem 0.75rem",
		borderRadius: "0.375rem",
		fontSize: "0.9375rem",
		fontWeight: isActive ? "600" : "400",
		textDecoration: "none",
		transition: "background 0.15s, color 0.15s",
		color: isActive
			? "var(--engine-nav-active-color, var(--color-primary, #fff))"
			: "var(--engine-nav-color, inherit)",
		background: isActive
			? "var(--engine-nav-active-bg, rgba(255,255,255,0.1))"
			: "transparent",
	}, styleCollector), [isActive, styleCollector, variant]);

	const dropdownClass = useMemo(() => staticClass({
		position: "absolute",
		top: "calc(100% + 0.25rem)",
		left: 0,
		minWidth: "10rem",
		background: "var(--engine-nav-dropdown-bg, #1a1a1a)",
		border: "1px solid var(--engine-nav-dropdown-border, rgba(255,255,255,0.1))",
		borderRadius: "0.5rem",
		padding: "0.375rem",
		zIndex: 50,
		display: "flex",
		flexDirection: "column",
		gap: "0.125rem",
		boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
	}, styleCollector), [styleCollector]);

	if (hasChildren) {
		return (
			<div className={itemClass}>
				<button
					aria-expanded={open}
					aria-haspopup="menu"
					onClick={() => setOpen((value) => !value)}
					className={anchorClass}
					style={{ cursor: "pointer", border: "none", background: "transparent" }}
				>
					{item.label}
					<svg
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
					>
						<path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</button>
				<div role="menu" className={dropdownClass} style={{ display: open ? "flex" : "none" }}>
					{item.children!.map((child, index) => (
						<NavItem
							key={`${child.cprop?.link?.href ?? child.href ?? child.label}-${index}`}
							item={child}
							pathname={pathname}
							variant={variant}
						/>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className={itemClass}>
			{renderEngineAnchor({
				href,
				target: item.target,
				transition,
				className: anchorClass,
				children: item.label,
				"aria-current": isActive ? "page" : undefined,
			})}
		</div>
	);
});

export const EngineNav = memo(
	forwardRef<HTMLElement, EngineNavProps>((props, ref) => {
		const {
			variant = "horizontal",
			sticky = false,
			logo,
			items = [],
			mobileBreakpoint = 768,
			children,
			className,
			cprop,
			id,
			point,
			style,
			...restProps
		} = props;

		const styleCollector = useStyleCollector();
		const pathname = usePathname();
		const [mobileOpen, setMobileOpen] = useState(false);
		const toggleMobile = useCallback(() => setMobileOpen((value) => !value), []);
		const hoverClass = useCpropClass(cprop);
		const navStyle = usePropStyles(restProps as any, style ?? {});

		const navClass = useMemo(() => [
			staticClass({
				display: "flex",
				alignItems: variant === "vertical" ? "flex-start" : "center",
				flexDirection: variant === "vertical" ? "column" : "row",
				position: sticky ? "sticky" : "relative",
				top: sticky ? 0 : undefined,
				zIndex: sticky ? 40 : undefined,
				width: "100%",
				background: "var(--engine-nav-bg, transparent)",
				borderBottom: variant === "horizontal"
					? "var(--engine-nav-border, 1px solid rgba(255,255,255,0.08))"
					: undefined,
				padding: variant === "vertical" ? "1rem 0" : "0 var(--engine-nav-px, 1.5rem)",
				gap: variant === "vertical" ? "0.25rem" : "0",
				backdropFilter: sticky ? "var(--engine-nav-blur, blur(12px))" : undefined,
			}, styleCollector),
			hoverClass,
			className,
		].filter(Boolean).join(" ") || undefined, [className, hoverClass, sticky, styleCollector, variant]);

		const innerClass = useMemo(() => staticClass({
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			width: "100%",
			maxWidth: "var(--engine-nav-max-width, 1200px)",
			margin: "0 auto",
			minHeight: variant === "horizontal" ? "var(--engine-nav-height, 3.5rem)" : undefined,
		}, styleCollector), [styleCollector, variant]);

		const itemsClass = useMemo(() => staticClass({
			display: "flex",
			alignItems: "center",
			flexWrap: "wrap",
			gap: "0.125rem",
			flexDirection: variant === "vertical" ? "column" : "row",
		}, styleCollector), [styleCollector, variant]);

		const desktopItemsClass = useMemo(() => staticClass({
			display: "none",
			[`@media(min-width: ${mobileBreakpoint}px)`]: { display: "flex" },
		}, styleCollector), [mobileBreakpoint, styleCollector]);

		const logoClass = useMemo(() => staticClass({
			flexShrink: 0,
			display: "flex",
			alignItems: "center",
		}, styleCollector), [styleCollector]);

		const mobileToggleClass = useMemo(() => staticClass({
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "2.5rem",
			height: "2.5rem",
			border: "none",
			background: "transparent",
			cursor: "pointer",
			borderRadius: "0.375rem",
			color: "inherit",
			[`@media(min-width: ${mobileBreakpoint}px)`]: { display: "none" },
		}, styleCollector), [mobileBreakpoint, styleCollector]);

		const mobileMenuClass = useMemo(() => staticClass({
			display: "flex",
			flexDirection: "column",
			gap: "0.125rem",
			padding: "0.75rem",
			borderTop: "1px solid var(--engine-nav-border, rgba(255,255,255,0.08))",
			width: "100%",
			[`@media(min-width: ${mobileBreakpoint}px)`]: { display: "none" },
		}, styleCollector), [mobileBreakpoint, styleCollector]);

		return (
			<nav
				ref={ref}
				id={id ?? point}
				className={navClass}
				style={navStyle}
				aria-label="Main navigation"
			>
				<div className={innerClass}>
					{logo && (
						<div className={logoClass}>
							{renderEngineAnchor({
								href: logo.href ?? "/",
								children: logo.src
									? (
										<img
											src={logo.src}
											alt={logo.alt ?? "Logo"}
											width={logo.width as any}
											height={logo.height as any}
											style={{ display: "block" }}
										/>
									)
									: (logo.alt ?? ""),
								"aria-label": logo.alt ?? "Home",
							})}
						</div>
					)}

					{items.length > 0 && (
						<div className={[itemsClass, desktopItemsClass].filter(Boolean).join(" ")}>
							{items.map((item, index) => (
								<NavItem
									key={`${item.cprop?.link?.href ?? item.href ?? item.label}-${index}`}
									item={item}
									pathname={pathname}
									variant={variant}
								/>
							))}
						</div>
					)}

					{children}

					{items.length > 0 && (
						<button
							aria-label={mobileOpen ? "Close menu" : "Open menu"}
							aria-expanded={mobileOpen}
							aria-controls="engine-nav-mobile"
							onClick={toggleMobile}
							className={mobileToggleClass}
						>
							{mobileOpen ? (
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
									<path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
								</svg>
							) : (
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
									<path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
								</svg>
							)}
						</button>
					)}
				</div>

				{mobileOpen && items.length > 0 && (
					<div id="engine-nav-mobile" role="menu" className={mobileMenuClass}>
						{items.map((item, index) => (
							<NavItem
								key={`${item.cprop?.link?.href ?? item.href ?? item.label}-${index}`}
								item={item}
								pathname={pathname}
								variant="vertical"
							/>
						))}
					</div>
				)}
			</nav>
		);
	}),
);

EngineNav.displayName = "EngineNav";