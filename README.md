# Mantine Gantt

A fully-featured Gantt chart component for [Mantine](https://mantine.dev/). Built with React, TypeScript, and integrates seamlessly with the Mantine ecosystem.

[![npm version](https://img.shields.io/npm/v/mantine-gantt.svg)](https://www.npmjs.com/package/mantine-gantt)
[![npm downloads](https://img.shields.io/npm/dm/mantine-gantt.svg)](https://www.npmjs.com/package/mantine-gantt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 📊 **Interactive Timeline** - Drag tasks to reschedule, resize to change duration
- 🔗 **Dependency Links** - Visual dependency arrows between tasks with interactive creation
- 🎨 **Mantine Integration** - Full support for Mantine's styling API, themes, and CSS variables
- 📱 **Responsive** - Works across different screen sizes with customizable column widths
- ♿ **Accessible** - Keyboard navigation and ARIA attributes for screen readers
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
  return <Gantt tasks={tasks} />;
}
```

## Props

| Prop            | Type                 | Default  | Description                            |
| --------------- | -------------------- | -------- | -------------------------------------- |
| `tasks`         | `GanttTask[]`        | Required | Array of tasks to display              |
| `columnWidth`   | `number`             | `40`     | Width of each day column in pixels     |
| `rowHeight`     | `number`             | `44`     | Height of each task row in pixels      |
| `taskListWidth` | `number`             | `320`    | Width of the task list panel in pixels |
| `showTitle`     | `boolean`            | `false`  | Show task title on hover               |
| `startDate`     | `Date`               | Auto     | Start date of the timeline             |
| `endDate`       | `Date`               | Auto     | End date of the timeline               |
| `onTaskUpdate`  | `(task) => void`     | -        | Callback when a task is updated        |
| `onTaskClick`   | `(task) => void`     | -        | Callback when a task is clicked        |
| `onLinkCreate`  | `(from, to) => void` | -        | Callback when a dependency is created  |

## Task Object

```tsx
interface GanttTask {
  id: string;
  label: string;
  startDate: string; // ISO date string
  duration: number; // Days
  progress: number; // 0-100
  dependencies?: string[]; // IDs of dependent tasks
  color?: MantineColor;
}
```

## Styling

The Gantt component supports Mantine's Styles API:

```tsx
<Gantt
  tasks={tasks}
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
<Gantt tasks={tasks} columnWidth={25} rowHeight={32} />
```

### Wide View

```tsx
<Gantt tasks={tasks} columnWidth={80} rowHeight={60} />
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
