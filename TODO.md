# Next.js Engine — Master Architectural Task Registry

> **Last Updated:** June 18, 2026
> **Status:** Active Development
> **Legend:** 🚨 Blocking • 🔴 High • 🟡 Medium • 🟢 Low • ✅ Completed

---

# Overview

This document serves as the single source of truth for all architectural work,
feature planning, bug tracking, engine milestones, and long-term development
goals for the Next.js Engine.

The registry tracks:

* Core engine architecture
* Rendering pipeline
* React / Next.js compatibility
* Schema evolution
* Performance optimization
* API framework
* Security architecture
* Rendering reliability
* Developer Experience (DX)
* Completed milestones

---

# Engine Security Model

The engine follows a strict zero-fingerprint philosophy.

## Anti-Fingerprinting Protocol

All internal networking components must avoid exposing implementation details
that could identify the framework or engine powering a deployment.

### Rules

* Never emit `X-Engine-*` headers.
* Never expose framework identifiers in network requests.
* Never expose internal runtime versions.
* Never expose engine build metadata.
* Never expose compiler identifiers.
* Never generate identifiable request fingerprints.

Approved security headers include:

* `Authorization`
* `X-Key`
* `X-Timestamp`
* `X-Signature`

All authentication implementations must comply with this protocol.

---

# EngineAPI Authentication Support

The EngineAPI subsystem officially supports the following authentication
strategies:

| Method                            | Status    |
| --------------------------------- | --------- |
| Public / Private Signatures (PNP) | Planned   |
| Generic API Keys (AK)             | Planned   |
| Bearer Tokens                     | Planned   |
| JWT                               | Planned   |
| HMAC                              | Planned   |
| Basic Authentication              | Planned   |
| Anonymous Requests                | Supported |

Authentication is configured through `.EngineAPIConfig` and resolved entirely
through `EngineAPIResolver`.

---

# 🚨 BLOCKING

These issues must be completed before the next production deployment.

---

## [TASK-010] Native `<select>` Rendering Support

### Priority

🚨 Blocking

### Problem

React 19 introduces significantly stricter hydration validation.

The current engine falls back to `<div>` whenever a node type is unknown.

This causes invalid HTML:

```text
<select>
    <div />
</select>
```

React correctly rejects this structure and hydration fails.

---

### Root Cause

Current registry:

```
EngineBox(as="select")
        │
        ▼
Unknown Node
        │
        ▼
Fallback <div>
```

Browsers reject this DOM.

---

### Required Implementation

Create dedicated primitives:

* EngineOption
* EngineOptGroup

Both must render native HTML.

---

### Files

```
components/primitives.tsx
core/registry.ts
schema/types.ts
```

---

### Required Work

* [ ] Create `EngineOption`
* [ ] Create `EngineOptGroup`
* [ ] Add `OptionProps`
* [ ] Add `OptGroupProps`
* [ ] Register `"option"`
* [ ] Register `"optgroup"`
* [ ] Verify slot resolution executes before registry lookup
* [ ] Validate React 19 hydration compatibility

---

## [TASK-004] Eliminate Client Boundary Leakage

### Priority

🚨 Blocking

### Problem

Currently the engine ships nearly the entire rendering tree to the browser.

Consequences:

* Very large JavaScript bundles
* Poor Time To Interactive (TTI)
* No effective React Server Components
* Lost SSR performance

---

### Root Cause

Current architecture:

```
SchemaRenderer
      │
      ▼
StyleCollector
      │
      ▼
useEngineContext
      │
      ▼
Entire render tree marked "use client"
```

The StyleCollector currently depends on runtime rendering.

---

### Target Architecture

## Server Phase

Responsible for:

* Schema parsing
* HTML generation
* CSS generation
* Static class generation
* Metadata generation

Outputs:

* HTML
* CSS stylesheet
* Static render tree

---

## Client Phase

Hydrates only interactive nodes.

Examples:

* Button
* Canvas
* Scroll
* Suspense
* Input
* Forms
* Custom Select
* Future interactive widgets

---

### Blockers

The current `StyleCollector` remains tightly coupled to React's render cycle.

This dependency must be removed before Server Component rendering becomes
possible.

---

### Files

```
createPage.tsx
SchemaRenderer.tsx
StyleCollector.ts
usePropStyles.ts
```

---

### Required Work

* [ ] Separate server compilation
* [ ] Move StyleCollector to build phase
* [ ] Generate CSS before render
* [ ] Hydrate only interactive leaf nodes
* [ ] Restore full React Server Component compatibility

---

## Deployment Requirement

No production release should occur until all 🚨 Blocking tasks have been completed.

These tasks directly affect correctness, hydration stability, or overall engine architecture.

---

