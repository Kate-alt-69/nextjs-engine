// ─────────────────────────────────────────────────────────────────────────────
//  Next.js Engine — Schema Types
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, JSX, ReactNode, MouseEventHandler } from "react";

// ── Breakpoints ───────────────────────────────────────────────────────────────

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export const BREAKPOINTS: Record<Breakpoint, number> = {
	xs:  0, sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536,
};

export const BREAKPOINT_ORDER: Breakpoint[] = ["xs","sm","md","lg","xl","2xl"];

export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>;

export type EngineStyleObject = CSSProperties & {
	[key: `@${string}`]: EngineStyleObject | CSSProperties | string | number | null | undefined;
};

// ── Node types ────────────────────────────────────────────────────────────────

export type BuiltinNodeType =
	| "box" | "stack" | "grid" | "text" | "heading" | "markdown"
	| "image" | "section" | "hero" | "card" | "button" | "link" | "nav" | "manim" | "manim3d"
	| "spacer" | "divider" | "slot" | "raw" | "canvas" | "scroll"
	| "custom-select" | "suspense" | "option" | "optgroup"
	| "form" | "input" | "textarea" | "checkbox" | "label";


export type NodeType = BuiltinNodeType | (string & {});

// ── CpropValue — engine custom properties ─────────────────────────────────────
//
//  cprop is for ENGINE-specific concepts that don't exist natively in CSS.
//  For raw CSS properties, write them directly on the node's prop object.
//
//  cprop handles:
//    · Pseudo-class states (onHover / onFocus / onActive) — compiled to CSS
//      class injection. No JS event handlers. Uses CSSProperties for full
//      auto-complete on the override values.
//    · Any future engine-specific behaviour that maps to >1 CSS prop or
//      requires special handling.
//
//  Removed from cprop (these now live directly on prop):
//    · css — use direct CSS props on prop instead
//    · pointerEvents, userSelect, willChange — now in BaseNodeProps

export interface CpropValue {
	/**
	 * CSS overrides applied on `:hover`.
	 * Accepts any CSSProperties key for full auto-complete.
	 * Compiled to a `.e-h-{hash}:hover{...}` CSS rule — pure CSS, no JS.
	 * @example
	 * onHover: { background: "#1a1a2e", transform: "scale(1.02)", color: "#fff" }
	 */
	onHover?: EngineStyleObject;

	/**
	 * CSS overrides applied on `:focus` and `:focus-visible`.
	 * @example
	 * onFocus: { outline: "2px solid var(--e-accent)", outlineOffset: "3px" }
	 */
	onFocus?: EngineStyleObject;

	/**
	 * CSS overrides applied on `:active` (pressed state).
	 * @example
	 * onActive: { transform: "scale(0.97)", opacity: 0.9 }
	 */
	onActive?: EngineStyleObject;

	/**
	 * CSS overrides applied on `:checked` (useful for styled checkboxes/radios).
	 */
	onChecked?: EngineStyleObject;

	/**
	 * CSS overrides applied when the element is disabled (`:disabled`).
	 */
	onDisabled?: EngineStyleObject;

	/**
	 * CSS overrides applied on `:placeholder-shown`.
	 */
	onPlaceholder?: EngineStyleObject;
}

// ── BaseNodeProps ─────────────────────────────────────────────────────────────
//
//  All engine nodes accept these props.
//
//  CSS DIRECTLY ON PROP:
//  Any standard CSS property can be written directly alongside engine
//  shorthands. Engine shorthands (bg, m, px, gap, etc.) take precedence
//  for properties they cover. The rest flow through as-is.
//
//  Example — writing CSS directly:
//    { type: "box", props: {
//        bg: "#111",               ← engine shorthand (= background)
//        transform: "scale(1.05)", ← direct CSS passthrough
//        filter: "blur(4px)",      ← direct CSS passthrough
//        willChange: "transform",  ← direct CSS passthrough
//    }}

export interface BaseNodeProps {
	id?:        string;
	className?: string;
	style?:     EngineStyleObject;

