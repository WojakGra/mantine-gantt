import React from 'react';
import type { GetStylesApi } from '@mantine/core';
import type { GanttFactory, GanttTask } from './types';
import { formatTaskDate, getTaskEndDate } from './utils';

interface TaskListProps {
  tasks: GanttTask[];
  getStyles: GetStylesApi<GanttFactory>;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export function TaskList({ tasks, getStyles, bodyRef, onScroll }: TaskListProps) {
  return (
    <div {...getStyles('taskList')}>
      {/* Header */}
      <div {...getStyles('taskListHeader')}>
        <div {...getStyles('taskListCell')}>Task Name</div>
        <div {...getStyles('taskListCell')}>Start</div>
        <div {...getStyles('taskListCell')}>End</div>
      </div>

      {/* Body */}
      <div {...getStyles('taskListBody')} ref={bodyRef} onScroll={onScroll}>
        {tasks.map((task) => (
          <div key={task.id} {...getStyles('taskListRow')}>
            <div {...getStyles('taskListCell')} title={task.label}>
              {task.label}
            </div>
            <div {...getStyles('taskListCell')}>{formatTaskDate(task.startDate)}</div>
            <div {...getStyles('taskListCell')}>
              {formatTaskDate(getTaskEndDate(task.startDate, task.duration))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

TaskList.displayName = 'TaskList';
