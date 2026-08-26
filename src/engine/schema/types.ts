// ─────────────────────────────────────────────────────────────────────────────
//  Next.js Engine — Schema Types
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, JSX, ReactNode, MouseEventHandler } from "react";
import type { ECScene } from "../core/enginecanvas/ECTypes";

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export const BREAKPOINTS: Record<Breakpoint, number> = {
	xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536,
};

export const BREAKPOINT_ORDER: Breakpoint[] = ["xs", "sm", "md", "lg", "xl", "2xl"];
export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>;

export type EngineStyleObject = CSSProperties & {
	[key: `@${string}`]: EngineStyleObject | CSSProperties | string | number | null | undefined;
};

export type BuiltinNodeType =
	| "box" | "stack" | "grid" | "text" | "heading" | "markdown"
	| "image" | "video" | "section" | "hero" | "card" | "button" | "link" | "nav" | "manim" | "manim3d"
	| "spacer" | "divider" | "slot" | "canvas" | "scroll"
	| "custom-select" | "suspense" | "option" | "optgroup"
	| "form" | "input" | "textarea" | "checkbox" | "label";

export type NodeType = BuiltinNodeType | (string & {});

export interface CpropValue {
	onHover?: EngineStyleObject;
	onFocus?: EngineStyleObject;
	onActive?: EngineStyleObject;
	onChecked?: EngineStyleObject;
	onDisabled?: EngineStyleObject;
	onPlaceholder?: EngineStyleObject;
}

export interface BaseNodeProps {
	id?: string;
	className?: string;
	style?: EngineStyleObject;
	point?: string;
	cprop?: CpropValue;

	/** Force/disable schema lazy mounting where the renderer supports it. */
	lazy?: boolean;
	/** Mark above-fold/important content as eager. */
	priority?: boolean;
	/** Alias used by lazy wrappers/components that expose an eager override. */
	eager?: boolean;

	hideOn?: Breakpoint[];
	showOnly?: Breakpoint[];

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

	alignSelf?: CSSProperties["alignSelf"];
	justifySelf?: CSSProperties["justifySelf"];
	flex?: string;
	order?: ResponsiveValue<number>;

	bg?: ResponsiveValue<CSSProperties["background"]>;
	background?: ResponsiveValue<CSSProperties["background"]>;
	backgroundColor?: ResponsiveValue<CSSProperties["backgroundColor"]>;
	color?: ResponsiveValue<CSSProperties["color"]>;
	opacity?: ResponsiveValue<number>;

	border?: string;
	borderTop?: string;
	borderBottom?: string;
	borderLeft?: string;
	borderRight?: string;
	borderRadius?: ResponsiveValue<string | number>;

	shadow?: string;
	boxShadow?: string;
	transition?: string;
	backgroundImage?: ResponsiveValue<CSSProperties["backgroundImage"]>;
	backgroundSize?: ResponsiveValue<CSSProperties["backgroundSize"]>;
	backgroundRepeat?: ResponsiveValue<CSSProperties["backgroundRepeat"]>;
	backgroundPosition?: ResponsiveValue<CSSProperties["backgroundPosition"]>;
	backgroundAttachment?: ResponsiveValue<CSSProperties["backgroundAttachment"]>;
	backgroundClip?: ResponsiveValue<CSSProperties["backgroundClip"]>;
	backgroundOrigin?: ResponsiveValue<CSSProperties["backgroundOrigin"]>;
	backgroundBlendMode?: ResponsiveValue<CSSProperties["backgroundBlendMode"]>;
	backdrop?: string;

	overflow?: CSSProperties["overflow"];
	cursor?: CSSProperties["cursor"];
	position?: CSSProperties["position"];
	top?: string | number;
	right?: string | number;
	bottom?: string | number;
	left?: string | number;
	zIndex?: number;

	onClick?: string;
	href?: string;
	vars?: Record<string, string>;
	sides?: (1 | 2 | 3 | 4)[];
	sideDistance?: string | number;
	sideType?: "margin" | "padding";

