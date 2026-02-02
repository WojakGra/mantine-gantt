import React from 'react';
import { Gantt, mockTasks } from 'mantine-gantt';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { Gantt, mockTasks } from 'mantine-gantt';

function Demo() {
  return <Gantt tasks={mockTasks} />;
}
`;

function Demo() {
  return <Gantt tasks={mockTasks} />;
}

export const usage: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
