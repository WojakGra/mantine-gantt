import React from 'react';
import { Gantt, type GanttTask } from 'mantine-gantt';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { Gantt, type GanttTask } from 'mantine-gantt';

// A task with a parentId becomes a child row; its parent renders as a summary bar
// spanning the whole subtree, with a duration-weighted progress. Nesting is unlimited.
const tasks: GanttTask[] = [
  { id: 'design', label: 'Design', startDate: '2026-02-02', duration: 1, progress: 0 },
  { id: 'wireframes', label: 'Wireframes', startDate: '2026-02-02', duration: 4, progress: 100, parentId: 'design' },
  { id: 'visuals', label: 'Visual design', startDate: '2026-02-06', duration: 6, progress: 60, parentId: 'design', color: 'violet' },
  { id: 'build', label: 'Build', startDate: '2026-02-12', duration: 1, progress: 0 },
  { id: 'api', label: 'API', startDate: '2026-02-12', duration: 8, progress: 40, parentId: 'build', dependencies: ['wireframes'], color: 'orange' },
  { id: 'ui', label: 'UI', startDate: '2026-02-16', duration: 10, progress: 10, parentId: 'build', dependencies: ['visuals'] },
  { id: 'auth', label: 'Auth screens', startDate: '2026-02-16', duration: 5, progress: 0, parentId: 'ui', color: 'teal' },
  { id: 'launch', label: 'Launch', startDate: '2026-02-26', duration: 2, progress: 0, dependencies: ['ui'], color: 'green' },
];

function Demo() {
  return (
    <Gantt
      defaultTasks={tasks}
      // Omit to start with everything expanded. Listed ids stay open, the rest collapse.
      defaultExpandedIds={['design', 'build']}
      onToggleExpand={(id, expanded) => console.log(id, expanded)}
    />
  );
}
`;

const tasks: GanttTask[] = [
  { id: 'design', label: 'Design', startDate: '2026-02-02', duration: 1, progress: 0 },
  {
    id: 'wireframes',
    label: 'Wireframes',
    startDate: '2026-02-02',
    duration: 4,
    progress: 100,
    parentId: 'design',
  },
  {
    id: 'visuals',
    label: 'Visual design',
    startDate: '2026-02-06',
    duration: 6,
    progress: 60,
    parentId: 'design',
    color: 'violet',
  },
  { id: 'build', label: 'Build', startDate: '2026-02-12', duration: 1, progress: 0 },
  {
    id: 'api',
    label: 'API',
    startDate: '2026-02-12',
    duration: 8,
    progress: 40,
    parentId: 'build',
    dependencies: ['wireframes'],
    color: 'orange',
  },
  {
    id: 'ui',
    label: 'UI',
    startDate: '2026-02-16',
    duration: 10,
    progress: 10,
    parentId: 'build',
    dependencies: ['visuals'],
  },
  {
    id: 'auth',
    label: 'Auth screens',
    startDate: '2026-02-16',
    duration: 5,
    progress: 0,
    parentId: 'ui',
    color: 'teal',
  },
  {
    id: 'launch',
    label: 'Launch',
    startDate: '2026-02-26',
    duration: 2,
    progress: 0,
    dependencies: ['ui'],
    color: 'green',
  },
];

function Demo() {
  return (
    <Gantt
      defaultTasks={tasks}
      defaultExpandedIds={['design', 'build']}
      onToggleExpand={() => {}}
    />
  );
}

export const grouping: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