	transform?: ResponsiveValue<CSSProperties["transform"]>;
	transformOrigin?: ResponsiveValue<CSSProperties["transformOrigin"]>;
	transformStyle?: CSSProperties["transformStyle"];
	perspective?: CSSProperties["perspective"];
	perspectiveOrigin?: CSSProperties["perspectiveOrigin"];
	backfaceVisibility?: CSSProperties["backfaceVisibility"];
	filter?: CSSProperties["filter"];
	backdropFilter?: CSSProperties["backdropFilter"];
	clipPath?: CSSProperties["clipPath"];
	objectFit?: CSSProperties["objectFit"];
	objectPosition?: CSSProperties["objectPosition"];
	aspectRatio?: CSSProperties["aspectRatio"];
	mixBlendMode?: CSSProperties["mixBlendMode"];
	isolation?: CSSProperties["isolation"];
	willChange?: CSSProperties["willChange"];
	contentVisibility?: CSSProperties["contentVisibility"];
	contain?: CSSProperties["contain"];
	containIntrinsicSize?: string;
	appearance?: CSSProperties["appearance"];
	resize?: CSSProperties["resize"];
	visibility?: CSSProperties["visibility"];
	pointerEvents?: CSSProperties["pointerEvents"];
	userSelect?: CSSProperties["userSelect"];
	overflowX?: CSSProperties["overflowX"];
	overflowY?: CSSProperties["overflowY"];
	float?: CSSProperties["float"];
	clear?: CSSProperties["clear"];
	verticalAlign?: CSSProperties["verticalAlign"];
	tableLayout?: CSSProperties["tableLayout"];
	borderCollapse?: CSSProperties["borderCollapse"];
	borderSpacing?: string;
	columnCount?: CSSProperties["columnCount"];
	columnWidth?: CSSProperties["columnWidth"];
	fontFamily?: ResponsiveValue<CSSProperties["fontFamily"]>;
	fontStyle?: CSSProperties["fontStyle"];
	fontVariant?: CSSProperties["fontVariant"];
	fontStretch?: CSSProperties["fontStretch"];
	fontFeatureSettings?: CSSProperties["fontFeatureSettings"];
	fontVariationSettings?: string;
	textTransform?: CSSProperties["textTransform"];
	textDecoration?: CSSProperties["textDecoration"];
	textDecorationColor?: CSSProperties["textDecorationColor"];
	textDecorationStyle?: CSSProperties["textDecorationStyle"];
	textUnderlineOffset?: string;
	textShadow?: CSSProperties["textShadow"];
	textIndent?: CSSProperties["textIndent"];
	textRendering?: CSSProperties["textRendering"];
	textWrap?: string;
	wordBreak?: CSSProperties["wordBreak"];
	wordSpacing?: CSSProperties["wordSpacing"];
	whiteSpace?: CSSProperties["whiteSpace"];
	hyphens?: CSSProperties["hyphens"];
	writingMode?: CSSProperties["writingMode"];
	direction?: CSSProperties["direction"];
	caretColor?: CSSProperties["caretColor"];
	accentColor?: CSSProperties["accentColor"];
	lineBreak?: CSSProperties["lineBreak"];
	tabSize?: CSSProperties["tabSize"];
	gridColumn?: CSSProperties["gridColumn"];
	gridRow?: CSSProperties["gridRow"];
	gridArea?: CSSProperties["gridArea"];
	gridColumnStart?: CSSProperties["gridColumnStart"];
	gridColumnEnd?: CSSProperties["gridColumnEnd"];
	gridRowStart?: CSSProperties["gridRowStart"];
	gridRowEnd?: CSSProperties["gridRowEnd"];
	gridAutoFlow?: CSSProperties["gridAutoFlow"];
	gridAutoColumns?: CSSProperties["gridAutoColumns"];
	gridAutoRows?: CSSProperties["gridAutoRows"];
	placeSelf?: string;
	placeItems?: string;
	placeContent?: string;
	animation?: CSSProperties["animation"];
	animationName?: CSSProperties["animationName"];
	animationDuration?: CSSProperties["animationDuration"];
	animationDelay?: CSSProperties["animationDelay"];
	animationTimingFunction?: CSSProperties["animationTimingFunction"];
	animationIterationCount?: CSSProperties["animationIterationCount"];
	animationFillMode?: CSSProperties["animationFillMode"];
	animationPlayState?: CSSProperties["animationPlayState"];
	animationDirection?: CSSProperties["animationDirection"];
	scrollSnapAlign?: CSSProperties["scrollSnapAlign"];
	scrollSnapStop?: CSSProperties["scrollSnapStop"];
	scrollMarginTop?: string | number;
	scrollMarginBottom?: string | number;
	scrollMarginLeft?: string | number;
	scrollMarginRight?: string | number;
	scrollPaddingTop?: string | number;
	scrollPaddingBottom?: string | number;
	overscrollBehavior?: CSSProperties["overscrollBehavior"];
	overscrollBehaviorX?: CSSProperties["overscrollBehaviorX"];
	overscrollBehaviorY?: CSSProperties["overscrollBehaviorY"];
	outline?: CSSProperties["outline"];
	outlineColor?: CSSProperties["outlineColor"];
	outlineOffset?: CSSProperties["outlineOffset"];
	outlineWidth?: CSSProperties["outlineWidth"];
	outlineStyle?: CSSProperties["outlineStyle"];
	listStyle?: CSSProperties["listStyle"];
	listStyleType?: CSSProperties["listStyleType"];
	listStylePosition?: CSSProperties["listStylePosition"];
	content?: CSSProperties["content"];
	fill?: string;
	stroke?: string;
	strokeWidth?: string | number;
	strokeDasharray?: string;
	strokeDashoffset?: string | number;
	strokeLinecap?: "butt" | "round" | "square";
	strokeLinejoin?: "miter" | "round" | "bevel";
}

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