	// ── EngineScroll anchor point ─────────────────────────────────────────────
	/**
	 * Scroll anchor name. Sets the element's HTML id so it is reachable via
	 * `#name` in the URL. EngineScroll smooth-scrolls or fade-transitions to it.
	 * When both `id` and `point` are set, `id` takes precedence.
	 */
	point?: string;

	// ── Engine custom properties ──────────────────────────────────────────────
	/**
	 * Engine custom prop bag. For pseudo-class CSS states (hover / focus / active)
	 * and future engine-specific behaviours. Not for raw CSS — write CSS props
	 * directly on the node's prop object instead.
	 */
	cprop?: CpropValue;

	// ── Responsive visibility ─────────────────────────────────────────────────
	hideOn?:   Breakpoint[];
	showOnly?: Breakpoint[];

	// ── Spacing (engine shorthands) ───────────────────────────────────────────
	m?:  ResponsiveValue<string | number>;
	mt?: ResponsiveValue<string | number>;
	mr?: ResponsiveValue<string | number>;
	mb?: ResponsiveValue<string | number>;
	ml?: ResponsiveValue<string | number>;
	mx?: ResponsiveValue<string | number>;
	my?: ResponsiveValue<string | number>;

	p?:  ResponsiveValue<string | number>;
	pt?: ResponsiveValue<string | number>;
	pr?: ResponsiveValue<string | number>;
	pb?: ResponsiveValue<string | number>;
	pl?: ResponsiveValue<string | number>;
	px?: ResponsiveValue<string | number>;
	py?: ResponsiveValue<string | number>;

	// ── Sizing (engine shorthands) ────────────────────────────────────────────
	w?:        ResponsiveValue<string | number>;
	h?:        ResponsiveValue<string | number>;
	minW?:     ResponsiveValue<string | number>;
	minH?:     ResponsiveValue<string | number>;
	maxW?:     ResponsiveValue<string | number>;
	maxH?:     ResponsiveValue<string | number>;
	width?:    ResponsiveValue<string | number>;
	height?:   ResponsiveValue<string | number>;
	minWidth?: ResponsiveValue<string | number>;
	minHeight?: ResponsiveValue<string | number>;
	maxWidth?: ResponsiveValue<string | number>;
	maxHeight?: ResponsiveValue<string | number>;

	// ── Self alignment (in parent flex/grid) ─────────────────────────────────
	alignSelf?:   CSSProperties["alignSelf"];
	justifySelf?: CSSProperties["justifySelf"];
	flex?:        string;
	order?:       ResponsiveValue<number>;

	// ── Colours & surface (engine shorthands) ────────────────────────────────
	bg?:    string;   // → background
	color?: string;
	opacity?: number;

	// ── Border (engine shorthands) ────────────────────────────────────────────
	border?:       string;
	borderTop?:    string;
	borderBottom?: string;
	borderLeft?:   string;
	borderRight?:  string;
	borderRadius?: ResponsiveValue<string | number>;

	// ── Effects (engine shorthands) ───────────────────────────────────────────
	shadow?:             string;   // → boxShadow
	boxShadow?:          string;
	transition?:         string;
	backgroundImage?:    string;
	backgroundSize?:     string;
	backgroundRepeat?:   string;
	backgroundPosition?: string;
	backdrop?:           string;   // → backdropFilter

	// ── Position ──────────────────────────────────────────────────────────────
	overflow?: CSSProperties["overflow"];
	cursor?:   CSSProperties["cursor"];
	position?: CSSProperties["position"];
	top?:      string | number;
	right?:    string | number;
	bottom?:   string | number;
	left?:     string | number;
	zIndex?:   number;

	// ── Interaction ───────────────────────────────────────────────────────────
	onClick?: string;  // handler name from pageProps.handlers
	href?:    string;  // wraps node in <a>

	// ── CSS custom properties ─────────────────────────────────────────────────
	vars?: Record<string, string>;

	// ── Sides system ──────────────────────────────────────────────────────────
	sides?:        (1 | 2 | 3 | 4)[];
	sideDistance?: string | number;
	sideType?:     "margin" | "padding";

	// ─────────────────────────────────────────────────────────────────────────
	//  CSS PASSTHROUGH PROPERTIES
	//  Write these directly on prop alongside engine shorthands.
	//  All accept ResponsiveValue<T> — use a breakpoint map for responsive CSS.
	//
	//  Example:
	//    transform: "rotate(45deg)"
	//    transform: { xs: "scale(0.9)", md: "scale(1)" }
	// ─────────────────────────────────────────────────────────────────────────