# 🔴 HIGH PRIORITY

These tasks introduce major engine capabilities and should be completed after all
blocking issues have been resolved.

---

# [TASK-011] EngineAPI Framework

## Status

🔴 High Priority

---

## Overview

EngineAPI introduces a first-class networking layer directly into the schema
engine.

Instead of manually writing `fetch()` calls throughout React components,
networking becomes declarative and schema-driven.

EngineAPI provides:

* Build-time configuration
* Runtime endpoint resolution
* Authentication abstraction
* Version routing
* Form binding
* Automatic request execution
* Response handlers
* Page-level configuration overrides
* React Suspense integration

Everything is handled internally through EngineAPIResolver.

---

# EngineAPI Architecture

```
.EngineAPIConfig
        │
        ▼
EngineAPIConfigParser
        │
        ▼
Compiled JSON
        │
        ▼
EngineAPIResolver
        │
        ▼
Schema cprop.api
        │
        ▼
Resolved Endpoint
        │
        ▼
Authentication
        │
        ▼
Native fetch()
        │
        ▼
onSuccess / onError
```

---

# EngineAPIConfig

A dedicated configuration system stored inside:

```
.EngineAPIConfig/
```

The configuration is parsed during build time and compiled into optimized JSON
consumed by the runtime.

The configuration defines:

* Provider
* Endpoint
* Default cache
* Default method
* Authentication
* Headers
* Version macros

---

## Supported Authentication

EngineAPI supports multiple authentication mechanisms without requiring external
dependencies.

| Authentication                    | Supported |
| --------------------------------- | --------- |
| PNP (Public / Private Signatures) | ✅         |
| API Keys                          | ✅         |
| HMAC                              | ✅         |
| Bearer Tokens                     | ✅         |
| JWT                               | ✅         |
| Basic Authentication              | ✅         |
| Anonymous Requests                | ✅         |

Authentication is selected using:

```
auth.type
```

Supported values:

```
pnp
ak
hmac
bearer
basic
none
```

---

# Supported Authentication Methods

## PNP

Uses asymmetric cryptography.

Automatically generates:

```
X-Key
X-Timestamp
X-Signature
```

Payloads are signed using Web Crypto.

Supported algorithms:

* Ed25519
* RS256

---

## API Key

Attaches an API key to a configurable destination header.

Example:

```
X-Key
```

or

```
Authorization
```

depending on configuration.

---

## HMAC

Generates a symmetric request signature.

Signature includes:

* HTTP Method
* URL
* Timestamp
* Request Body

Header output:

```
X-Signature
```

Supported algorithms:

* SHA-256
* SHA-512

---

## Bearer

Automatically formats:

```
Authorization: Bearer <token>
```

Supports:

* OAuth
* JWT
* Static Bearer Tokens

---

## Basic Authentication

Automatically generates

```
Authorization: Basic <base64(username:password)>
```

using native runtime utilities.

---

# Anti-Fingerprinting Enforcement

All EngineAPI requests must comply with the engine's anti-fingerprinting
protocol.

Forbidden headers:

```
X-Engine-*
X-Powered-By
X-Framework
```

Allowed headers include:

```
Authorization
X-Key
X-Timestamp
X-Signature
```

No internal engine identifiers may appear in outgoing requests.

---

# URL Version Macros

EngineAPI supports reusable version aliases.

Example:

```
/&VERSION_1&/users/login
```

Automatically resolves to:

```
https://provider/api/version/users/login
```

This allows entire API versions to be upgraded without changing individual
schemas.

---

# Page-Level Configuration Cascade

Any schema node may locally override the global EngineAPI configuration.

Hierarchy:

```
Global Config
        │
        ▼
Page Override
        │
        ▼
Node Override
```

Deep merging preserves unspecified parent values.

Example overrides include:

* Provider
* Endpoint
* Authentication
* Headers
* Cache
* Request Method

---

# Form Variable Binding

Input components may bind directly into EngineAPI.

Example:

```
cprop.bind = "email"
```

Engine state automatically tracks values.

When submitting:

```
fields:
    email
    password
    username
```

EngineAPIResolver automatically assembles the request body.

No manual form serialization is required.

---

# Request Triggers

Supported trigger modes:

| Trigger  | Description                        |
| -------- | ---------------------------------- |
| onMount  | Executes when the component mounts |
| onSubmit | Executes after form submission     |
| onClick  | Executes after click               |
| manual   | Executed programmatically          |

---

# Response Handling

Responses may define:

```
onSuccess
```

and

```
onError
```

Both resolve through EngineProvider.

Handlers receive typed payloads generated by EngineAPIResolver.

---

# Native Runtime

EngineAPI must remain dependency-free.

Native browser/server APIs only.

