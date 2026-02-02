import React from 'react';
import { TestComponent } from 'mantine-gantt';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { TestComponent } from 'mantine-gantt';

function Demo() {
  return <TestComponent label="Test component usage demo" />;
}
`;

function Demo() {
  return <TestComponent label="Test component usage demo" />;
}

export const usage: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