	// Transforms & 3D
	transform?:           ResponsiveValue<CSSProperties["transform"]>;
	transformOrigin?:     ResponsiveValue<CSSProperties["transformOrigin"]>;
	transformStyle?:      CSSProperties["transformStyle"];
	perspective?:         CSSProperties["perspective"];
	perspectiveOrigin?:   CSSProperties["perspectiveOrigin"];
	backfaceVisibility?:  CSSProperties["backfaceVisibility"];

	// Filters
	filter?:              CSSProperties["filter"];
	backdropFilter?:      CSSProperties["backdropFilter"];

	// Clip & shape
	clipPath?:            CSSProperties["clipPath"];

	// Object / media
	objectFit?:           CSSProperties["objectFit"];
	objectPosition?:      CSSProperties["objectPosition"];
	aspectRatio?:         CSSProperties["aspectRatio"];

	// Blend modes & isolation
	mixBlendMode?:        CSSProperties["mixBlendMode"];
	isolation?:           CSSProperties["isolation"];

	// Performance hints
	willChange?:          CSSProperties["willChange"];
	contentVisibility?:   CSSProperties["contentVisibility"];
	contain?:             CSSProperties["contain"];
	containIntrinsicSize?: string;

	// Behaviour
	appearance?:          CSSProperties["appearance"];
	resize?:              CSSProperties["resize"];
	visibility?:          CSSProperties["visibility"];
	pointerEvents?:       CSSProperties["pointerEvents"];
	userSelect?:          CSSProperties["userSelect"];

	// Overflow axes
	overflowX?:           CSSProperties["overflowX"];
	overflowY?:           CSSProperties["overflowY"];

	// Layout utils
	float?:               CSSProperties["float"];
	clear?:               CSSProperties["clear"];
	verticalAlign?:       CSSProperties["verticalAlign"];
	tableLayout?:         CSSProperties["tableLayout"];
	borderCollapse?:      CSSProperties["borderCollapse"];
	borderSpacing?:       string;
	columnCount?:         CSSProperties["columnCount"];
	columnWidth?:         CSSProperties["columnWidth"];

	// Typography
	fontFamily?:           ResponsiveValue<CSSProperties["fontFamily"]>;
	fontStyle?:            CSSProperties["fontStyle"];
	fontVariant?:          CSSProperties["fontVariant"];
	fontStretch?:          CSSProperties["fontStretch"];
	fontFeatureSettings?:  CSSProperties["fontFeatureSettings"];
	fontVariationSettings?: string;
	textTransform?:        CSSProperties["textTransform"];
	textDecoration?:       CSSProperties["textDecoration"];
	textDecorationColor?:  CSSProperties["textDecorationColor"];
	textDecorationStyle?:  CSSProperties["textDecorationStyle"];
	textUnderlineOffset?:  string;
	textShadow?:           CSSProperties["textShadow"];
	textIndent?:           CSSProperties["textIndent"];
	textRendering?:        CSSProperties["textRendering"];
	textWrap?:             string;
	wordBreak?:            CSSProperties["wordBreak"];
	wordSpacing?:          CSSProperties["wordSpacing"];
	whiteSpace?:           CSSProperties["whiteSpace"];
	hyphens?:              CSSProperties["hyphens"];
	writingMode?:          CSSProperties["writingMode"];
	direction?:            CSSProperties["direction"];
	caretColor?:           CSSProperties["caretColor"];
	accentColor?:          CSSProperties["accentColor"];
	lineBreak?:            CSSProperties["lineBreak"];
	tabSize?:              CSSProperties["tabSize"];

