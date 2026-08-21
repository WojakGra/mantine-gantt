import React from 'react';
import { Gantt, type GanttTask } from 'mantine-gantt';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { Gantt, type GanttTask } from 'mantine-gantt';

const tasks: GanttTask[] = [
  {
    id: '1',
    label: 'Foundation',
    startDate: '2026-05-04',
    duration: 5,
    progress: 100,
  },
  {
    id: '2',
    label: 'Framing',
    startDate: '2026-05-04',
    duration: 6,
    progress: 40,
    dependencies: ['1'],
    color: 'teal',
  },
  {
    id: '3',
    label: 'Roofing',
    startDate: '2026-05-04',
    duration: 4,
    progress: 0,
    dependencies: ['2'],
    color: 'orange',
  },
  {
    id: '4',
    label: 'Interior',
    startDate: '2026-05-04',
    duration: 8,
    progress: 0,
    dependencies: ['3'],
    color: 'violet',
  },
];

// With autoSchedule, moving or resizing a task pushes every finish-to-start
// successor so it never starts before its predecessor ends.
function Demo() {
  return <Gantt defaultTasks={tasks} autoSchedule showTitle />;
}
`;

const tasks: GanttTask[] = [
  {
    id: '1',
    label: 'Foundation',
    startDate: '2026-05-04',
    duration: 5,
    progress: 100,
  },
  {
    id: '2',
    label: 'Framing',
    startDate: '2026-05-04',
    duration: 6,
    progress: 40,
    dependencies: ['1'],
    color: 'teal',
  },
  {
    id: '3',
    label: 'Roofing',
    startDate: '2026-05-04',
    duration: 4,
    progress: 0,
    dependencies: ['2'],
    color: 'orange',
  },
  {
    id: '4',
    label: 'Interior',
    startDate: '2026-05-04',
    duration: 8,
    progress: 0,
    dependencies: ['3'],
    color: 'violet',
  },
];

function Demo() {
  return <Gantt defaultTasks={tasks} autoSchedule showTitle />;
}

export const autoSchedule: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