Required runtime features:

* fetch()
* Web Crypto
* TextEncoder
* TextDecoder
* AbortController

No third-party HTTP clients.

---

# Files

Create:

```
core/
    EngineAPIResolver.ts

core/
    EngineAPIConfigParser.ts

plugins/
    engineApiPlugin.js
```

Update:

```
schema/types.ts

core/registry.ts
```

---

# Required Work

## Configuration

* [ ] Build EngineAPIConfig parser
* [ ] Support TOML-inspired syntax
* [ ] Compile configuration during build
* [ ] Environment variable substitution
* [ ] Deep configuration merging

---

## Runtime

* [ ] Resolve providers
* [ ] Resolve endpoints
* [ ] Resolve version macros
* [ ] Resolve page overrides
* [ ] Build request body
* [ ] Execute fetch
* [ ] Handle errors
* [ ] Invoke callbacks

---

## Authentication

* [ ] PNP
* [ ] API Key
* [ ] HMAC
* [ ] Bearer
* [ ] JWT
* [ ] Basic

---

## Security

* [ ] Anonymous headers only
* [ ] Ban framework headers
* [ ] Timestamp validation
* [ ] Signature generation
* [ ] Replay attack protection

---

## Documentation

* [ ] EngineAPIConfig specification
* [ ] Authentication reference
* [ ] cprop.api reference
* [ ] Migration guide

---

# [TASK-015] EngineSuspense Framework

## Status

🔴 High Priority

---

## Overview

EngineSuspense provides a schema-native abstraction over `React.Suspense`,
allowing asynchronous engine components to define loading states directly within
their schema.

Unlike raw `React.Suspense`, EngineSuspense integrates with the engine registry,
EngineAPIResolver, lazy imports, schema rendering, and future streaming
capabilities.

Supported async operations include:

* EngineAPI requests
* Lazy-loaded engine components
* Markdown loading
* Dynamic imports
* Future CMS integrations
* Future database adapters

---

# Rendering Flow

```text
Schema
   │
   ▼
SchemaRenderer
   │
   ▼
EngineSuspense
   │
   ▼
React.Suspense
   │
   ▼
Fallback Preset
   │
   ▼
Resolved Content
```

---

# Supported Presets

EngineSuspense ships with built-in fallback presets.

## Skeleton

Use for:

* Articles
* Cards
* Blog posts
* Product pages
* Documentation

Features:

* Multiple configurable lines
* Adjustable spacing
* Responsive layout
* Theme aware

---

## Spinner

Use for:

* Buttons
* Login requests
* Small widgets
* Dialog actions

Centered animated loading indicator.

---

## Shimmer

Use for:

* Tables
* Lists
* Dashboards
* Social feeds

Animated left-to-right shimmer effect.

---

## Pulse

Use for:

* Images
* Videos
* Media placeholders

Opacity animation until content resolves.

---

## Blur

Use for:

* Hero sections
* Overlay reveals
* Progressive loading

Content renders immediately with a configurable blur that fades away once data
has loaded.

---

# Schema Usage

Example:

```ts
{
  type: "suspense",
  props: {
    preset: "skeleton",
    minHeight: "240px",
    skeletonLines: 5,
    delay: 200,
    timeout: 8000,
    errorFallback: "error-ui"
  },
  children: [
    ...
  ]
}
```

---

# Supported Properties

| Property      | Description                     |
| ------------- | ------------------------------- |
| preset        | Built-in loading preset         |
| minHeight     | Placeholder height              |
| skeletonLines | Number of placeholder rows      |
| delay         | Delay before fallback appears   |
| timeout       | Maximum wait before error state |
| errorFallback | Schema node rendered on timeout |

---

# Timeout Handling

EngineSuspense should support automatic timeout recovery.

Flow:

```text
Loading
    │
    ▼
Delay
    │
    ▼
Fallback
    │
    ▼
Resolved
      │
      ├── Success → Render Content
      │
      └── Timeout → Error Fallback
```

---

# Future Integrations

Planned integrations include:

* EngineAPIResolver
* React Server Components
* Streaming SSR
* Incremental Rendering
* Partial Hydration
* Asset Preloading
* Route Transitions

---

# Files

Create:

```text
components/
    EngineSuspense.tsx
```

Update:

```text
core/registry.ts
schema/types.ts
```

---

# Required Work

* [ ] Create EngineSuspense component
* [ ] Register `"suspense"` node
* [ ] Add EngineSuspenseProps
* [ ] Support all built-in presets
* [ ] Implement timeout handling
* [ ] Implement delayed fallback rendering
* [ ] Integrate with EngineAPIResolver
* [ ] Support future streaming SSR

---

# [TASK-012] Native Form Components

## Status