	// Grid item positioning (grid-column, grid-row, etc.)
	gridColumn?:       CSSProperties["gridColumn"];
	gridRow?:          CSSProperties["gridRow"];
	gridArea?:         CSSProperties["gridArea"];
	gridColumnStart?:  CSSProperties["gridColumnStart"];
	gridColumnEnd?:    CSSProperties["gridColumnEnd"];
	gridRowStart?:     CSSProperties["gridRowStart"];
	gridRowEnd?:       CSSProperties["gridRowEnd"];
	gridAutoFlow?:     CSSProperties["gridAutoFlow"];
	gridAutoColumns?:  CSSProperties["gridAutoColumns"];
	gridAutoRows?:     CSSProperties["gridAutoRows"];
	placeSelf?:        string;
	placeItems?:       string;
	placeContent?:     string;

	// Animation
	animation?:                  CSSProperties["animation"];
	animationName?:              CSSProperties["animationName"];
	animationDuration?:          CSSProperties["animationDuration"];
	animationDelay?:             CSSProperties["animationDelay"];
	animationTimingFunction?:    CSSProperties["animationTimingFunction"];
	animationIterationCount?:    CSSProperties["animationIterationCount"];
	animationFillMode?:          CSSProperties["animationFillMode"];
	animationPlayState?:         CSSProperties["animationPlayState"];
	animationDirection?:         CSSProperties["animationDirection"];

	// Scroll integration
	scrollSnapAlign?:      CSSProperties["scrollSnapAlign"];
	scrollSnapStop?:       CSSProperties["scrollSnapStop"];
	scrollMarginTop?:      string | number;
	scrollMarginBottom?:   string | number;
	scrollMarginLeft?:     string | number;
	scrollMarginRight?:    string | number;
	scrollPaddingTop?:     string | number;
	scrollPaddingBottom?:  string | number;
	overscrollBehavior?:   CSSProperties["overscrollBehavior"];
	overscrollBehaviorX?:  CSSProperties["overscrollBehaviorX"];
	overscrollBehaviorY?:  CSSProperties["overscrollBehaviorY"];

	// Outline (separate from border)
	outline?:        CSSProperties["outline"];
	outlineColor?:   CSSProperties["outlineColor"];
	outlineOffset?:  CSSProperties["outlineOffset"];
	outlineWidth?:   CSSProperties["outlineWidth"];
	outlineStyle?:   CSSProperties["outlineStyle"];

	// Lists
	listStyle?:         CSSProperties["listStyle"];
	listStyleType?:     CSSProperties["listStyleType"];
	listStylePosition?: CSSProperties["listStylePosition"];

	// Content / generated
	content?: CSSProperties["content"];

	// SVG paint
	fill?:             string;
	stroke?:           string;
	strokeWidth?:      string | number;
	strokeDasharray?:  string;
	strokeDashoffset?: string | number;
	strokeLinecap?:    "butt" | "round" | "square";
	strokeLinejoin?:   "miter" | "round" | "bevel";
}

// ── Per-type props ────────────────────────────────────────────────────────────

export interface BoxProps extends BaseNodeProps {
	display?:  ResponsiveValue<CSSProperties["display"]>;
	flexDir?:  ResponsiveValue<CSSProperties["flexDirection"]>;
	align?:    ResponsiveValue<CSSProperties["alignItems"]>;
	justify?:  ResponsiveValue<CSSProperties["justifyContent"]>;
	wrap?:     ResponsiveValue<CSSProperties["flexWrap"]>;
	gap?:      ResponsiveValue<string | number>;
	colGap?:   ResponsiveValue<string | number>;
	rowGap?:   ResponsiveValue<string | number>;
}

export interface StackProps extends Omit<BaseNodeProps, "direction"> {
	direction?: ResponsiveValue<"horizontal" | "vertical">;
	gap?: ResponsiveValue<string | number>;
	align?: ResponsiveValue<string>;
	justify?: ResponsiveValue<string>;
	wrap?: boolean;
	dividers?: boolean;
}

export interface GridProps extends BaseNodeProps {
	columns?:     ResponsiveValue<number | string>;
	rows?:        ResponsiveValue<number | string>;
	gap?:         ResponsiveValue<string | number>;
	colGap?:      ResponsiveValue<string | number>;
	rowGap?:      ResponsiveValue<string | number>;
	autoFit?:     boolean;
	minColWidth?: string;
	align?:       ResponsiveValue<CSSProperties["alignItems"]>;
	justify?:     ResponsiveValue<CSSProperties["justifyContent"]>;
}

