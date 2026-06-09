// ─────────────────────────────────────────────────────────────────────────────
//  Next.js Engine — Schema Types
//  The full type surface for defining pages as data, not markup.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, JSX } from "react";

// ── Breakpoint system ─────────────────────────────────────────────────────────

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export const BREAKPOINT_ORDER: Breakpoint[] = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
];

/**
 * A value that can be a plain T or a responsive map keyed by breakpoint.
 * Missing breakpoints cascade up from the smallest defined breakpoint.
 *
 * @example
 * const padding: ResponsiveValue<string> = { xs: "1rem", md: "2rem", xl: "3rem" }
 */
export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>;

// ── Node types ────────────────────────────────────────────────────────────────

export type BuiltinNodeType =
  | "box"
  | "stack"
  | "grid"
  | "text"
  | "heading"
  | "markdown"
  | "image"
  | "section"
  | "hero"
  | "card"
  | "button"
  | "link"
  | "spacer"
  | "divider"
  | "slot"        // Renders a named prop from pageProps
  | "raw"         // Escape hatch: renders a React component directly
  | "canvas"      // EngineCanvas — GPU-optimised 2D/WebGL canvas
  | "scroll";     // EngineScroll — smooth-scroll + anchor-point + page-transition system

// ── Canvas props ──────────────────────────────────────────────────────────────

export interface CanvasNodeProps extends BaseNodeProps {
  mode?: "2d" | "webgl" | "webgl2" | "auto";
  width?: number;
  height?: number;
  responsive?: boolean;
  dpr?: number | "auto";
  maxDpr?: number;
  adaptive?: boolean;
  pauseWhenOffscreen?: boolean;
  pauseWhenHidden?: boolean;
  alpha?: boolean;
  antialias?: boolean;
  powerPreference?: "default" | "high-performance" | "low-power";
  /** Handler name for onSetup — must return a cleanup fn or void */
  onSetup?: string;
  /** Handler name for onDraw(ctx, canvas, delta, frame) */
  onDraw?: string;
  /** Handler name for onResize(ctx, canvas, w, h) */
  onResize?: string;
}

/** Any string is valid — allows custom registered types */
export type NodeType = BuiltinNodeType | (string & {});

// ── CpropValue — custom CSS prop bag ─────────────────────────────────────────

/**
 * Custom CSS property bag for engine nodes.
 *
 * `cprop` exposes pseudo-class states (hover, focus, active) and any standard
 * CSS properties not already covered by BaseNodeProps. It is an engine-level
 * complement to the `style` prop, with the addition of:
 *
 *   · Hover / focus / active states via CSS class injection
 *   · Direct CSS property passthrough via `css`
 *
 * @example
 * cprop: {
 *   onHover: { background: "#1a1a1a", transform: "scale(1.02)" },
 *   css: { userSelect: "none", pointerEvents: "auto" },
 * }
 */
export interface CpropValue {
  /**
   * CSS properties applied on `:hover`.
   * Accepts any camelCase or kebab-case CSS property name.
   * Compiled to a CSS class with a `:hover` selector — no JS event handlers.
   *
   * @example
   * onHover: { background: "#333", color: "#fff", transform: "translateY(-2px)" }
   */
  onHover?: Record<string, string | number>;

  /**
   * CSS properties applied on `:focus` and `:focus-visible`.
   *
   * @example
   * onFocus: { outline: "2px solid var(--e-accent)", outlineOffset: "3px" }
   */
  onFocus?: Record<string, string | number>;

  /**
   * CSS properties applied on `:active` (pressed state).
   *
   * @example
   * onActive: { transform: "scale(0.97)", opacity: "0.9" }
   */
  onActive?: Record<string, string | number>;

  /**
   * Direct CSS property additions as a standard CSSProperties object.
   * Applied as inline style — merged with other resolved styles.
   * For properties not in BaseNodeProps (e.g. userSelect, appearance, willChange).
   *
   * @example
   * css: { userSelect: "none", willChange: "transform", pointerEvents: "none" }
   */
  css?: CSSProperties;
}

// ── Shared base props ─────────────────────────────────────────────────────────

export interface BaseNodeProps {
  id?: string;
  className?: string;
  style?: CSSProperties;

