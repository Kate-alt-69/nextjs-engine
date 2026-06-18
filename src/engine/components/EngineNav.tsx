"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineNav
//
//  Full navigation bar component + the shared anchor-rendering pipeline that
//  was previously duplicated inside EngineLink.
//
//  Routing pipeline (exported for EngineLink to delegate to):
//    1. External  — <a rel="noopener noreferrer">
//    2. Animated  — <TransitionLink>  (cprop.link.transition = "page-to-page")
//    3. Native    — <a>               (default, highest performance)
//
//  Schema type: "nav"
//
//  Schema example:
//    {
//      type: "nav",
//      props: {
//        variant : "horizontal",
//        sticky  : true,
//        logo    : { src: "/logo.svg", href: "/", alt: "Brand" },
//        items   : [
//          { label: "Home",     href: "/" },
//          { label: "Docs",     href: "/docs",     cprop: { link: { transition: "page-to-page" } } },
//          { label: "GitHub",   href: "https://github.com/...", target: "_blank" }
//        ]
//      }
//    }
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	forwardRef,
	memo,
	useRef,
	useState,
	useCallback,
	type ReactNode,
	type ReactElement,
	type CSSProperties,
	type RefObject,
} from "react";
import { Link as TransitionLink } from "next-view-transitions";
import { usePathname }            from "next/navigation";
import { usePropStyles, cpropClass, staticClass } from "../hooks/usePropStyles";
import { useHandler }             from "../providers/EngineProvider";
import type { BaseNodeProps }     from "../schema/types";