export type TextVariant =
	| "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
	| "body" | "body-sm" | "lead" | "caption" | "label" | "mono" | "overline";

export interface TextPart {
	text:    string;
	href?:   string;
	target?: "_blank" | "_self" | "_parent" | "_top";
	rel?:    string;
	style?:  CSSProperties;
}

export interface TextProps extends BaseNodeProps {
	variant?:      TextVariant;
	size?:         ResponsiveValue<string>;
	weight?:       ResponsiveValue<CSSProperties["fontWeight"]>;
	align?:        ResponsiveValue<CSSProperties["textAlign"]>;
	lineHeight?:   string | number;
	letterSpacing?: string;
	truncate?:     boolean | number;
	italic?:       boolean;
	underline?:    boolean;
	gradient?:     string;
	content?:      string;
	as?:           keyof JSX.IntrinsicElements;
	parts?:        TextPart[];
}

export interface MarkdownProps extends BaseNodeProps {
	content?:                         string;
	filePath?:                        string;
	textColor?:                       string;
	headingColor?:                    string;
	linkColor?:                       string;
	mutedColor?:                      string;
	fontFamily?:                      ResponsiveValue<CSSProperties["fontFamily"]>;
	bodySize?:                        string;
	bodyLineHeight?:                  number | string;
	headingSizes?:                    Partial<Record<"h1"|"h2"|"h3"|"h4"|"h5"|"h6", string>>;
	headingIdPrefix?:                 string;
	disablepointformarkdownhashhash?: boolean;
	disablepointformarkdownhash?:     boolean;
	textAnimation?:                   "none" | "fade-in" | "slide-up";
	blockAnimation?:                  "none" | "fade-in" | "slide-up";
	animationDuration?:               string;
	animationStagger?:                number;
}

export interface HeadingProps extends TextProps {
	level?:           1 | 2 | 3 | 4 | 5 | 6;
	subheading?:      string;
	subheadingProps?: TextProps;
}

export interface ImageNodeProps extends Omit<BaseNodeProps, "fill" | "objectFit"> {
	src: string;
	alt: string;
	width?: number;
	height?: number;
	fill?: boolean;
	priority?: boolean;
	quality?: number;
	objectFit?: string;
	aspectRatio?: string;
	sizes?: string;
	blurDataURL?: string;
	rounded?: boolean | string;
	qualityPreset?: "performance" | "balanced" | "sharp";
	qualityMobile?: number;
	qualityDesktop?: number;
	caption?: string;
}

export type ButtonVariant = "solid" | "outline" | "ghost" | "link" | "elevated";
export type ButtonSize    = "xs" | "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends BaseNodeProps {
	variant?:      ButtonVariant;
	size?:         ButtonSize;
	accentColor?:  string;
	label?:        string;
	icon?:         string;
	iconPosition?: "left" | "right";
	disabled?:     boolean;
	fullWidth?:    ResponsiveValue<boolean>;
	loading?:      boolean;
	type?:         "button" | "submit" | "reset";
}

export interface SectionProps extends BaseNodeProps {
	contentMaxWidth?: ResponsiveValue<string | number>;
	centered?:        boolean;
	fullViewport?:    boolean;
	snapAlign?:       "start" | "center" | "end";
}

export interface HeroProps extends SectionProps {
	variant?: "centered" | "split" | "fullbleed";
	overlay?: string;
	parallax?: boolean;
}

export interface EngineHeroProps extends HeroProps {
	children?: ReactNode;
}

export interface EngineLinkConfig {
	href: string;
	transition?: "page-to-page" | "instant" | string;
	styles?: CSSProperties & Record<string, any>;
}

export interface EngineLinkProps extends Omit<BaseNodeProps, "onClick"> {
	children?: ReactNode;
	href?: string;
	target?: string;
	content?: string;
	cprop?: any; // Bypasses the strict CpropValue core definition check
	onClick?: string | MouseEventHandler<HTMLAnchorElement>;
}

export type SuspensePreset = "skeleton" | "spinner" | "shimmer" | "pulse" | "blur";