  /**
   * Scroll anchor point name.
   * Creates an HTML `id` on the element so it can be targeted by `#name` URLs.
   * EngineScroll uses this to smooth-scroll or fade-transition to the element.
   * When both `id` and `point` are set, `id` takes precedence.
   *
   * In EngineMarkdown, `#` (h1) and `##` (h2) headings become points by default.
   * Disable with `disablepointformarkdownhash` / `disablepointformarkdownhashhash`.
   *
   * @example
   * // Section becomes target of #features in the URL
   * { type: "section", props: { point: "features" } }
   */
  point?: string;

  /**
   * Custom CSS prop bag. Exposes pseudo-class states (hover, focus, active)
   * and direct CSS property additions not covered by BaseNodeProps.
   *
   * @example
   * cprop: {
   *   onHover: { background: "#2a2a2a", transform: "scale(1.02)" },
   *   css: { userSelect: "none" },
   * }
   */
  cprop?: CpropValue;

  // Responsive visibility
  hideOn?: Breakpoint[];
  showOnly?: Breakpoint[];

  // Spacing — all accept responsive values
  m?: ResponsiveValue<string | number>;
  mt?: ResponsiveValue<string | number>;
  mr?: ResponsiveValue<string | number>;
  mb?: ResponsiveValue<string | number>;
  ml?: ResponsiveValue<string | number>;
  mx?: ResponsiveValue<string | number>;
  my?: ResponsiveValue<string | number>;

  p?: ResponsiveValue<string | number>;
  pt?: ResponsiveValue<string | number>;
  pr?: ResponsiveValue<string | number>;
  pb?: ResponsiveValue<string | number>;
  pl?: ResponsiveValue<string | number>;
  px?: ResponsiveValue<string | number>;
  py?: ResponsiveValue<string | number>;

  // Sizing
  w?: ResponsiveValue<string | number>;
  h?: ResponsiveValue<string | number>;
  minW?: ResponsiveValue<string | number>;
  minH?: ResponsiveValue<string | number>;
  maxW?: ResponsiveValue<string | number>;
  maxH?: ResponsiveValue<string | number>;
  width?: ResponsiveValue<string | number>;
  height?: ResponsiveValue<string | number>;
  minWidth?: ResponsiveValue<string | number>;
  minHeight?: ResponsiveValue<string | number>;
  maxWidth?: ResponsiveValue<string | number>;
  maxHeight?: ResponsiveValue<string | number>;

  // Self-alignment inside parent flex/grid
  alignSelf?: CSSProperties["alignSelf"];
  justifySelf?: CSSProperties["justifySelf"];
  flex?: string;
  order?: ResponsiveValue<number>;

  // Colours & surfaces
  bg?: string;
  color?: string;
  opacity?: number;

  // Border
  border?: string;
  borderTop?: string;
  borderBottom?: string;
  borderRadius?: ResponsiveValue<string | number>;

  // Effects
  shadow?: string;
  boxShadow?: string;
  transition?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
  backgroundPosition?: string;
  backdrop?: string;
  backdropFilter?: string;
  overflow?: CSSProperties["overflow"];
  cursor?: CSSProperties["cursor"];

  // Position
  position?: CSSProperties["position"];
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
  zIndex?: number;

  // Interaction
  onClick?: string; // name of a handler from pageProps.handlers
  href?: string;    // If set, wraps node in <a>

  // ── Custom CSS variables ───────────────────────────────────────────────────
  /**
   * CSS custom properties to set inline on this element.
   * Keys without leading `--` are auto-prefixed.
   * Values cascade down to all children through the CSS variable system.
   *
   * @example
   * vars: { "--card-bg": "#1a1a2e", "--accent": "#9bcf3a" }
   */
  vars?: Record<string, string>;

  // ── Sides system ───────────────────────────────────────────────────────────
  /**
   * Which sides `sideDistance` applies to.
   *   1 = top
   *   2 = left
   *   3 = right
   *   4 = bottom
   */
  sides?: (1 | 2 | 3 | 4)[];

  /**
   * Distance applied to each selected side.
   * Numbers are converted to rem (÷16), strings are used as-is.
   */
  sideDistance?: string | number;

  /**
   * Whether `sideDistance` maps to `margin` (pushes adjacent elements) or
   * `padding` (pushes inner content). Default: `"margin"`.
   */
  sideType?: "margin" | "padding";
}