export interface StackProps extends Omit<BaseNodeProps, "direction"> {
	direction?: ResponsiveValue<"horizontal" | "vertical">;
	gap?: ResponsiveValue<string | number>;
	align?: ResponsiveValue<string>;
	justify?: ResponsiveValue<string>;
	wrap?: boolean;
	dividers?: boolean;
}

export interface GridProps extends BaseNodeProps {
	columns?: ResponsiveValue<number | string>;
	rows?: ResponsiveValue<number | string>;
	gap?: ResponsiveValue<string | number>;
	colGap?: ResponsiveValue<string | number>;
	rowGap?: ResponsiveValue<string | number>;
	autoFit?: boolean;
	minColWidth?: string;
	align?: ResponsiveValue<CSSProperties["alignItems"]>;
	justify?: ResponsiveValue<CSSProperties["justifyContent"]>;
}

export type TextVariant =
	| "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
	| "body" | "body-sm" | "lead" | "caption" | "label" | "mono" | "overline";

export interface TextPart {
	text: string;
	href?: string;
	target?: "_blank" | "_self" | "_parent" | "_top";
	rel?: string;
	style?: CSSProperties;
}

export interface TextProps extends BaseNodeProps {
	variant?: TextVariant;
	size?: ResponsiveValue<string>;
	weight?: ResponsiveValue<CSSProperties["fontWeight"]>;
	align?: ResponsiveValue<CSSProperties["textAlign"]>;
	lineHeight?: string | number;
	letterSpacing?: string;
	truncate?: boolean | number;
	italic?: boolean;
	underline?: boolean;
	gradient?: string;
	content?: string;
	as?: keyof JSX.IntrinsicElements;
	parts?: TextPart[];
}

export interface MarkdownProps extends BaseNodeProps {
	content?: string;
	filePath?: string;
	textColor?: string;
	headingColor?: string;
	linkColor?: string;
	mutedColor?: string;
	fontFamily?: ResponsiveValue<CSSProperties["fontFamily"]>;
	bodySize?: string;
	bodyLineHeight?: number | string;
	headingSizes?: Partial<Record<"h1" | "h2" | "h3" | "h4" | "h5" | "h6", string>>;
	headingIdPrefix?: string;
	disablepointformarkdownhashhash?: boolean;
	disablepointformarkdownhash?: boolean;
	textAnimation?: "none" | "fade-in" | "slide-up";
	blockAnimation?: "none" | "fade-in" | "slide-up";
	animationDuration?: string;
	animationStagger?: number;
}

export interface HeadingProps extends TextProps {
	level?: 1 | 2 | 3 | 4 | 5 | 6;
	subheading?: string;
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
	contentMaxWidth?: ResponsiveValue<string | number>;
	centered?: boolean;
	fullViewport?: boolean;
	snapAlign?: "start" | "center" | "end";
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
	cprop?: any;
	onClick?: string | MouseEventHandler<HTMLAnchorElement>;
}