export interface EngineSuspenseProps extends BaseNodeProps {
	children?: ReactNode;
	/** Built-in loading fallback preset */
	preset?: SuspensePreset;
	/** Minimum height of the placeholder area */
	minHeight?: string | number;
	/** Number of skeleton lines (skeleton preset) */
	skeletonLines?: number;
	/** Delay (ms) before the fallback appears — prevents flash for fast loads */
	delay?: number;
	/** Maximum ms to wait before switching to errorFallback */
	timeout?: number;
	/** Schema node id (string) to render on timeout — for future use */
	errorFallback?: string;
	/** Custom fallback node override */
	fallback?: ReactNode;
}

export interface EngineFormProps extends BaseNodeProps {
	children?: ReactNode;
	/** Called when the form submits. Receives the current bound field values. */
	onSubmit?: string;  // handler name from pageProps.handlers
	/** Handler name called when form resets. */
	onReset?: string;
	/** noValidate disables browser built-in validation. */
	noValidate?: boolean;
	/** autocomplete attribute */
	autoComplete?: string;
	/** Form action URL (native) */
	action?: string;
	/** HTTP method */
	method?: "get" | "post";
	/** encType for file uploads */
	encType?: string;
}

export type InputType =
	| "text" | "email" | "password" | "search" | "url" | "tel"
	| "number" | "hidden" | "date" | "time" | "color" | "range" | "file"
	| "checkbox" | "radio" | "submit" | "reset" | "button";

export interface EngineInputProps extends BaseNodeProps {
	/** Input type */
	type?: InputType;
	/** Field name — also used as the cprop.bind key */
	name?: string;
	/** Placeholder text */
	placeholder?: string;
	/** Default value */
	defaultValue?: string | number;
	/** Controlled value */
	value?: string | number;
	/** Disable the input */
	disabled?: boolean;
	/** Make the input required */
	required?: boolean;
	/** HTML5 pattern validation */
	pattern?: string;
	/** Min/max for numeric/date types */
	min?: string | number;
	max?: string | number;
	step?: string | number;
	/** Min/max length for text */
	minLength?: number;
	maxLength?: number;
	/** Multiple selections (file input) */
	multiple?: boolean;
	/** Accept file types */
	accept?: string;
	/** autoComplete attribute */
	autoComplete?: string;
	/** aria-label for accessibility */
	ariaLabel?: string;
	/** aria-describedby */
	ariaDescribedBy?: string;
	/** onChange handler name */
	onChange?: string;
	/** readOnly */
	readOnly?: boolean;
	/** autoFocus */
	autoFocus?: boolean;
	/** tabIndex */
	tabIndex?: number;
}

export interface EngineTextareaProps extends BaseNodeProps {
	name?: string;
	placeholder?: string;
	defaultValue?: string;
	value?: string;
	disabled?: boolean;
	required?: boolean;
	rows?: number;
	cols?: number;
	minLength?: number;
	maxLength?: number;
	readOnly?: boolean;
	autoFocus?: boolean;
	tabIndex?: number;
	autoComplete?: string;
	ariaLabel?: string;
	ariaDescribedBy?: string;
	onChange?: string;
	/** resize CSS property shorthand */
	resizable?: "none" | "both" | "horizontal" | "vertical" | "block" | "inline";
}

export interface EngineCheckboxProps extends BaseNodeProps {
	name?: string;
	/** Value submitted when checked */
	value?: string;
	/** Controlled checked state */
	checked?: boolean;
	/** Default checked state */
	defaultChecked?: boolean;
	disabled?: boolean;
	required?: boolean;
	ariaLabel?: string;
	ariaDescribedBy?: string;
	onChange?: string;
	tabIndex?: number;
	autoFocus?: boolean;
}

export interface EngineLabelProps extends BaseNodeProps {
	children?: ReactNode;
	/** The id of the form element this label is for */
	htmlFor?: string;
	/** Shorthand: if set and htmlFor is not, uses `for-${forInput}` as htmlFor */
	forInput?: string;
}

export interface EngineAPIAuthConfig {
	type: "pnp" | "ak" | "hmac" | "bearer" | "jwt" | "basic" | "none";
	key?: string;
	secret?: string;
	token?: string;
	username?: string;
	password?: string;
	destinationHeader?: string;
	algorithm?: "SHA-256" | "SHA-512" | "Ed25519" | "RS256" | string;
	privateKey?: CryptoKey | JsonWebKey | string;
}