// ── Per-type props ────────────────────────────────────────────────────────────

export interface BoxProps extends BaseNodeProps {
  display?: ResponsiveValue<CSSProperties["display"]>;
  flexDir?: ResponsiveValue<CSSProperties["flexDirection"]>;
  align?: ResponsiveValue<CSSProperties["alignItems"]>;
  justify?: ResponsiveValue<CSSProperties["justifyContent"]>;
  wrap?: ResponsiveValue<CSSProperties["flexWrap"]>;
  gap?: ResponsiveValue<string | number>;
  colGap?: ResponsiveValue<string | number>;
  rowGap?: ResponsiveValue<string | number>;
}

export interface StackProps extends BaseNodeProps {
  /** Default: vertical */
  direction?: ResponsiveValue<"vertical" | "horizontal">;
  gap?: ResponsiveValue<string | number>;
  align?: ResponsiveValue<CSSProperties["alignItems"]>;
  justify?: ResponsiveValue<CSSProperties["justifyContent"]>;
  wrap?: boolean;
  /** Render a <hr>-style divider between each child */
  dividers?: boolean;
}

export interface GridProps extends BaseNodeProps {
  /** Number of columns, or a CSS grid-template-columns string */
  columns?: ResponsiveValue<number | string>;
  rows?: ResponsiveValue<number | string>;
  gap?: ResponsiveValue<string | number>;
  colGap?: ResponsiveValue<string | number>;
  rowGap?: ResponsiveValue<string | number>;
  /**
   * Auto-fit mode — generates repeat(auto-fit, minmax(minColWidth, 1fr))
   * overrides `columns` when set.
   */
  autoFit?: boolean;
  minColWidth?: string;
  align?: ResponsiveValue<CSSProperties["alignItems"]>;
  justify?: ResponsiveValue<CSSProperties["justifyContent"]>;
}

export type TextVariant =
  | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  | "body" | "body-sm" | "lead" | "caption" | "label" | "mono" | "overline";

export interface TextPart {
  /** Visible text for this segment */
  text: string;
  /** If set, renders an <a> with this href */
  href?: string;
  /**
   * Link target.
   * Defaults to "_blank" when href starts with "http", "_self" otherwise.
   */
  target?: "_blank" | "_self" | "_parent" | "_top";
  /**
   * Rel attribute on the anchor.
   * Auto-set to "noopener noreferrer" for external / _blank links if omitted.
   */
  rel?: string;
  /** Per-segment inline style overrides */
  style?: CSSProperties;
}

export interface TextProps extends BaseNodeProps {
  variant?: TextVariant;
  /** Override font-size */
  size?: ResponsiveValue<string>;
  weight?: ResponsiveValue<CSSProperties["fontWeight"]>;
  align?: ResponsiveValue<CSSProperties["textAlign"]>;
  lineHeight?: string | number;
  letterSpacing?: string;
  /** Clamp to N lines with ellipsis. true = 1 line */
  truncate?: boolean | number;
  italic?: boolean;
  underline?: boolean;
  /** CSS gradient applied as text fill */
  gradient?: string;
  /** The text content as a prop instead of child schema node */
  content?: string;
  /** Render as a specific HTML tag regardless of variant */
  as?: keyof JSX.IntrinsicElements;
  /**
   * Inline text parts — use instead of `content` for mixed text + hyperlinks.
   * When provided, `content` and child nodes are ignored.
   */
  parts?: TextPart[];
}

export interface MarkdownProps extends BaseNodeProps {
  // ── Content ───────────────────────────────────────────────────────────────
  /** Markdown string to render inline */
  content?: string;
  /**
   * Path to a .md file resolved server-side by createPage before render.
   * The component always receives a plain `content` string — never a raw path.
   */
  filePath?: string;

  // ── Colour ────────────────────────────────────────────────────────────────
  /** Body text colour. Default: "#30475f" */
  textColor?: string;
  /** Heading colour. Default: "#07111f" */
  headingColor?: string;
  /** Link colour. Default: "#12304c" */
  linkColor?: string;
  /** Divider and muted element colour. Default: "rgba(7,17,31,0.16)" */
  mutedColor?: string;

