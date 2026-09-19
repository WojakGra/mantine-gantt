import React, { useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { TextInput, Title } from '@mantine/core';
import { getComponentName } from './getComponentName';
import { PropsTable } from './PropsTable';
import classes from './PropsTablesList.module.css';

export interface PropsTablesListProps {
  components: string[];
  /** Keys of `data` that document plain types, not components */
  types?: string[];
  data: any;
  componentPrefix?: string;
}

export function PropsTablesList({
  components,
  types = [],
  componentPrefix,
  data,
}: PropsTablesListProps) {
  const [query, setQuery] = useState('');

  const tables = [...components, ...types].map((component) => (
    <div key={component} className={classes.section}>
      <Title order={2} className={classes.title}>
        {getComponentName({ component, componentPrefix })}{' '}
        {types.includes(component) ? 'type' : 'component props'}
      </Title>
      <PropsTable component={component} query={query} data={data} />
    </div>
  ));

  return (
    <div className={classes.root}>
      <TextInput
        className={classes.search}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        leftSection={<IconSearch className={classes.searchIcon} />}
        placeholder="Search props"
        radius="md"
        size="lg"
        autoFocus
      />
      {tables}
    </div>
  );
}
