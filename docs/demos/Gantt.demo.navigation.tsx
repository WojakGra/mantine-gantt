import React, { useState } from 'react';
import { Gantt, type GanttTask } from 'mantine-gantt';
import { Button, Group, Stack, Text } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { useState } from 'react';
import { Gantt, type GanttTask } from 'mantine-gantt';
import { Button, Group, Stack, Text } from '@mantine/core';

const tasks: GanttTask[] = [
  { id: '1', label: 'Discovery', startDate: '2026-02-02', duration: 10, progress: 100 },
  { id: '2', label: 'Implementation', startDate: '2026-02-12', duration: 24, progress: 45, dependencies: ['1'], color: 'orange' },
  { id: '3', label: 'Rollout', startDate: '2026-03-09', duration: 12, progress: 0, dependencies: ['2'], color: 'green' },
];

// Fridays are off, plus one public holiday.
const isNonWorkingDay = (d: Date) =>
  d.getDay() === 0 || d.getDay() === 5 || d.getDay() === 6 || d.toDateString() === 'Mon Feb 16 2026';

function Demo() {
  const [scrollTo, setScrollTo] = useState<{ taskId: string } | Date>(new Date(2026, 1, 2));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [columnWidth, setColumnWidth] = useState(40);

  return (
    <Stack>
      <Group>
        {tasks.map((t) => (
          <Button key={t.id} size="xs" variant="light" onClick={() => setScrollTo({ taskId: t.id })}>
            Go to {t.label}
          </Button>
        ))}
        <Text size="sm">Column width: {columnWidth}px (Ctrl+wheel to zoom, middle button to autoscroll)</Text>
      </Group>
      <Gantt
        defaultTasks={tasks}
        scrollTo={scrollTo}
        selectedTaskId={selectedTaskId}
        onTaskClick={(task) => setSelectedTaskId((id) => (id === task.id ? null : task.id))}
        isNonWorkingDay={isNonWorkingDay}
        columnWidth={columnWidth}
        onColumnWidthChange={setColumnWidth}
      />
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

const isNonWorkingDay = (d: Date) =>
  d.getDay() === 0 ||
  d.getDay() === 5 ||
  d.getDay() === 6 ||
  d.toDateString() === 'Mon Feb 16 2026';

function Demo() {
  const [scrollTo, setScrollTo] = useState<{ taskId: string } | Date>(new Date(2026, 1, 2));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [columnWidth, setColumnWidth] = useState(40);

  return (
    <Stack>
      <Group>
        {tasks.map((t) => (
          <Button
            key={t.id}
            size="xs"
            variant="light"
            onClick={() => setScrollTo({ taskId: t.id })}
          >
            Go to {t.label}
          </Button>
        ))}
        <Text size="sm">
          Column width: {columnWidth}px (Ctrl+wheel to zoom, middle button to autoscroll)
        </Text>
      </Group>
      <Gantt
        defaultTasks={tasks}
        scrollTo={scrollTo}
        selectedTaskId={selectedTaskId}
        onTaskClick={(task) => setSelectedTaskId((id) => (id === task.id ? null : task.id))}
        isNonWorkingDay={isNonWorkingDay}
        columnWidth={columnWidth}
        onColumnWidthChange={setColumnWidth}
      />
    </Stack>
  );
}

export const navigation: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