export interface EngineAPIConfig {
	endpoint?: string;
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | string;
	cache?: RequestCache;
	auth?: EngineAPIAuthConfig;
	headers?: Record<string, string>;
	versionMacros?: Record<string, string>;
}

export interface CardProps extends Omit<BaseNodeProps, "direction"> {
	variant?: "elevated" | "outlined" | "filled" | "flat";
	interactive?: boolean;
	direction?: "horizontal" | "vertical";
	cover?: string;
	coverAlt?: string;
	coverRatio?: string;
	coverFit?: string;
	coverWidth?: string;
	innerPadding?: string;
}

export interface SpacerProps {
	size?: ResponsiveValue<string | number>;
	axis?: "x" | "y";
}

export interface DividerProps {
	orientation?: "horizontal" | "vertical";
	color?:       string;
	thickness?:   string;
	style?:       "solid" | "dashed" | "dotted";
	my?:          ResponsiveValue<string | number>;
}

export interface OptionProps extends BaseNodeProps {
	value:     string;
	label?:    string;
	disabled?: boolean;
	selected?: boolean;
}

export interface OptGroupProps extends BaseNodeProps {
	label:     string;
	disabled?: boolean;
}

export interface SlotProps {
	name:       string;
	fallback?:  SchemaNode;
}

// ── EngineScroll props ─────────────────────────────────────────────────────────

export interface EngineScrollProps extends BaseNodeProps {
	method?:             "ease" | "smooth" | "snap" | "instant";
	scrollDuration?:     number;
	easing?:             "ease-in-out" | "ease-in" | "ease-out" | "linear" | "spring";
	pageTransition?:     boolean;
	transitionDuration?: number;
	transitionColor?:    string;
	scrollOffset?:       number | string;
}

// ── CustomSelect props ─────────────────────────────────────────────────────────

export interface SelectOption {
	value:     string;
	label:     string;
	disabled?: boolean;
}

export interface CustomSelectProps extends BaseNodeProps {
	name:         string;
	label?:       string;
	options:      SelectOption[];
	placeholder?: string;
	defaultValue?: string;
	onChange?:    string;  // handler name
	searchable?:  boolean;
	clearable?:   boolean;
	size?:        "sm" | "md" | "lg";
}

// ── CanvasNodeProps ────────────────────────────────────────────────────────────

export interface CanvasNodeProps extends BaseNodeProps {
	mode?:              "2d" | "webgl" | "webgl2" | "auto";
	width?:             number;
	height?:            number;
	responsive?:        boolean;
	dpr?:               number | "auto";
	maxDpr?:            number;
	adaptive?:          boolean;
	pauseWhenOffscreen?: boolean;
	pauseWhenHidden?:   boolean;
	alpha?:             boolean;
	antialias?:         boolean;
	powerPreference?:   "default" | "high-performance" | "low-power";
	onSetup?:           string;
	onDraw?:            string;
	onResize?:          string;
}

// ── Schema node ───────────────────────────────────────────────────────────────

export interface SchemaNode {
	type:       NodeType;
	/**
	 * Optional stable name for this node, used as a mobile patch selector.
	 * Set `name: "my-node"` here, then target it from the mobile patch list
	 * with the selector `"children#my-node"`.
	 *
	 * Like `key`, this is an engine-level field — it is NOT passed to the
	 * rendered component as a prop.
	 *
	 * @example
	 * // Schema node:
	 * { type: "box", name: "hero-cta", props: { ... } }
	 *
	 * // Mobile patch:
	 * { "children#hero-cta": { props: { display: "none" } } }
	 */
	name?:      string;
	key?:       string;
	props?:     Record<string, unknown>;
	children?:  SchemaNode[] | string;
}

// ── Page schema ───────────────────────────────────────────────────────────────

export interface PageMeta {
	title?:       string;
	description?: string;
	keywords?:    string[];
	ogTitle?:     string;
	ogDescription?: string;
	ogImage?:     string;
	twitterCard?: "summary" | "summary_large_image";
	noIndex?:     boolean;
	canonical?:   string;
	viewport?:    string;
}

