import React, { useState } from 'react';
import { Gantt, type GanttTask } from 'mantine-gantt';
import { Stack, Switch } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { useState } from 'react';
import { Stack, Switch } from '@mantine/core';
import { Gantt, type GanttTask } from 'mantine-gantt';

const tasks: GanttTask[] = [
  // locked: signed off, nobody drags it any more
  { id: '1', label: 'Requirements', startDate: '2026-04-01', duration: 5, progress: 100, locked: true },
  {
    id: '2',
    label: 'Implementation',
    startDate: '2026-04-06',
    duration: 8,
    progress: 40,
    dependencies: ['1'],
    color: 'teal',
  },
];

function Demo() {
  const [readOnly, setReadOnly] = useState(false);

  return (
    <Stack>
      <Switch
        label="readOnly"
        checked={readOnly}
        onChange={(event) => setReadOnly(event.currentTarget.checked)}
      />
      <Gantt
        defaultTasks={tasks}
        readOnly={readOnly}
        markers={[
          { date: '2026-04-08', label: 'Code freeze' },
          { date: '2026-04-16', label: 'Release', color: 'green' },
        ]}
      />
    </Stack>
  );
}
`;

const tasks: GanttTask[] = [
  // locked: signed off, nobody drags it any more
  {
    id: '1',
    label: 'Requirements',
    startDate: '2026-04-01',
    duration: 5,
    progress: 100,
    locked: true,
  },
  {
    id: '2',
    label: 'Implementation',
    startDate: '2026-04-06',
    duration: 8,
    progress: 40,
    dependencies: ['1'],
    color: 'teal',
  },
];

function Demo() {
  const [readOnly, setReadOnly] = useState(false);

  return (
    <Stack>
      <Switch
        label="readOnly"
        checked={readOnly}
        onChange={(event) => setReadOnly(event.currentTarget.checked)}
      />
      <Gantt
        defaultTasks={tasks}
        readOnly={readOnly}
        markers={[
          { date: '2026-04-08', label: 'Code freeze' },
          { date: '2026-04-16', label: 'Release', color: 'green' },
        ]}
      />
    </Stack>
  );
}

export const markers: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
