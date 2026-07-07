import React, { useState } from 'react';
import { Gantt, type GanttColumn, type GanttTask } from 'mantine-gantt';
import { Badge, Modal, Stack, Text } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { useState } from 'react';
import { Gantt, type GanttColumn, type GanttTask } from 'mantine-gantt';
import { Badge, Modal, Stack, Text } from '@mantine/core';

const tasks: Array<GanttTask & { owner: string }> = [
  { id: '1', label: 'Project Planning', startDate: '2026-02-01', duration: 5, progress: 100, owner: 'Ada' },
  { id: '2', label: 'UI/UX Design', startDate: '2026-02-06', duration: 10, progress: 60, owner: 'Grace', dependencies: ['1'], color: 'violet' },
  { id: '3', label: 'API Development', startDate: '2026-02-16', duration: 14, progress: 20, owner: 'Linus', dependencies: ['2'], color: 'orange' },
];

// Custom left-hand columns: Duration is built in, plus an Owner column of our own.
const columns: Array<GanttColumn> = [
  { header: 'Task', render: (t) => t.label },
  { header: 'Owner', render: (t) => (t as any).owner, width: 90 },
  { header: 'Duration', render: (t) => \`\${t.duration}d\`, width: 80 },
];

function Demo() {
  const [selected, setSelected] = useState<GanttTask | null>(null);
  return (
    <>
      <Gantt tasks={tasks} columns={columns} taskListWidth={360} onTaskClick={setSelected} />
      <Modal opened={!!selected} onClose={() => setSelected(null)} title={selected?.label} centered>
        {selected && (
          <Stack gap="xs">
            <Text size="sm">Starts {selected.startDate} · {selected.duration} days</Text>
            <Badge>{selected.progress}% complete</Badge>
          </Stack>
        )}
      </Modal>
    </>
  );
}
`;

const tasks: Array<GanttTask & { owner: string }> = [
  {
    id: '1',
    label: 'Project Planning',
    startDate: '2026-02-01',
    duration: 5,
    progress: 100,
    owner: 'Ada',
  },
  {
    id: '2',
    label: 'UI/UX Design',
    startDate: '2026-02-06',
    duration: 10,
    progress: 60,
    owner: 'Grace',
    dependencies: ['1'],
    color: 'violet',
  },
  {
    id: '3',
    label: 'API Development',
    startDate: '2026-02-16',
    duration: 14,
    progress: 20,
    owner: 'Linus',
    dependencies: ['2'],
    color: 'orange',
  },
];

const columns: Array<GanttColumn> = [
  { header: 'Task', render: (t) => t.label },
  { header: 'Owner', render: (t) => (t as GanttTask & { owner: string }).owner, width: 90 },
  { header: 'Duration', render: (t) => `${t.duration}d`, width: 80 },
];

function Demo() {
  const [selected, setSelected] = useState<GanttTask | null>(null);
  return (
    <>
      <Gantt tasks={tasks} columns={columns} taskListWidth={360} onTaskClick={setSelected} />
      <Modal opened={!!selected} onClose={() => setSelected(null)} title={selected?.label} centered>
        {selected && (
          <Stack gap="xs">
            <Text size="sm">
              Starts {selected.startDate} · {selected.duration} days
            </Text>
            <Badge>{selected.progress}% complete</Badge>
          </Stack>
        )}
      </Modal>
    </>
  );
}

export const modal: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