🔴 High Priority

---

## Overview

To fully support `cprop.bind` and EngineAPIResolver, native HTML form elements
must become first-class engine primitives.

These components should behave identically to their HTML counterparts while
remaining fully schema-driven.

---

# Components

## EngineForm

Native `<form>` wrapper.

Responsibilities:

* Submit handling
* EngineAPI integration
* Validation hooks
* Reset handling

---

## EngineInput

Supports:

* text
* email
* password
* search
* url
* tel
* number
* hidden
* date
* time
* color
* range
* file

Supports:

* `cprop.bind`
* Validation
* Default values
* Accessibility

---

## EngineTextarea

Supports:

* Rows
* Resize options
* Character limits
* `cprop.bind`

---

## EngineCheckbox

Supports:

* Boolean binding
* Groups
* Default checked state

---

## EngineLabel

Native label implementation with automatic `htmlFor` linking.

---

## Future Components

Planned additions:

* Radio
* Select
* Switch
* Date Picker
* Combobox
* Multi Select
* File Upload
* Color Picker

---

# Registry Updates

Register:

* `"form"`
* `"input"`
* `"textarea"`
* `"checkbox"`
* `"label"`

---

# Required Work

* [ ] Create all components
* [ ] Add schema interfaces
* [ ] Support cprop.bind
* [ ] Integrate with EngineAPIResolver
* [ ] Register all primitives
* [ ] Add accessibility defaults

---

# [TASK-013] EngineHero

## Status

🔴 High Priority

---

## Overview

The current `"hero"` node aliases `EngineSection`, meaning dedicated Hero
properties are ignored.

A native EngineHero component should replace this alias.

---

# Variants

Supported layouts:

* Centered
* Split
* Full Bleed

---

# Features

Support:

* Overlay gradients
* Overlay colors
* Background media
* Responsive layouts
* CTA alignment
* Hero height presets

---

# Parallax

Support CSS parallax backgrounds where available.

Use EngineBrowser capability detection to disable unsupported Safari behavior.

---

# Required Work

* [ ] Create EngineHero
* [ ] Replace Section alias
* [ ] Implement variants
* [ ] Implement overlay support
* [ ] Implement parallax support
* [ ] Add HeroProps

---

# [TASK-014] React 19 / Next.js 16 Compatibility Audit

## Status

🔴 High Priority

---

## Objective

Perform a complete compatibility audit against modern React and Next.js
behavior.

---

# Audit Checklist

Rendering

* [ ] Verify deterministic rendering
* [ ] Remove remaining hydration mismatches
* [ ] Audit concurrent rendering

React

* [ ] Remove legacy render APIs
* [ ] Verify `use()` compatibility
* [ ] Audit Suspense integration
* [ ] Validate streaming compatibility

Next.js

* [ ] Verify App Router compatibility
* [ ] Verify Server Components
* [ ] Verify Metadata integration
* [ ] Validate route transitions

Styles

* [ ] Re-test `<style precedence>`
* [ ] Validate CSS hoisting
* [ ] Verify StyleCollector output

Engine Components

* [ ] EngineScroll
* [ ] EngineMarkdown
* [ ] EngineCanvas
* [ ] EngineBrowser
* [ ] EngineHero
* [ ] EngineAPIResolver
* [ ] EngineSuspense

No production release should target React 19 or Next.js 16 until this audit is
fully complete.

---

# 🟡 MEDIUM PRIORITY

These tasks improve rendering quality, engine performance, developer
experience, and long-term maintainability. While not immediately blocking
production deployments, they represent important architectural improvements
that should be completed before introducing major new engine features.

---

# [TASK-005] Full Static Style De-duplication

## Status

🟡 Medium Priority

---

## Overview

The engine currently performs static style deduplication through
`usePropStyles`, grouping identical static properties into reusable CSS
classes.

While the core system is operational, several structural components still bypass
the collector and emit inline styles directly.

---

## Current Status

Completed:

* Static CSS class generation
* Hash-based style lookup
* Shared class reuse
* CSS variable support
* Responsive property compilation

Remaining work focuses on ensuring **every** engine component participates in
the same optimization pipeline.

---

## Remaining Work

### EngineSection

Current issue:

The internal wrapper `<div>` still applies certain styles directly instead of
using `usePropStyles`.

Required:

* [ ] Route inner wrapper styles through `usePropStyles`
* [ ] Verify static class generation
* [ ] Eliminate duplicated inline CSS

---

### EngineCard

Current issue:

The inner content wrapper bypasses the collector.

Required:

* [ ] Replace inline styling
* [ ] Generate reusable classes
* [ ] Verify deduplication

---

### Verification

Stress test:

Render:

* 50 Cards
* 100 Cards
* 500 Cards

