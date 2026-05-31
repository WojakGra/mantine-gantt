# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`mantine-gantt` — a single-component npm library: an interactive Gantt chart for [Mantine](https://mantine.dev/). React 18/19, TypeScript, built on `@dnd-kit` for drag interactions and `dayjs` for dates. The published package lives in `package/`; `docs/` is a Next.js docs site. Yarn 4 (Berry) workspace, Node 24 (`.nvmrc`).

The root `package.json` (`name: m-90d2bb8`) is **not** published — it only holds scripts and devDependencies. The published manifest is `package/package.json`. Bump versions there (or via the release scripts), never in the root.

## Commands

Run from repo root unless noted.

- `yarn build` — Rollup build of `package/src` → `package/dist` (ESM + CJS + CSS), then generate `.d.ts` (`scripts/generate-dts`) and process CSS (`scripts/prepare-css`).
- `yarn test` — full CI gate: `syncpack` + `prettier:check` + `typecheck` + `lint` (eslint + stylelint) + `jest`. Run this before claiming work is done.
- `yarn jest` — Jest only. Single file: `yarn jest package/src/Gantt/utils.test.ts`. Single test: `yarn jest -t 'snapToGrid'`.
- `yarn typecheck` — `tsc --noEmit` for the package, then the docs site's own typecheck.
- `yarn eslint` / `yarn stylelint` — lint TS/TSX and CSS separately (both cached).
- `yarn prettier:write` — format. Import order is enforced by `@ianvs/prettier-plugin-sort-imports`; let Prettier sort, don't hand-order imports.
- `yarn dev` — run the docs site (Next.js) for manual testing.
- `yarn storybook` — Storybook on port 8271; stories are `package/src/**/*.story.tsx`.
- `yarn release:patch|minor|major` — bump `package/package.json`, publish, then build & deploy docs to GitHub Pages. Maintainer-only; don't run unprompted.

## Architecture

All source is one component family under `package/src/Gantt/`. `package/src/index.ts` is the public entry and re-exports a subset of `Gantt/index.ts`.

**`Gantt.tsx` is the stateful orchestrator.** Everything else is a presentational child that receives a `getStyles` function and computed geometry. Key responsibilities living in `Gantt.tsx`:

- **Internal task state.** `tasks` is held in `useState`, seeded from the `tasks` prop. Drag operations mutate this internal copy and fire `onTaskUpdate` / `onLinkCreate` callbacks — the component is uncontrolled with respect to task data.
- **One `DndContext` for all interactions.** Drag intent is encoded in `active.data.current.type`: `'move'`, `'resize-start'`, `'resize-end'`, or `'link'`. `handleDragEnd` branches on this type. `'link'` creates a dependency (and returns early); the others recompute `startDate`/`duration` in days. `flushSync` wraps the task update + drag-state clear to commit in one render and avoid bar flicker.
- **Grid snapping.** All horizontal deltas pass through `snapToGrid` (in `utils.ts`) against `effectiveColumnWidth`, then convert to whole-day deltas.
- **`viewMode` derives `effectiveColumnWidth`** from the `columnWidth` prop: `day` = full width, `week` = ÷2 (min 14px), `month` = ÷6 (min 7px). **Always use `effectiveColumnWidth`, not the raw `columnWidth` prop, for any pixel/date math** — children receive the effective value as their `columnWidth`.
- **Stable bounds during drag.** Timeline bounds are recomputed from tasks via `calculateTimelineBounds`, but frozen in `stableBoundsRef` while a drag is active so the timeline doesn't reflow under the cursor.
- **Scroll sync.** Manual scroll-handler wiring keeps the task list (vertical), timeline body, and timeline header (horizontal) aligned.

**Children:** `TaskList` (left pane), `TimelineHeader` (date columns), `TimelineGrid` (background grid + rows), `TaskBar` (a draggable bar with move/resize/link handles), `DependencyLinks` (SVG dependency arrows, redrawn live during drag using `dragDelta`). `types.ts` defines `GanttTask`, props, and the Mantine `GanttFactory`. `utils.ts` holds all pure date↔pixel math and is the most heavily unit-tested file.

## Mantine component conventions (important)

`Gantt` is a real Mantine component built with the Styles API — not a plain React component. Match these patterns when editing or adding components:

- Built with `factory<GanttFactory>(...)`; props resolved through `useProps('Gantt', defaultProps, _props)` so theme `Gantt.extend({ defaultProps })` works.
- Styling goes through `useStyles` + `getStyles('selector')`, never inline `className`/`style` on internal elements. CSS lives in `Gantt.module.css`; selectors are the `GanttStylesNames` union in `types.ts`.
- CSS variables (column width, row height, etc.) are produced by `createVarsResolver` (`--gantt-*`), not passed as inline styles.
- A new sub-component selector must be added to the `stylesNames` union in `types.ts` AND have a matching class in the CSS module.

The `.agents/skills/mantine-custom-components/` skill (SKILL.md + `references/`) is the authoritative reference for `factory`, `useProps`, `useStyles`, `createVarsResolver`, compound/polymorphic components, and theme integration. Consult it before changing the component's Mantine plumbing.

## Tests

Jest + jsdom + `@testing-library/react`, esbuild transform (`esbuild-jest`). CSS imports are mocked via `identity-obj-proxy`, so tests assert on selector class **names**, not computed styles. `utils.test.ts` covers the date/pixel math directly; `Gantt.test.tsx` is the component-level integration test.
