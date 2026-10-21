# Mantine Gantt

An interactive Gantt chart component for [Mantine](https://mantine.dev/). React 18/19, TypeScript, drag interactions on plain pointer events, `dayjs` for dates.

[![npm version](https://img.shields.io/npm/v/mantine-gantt.svg)](https://www.npmjs.com/package/mantine-gantt)
[![npm downloads](https://img.shields.io/npm/dm/mantine-gantt.svg)](https://www.npmjs.com/package/mantine-gantt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Live demos, the full props table and the Styles API reference live in the
[documentation](https://wojakgra.github.io/mantine-gantt).

## Features

- Drag bars to reschedule, resize to change duration, nudge with the keyboard, zoom with Ctrl+wheel
- Dependency arrows: drag to create, click to delete. FS, SS, FF and SF links with lag or lead
- Auto-scheduling pushes successors later when a predecessor moves
- Critical path highlighting, baselines, milestones and parent tasks with summary bars
- Working-days mode counts durations and lag in working days, skipping weekends and holidays
- Day, week and month view modes, a today line and custom date markers
- Custom columns in the task list; the list collapses on narrow containers
- Read-only mode and per-task `locked`
- Virtualized rows: only the visible slice of the task list is rendered
- Mantine Styles API, theme colors and CSS variables; ARIA attributes on bars and rows; full TypeScript types

## Installation

```bash
npm install mantine-gantt @mantine/core @mantine/hooks dayjs
# or
yarn add mantine-gantt @mantine/core @mantine/hooks dayjs
```

Requires `@mantine/core` and `@mantine/hooks` 9.0.0 or newer. Mantine 7 and 8 are not supported.

Import the styles once, after Mantine's own styles. Use `mantine-gantt/styles.layer.css` instead if
you load Mantine through CSS layers.

```tsx
import 'mantine-gantt/styles.css';
```

## Quick start

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

Pass `defaultTasks` and the component owns the task list. Drag, resize, link and keyboard edits
are applied internally. `onTaskUpdate`, `onLinkCreate`, `onLinkDelete` and `onTasksChange` still
report them.

```tsx
<Gantt defaultTasks={tasks} onTaskUpdate={(task) => save(task)} />
```

Pass `tasks` and `onTasksChange` and your store is the single source of truth. The component
keeps no copy: after a drag the bar lands wherever the new `tasks` prop puts it, so if you ignore
the change the bar snaps back. That is what makes external stores (TanStack Query, Redux,
undo/redo) work.

```tsx
const [tasks, setTasks] = useState(initialTasks);

<Gantt tasks={tasks} onTasksChange={setTasks} />;
```

## Styling

Every internal element has a Styles API selector, so `classNames`, `styles` and
`Gantt.extend({ ... })` in the theme all work:

```tsx
<Gantt
  defaultTasks={tasks}
  classNames={{ taskBar: 'my-task-bar' }}
  styles={{ taskBar: { borderRadius: 8 } }}
/>
```

The full selector list is on the Styles API tab of the
[documentation](https://wojakgra.github.io/mantine-gantt).

## Changelog

Breaking changes and migration notes are in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, the development
commands and what to run before opening a pull request. See also the
[Code of Conduct](CODE_OF_CONDUCT.md). Report security issues as described in
[SECURITY.md](SECURITY.md).

## License

MIT © [WojakGra](https://github.com/WojakGra)