export type SuspensePreset = "skeleton" | "spinner" | "shimmer" | "pulse" | "blur";

export interface EngineSuspenseProps extends BaseNodeProps {
	children?: ReactNode;
	preset?: SuspensePreset;
	minHeight?: string | number;
	skeletonLines?: number;
	delay?: number;
	timeout?: number;
	errorFallback?: string;
	fallback?: ReactNode;
}

export interface EngineFormProps extends BaseNodeProps {
	children?: ReactNode;
	onSubmit?: string;
	onReset?: string;
	noValidate?: boolean;
	autoComplete?: string;
	action?: string;
	method?: "get" | "post";
	encType?: string;
}

export type InputType =
	| "text" | "email" | "password" | "search" | "url" | "tel"
	| "number" | "hidden" | "date" | "time" | "color" | "range" | "file"
	| "checkbox" | "radio" | "submit" | "reset" | "button";

export interface EngineInputProps extends BaseNodeProps {
	type?: InputType;
	name?: string;
	placeholder?: string;
	defaultValue?: string | number;
	value?: string | number;
	disabled?: boolean;
	required?: boolean;
	pattern?: string;
	min?: string | number;
	max?: string | number;
	step?: string | number;
	minLength?: number;
	maxLength?: number;
	multiple?: boolean;
	accept?: string;
	autoComplete?: string;
	ariaLabel?: string;
	ariaDescribedBy?: string;
	onChange?: string;
	readOnly?: boolean;
	autoFocus?: boolean;
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
	resizable?: "none" | "both" | "horizontal" | "vertical" | "block" | "inline";
}

export interface EngineCheckboxProps extends BaseNodeProps {
	name?: string;
	value?: string;
	checked?: boolean;
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
	htmlFor?: string;
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
	color?: string;
	thickness?: string;
	style?: "solid" | "dashed" | "dotted";
	my?: ResponsiveValue<string | number>;
}

export interface OptionProps extends BaseNodeProps {
	value: string;
	label?: string;
	disabled?: boolean;
	selected?: boolean;
}

export interface OptGroupProps extends BaseNodeProps {
	label: string;
	disabled?: boolean;
}

export interface SlotProps {
	name: string;
	fallback?: SchemaNode;
}

export interface EngineScrollProps extends BaseNodeProps {
	method?: "ease" | "smooth" | "snap" | "instant";
	scrollDuration?: number;
	easing?: "ease-in-out" | "ease-in" | "ease-out" | "linear" | "spring";
	pageTransition?: boolean;
	transitionDuration?: number;
	transitionColor?: string;
	scrollOffset?: number | string;
}

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface CustomSelectProps extends BaseNodeProps {
	name: string;
	label?: string;
	options: SelectOption[];
	placeholder?: string;
	defaultValue?: string;
	onChange?: string;
	searchable?: boolean;
	clearable?: boolean;
	size?: "sm" | "md" | "lg";
}

export interface CanvasNodeProps extends Omit<BaseNodeProps, "width" | "height"> {
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
	onSetup?: string;
	onDraw?: string;
	onResize?: string;
	graphics?: {
		engine: string;
		scene: ECScene;
	};
}

export interface SchemaNode {
	type: NodeType;
	name?: string;
	key?: string;
	props?: Record<string, unknown>;
	children?: SchemaNode[] | string;
}

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
	viewport?: string;
}

export interface EngineTheme {
	vars?: Record<string, string>;
	fonts?: string[];
	globalStyles?: string;
}

export interface PageSchema {
	meta?: PageMeta;
	theme?: EngineTheme;
	root: SchemaNode;
}

export interface EngineConfig {
	breakpoints?: Partial<Record<Breakpoint, number>>;
	contentMaxWidth?: string;
	gapBase?: string;
	spacingScale?: (n: number) => string;
}

export interface MobileCpropPatch extends CpropValue {
	hide?: boolean;
}

export interface MobilePatchDirectives {
	"remove-all-prop"?: boolean;
	"remove-all-cprop"?: boolean;
	props?: Record<string, unknown>;
	cprop?: MobileCpropPatch;
}

export type MobilePatch = {
	[selector: string]: MobilePatchDirectives;
};

export type MobileSchemaConfig = MobilePatch[];