Expected result:

Only a single shared CSS rule should exist for identical styling.

---

## Files

```
components/EngineSection.tsx
components/EngineCard.tsx
hooks/usePropStyles.ts
core/StyleCollector.ts
```

---

# [TASK-008] Full AST Markdown Parser

## Status

🟡 Medium Priority

---

## Overview

The current markdown renderer relies primarily on regular-expression
replacement.

While functional for simple content, regex-based parsing struggles with nested
structures and increasingly complex markdown syntax.

A dedicated Abstract Syntax Tree (AST) parser will improve correctness,
maintainability, and future extensibility.

---

## Current Limitations

Known issues include:

* Nested unordered lists
* Nested ordered lists
* Multi-level blockquotes
* Triple backtick code fences
* Tables
* Front matter
* Inline HTML edge cases
* Complex emphasis nesting

Current hydration warnings are suppressed, but parser correctness should be
improved.

---

## Goals

Replace the regex parser with a proper tokenization pipeline while preserving
the existing public API.

The `MarkdownProps` interface should remain unchanged to avoid breaking
existing projects.

---

## Features

Support:

* Headings
* Lists
* Nested lists
* Tables
* Code fences
* Syntax highlighting hooks
* Front matter
* Blockquotes
* Images
* Links
* Task lists
* Horizontal rules
* Inline formatting

---

## Optional Integration

Allow optional peer dependency support for:

* `marked`
* `remark`
* Custom parser

without making external packages mandatory.

---

## Required Work

* [ ] Build tokenizer
* [ ] Build AST
* [ ] Implement renderer
* [ ] Preserve MarkdownProps
* [ ] Improve hydration stability
* [ ] Benchmark performance

---

## Files

```
components/EngineMarkdown.tsx
```

---

# [TASK-016] Engine Compiler

## Status

🟡 Medium Priority

---

## Overview

Introduce a dedicated build-time compiler capable of transforming engine schemas
into optimized runtime artifacts.

The compiler will reduce runtime work by resolving as much information as
possible before deployment.

---

## Responsibilities

Compile:

* Schema trees
* Static CSS
* Metadata
* Route manifests
* Static node maps
* Registry lookups
* EngineAPI configuration
* Responsive styles

---

## Benefits

* Smaller client bundles
* Faster hydration
* Better SSR performance
* Reduced runtime computation
* Improved caching
* Deterministic rendering

---

## Planned Output

```
Compiled Schema

↓

Optimized JSON

↓

Runtime Renderer
```

---

## Required Work

* [ ] Build schema compiler
* [ ] Emit optimized JSON
* [ ] Pre-compute CSS
* [ ] Pre-compute metadata
* [ ] Pre-compute registries
* [ ] Integrate into build pipeline

---

# [TASK-017] Theme Compilation System

## Status

🟡 Medium Priority

---

## Overview

Introduce a centralized theme compiler capable of generating optimized design
tokens and CSS variables from theme definitions.

The system should support:

* Global themes
* Route themes
* Component themes
* Dark mode
* Light mode
* Custom theme inheritance

---

## Features

Compile:

* Colors
* Typography
* Spacing
* Radius
* Shadows
* Motion
* Breakpoints
* CSS variables

---

## Required Work

* [ ] Theme parser
* [ ] Variable generator
* [ ] Theme inheritance
* [ ] Dark mode
* [ ] Multiple theme support

---

# [TASK-018] Static Schema Analyzer

## Status

🟡 Medium Priority

---

## Overview

Create an analyzer capable of inspecting schemas during development and build
time to detect architectural issues before runtime.

---

## Checks

Detect:

* Unknown node types
* Invalid property names
* Invalid property values
* Missing required props
* Invalid nesting
* Duplicate IDs
* Circular references
* Accessibility issues
* Performance warnings

---

## Output

Provide readable diagnostics similar to TypeScript compiler output.

Example:

```
Schema Error

Page:
app/contact/page.tsx

Path:
children[2].children[5]

Problem:
Unknown node type "texarea"

Suggestion:
Did you mean "textarea"?
```

---

## Required Work

* [ ] Schema analyzer
* [ ] Error formatter
* [ ] Warning system
* [ ] Build integration
* [ ] IDE-friendly diagnostics

---

# [TASK-019] Asset Pipeline

## Status

🟡 Medium Priority

---

## Overview

Create a centralized asset pipeline for engine-managed resources.

The pipeline should optimize and prepare assets during build time.

---

## Supported Assets

* Images
* SVG
* Video
* Audio
* Fonts
* Icons
* Markdown assets

---

## Responsibilities

* Compression
* Hashing
* Fingerprinting
* Responsive image generation
* Lazy loading metadata
* Manifest generation

