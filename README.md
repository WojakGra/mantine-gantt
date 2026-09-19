# Mantine Gantt

A fully-featured Gantt chart component for [Mantine](https://mantine.dev/). Built with React, TypeScript, and integrates seamlessly with the Mantine ecosystem.

[![npm version](https://img.shields.io/npm/v/mantine-gantt.svg)](https://www.npmjs.com/package/mantine-gantt)
[![npm downloads](https://img.shields.io/npm/dm/mantine-gantt.svg)](https://www.npmjs.com/package/mantine-gantt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 📊 **Interactive Timeline** - Drag tasks to reschedule, resize to change duration
- 🔗 **Dependency Links** - Visual dependency arrows between tasks with interactive creation
- 🧭 **Dependency types and lag** - FS, SS, FF and SF links with lag or lead, honoured by auto-scheduling and the critical path
- 📅 **Working days** - Optionally count durations in working days, skipping weekends and holidays
- 🎨 **Mantine Integration** - Full support for Mantine's styling API, themes, and CSS variables
- 📱 **Responsive** - Works across different screen sizes with customizable column widths
- ♿ **Accessible** - Keyboard navigation and ARIA attributes for screen readers
- ⚡ **Virtualized rows** - Only the visible rows are rendered, so long task lists stay smooth
- 🎯 **TypeScript** - Full type definitions included

## Installation

```bash
npm install mantine-gantt @mantine/core @mantine/hooks dayjs
# or
yarn add mantine-gantt @mantine/core @mantine/hooks dayjs
```

## Quick Start

```tsx
import { Gantt, GanttTask } from 'mantine-gantt';

import 'mantine-gantt/styles.css';

const tasks: GanttTask[] = [
  {
    id: '1',
    label: 'Project Planning',
    startDate: '2026-02-01',
    duration: 5,
    progress: 100,
  },
  {
    id: '2',
    label: 'Development',
    startDate: '2026-02-06',
    duration: 10,
    progress: 50,
    dependencies: ['1'],
    color: 'teal',
  },
];

function App() {
  return <Gantt defaultTasks={tasks} />;
}
```

## Controlled and uncontrolled

`Gantt` works in either mode, following the usual Mantine convention.

**Uncontrolled** - pass `defaultTasks` and the component owns the task list. Drag, resize, link
and keyboard edits are applied internally; `onTaskUpdate` / `onLinkCreate` / `onTasksChange` still
report them.

```tsx
<Gantt defaultTasks={tasks} onTaskUpdate={(task) => save(task)} />
```

**Controlled** - pass `tasks` and `onTasksChange`, and your store is the single source of truth.
The component keeps no copy: after a drag the bar lands wherever the new `tasks` prop puts it, so
if you ignore the change the bar snaps back. That is what makes external stores (TanStack Query,
Redux, undo/redo) work.

```tsx
const [tasks, setTasks] = useState(initialTasks);

<Gantt tasks={tasks} onTasksChange={setTasks} />;
```

## Breaking changes

### Since 0.5.x

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
put them there yourself - dragging a link still writes a plain id.

**The today line is painted by `.todayLine::after`.** The line now runs behind the task bars
while its dot stays on top, which needed the background to move to a pseudo-element. A
`background-color` override on the `todayLine` selector no longer recolors the line:

```diff
-.myTodayLine { background-color: blue; }
+.myTodayLine::after, .myTodayLine::before { background-color: blue; }
```

Not breaking: `workingDays` is off by default, and the third `row` argument of
`GanttColumn.render` is optional to use.

## Migrating from 0.2.x

`tasks` used to be an initial value that the component copied into internal state; it is now the
controlled value. To keep the 0.2 behaviour, rename the prop:

```diff
-<Gantt tasks={tasks} />
+<Gantt defaultTasks={tasks} />
```

Keep `tasks` only if you also pass `onTasksChange` (or otherwise update the prop yourself) -
otherwise the bars will not move.

## Props

| Prop            | Type                 | Default | Description                                                                  |
| --------------- | -------------------- | ------- | ---------------------------------------------------------------------------- |
| `tasks`         | `GanttTask[]`        | -       | Tasks to display (controlled)                                                |
| `defaultTasks`  | `GanttTask[]`        | -       | Initial tasks (uncontrolled)                                                 |
| `onTasksChange` | `(tasks) => void`    | -       | Called with the full new list after any change                               |
| `columnWidth`   | `number`             | `40`    | Width of each day column in pixels                                           |
| `rowHeight`     | `number`             | `44`    | Height of each task row in pixels                                            |
| `taskListWidth` | `number`             | auto    | Panel width; auto = sum of `columns` widths                                  |
| `weekStart`     | `0 \| 1`             | `1`     | First day of the week (0 = Sunday, 1 = Monday)                               |
| `locale`        | `string`             | `'en'`  | BCP 47 locale for month names and dates, e.g. `'de'` or `navigator.language` |
| `showTitle`     | `boolean`            | `false` | Show task title on hover                                                     |
| `startDate`     | `Date`               | Auto    | Start date of the timeline                                                   |
| `endDate`       | `Date`               | Auto    | End date of the timeline                                                     |
| `onTaskUpdate`  | `(task) => void`     | -       | Callback when a task is updated                                              |
| `onTaskClick`   | `(task) => void`     | -       | Callback when a task is clicked                                              |
| `onLinkCreate`  | `(from, to) => void` | -       | Callback when a dependency is created                                        |
| `workingDays`   | `boolean`            | `false` | Count `duration` and `lag` in working days (see `isNonWorkingDay`)           |
| `readOnly`      | `boolean`            | `false` | Disable drag, resize, linking, link deletion and keyboard nudges             |
| `markers`       | `GanttMarker[]`      | -       | Extra vertical date lines: `{ date, label?, color? }`                        |

## Task Object

```tsx
interface GanttTask {
  id: string;
  label: string;
  startDate: string; // ISO date string
  duration: number; // Days - working days with the `workingDays` prop
  progress: number; // 0-100
  dependencies?: (string | GanttDependency)[]; // 'id' = finish-to-start, no lag
  color?: MantineColor;
  locked?: boolean; // no drag, resize or keyboard nudge
}

interface GanttDependency {
  taskId: string;
  type?: 'FS' | 'SS' | 'FF' | 'SF'; // default 'FS'
  lag?: number; // days, negative = lead
}
```

## Styling

The Gantt component supports Mantine's Styles API:

```tsx
<Gantt
  defaultTasks={tasks}
  classNames={{
    root: 'my-gantt',
    taskBar: 'my-task-bar',
  }}
  styles={{
    taskBar: { borderRadius: '8px' },
  }}
/>
```

### Available Selectors

- `root` - Main container
- `taskList` - Left panel with task names
- `taskListHeader` - Header of task list
- `taskListBody` - Body of task list
- `taskListRow` - Individual task row
- `taskListCell` - Cell in task list
- `timeline` - Right panel with chart
- `timelineHeader` - Timeline header with dates
- `timelineBody` - Timeline body with bars
- `timelineRow` - Row in timeline
- `taskBar` - Task bar element
- `taskBarProgress` - Progress indicator
- `taskBarLabel` - Task label

## Examples

### Compact View

```tsx
<Gantt defaultTasks={tasks} columnWidth={25} rowHeight={32} />
```

### Wide View

```tsx
<Gantt defaultTasks={tasks} columnWidth={80} rowHeight={60} />
```

### With Callbacks

```tsx
<Gantt
  tasks={tasks}
  onTaskUpdate={(task) => console.log('Updated:', task)}
  onTaskClick={(task) => console.log('Clicked:', task)}
  onLinkCreate={(from, to) => console.log('Link:', from, '->', to)}
/>
```

## Development

```bash
# Install dependencies
yarn

# Update documentation
npm run docgen

# Start Storybook
npm run storybook

# Run tests
npm run test

# Build
npm run build
```

## License

MIT © [WojakGra](https://github.com/WojakGra)
