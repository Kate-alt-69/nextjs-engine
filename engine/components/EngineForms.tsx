"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Native Form Components
//
//  First-class native HTML form element primitives.
//  All components:
//    · Support cprop.bind for EngineAPIResolver field binding
//    · Follow engine prop patterns (usePropStyles, cpropClass)
//    · Include ARIA defaults for accessibility
//    · Are React.memo wrapped for performance
// ─────────────────────────────────────────────────────────────────────────────

import React, { forwardRef, memo, type ReactNode } from "react";
import { usePropStyles, cpropClass } from "../hooks/usePropStyles";
import type { BaseNodeProps } from "../schema/types";

// ── EngineForm ────────────────────────────────────────────────────────────────

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
    const hoverClass   = cpropClass(cprop);
    const mergedClass  = [className, hoverClass].filter(Boolean).join(" ") || undefined;
    const resolvedId   = id ?? point;

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
        data-engine-form={onSubmit ?? ""}
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
    const hoverClass   = cpropClass(cprop);
    const mergedClass  = [className, hoverClass].filter(Boolean).join(" ") || undefined;
    const resolvedId   = id ?? point ?? name;

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
  /** resize CSS property shorthand */
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
    const resolvedStyle = usePropStyles(props as any, {
      resize: resizable,
      ...style,
    });
    const hoverClass  = cpropClass(cprop);
    const mergedClass = [className, hoverClass].filter(Boolean).join(" ") || undefined;
    const resolvedId  = id ?? point ?? name;

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
        data-engine-bind={name}
        data-engine-handler={onChange}
      />
    );
  }),
);

// ── EngineCheckbox ────────────────────────────────────────────────────────────

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
    const hoverClass   = cpropClass(cprop);
    const mergedClass  = [className, hoverClass].filter(Boolean).join(" ") || undefined;
    const resolvedId   = id ?? point ?? name;

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
        data-engine-bind={name}
        data-engine-handler={onChange}
      />
    );
  }),
);

// ── EngineLabel ───────────────────────────────────────────────────────────────

export interface EngineLabelProps extends BaseNodeProps {
  children?: ReactNode;
  /** The id of the form element this label is for */
  htmlFor?: string;
  /** Shorthand: if set and htmlFor is not, uses `for-${forInput}` as htmlFor */
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
    const hoverClass   = cpropClass(cprop);
    const mergedClass  = [className, hoverClass].filter(Boolean).join(" ") || undefined;
    const resolvedId   = id ?? point;
    const resolvedFor  = htmlFor ?? forInput;

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