// ─────────────────────────────────────────────────────────────────────────────
//  Shared anchor config  (used by renderEngineAnchor + EngineLink)
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineAnchorConfig {
	href:        string;
	target?:     string;
	transition?: string;
	className?:  string;
	children?:   ReactNode;
	onClick?:    React.MouseEventHandler<HTMLAnchorElement>;
	ref?:        React.Ref<HTMLAnchorElement>;
	style?:      CSSProperties;
	"aria-label"?: string;
	"aria-current"?: React.AriaAttributes["aria-current"];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared routing pipeline  (previously inline in EngineLink)
//
//  All anchor rendering in the engine routes through here so the three
//  navigation strategies stay in one place.
// ─────────────────────────────────────────────────────────────────────────────

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
		"aria-label":   ariaLabel,
		"aria-current": ariaCurrent,
	} = cfg;

	const isExternal = href.startsWith("http://")
		|| href.startsWith("https://")
		|| href.startsWith("//")
		|| target === "_blank";

	// 1. External routing
	if (isExternal) {
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

	// 2. Animated page transitions (opt-in — transition = "page-to-page")
	if (transition === "page-to-page") {
		return (
			<TransitionLink
				ref={ref}
				href={href}
				target={target}
				className={className}
				onClick={onClick}
				style={style}
				aria-label={ariaLabel}
				aria-current={ariaCurrent}
			>
				{children}
			</TransitionLink>
		);
	}

	// 3. Native high-performance anchor (default)
	return (
		<a
			ref={ref}
			href={href}
			target={target}
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

// ─────────────────────────────────────────────────────────────────────────────
//  EngineNav types
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineNavItem {
	label:       string;
	href?:       string;
	target?:     string;
	/** Supports the same cprop.link API as EngineLink */
	cprop?:      { link?: { transition?: string; href?: string } };
	/** Override active state — auto-detected from pathname when omitted */
	active?:     boolean;
	/** Sub-items render as a dropdown */
	children?:   EngineNavItem[];
}

export interface EngineNavLogo {
	src?:    string;
	href?:   string;
	alt?:    string;
	width?:  number | string;
	height?: number | string;
}

export type EngineNavVariant = "horizontal" | "vertical" | "minimal";

export interface EngineNavProps extends Omit<BaseNodeProps, "onClick"> {
	/** Layout variant (default: "horizontal") */
	variant?:          EngineNavVariant;
	/** Stick to top of viewport */
	sticky?:           boolean;
	/** Logo config — renders left of items in horizontal mode */
	logo?:             EngineNavLogo;
	/** Navigation items */
	items?:            EngineNavItem[];
	/** Pixel width below which the mobile hamburger activates (default: 768) */
	mobileBreakpoint?: number;
	/** Pass-through children rendered after items */
	children?:         ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Internal: nav item renderer
// ─────────────────────────────────────────────────────────────────────────────

interface NavItemProps {
	item:     EngineNavItem;
	pathname: string;
	variant:  EngineNavVariant;
}

const NavItem = memo(function NavItem({ item, pathname, variant }: NavItemProps): ReactElement {
	const [open, setOpen] = useState(false);

	const href       = item.cprop?.link?.href ?? item.href ?? "#";
	const transition = item.cprop?.link?.transition;
	const isActive   = item.active ?? (href !== "#" && pathname.startsWith(href) && (href === "/" ? pathname === "/" : true));
	const hasChildren = item.children && item.children.length > 0;

	const itemClass = staticClass({
		position:   "relative",
		display:    "inline-flex",
		alignItems: "center",
		gap:        "0.25rem",
	});

	const anchorClass = [
		staticClass({
			display:        "inline-flex",
			alignItems:     "center",
			padding:        variant === "vertical" ? "0.5rem 1rem" : "0.375rem 0.75rem",
			borderRadius:   "0.375rem",
			fontSize:       "0.9375rem",
			fontWeight:     isActive ? "600" : "400",
			textDecoration: "none",
			transition:     "background 0.15s, color 0.15s",
			color:          isActive
				? "var(--engine-nav-active-color, var(--color-primary, #fff))"
				: "var(--engine-nav-color, inherit)",
			background: isActive
				? "var(--engine-nav-active-bg, rgba(255,255,255,0.1))"
				: "transparent",
		}),
	].filter(Boolean).join(" ");

	const dropdownClass = staticClass({
		position:        "absolute",
		top:             "calc(100% + 0.25rem)",
		left:            0,
		minWidth:        "10rem",
		background:      "var(--engine-nav-dropdown-bg, #1a1a1a)",
		border:          "1px solid var(--engine-nav-dropdown-border, rgba(255,255,255,0.1))",
		borderRadius:    "0.5rem",
		padding:         "0.375rem",
		zIndex:          50,
		display:         open ? "flex" : "none",
		flexDirection:   "column",
		gap:             "0.125rem",
		boxShadow:       "0 4px 24px rgba(0,0,0,0.3)",
	});

	if (hasChildren) {
		return (
			<div className={itemClass}>
				<button
					aria-expanded={open}
					aria-haspopup="menu"
					onClick={() => setOpen((v) => !v)}
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
				<div role="menu" className={dropdownClass}>
					{item.children!.map((child, i) => (
						<NavItem key={i} item={child} pathname={pathname} variant={variant} />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className={itemClass}>
			{renderEngineAnchor({
				href,
				target:       item.target,
				transition,
				className:    anchorClass,
				children:     item.label,
				"aria-current": isActive ? "page" : undefined,
			})}
		</div>
	);
});

// ─────────────────────────────────────────────────────────────────────────────
//  EngineNav component
// ─────────────────────────────────────────────────────────────────────────────

export const EngineNav = memo(
	forwardRef<HTMLElement, EngineNavProps>((props, ref) => {
		const {
			variant          = "horizontal",
			sticky           = false,
			logo,
			items            = [],
			mobileBreakpoint = 768,
			children,
			className,
			cprop,
			id,
			point,
			style,
			...restProps
		} = props;

		const pathname  = usePathname();
		const [mobileOpen, setMobileOpen] = useState(false);
		const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);

		const hoverClass = cpropClass(cprop);

		const navStyle = usePropStyles(restProps as any, style ?? {});

		const navClass = [
			staticClass({
				display:        "flex",
				alignItems:     variant === "vertical" ? "flex-start" : "center",
				flexDirection:  variant === "vertical" ? "column" : "row",
				position:       sticky ? "sticky" : "relative",
				top:            sticky ? 0 : undefined,
				zIndex:         sticky ? 40 : undefined,
				width:          "100%",
				background:     "var(--engine-nav-bg, transparent)",
				borderBottom:   variant === "horizontal"
					? "var(--engine-nav-border, 1px solid rgba(255,255,255,0.08))"
					: undefined,
				padding:        variant === "vertical"
					? "1rem 0"
					: "0 var(--engine-nav-px, 1.5rem)",
				gap:            variant === "vertical" ? "0.25rem" : "0",
				backdropFilter: sticky
					? "var(--engine-nav-blur, blur(12px))"
					: undefined,
			}),
			hoverClass,
			className,
		].filter(Boolean).join(" ") || undefined;

		const innerClass = staticClass({
			display:        "flex",
			alignItems:     "center",
			justifyContent: "space-between",
			width:          "100%",
			maxWidth:       "var(--engine-nav-max-width, 1200px)",
			margin:         "0 auto",
			minHeight:      variant === "horizontal"
				? "var(--engine-nav-height, 3.5rem)"
				: undefined,
		});

		const itemsClass = staticClass({
			display:    "flex",
			alignItems: "center",
			flexWrap:   "wrap",
			gap:        "0.125rem",
			flexDirection: variant === "vertical" ? "column" : "row",
		});

		return (
			<nav
				ref={ref}
				id={id ?? point}
				className={navClass}
				style={navStyle}
				aria-label="Main navigation"
				{...restProps}
			>
				<div className={innerClass}>
					{/* Logo */}
					{logo && (
						<div className={staticClass({ flexShrink: 0, display: "flex", alignItems: "center" })}>
							{renderEngineAnchor({
								href:      logo.href ?? "/",
								children:  logo.src
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

					{/* Desktop items */}
					{items.length > 0 && (
						<div
							className={[
								itemsClass,
								staticClass({
									display: "none",
									[`@media(min-width: ${mobileBreakpoint}px)`]: {
										display: "flex",
									},
								}),
							].filter(Boolean).join(" ")}
						>
							{items.map((item, i) => (
								<NavItem key={i} item={item} pathname={pathname} variant={variant} />
							))}
						</div>
					)}

					{/* Pass-through slot */}
					{children}

					{/* Mobile hamburger */}
					{items.length > 0 && (
						<button
							aria-label={mobileOpen ? "Close menu" : "Open menu"}
							aria-expanded={mobileOpen}
							aria-controls="engine-nav-mobile"
							onClick={toggleMobile}
							className={staticClass({
								display:         "flex",
								alignItems:      "center",
								justifyContent:  "center",
								width:           "2.5rem",
								height:          "2.5rem",
								border:          "none",
								background:      "transparent",
								cursor:          "pointer",
								borderRadius:    "0.375rem",
								color:           "inherit",
							})}
						>
							{mobileOpen
								? (
									// ✕
									<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
										<path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
									</svg>
								)
								: (
									// ☰
									<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
										<path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
									</svg>
								)}
						</button>
					)}
				</div>

				{/* Mobile drawer */}
				{mobileOpen && items.length > 0 && (
					<div
						id="engine-nav-mobile"
						role="menu"
						className={staticClass({
							display:       "flex",
							flexDirection: "column",
							gap:           "0.125rem",
							padding:       "0.75rem",
							borderTop:     "1px solid var(--engine-nav-border, rgba(255,255,255,0.08))",
							width:         "100%",
						})}
					>
						{items.map((item, i) => (
							<NavItem key={i} item={item} pathname={pathname} variant="vertical" />
						))}
					</div>
				)}
			</nav>
		);
	}),
);

EngineNav.displayName = "EngineNav";