export interface EngineTheme {
	vars?:         Record<string, string>;
	fonts?:        string[];
	globalStyles?: string;
}

export interface PageSchema {
	meta?:  PageMeta;
	theme?: EngineTheme;
	root:   SchemaNode;
}

export interface EngineConfig {
	breakpoints?:    Partial<Record<Breakpoint, number>>;
	contentMaxWidth?: string;
	gapBase?:        string;
	spacingScale?:   (n: number) => string;
}

// ── Mobile patch system ───────────────────────────────────────────────────────
//
//  Declare the mobile layout of a page alongside the main schema.
//  Mobile patches are applied server-side when the request comes from a
//  mobile device, producing an alternate schema tree for that render only.
//  The desktop schema object is never mutated.
//
//  Selector syntax:
//    "children#my-node" — targets a SchemaNode with name: "my-node"
//    "#my-node"         — short form, same effect
//
//  Directives (at the top level of each patch entry, NOT inside props/cprop):
//    "remove-all-prop"  — clears ALL existing props before merging new ones
//    "remove-all-cprop" — clears the existing cprop bag before merging new one
//
//  Example:
//  ```ts
//  mobile: [
//    {
//      "children#pricing-cta": {
//        "remove-all-prop": true,
//        props: { display: "none" },
//      },
//    },
//    {
//      "children#mobile-menu": {
//        cprop: { hide: false },
//        props: { display: "flex" },
//      },
//    },
//  ]
//  ```

/**
 * Cprop overrides valid inside a mobile patch entry.
 * Extends the standard CpropValue with one mobile-only field.
 */
export interface MobileCpropPatch extends CpropValue {
	/**
	 * Mobile-only shorthand. When true, sets `display: none` on the node —
	 * hides the element from mobile viewers without touching the desktop tree.
	 * When false (or absent), no change is made to display.
	 *
	 * Only meaningful inside a `MobilePatchDirectives` object.
	 * Ignored at render time on non-mobile devices.
	 */
	hide?: boolean;
}

/**
 * The directives that can appear inside a single mobile patch entry.
 *
 * `"remove-all-prop"` and `"remove-all-cprop"` are top-level flags — they
 * are NOT placed under `props` or `cprop`. They tell the patcher what to
 * wipe before applying the new values.
 */
export interface MobilePatchDirectives {
	/**
	 * When true, all existing props on the targeted node are removed before
	 * the new `props` values are merged in. cprop is also cleared unless
	 * kept by the node's existing cprop not being under props explicitly.
	 *
	 * Place this at the TOP LEVEL of the patch entry, not inside `props`.
	 */
	"remove-all-prop"?:  boolean;
	/**
	 * When true, the existing `cprop` bag on the targeted node is cleared
	 * before merging in the new `cprop` values. All other props are kept.
	 *
	 * Place this at the TOP LEVEL of the patch entry, not inside `cprop`.
	 */
	"remove-all-cprop"?: boolean;
	/**
	 * Props to merge into the node after any `remove-all-prop` wipe.
	 * These are merged shallowly — existing keys not listed here are kept
	 * (unless wiped by `remove-all-prop`).
	 */
	props?:              Record<string, unknown>;
	/**
	 * Cprop values to merge into `props.cprop` after any `remove-all-cprop`
	 * wipe. Includes the mobile-only `hide` shorthand.
	 */
	cprop?:              MobileCpropPatch;
}

/**
 * A single mobile patch object.
 * Each key is a node selector (`"children#name"` or `"#name"`).
 * Each value is the set of directives to apply to the matched node.
 */
export type MobilePatch = {
	[selector: string]: MobilePatchDirectives;
};

/**
 * The full mobile schema config — an ordered array of patch objects.
 * Patches are applied in order, so later patches override earlier ones
 * when they target the same node.
 *
 * Pass this as the `mobile` field to `createPage()`:
 * ```ts
 * createPage({
 *   schema: MySchema,
 *   mobile: [
 *     { "children#desktop-nav": { cprop: { hide: true } } },
 *     { "children#mobile-nav": { props: { display: "flex" } } },
 *   ],
 * });
 * ```
 */
export type MobileSchemaConfig = MobilePatch[];