---

## Required Work

* [ ] Asset manifest
* [ ] Image optimization
* [ ] Font optimization
* [ ] SVG optimization
* [ ] Build integration

---

# [TASK-020] Accessibility Audit Framework

## Status

🟡 Medium Priority

---

## Overview

Introduce automated accessibility validation across the entire engine.

The audit framework should evaluate rendered schemas and provide actionable
feedback for developers.

---

## Checks

Audit:

* Missing labels
* Missing alt text
* Color contrast
* Keyboard navigation
* Focus order
* ARIA usage
* Heading hierarchy
* Landmark structure

---

## Goal

Enable developers to identify accessibility issues before deployment and move
toward WCAG-compliant output by default.

---

## Required Work

* [ ] Accessibility analyzer
* [ ] WCAG validation rules
* [ ] Schema integration
* [ ] Build-time reporting
* [ ] Developer diagnostics

---

# 🟢 LOW PRIORITY / MAINTENANCE

These tasks are non-blocking improvements, platform compatibility fixes, tooling
enhancements, and long-term maintenance work. They generally do not affect core
engine functionality but improve developer experience, platform stability, and
future extensibility.

---

# [TASK-002] LazySection Safari Compatibility

## Status

🟢 Low Priority

---

## Overview

Safari versions earlier than 16 contain rendering issues with modern CSS
properties used by `LazySection`.

Specifically, the combination of:

* `content-visibility: auto`
* `contain-intrinsic-height`

can cause sections to collapse or render with incorrect sizing.

---

## Current Behavior

Affected browsers:

* Safari < 16

Unaffected:

* Chromium
* Firefox
* Edge
* Safari 16+

---

## Planned Solution

Use `EngineBrowser` capability detection to selectively apply compatibility
styles only on affected Safari versions.

Fallback behavior:

* Explicit `min-height`
* Static placeholders
* Progressive enhancement

---

## Required Work

* [ ] Detect Safari version
* [ ] Apply compatibility CSS
* [ ] Prevent collapsed placeholders
* [ ] Verify rendering consistency

---

## Files

```text
components/LazySection.tsx
core/EngineBrowser.ts
```

---

# [TASK-007] Windows UTF-8 Environment Support

## Status

🟢 Low Priority

---

## Overview

Some Windows development environments default Python subprocesses to legacy
code pages such as `cp1252`, causing parser failures during automation and
build pipelines.

This primarily affects external tooling rather than the engine itself.

---

## Planned Fix

Force UTF-8 execution by configuring the environment before pipeline execution.

Example:

```python
os.environ["PYTHONUTF8"] = "1"
```

---

## Required Work

* [ ] Update automation scripts
* [ ] Verify UTF-8 handling
* [ ] Test on Windows 10
* [ ] Test on Windows 11

---

# [TASK-021] Engine CLI

## Status

🟢 Low Priority

---

## Overview

Develop an official command-line interface for creating, managing, and
maintaining Engine projects.

The CLI should simplify project setup and improve developer onboarding.

---

## Planned Commands

```text
engine create

engine dev

engine build

engine export

engine doctor

engine validate

engine upgrade
```

---

## Future Features

* Interactive project wizard
* Plugin installation
* Configuration editor
* Theme generation
* Schema scaffolding
* Project diagnostics

---

## Required Work

* [ ] CLI bootstrap
* [ ] Command parser
* [ ] Configuration loader
* [ ] Project templates
* [ ] Documentation

---

# [TASK-022] Plugin SDK

## Status

🟢 Low Priority

---

## Overview

Provide a public SDK allowing third-party developers to extend the engine
without modifying its core source code.

Plugins should be capable of registering:

* Components
* Parsers
* Renderers
* Build hooks
* Validators
* Compiler extensions

---

## Plugin Lifecycle

```text
Load

↓

Validate

↓

Register

↓

Initialize

↓

Runtime Hooks
```

---

## Required Work

* [ ] Plugin loader
* [ ] Lifecycle hooks
* [ ] API documentation
* [ ] Version compatibility
* [ ] Security validation

---

# [TASK-023] Engine DevTools

## Status

🟢 Low Priority

---

## Overview

Create browser-based developer tools for inspecting engine schemas and runtime
behavior.

The goal is to provide debugging capabilities similar to React DevTools.

---

## Features

Inspect:

* Schema tree
* Component hierarchy
* Generated CSS
* Runtime state
* Bound variables
* API requests
* Performance metrics

---

## Required Work

* [ ] Browser extension
* [ ] Runtime inspector
* [ ] Schema viewer
* [ ] Performance panel

---

# [TASK-024] Documentation Generator

## Status

🟢 Low Priority

---

## Overview