  // ── Typography ────────────────────────────────────────────────────────────
  /** Font family for the whole article */
  fontFamily?: string;
  /** Body paragraph font size. Default: "1rem" */
  bodySize?: string;
  /** Body paragraph line height. Default: 1.8 */
  bodyLineHeight?: number | string;
  /**
   * Per-heading font-size overrides.
   * @example headingSizes: { h1: "clamp(2rem,5vw,3.5rem)", h2: "1.75rem" }
   */
  headingSizes?: Partial<Record<"h1" | "h2" | "h3" | "h4" | "h5" | "h6", string>>;
  /** Optional prefix added to generated heading ids for hash links. */
  headingIdPrefix?: string;

  // ── EngineScroll integration ──────────────────────────────────────────────
  /**
   * When true, `##` (h2) headings do NOT become EngineScroll anchor points.
   * The heading id is still generated for manual `href="#slug"` links.
   * Default: false — h2 headings ARE anchor points.
   */
  disablepointformarkdownhashhash?: boolean;
  /**
   * When true, `#` (h1) headings do NOT become EngineScroll anchor points.
   * The heading id is still generated for manual `href="#slug"` links.
   * Default: false — h1 headings ARE anchor points.
   */
  disablepointformarkdownhash?: boolean;

  // ── Animation ─────────────────────────────────────────────────────────────
  /**
   * Animation applied to the whole article wrapper.
   * "fade-in"  → opacity 0 → 1
   * "slide-up" → opacity 0 + translateY(12px) → opacity 1 + none
   */
  textAnimation?: "none" | "fade-in" | "slide-up";
  /**
   * Per-block staggered animation — every heading, paragraph, list, and hr
   * animates in with a progressively longer delay.
   */
  blockAnimation?: "none" | "fade-in" | "slide-up";
  /** Duration for each animation. Default: "0.4s" */
  animationDuration?: string;
  /** Extra delay per block for stagger effect in ms. Default: 50 */
  animationStagger?: number;
}

export interface HeadingProps extends TextProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  subheading?: string;
  subheadingProps?: TextProps;
}

export interface ImageNodeProps extends BaseNodeProps {
  src: string;
  alt: string;
  fill?: boolean;
  aspectRatio?: string;
  objectFit?: CSSProperties["objectFit"];
  priority?: boolean;
  sizes?: string;
  quality?: number;
  rounded?: boolean | string;
  caption?: string;
}

export type ButtonVariant = "solid" | "outline" | "ghost" | "link" | "elevated";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends BaseNodeProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  accentColor?: string;
  label?: string;
  icon?: string;
  iconPosition?: "left" | "right";
  disabled?: boolean;
  fullWidth?: ResponsiveValue<boolean>;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
}

export interface SectionProps extends BaseNodeProps {
  /** Max content width — defaults to engine config */
  contentMaxWidth?: ResponsiveValue<string | number>;
  /** Center the content column */
  centered?: boolean;
  /** Full viewport height */
  fullViewport?: boolean;
  /** Snap scrolling point */
  snapAlign?: "start" | "center" | "end";
}

export interface HeroProps extends SectionProps {
  variant?: "centered" | "split" | "fullbleed";
  overlay?: string; // CSS colour/gradient
  parallax?: boolean;
}

export interface CardProps extends BaseNodeProps {
  /** Visual style variant */
  variant?: "flat" | "elevated" | "outlined" | "filled";
  /** Adds hover lift + cursor pointer */
  interactive?: boolean;

  // ── Cover image ────────────────────────────────────────────────────────────
  /** URL of a cover image rendered in its own media area */
  cover?: string;
  /** Alt text for the cover image (required for accessibility when cover is set) */
  coverAlt?: string;
  /** CSS aspect-ratio for the cover area. Default: "16/9" */
  coverRatio?: string;
  /** CSS object-fit for the cover image. Default: "cover" */
  coverFit?: CSSProperties["objectFit"];
  /** Extra className on the cover <img> */
  coverClassName?: string;

  // ── Layout ─────────────────────────────────────────────────────────────────
  /**
   * "vertical"   — cover on top, content below (default)
   * "horizontal" — cover on left, content on right
   */
  direction?: "vertical" | "horizontal";
  /** Padding on the content area. Default: "1.25rem" */
  innerPadding?: string;
  /** Width of the cover column when direction="horizontal". Default: "40%" */
  coverWidth?: string;
}

