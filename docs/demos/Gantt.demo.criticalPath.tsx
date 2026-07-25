import React from 'react';
import { Gantt, type GanttTask } from 'mantine-gantt';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { Gantt, type GanttTask } from 'mantine-gantt';

// baseline is the planned schedule: it renders as a thin bar under the actual one,
// so slipped tasks are visible at a glance.
const tasks: GanttTask[] = [
  { id: '1', label: 'Planning', startDate: '2026-02-02', duration: 4, progress: 100, baseline: { startDate: '2026-02-02', duration: 3 } },
  { id: '2', label: 'Backend', startDate: '2026-02-06', duration: 8, progress: 60, dependencies: ['1'], baseline: { startDate: '2026-02-05', duration: 7 } },
  { id: '3', label: 'Design', startDate: '2026-02-06', duration: 3, progress: 100, dependencies: ['1'], color: 'teal', baseline: { startDate: '2026-02-05', duration: 3 } },
  { id: '4', label: 'Integration', startDate: '2026-02-16', duration: 5, progress: 0, dependencies: ['2', '3'], baseline: { startDate: '2026-02-12', duration: 5 } },
];

function Demo() {
  // highlightCriticalPath runs CPM over the dependency graph; tasks with zero slack
  // (and the links between them) are painted with criticalPathColor.
  return <Gantt defaultTasks={tasks} highlightCriticalPath criticalPathColor="red" showBaselines />;
}
`;

const tasks: GanttTask[] = [
  {
    id: '1',
    label: 'Planning',
    startDate: '2026-02-02',
    duration: 4,
    progress: 100,
    baseline: { startDate: '2026-02-02', duration: 3 },
  },
  {
    id: '2',
    label: 'Backend',
    startDate: '2026-02-06',
    duration: 8,
    progress: 60,
    dependencies: ['1'],
    baseline: { startDate: '2026-02-05', duration: 7 },
  },
  {
    id: '3',
    label: 'Design',
    startDate: '2026-02-06',
    duration: 3,
    progress: 100,
    dependencies: ['1'],
    color: 'teal',
    baseline: { startDate: '2026-02-05', duration: 3 },
  },
  {
    id: '4',
    label: 'Integration',
    startDate: '2026-02-16',
    duration: 5,
    progress: 0,
    dependencies: ['2', '3'],
    baseline: { startDate: '2026-02-12', duration: 5 },
  },
];

function Demo() {
  return <Gantt defaultTasks={tasks} highlightCriticalPath criticalPathColor="red" showBaselines />;
}

export const criticalPath: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