Automatically generate documentation directly from engine schemas, component
definitions, and TypeScript interfaces.

---

## Outputs

Generate:

* API reference
* Component documentation
* Schema examples
* Type definitions
* Migration guides
* Changelogs

---

## Required Work

* [ ] Documentation parser
* [ ] Markdown generator
* [ ] Static site output
* [ ] Search indexing

---

# [TASK-025] Benchmark Suite

## Status

🟢 Low Priority

---

## Overview

Introduce a dedicated benchmarking framework to monitor engine performance over
time.

The suite should track regressions and compare releases.

---

## Metrics

Measure:

* Build time
* SSR time
* Hydration time
* Client bundle size
* CSS generation
* Memory usage
* API performance

---

## Required Work

* [ ] Benchmark harness
* [ ] Regression tracking
* [ ] Historical reports
* [ ] CI integration

---

# [TASK-026] Internationalization (i18n)

## Status

🟢 Low Priority

---

## Overview

Add first-class internationalization support to the engine.

Translations should integrate directly with schema definitions while remaining
compatible with React Server Components and static compilation.

---

## Features

Support:

* Multiple locales
* RTL layouts
* Locale-aware routing
* Date formatting
* Number formatting
* Currency formatting
* Translation fallbacks

---

## Required Work

* [ ] Translation loader
* [ ] Locale manager
* [ ] Routing integration
* [ ] Compiler support
* [ ] Documentation

---

# [TASK-027] Animation Engine

## Status

🟢 Low Priority

---

## Overview

Introduce a schema-native animation system for declarative motion.

Animations should compile to efficient CSS or Web Animations API output where
appropriate, avoiding unnecessary JavaScript execution.

---

## Planned Features

Support:

* Entrance animations
* Exit animations
* Scroll animations
* Hover effects
* Keyframes
* Timeline sequencing
* Reduced-motion support

---

## Required Work

* [ ] Animation schema
* [ ] CSS compiler
* [ ] WAAPI integration
* [ ] Performance optimizations
* [ ] Accessibility support

---

# Maintenance Goals

The low-priority roadmap focuses on improving the surrounding developer
ecosystem rather than the rendering engine itself.

Long-term objectives include:

* Better tooling
* Easier onboarding
* Stronger diagnostics
* Improved platform compatibility
* Rich plugin ecosystem
* Comprehensive documentation
* Performance monitoring
* Global localization support

These improvements are intended to mature the engine into a complete
application platform rather than only a rendering framework.

---

# ✅ COMPLETED

The following features, optimizations, architectural improvements, and bug
fixes have been successfully implemented into the engine.

---

# Core Rendering Engine

| Task     | Status                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-001  | ✅ CSS variable fallbacks implemented, deterministic style generation, `precedence` support added to production style tags to eliminate FOUC. |
| BUG-002  | ✅ Replaced incremental style IDs with deterministic content-hash class names to eliminate hydration mismatches.                              |
| BUG-003  | ✅ Registry size cap implemented (3000 entries) with automatic HMR cleanup to prevent memory leaks during development.                        |
| TASK-001 | ✅ Responsive properties now compile into native CSS `@media` rules instead of runtime JavaScript listeners.                                  |
| TASK-003 | ✅ EngineCanvas now renders fixed-size SSR placeholders, eliminating CLS during hydration.                                                    |
| TASK-005 | ✅ Static style deduplication implemented through `usePropStyles`, generating reusable CSS classes for identical style declarations.          |
| TASK-006 | ✅ Native Next.js `generateMetadata()` integration via `generateEngineMetadata()`.                                                            |
| TASK-008 | ✅ Hydration stability improved through `suppressHydrationWarning` on EngineMarkdown while larger parser rewrite remains planned.             |
| TASK-009 | ✅ `validateSchema()` and `validatePageSchema()` integrated into SchemaRenderer for runtime schema validation.                                |
| BUG-004  | ✅ Build compile fix: `staticClass()` and schema `style` now compile nested CSS at-rules through `StyleCollector`; `EngineNav` uses `mobileBreakpoint` for desktop visibility; EngineAPI auth typing now matches compiled API-key and PNP config output. |

---

# Schema System

Implemented:

* ✅ Declarative schema rendering
* ✅ Nested component trees
* ✅ Slot support
* ✅ Raw node support
* ✅ Dynamic component registry
* ✅ Component aliasing
* ✅ Strong schema validation
* ✅ Typed node definitions

---

# Styling System

Completed:

* ✅ StyleCollector architecture
* ✅ Static class generation
* ✅ CSS variable resolver
* ✅ Content-hash CSS classes
* ✅ Responsive property compilation
* ✅ Media query generation
* ✅ CSS precedence support
* ✅ Automatic style injection
* ✅ Static property deduplication

