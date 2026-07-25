import React, { useState } from 'react';
import { Gantt, type GanttTask } from 'mantine-gantt';
import { SegmentedControl, Stack } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { useState } from 'react';
import { Gantt, type GanttProps, type GanttTask } from 'mantine-gantt';
import { SegmentedControl, Stack } from '@mantine/core';

const tasks: GanttTask[] = [
  { id: '1', label: 'Discovery', startDate: '2026-02-02', duration: 10, progress: 100 },
  { id: '2', label: 'Implementation', startDate: '2026-02-12', duration: 24, progress: 45, dependencies: ['1'], color: 'orange' },
  { id: '3', label: 'Rollout', startDate: '2026-03-09', duration: 12, progress: 0, dependencies: ['2'], color: 'green' },
];

function Demo() {
  const [viewMode, setViewMode] = useState<GanttProps['viewMode']>('week');

  // 'week' and 'month' shrink the day column (columnWidth / 2 and / 6) so long
  // projects fit without horizontal scrolling. weekStart drives the header numbering.
  return (
    <Stack>
      <SegmentedControl
        value={viewMode}
        onChange={(value) => setViewMode(value as GanttProps['viewMode'])}
        data={['day', 'week', 'month']}
      />
      <Gantt defaultTasks={tasks} viewMode={viewMode} weekStart={1} />
    </Stack>
  );
}
`;

const tasks: GanttTask[] = [
  { id: '1', label: 'Discovery', startDate: '2026-02-02', duration: 10, progress: 100 },
  {
    id: '2',
    label: 'Implementation',
    startDate: '2026-02-12',
    duration: 24,
    progress: 45,
    dependencies: ['1'],
    color: 'orange',
  },
  {
    id: '3',
    label: 'Rollout',
    startDate: '2026-03-09',
    duration: 12,
    progress: 0,
    dependencies: ['2'],
    color: 'green',
  },
];

function Demo() {
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');

  return (
    <Stack>
      <SegmentedControl
        value={viewMode}
        onChange={(value) => setViewMode(value as 'day' | 'week' | 'month')}
        data={['day', 'week', 'month']}
      />
      <Gantt defaultTasks={tasks} viewMode={viewMode} weekStart={1} />
    </Stack>
  );
}

export const viewMode: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