export interface SpacerProps {
  /** Responsive size */
  size?: ResponsiveValue<string | number>;
  /** Axis — defaults to y (vertical) */
  axis?: "x" | "y";
}

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  color?: string;
  thickness?: string;
  style?: "solid" | "dashed" | "dotted";
  my?: ResponsiveValue<string | number>;
}

export interface SlotProps {
  /** Key in pageProps to render */
  name: string;
  fallback?: SchemaNode;
}

// ── EngineScroll props ─────────────────────────────────────────────────────────

/**
 * Props for the `scroll` schema node type — the EngineScroll component.
 *
 * Place at the root of a page (or layout) to enable the full scroll system:
 *   · RAF-based smooth scrolling with configurable easing
 *   · Page transition (fade-out → navigate → fade-in) for cross-page anchors
 *   · Automatic anchor detection from `point` props and Markdown headings
 *
 * @example
 * {
 *   type: "scroll",
 *   props: { method: "ease", pageTransition: true, transitionDuration: 350 },
 *   children: [{ type: "section", props: { point: "intro" }, children: [...] }]
 * }
 */
export interface EngineScrollProps extends BaseNodeProps {
  /**
   * Scroll animation method.
   *   "ease"    — custom JS ease-in-out via requestAnimationFrame (default)
   *   "smooth"  — native CSS scroll-behavior: smooth (browser handles it)
   *   "snap"    — CSS scroll-snap: transitions between full-viewport sections
   *   "instant" — no animation, jumps directly to the target
   */
  method?: "ease" | "smooth" | "snap" | "instant";

  /**
   * Duration of the ease-mode scroll animation in ms. Default: 600.
   * Only applies when method is "ease".
   */
  scrollDuration?: number;

  /**
   * Easing function used by ease mode.
   *   "ease-in-out" — slow start, fast middle, slow end (default, Google-style)
   *   "ease-in"     — slow start, fast end
   *   "ease-out"    — fast start, slow end
   *   "linear"      — constant speed
   *   "spring"      — slight overshoot and settle
   */
  easing?: "ease-in-out" | "ease-in" | "ease-out" | "linear" | "spring";

  /**
   * Enable page transition for cross-page anchor navigation.
   * When true: fade-out current page → navigate → fade-in new page → scroll.
   * When false: navigate directly, scroll to anchor on load.
   * Default: true
   */
  pageTransition?: boolean;

  /**
   * Duration of the fade transition in ms. Default: 350.
   */
  transitionDuration?: number;

  /**
   * Background color of the fade overlay / page wrapper opacity.
   * Defaults to CSS var --e-bg, falls back to #ffffff.
   */
  transitionColor?: string;

  /**
   * scrollMarginTop applied to all scroll points to offset sticky headers.
   * Default: 80px. Set to 0 if you have no sticky header.
   */
  scrollOffset?: number | string;
}

// ── Schema node ───────────────────────────────────────────────────────────────

export interface SchemaNode {
  /** Component type — builtin or custom-registered */
  type: NodeType;
  /** Stable key for React reconciliation */
  key?: string;
  /** Props matching the type's prop interface */
  props?: Record<string, unknown>;
  /** Child nodes, or a plain text string */
  children?: SchemaNode[] | string;
}

// ── Page schema ───────────────────────────────────────────────────────────────

export interface PageMeta {
  title?: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: "summary" | "summary_large_image";
  noIndex?: boolean;
  canonical?: string;
  /** Overrides the default viewport meta tag */
  viewport?: string;
}

export interface EngineTheme {
  /** CSS custom properties injected at :root */
  vars?: Record<string, string>;
  /** Font preconnect/stylesheet URLs loaded in <head> */
  fonts?: string[];
  /** Inline <style> string for global overrides */
  globalStyles?: string;
}

/** The top-level page definition */
export interface PageSchema {
  meta?: PageMeta;
  theme?: EngineTheme;
  root: SchemaNode;
}

// ── Engine config ─────────────────────────────────────────────────────────────

export interface EngineConfig {
  /** Override default breakpoint widths */
  breakpoints?: Partial<Record<Breakpoint, number>>;
  /** Default content max-width for Section nodes */
  contentMaxWidth?: string;
  /** Default gap unit base (default: "1rem") */
  gapBase?: string;
  /** Spacing scale function — receives a number and returns a CSS string */
  spacingScale?: (n: number) => string;
}
