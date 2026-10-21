# Changelog

Breaking changes and migration notes per release. Everything else is in the
[GitHub release history](https://github.com/WojakGra/mantine-gantt/releases).

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
