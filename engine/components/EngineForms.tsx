"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Native Form Components
//
//  Schema-native HTML form primitives with named handler resolution.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	forwardRef,
	memo,
	type ChangeEvent,
	type FormEvent,
	type ReactNode,
} from "react";
import { usePropStyles, cpropClass } from "../hooks/usePropStyles";
import { useHandler } from "../providers/EngineProvider";
import type { BaseNodeProps } from "../schema/types";

function assignBoundValue(
	values: Record<string, unknown>,
	key: string,
	value: unknown,
): void {
	if (!(key in values)) {
		values[key] = value;
		return;
	}

	const existing = values[key];
	values[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
}

function readBoundValue(element: HTMLElement): { include: boolean; value: unknown } {
	if (element instanceof HTMLInputElement) {
		if (element.disabled) return { include: false, value: undefined };

		if (element.type === "checkbox") {
			return {
				include: true,
				value: element.checked ? (element.value || "on") : "off",
			};
		}

		if (element.type === "radio") {
			return element.checked
				? { include: true, value: element.value }
				: { include: false, value: undefined };
		}

		if (element.type === "file") {
			const files = element.files ? Array.from(element.files) : [];
			return {
				include: true,
				value: element.multiple ? files : (files[0] ?? null),
			};
		}

		return { include: true, value: element.value };
	}

	if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
		if (element.disabled) return { include: false, value: undefined };
		return { include: true, value: element.value };
	}

	return { include: false, value: undefined };
}

function collectBoundFormValues(form: HTMLFormElement): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	const boundFields = form.querySelectorAll<HTMLElement>("[data-engine-bind]");

	for (const field of boundFields) {
		const key = field.dataset.engineBind;
		if (!key) continue;
		const resolved = readBoundValue(field);
		if (!resolved.include) continue;
		assignBoundValue(values, key, resolved.value);
	}

	return values;
}

// ── EngineForm ────────────────────────────────────────────────────────────────

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

