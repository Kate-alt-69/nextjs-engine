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
  | "image"
  | "section"
  | "hero"
  | "card"
  | "button"
  | "link"
  | "spacer"
  | "divider"
  | "slot"     // Renders a named prop from pageProps
  | "raw";     // Escape hatch: renders a React component directly

/** Any string is valid — allows custom registered types */
export type NodeType = BuiltinNodeType | (string & {});

// ── Shared base props ─────────────────────────────────────────────────────────

export interface BaseNodeProps {
  id?: string;
  className?: string;
  style?: CSSProperties;

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
  | "body" | "body-sm"
  | "lead"
  | "caption"
  | "label"
  | "mono"
  | "overline";

// ── Text parts ────────────────────────────────────────────────────────────────

/**
 * A single inline segment inside a `parts`-based text node.
 *
 * Plain segments (no `href`) render as bare text runs — no wrapper element
 * is added unless `style` is set, in which case a `<span>` is used.
 * Segments with `href` render as `<a>` tags.
 *
 * @example
 * parts: [
 *   { text: "built with love by " },
 *   { text: "Kastrick", href: "https://kastricks.com", target: "_blank" },
 * ]
 */
export interface TextPart {
  /** The visible text for this segment */
  text: string;
  /** If set, renders this segment as an <a> with this href */
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
   *
   * @example
   * parts: [
   *   { text: "this site was made with love and with " },
   *   { text: "Kastrick", href: "https://kastricks.com", target: "_blank" },
   * ]
   */
  parts?: TextPart[];
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
  variant?: "flat" | "elevated" | "outlined" | "filled";
  interactive?: boolean; // hover lift effect
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
