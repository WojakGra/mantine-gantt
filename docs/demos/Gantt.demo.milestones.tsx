import React from 'react';
import { Gantt, type GanttTask } from 'mantine-gantt';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { Gantt, type GanttTask } from 'mantine-gantt';

const tasks: GanttTask[] = [
  {
    id: '1',
    label: 'Requirements',
    startDate: '2026-04-01',
    duration: 5,
    progress: 100,
  },
  {
    id: '2',
    label: 'Design review',
    startDate: '2026-04-06',
    duration: 3,
    progress: 60,
    dependencies: ['1'],
    color: 'violet',
  },
  {
    id: 'm1',
    label: 'Design approved',
    startDate: '2026-04-09',
    duration: 0,
    progress: 0,
    type: 'milestone',
    dependencies: ['2'],
    color: 'grape',
  },
  {
    id: '3',
    label: 'Implementation',
    startDate: '2026-04-10',
    duration: 8,
    progress: 10,
    dependencies: ['m1'],
    color: 'teal',
  },
  {
    id: 'm2',
    label: 'Go live',
    startDate: '2026-04-18',
    duration: 0,
    progress: 0,
    type: 'milestone',
    dependencies: ['3'],
    color: 'red',
  },
];

function Demo() {
  return <Gantt defaultTasks={tasks} showTitle />;
}
`;

const tasks: GanttTask[] = [
  {
    id: '1',
    label: 'Requirements',
    startDate: '2026-04-01',
    duration: 5,
    progress: 100,
  },
  {
    id: '2',
    label: 'Design review',
    startDate: '2026-04-06',
    duration: 3,
    progress: 60,
    dependencies: ['1'],
    color: 'violet',
  },
  {
    id: 'm1',
    label: 'Design approved',
    startDate: '2026-04-09',
    duration: 0,
    progress: 0,
    type: 'milestone',
    dependencies: ['2'],
    color: 'grape',
  },
  {
    id: '3',
    label: 'Implementation',
    startDate: '2026-04-10',
    duration: 8,
    progress: 10,
    dependencies: ['m1'],
    color: 'teal',
  },
  {
    id: 'm2',
    label: 'Go live',
    startDate: '2026-04-18',
    duration: 0,
    progress: 0,
    type: 'milestone',
    dependencies: ['3'],
    color: 'red',
  },
];

function Demo() {
  return <Gantt defaultTasks={tasks} showTitle />;
}

export const milestones: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