export const EngineForm = memo(
	forwardRef<HTMLFormElement, EngineFormProps>(function EngineForm(
		{
			children,
			onSubmit,
			onReset,
			noValidate = false,
			autoComplete,
			action,
			method,
			encType,
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
		const submitHandler = useHandler(onSubmit ?? "");
		const resetHandler = useHandler(onReset ?? "");

		const handleSubmit = submitHandler
			? (event: FormEvent<HTMLFormElement>) => {
				if (!action) event.preventDefault();
				submitHandler(collectBoundFormValues(event.currentTarget), event);
			}
			: undefined;

		const handleReset = resetHandler
			? (event: FormEvent<HTMLFormElement>) => resetHandler(event)
			: undefined;

		return (
			<form
				ref={ref}
				id={resolvedId}
				className={mergedClass}
				style={resolvedStyle}
				noValidate={noValidate}
				autoComplete={autoComplete}
				action={action}
				method={method}
				encType={encType}
				onSubmit={handleSubmit}
				onReset={handleReset}
				data-engine-form={onSubmit || undefined}
			>
				{children}
			</form>
		);
	}),
);

// ── EngineInput ───────────────────────────────────────────────────────────────

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

export const EngineInput = memo(
	forwardRef<HTMLInputElement, EngineInputProps>(function EngineInput(
		{
			type = "text",
			name,
			placeholder,
			defaultValue,
			value,
			disabled = false,
			required = false,
			pattern,
			min,
			max,
			step,
			minLength,
			maxLength,
			multiple,
			accept,
			autoComplete,
			ariaLabel,
			ariaDescribedBy,
			onChange,
			readOnly,
			autoFocus,
			tabIndex,
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
		const resolvedId = id ?? point ?? name;
		const changeHandler = useHandler(onChange ?? "");
		const handleChange = changeHandler
			? (event: ChangeEvent<HTMLInputElement>) => {
				const currentValue = event.currentTarget.type === "checkbox"
					? (event.currentTarget.checked ? (event.currentTarget.value || "on") : "off")
					: event.currentTarget.value;
				changeHandler(currentValue, event);
			}
			: undefined;

		return (
			<input
				ref={ref}
				id={resolvedId}
				name={name}
				type={type}
				placeholder={placeholder}
				defaultValue={value === undefined ? defaultValue : undefined}
				value={value}
				disabled={disabled}
				required={required}
				pattern={pattern}
				min={min}
				max={max}
				step={step}
				minLength={minLength}
				maxLength={maxLength}
				multiple={multiple}
				accept={accept}
				autoComplete={autoComplete}
				readOnly={readOnly}
				autoFocus={autoFocus}
				tabIndex={tabIndex}
				aria-label={ariaLabel}
				aria-describedby={ariaDescribedBy}
				aria-required={required || undefined}
				aria-disabled={disabled || undefined}
				className={mergedClass}
				style={resolvedStyle}
				onChange={handleChange}
				data-engine-bind={name}
				data-engine-handler={onChange}
			/>
		);
	}),
);

// ── EngineTextarea ────────────────────────────────────────────────────────────

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

export const EngineTextarea = memo(
	forwardRef<HTMLTextAreaElement, EngineTextareaProps>(function EngineTextarea(
		{
			name,
			placeholder,
			defaultValue,
			value,
			disabled = false,
			required = false,
			rows = 4,
			cols,
			minLength,
			maxLength,
			readOnly,
			autoFocus,
			tabIndex,
			autoComplete,
			ariaLabel,
			ariaDescribedBy,
			onChange,
			resizable,
			style,
			className,
			id,
			point,
			cprop,
			...props
		},
		ref,
	) {
		const resolvedStyle = usePropStyles(props as any, { resize: resizable, ...style });
		const stateClass = cpropClass(cprop);
		const mergedClass = [className, stateClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point ?? name;
		const changeHandler = useHandler(onChange ?? "");
		const handleChange = changeHandler
			? (event: ChangeEvent<HTMLTextAreaElement>) => changeHandler(event.currentTarget.value, event)
			: undefined;

		return (
			<textarea
				ref={ref}
				id={resolvedId}
				name={name}
				placeholder={placeholder}
				defaultValue={value === undefined ? defaultValue : undefined}
				value={value}
				disabled={disabled}
				required={required}
				rows={rows}
				cols={cols}
				minLength={minLength}
				maxLength={maxLength}
				readOnly={readOnly}
				autoFocus={autoFocus}
				tabIndex={tabIndex}
				autoComplete={autoComplete}
				aria-label={ariaLabel}
				aria-describedby={ariaDescribedBy}
				aria-required={required || undefined}
				aria-disabled={disabled || undefined}
				className={mergedClass}
				style={resolvedStyle}
				onChange={handleChange}
				data-engine-bind={name}
				data-engine-handler={onChange}
			/>
		);
	}),
);

// ── EngineCheckbox ────────────────────────────────────────────────────────────

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

export const EngineCheckbox = memo(
	forwardRef<HTMLInputElement, EngineCheckboxProps>(function EngineCheckbox(
		{
			name,
			value,
			checked,
			defaultChecked,
			disabled = false,
			required = false,
			ariaLabel,
			ariaDescribedBy,
			onChange,
			tabIndex,
			autoFocus,
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
		const resolvedId = id ?? point ?? name;
		const changeHandler = useHandler(onChange ?? "");
		const handleChange = changeHandler
			? (event: ChangeEvent<HTMLInputElement>) => {
				const currentValue = event.currentTarget.checked
					? (event.currentTarget.value || "on")
					: "off";
				changeHandler(currentValue, event);
			}
			: undefined;

		return (
			<input
				ref={ref}
				type="checkbox"
				id={resolvedId}
				name={name}
				value={value}
				checked={checked !== undefined ? checked : undefined}
				defaultChecked={checked === undefined ? defaultChecked : undefined}
				disabled={disabled}
				required={required}
				tabIndex={tabIndex}
				autoFocus={autoFocus}
				aria-label={ariaLabel}
				aria-describedby={ariaDescribedBy}
				aria-required={required || undefined}
				aria-disabled={disabled || undefined}
				aria-checked={checked}
				className={mergedClass}
				style={resolvedStyle}
				onChange={handleChange}
				data-engine-bind={name}
				data-engine-handler={onChange}
			/>
		);
	}),
);

// ── EngineLabel ───────────────────────────────────────────────────────────────

export interface EngineLabelProps extends BaseNodeProps {
	children?: ReactNode;
	htmlFor?: string;
	forInput?: string;
}

export const EngineLabel = memo(
	forwardRef<HTMLLabelElement, EngineLabelProps>(function EngineLabel(
		{
			children,
			htmlFor,
			forInput,
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
		const resolvedFor = htmlFor ?? (forInput ? `for-${forInput}` : undefined);

		return (
			<label
				ref={ref}
				id={resolvedId}
				htmlFor={resolvedFor}
				className={mergedClass}
				style={resolvedStyle}
			>
				{children}
			</label>
		);
	}),
);
