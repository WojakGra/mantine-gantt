# Changelog

Breaking changes and migration notes per release. Everything else is in the
[GitHub release history](https://github.com/WojakGra/mantine-gantt/releases).

## 0.8.0

### Breaking

**React 19.2 is the declared minimum.** The peer range said `^18 || ^19`, but Mantine 9 already
requires `^19.2.0`, so React 18 never worked with 0.7.0.

**Day view draws its day lines as one element.** `gridLine` is a single full-width element with
a repeating CSS mask instead of one `div` per day. `background-color` on `gridLine` still sets
the line color; a `left`/`width` override no longer applies in day view. Week and month views
are unchanged.

**Day header cells and non-working-day shading are virtualized.** Once the timeline is measured,
only the columns near the viewport are rendered. jsdom never measures, so tests see every column.

**A link that cannot be deleted has no hit area.** With `readOnly` or `withLinkDelete={false}`
the invisible `data-hit` path is not rendered.

### Added

- `labels` prop: translate the column headers, week header, `aria-label`s and announcements.
- `withLinkDelete` prop, and keyboard deletion of a focused link (Delete, Backspace, Enter, Space).
- `isWeekend` is exported: the default `isNonWorkingDay`, to extend with your own holidays.

### Fixed

- The ESM build imports `dayjs/plugin/isoWeek.js` with its extension, so it loads in native Node
  ESM (SSR, Vitest) instead of failing with `ERR_MODULE_NOT_FOUND`.
- `onTaskClick` receives the current task. It could hand out a stale object after a change the
  bar does not draw (`dependencies`, `baseline`, custom fields).

## 0.7.0

### Breaking

**Mantine 9 is required.** The peer range for `@mantine/core` and `@mantine/hooks` is now
`>=9.0.0`. Upgrade Mantine first, or stay on 0.6.1.

**Parent tasks no longer schedule from their own dates.** A parent renders the span of its
children, and the exported utilities now agree with it:

- `calculateTimelineBounds` skips a parent's own `startDate`/`duration`. A parent baseline still
  counts.
- `applyAutoSchedule` (and the `autoSchedule` prop) never moves a parent. A dependency on a
  parent waits for the parent's children. A parent's own dependencies are ignored, and so is a
  child's dependency on its own parent.

If you read a parent's dates to place things on the timeline, compute them from its children.

**The first render is virtualized.** Before the timeline is measured, the chart renders the
first 35 rows (at the default 44px `rowHeight`) instead of every row. jsdom never measures,
so a test that looks for a later row has to scroll the timeline body first.

### Changed

- Shrinking a one-day task with Shift+ArrowLeft and dragging a link that already exists are
  now no-ops. They no longer fire `onTaskUpdate`, `onLinkCreate` or `onTasksChange`.

## 0.6.0

### Breaking

**`GanttTask.dependencies` is now `(string | GanttDependency)[]`.** Your data does not change: a
plain id still means a finish-to-start link with no lag. What breaks is TypeScript code that
_reads_ the array as `string[]` (`deps.includes(id)`, passing it to a `string[]` parameter).
Normalize it first:

```diff
-const ids = task.dependencies ?? [];
+import { normalizeDependency } from 'mantine-gantt';
+const ids = (task.dependencies ?? []).map((dep) => normalizeDependency(dep).taskId);
```

If you store tasks that users edit in the chart, expect objects in `dependencies` only when you
put them there yourself. Dragging a link still writes a plain id.

**The today line is painted by `.todayLine::after`.** The line now runs behind the task bars
while its dot stays on top, which needed the background to move to a pseudo-element. A
`background-color` override on the `todayLine` selector no longer recolors the line:

```diff
-.myTodayLine { background-color: blue; }
+.myTodayLine::after, .myTodayLine::before { background-color: blue; }
```

### Added

- `workingDays` prop, off by default.
- `GanttColumn.render` receives a third `row` argument with the computed schedule. Existing
  two-argument renderers keep working.

## 0.3.0

### Breaking

**`tasks` is the controlled value.** It used to be an initial value that the component copied
into internal state. To keep the 0.2 behaviour, rename the prop:

```diff
-<Gantt tasks={tasks} />
+<Gantt defaultTasks={tasks} />
```

Keep `tasks` only if you also pass `onTasksChange` (or otherwise update the prop yourself).
Otherwise the bars will not move.
