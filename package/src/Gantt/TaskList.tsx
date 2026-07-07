import React from 'react';
import type { GetStylesApi } from '@mantine/core';
import type { GanttColumn, GanttFactory, GanttTask } from './types';
import { formatTaskDate, getTaskEndDate } from './utils';

const defaultColumns: GanttColumn[] = [
  { header: 'Task Name', render: (t) => t.label },
  { header: 'Start', render: (t) => formatTaskDate(t.startDate), width: 90 },
  {
    header: 'End',
    render: (t) => formatTaskDate(getTaskEndDate(t.startDate, t.duration)),
    width: 90,
  },
  { header: 'Duration', render: (t) => `${t.duration}d`, width: 80 },
];

interface TaskListProps {
  tasks: GanttTask[];
  columns?: GanttColumn[];
  getStyles: GetStylesApi<GanttFactory>;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export function TaskList({
  tasks,
  columns = defaultColumns,
  getStyles,
  bodyRef,
  onScroll,
}: TaskListProps) {
  // Flex the first flexible column, fix the rest to their width. Set inline because the
  // column set is runtime data — same pattern as the timeline's inline geometry.
  const gridTemplateColumns = columns.map((c) => (c.width ? `${c.width}px` : '1fr')).join(' ');

  return (
    <div {...getStyles('taskList')}>
      {/* Header */}
      <div {...getStyles('taskListHeader')} style={{ gridTemplateColumns }}>
        {columns.map((col, i) => (
          <div key={i} {...getStyles('taskListCell')}>
            {col.header}
          </div>
        ))}
      </div>

      {/* Body */}
      <div {...getStyles('taskListBody')} ref={bodyRef} onScroll={onScroll}>
        {tasks.map((task) => (
          <div key={task.id} {...getStyles('taskListRow')} style={{ gridTemplateColumns }}>
            {columns.map((col, i) => {
              const content = col.render(task);
              return (
                <div
                  key={i}
                  {...getStyles('taskListCell')}
                  title={typeof content === 'string' ? content : undefined}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

TaskList.displayName = 'TaskList';
