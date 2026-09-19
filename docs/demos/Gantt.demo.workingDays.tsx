import React from 'react';
import { Gantt, type GanttTask } from 'mantine-gantt';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { Gantt, type GanttTask } from 'mantine-gantt';

// February 2026: the 6th is a Friday.
const tasks: GanttTask[] = [
  { id: '1', label: 'Backend', startDate: '2026-02-02', duration: 5, progress: 60 },
  {
    id: '2',
    label: 'Frontend',
    startDate: '2026-02-04',
    duration: 5,
    progress: 30,
    color: 'teal',
    // starts two working days after Backend starts
    dependencies: [{ taskId: '1', type: 'SS', lag: 2 }],
  },
  {
    id: '3',
    label: 'Docs',
    startDate: '2026-02-09',
    duration: 2,
    progress: 0,
    color: 'grape',
    // must finish together with Frontend
    dependencies: [{ taskId: '2', type: 'FF' }],
  },
  {
    id: '4',
    label: 'Release',
    startDate: '2026-02-12',
    duration: 1,
    progress: 0,
    color: 'red',
    // plain id = finish-to-start, no lag
    dependencies: ['2'],
  },
];

function Demo() {
  return <Gantt defaultTasks={tasks} workingDays autoSchedule />;
}
`;

// February 2026: the 6th is a Friday.
const tasks: GanttTask[] = [
  { id: '1', label: 'Backend', startDate: '2026-02-02', duration: 5, progress: 60 },
  {
    id: '2',
    label: 'Frontend',
    startDate: '2026-02-04',
    duration: 5,
    progress: 30,
    color: 'teal',
    // starts two working days after Backend starts
    dependencies: [{ taskId: '1', type: 'SS', lag: 2 }],
  },
  {
    id: '3',
    label: 'Docs',
    startDate: '2026-02-09',
    duration: 2,
    progress: 0,
    color: 'grape',
    // must finish together with Frontend
    dependencies: [{ taskId: '2', type: 'FF' }],
  },
  {
    id: '4',
    label: 'Release',
    startDate: '2026-02-12',
    duration: 1,
    progress: 0,
    color: 'red',
    // plain id = finish-to-start, no lag
    dependencies: ['2'],
  },
];

function Demo() {
  return <Gantt defaultTasks={tasks} workingDays autoSchedule />;
}

export const workingDays: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