---

# Engine Components

Implemented:

* ✅ EngineScroll
* ✅ EngineBrowser
* ✅ EngineCanvas
* ✅ EngineMarkdown
* ✅ EngineCard
* ✅ EngineSection
* ✅ EngineButton
* ✅ EngineLink
* ✅ LazySection
* ✅ Raw Component escape hatch

---

# EngineScroll

Completed Features:

* ✅ Smooth RAF scrolling
* ✅ Page fade transitions
* ✅ Anchor navigation
* ✅ Scroll restoration
* ✅ `prefers-reduced-motion` support
* ✅ Scroll helper utilities

---

# EngineBrowser

Completed Features:

* ✅ Browser detection
* ✅ Feature detection
* ✅ `run()` execution helper
* ✅ `pick()` browser selector
* ✅ `useBrowser()` hook
* ✅ Osmium compatibility support

---

# Markdown

Completed:

* ✅ Markdown component
* ✅ Hydration suppression
* ✅ Basic parsing
* ✅ HTML output
* ✅ File loading
* ✅ SSR compatibility

---

# Metadata

Completed:

* ✅ Page title generation
* ✅ Description
* ✅ Open Graph
* ✅ Twitter Cards
* ✅ Canonical URLs
* ✅ Robots / noIndex
* ✅ Metadata helper generation

---

# Forms & Interaction

Completed:

* ✅ onClick handler resolution
* ✅ String-to-function handler mapping
* ✅ Event dispatch through EngineProvider
* ✅ Interactive component support

---

# CSS Property System

Completed:

* ✅ 60+ CSS passthrough properties
* ✅ Responsive object syntax
* ✅ CSS variable support
* ✅ Pseudo-state compilation

Supported pseudo states:

* ✅ onHover
* ✅ onFocus
* ✅ onActive
* ✅ onChecked
* ✅ onDisabled

---

# Navigation

Completed:

* ✅ EngineLink component
* ✅ Registered `"link"` schema node
* ✅ Internal navigation
* ✅ External navigation
* ✅ Anchor support

---

# Schema Features

Implemented:

* ✅ `point` property for scroll anchors
* ✅ `raw` component escape hatch
* ✅ Dynamic registry lookup
* ✅ Slot rendering
* ✅ Component validation

---

# Validation

Completed:

* ✅ Runtime schema validation
* ✅ Page validation
* ✅ Human-readable validation errors
* ✅ Nested schema path reporting

---

# Performance

Completed:

* ✅ Static CSS extraction
* ✅ CSS deduplication
* ✅ Hash-based class generation
* ✅ Hydration stability improvements
* ✅ Registry cleanup
* ✅ Reduced runtime allocations

---

# Developer Experience

Completed:

* ✅ TypeScript interfaces
* ✅ Registry architecture
* ✅ Component abstraction
* ✅ Metadata generator
* ✅ Validation helpers
* ✅ Responsive property system

---

# Current Engine Capabilities

The engine currently supports:

* ✅ Schema-driven UI rendering
* ✅ Server-Side Rendering (SSR)
* ✅ React Server Component compatibility foundation
* ✅ Next.js App Router
* ✅ Automatic metadata generation
* ✅ Static CSS compilation
* ✅ Responsive layouts
* ✅ Markdown rendering
* ✅ Browser detection
* ✅ Smooth scrolling
* ✅ Schema validation
* ✅ Dynamic component registry
* ✅ Raw component rendering
* ✅ CSS pseudo-state compilation
* ✅ Responsive CSS properties
* ✅ Hash-based styling
* ✅ Performance optimizations
* ✅ Accessibility foundations

---

# Engine Maturity

Current implementation status:

```text
Core Renderer            ██████████ 100%
Schema System            ██████████ 100%
Styling Engine           ██████████ 100%
Metadata                 ██████████ 100%
Validation               ██████████ 100%
Markdown                 ████████░░ 80%
Components               ████████░░ 80%
API Framework            ██░░░░░░░░ 20%
Suspense                 ░░░░░░░░░░ 0%
Compiler                 ░░░░░░░░░░ 0%
Plugin SDK               ░░░░░░░░░░ 0%
CLI                      ░░░░░░░░░░ 0%
DevTools                 ░░░░░░░░░░ 0%
```

---

# Master Roadmap Summary

The merged registry now tracks work across the following categories:

* 🚨 Blocking Issues
* 🔴 High Priority Features
* 🟡 Medium Priority Enhancements
* 🟢 Low Priority & Maintenance
* ✅ Completed Milestones

This consolidated TODO serves as the single source of truth for the engine's ongoing development, combining architectural goals, bug tracking, feature planning, optimization work, and completed milestones into one unified roadmap.
