# Changelog

Breaking changes and migration notes per release. Everything else is in the
[GitHub release history](https://github.com/WojakGra/mantine-gantt/releases).

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
