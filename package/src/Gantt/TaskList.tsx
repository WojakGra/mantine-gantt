import React from 'react';
import type { GetStylesApi } from '@mantine/core';
import type { GanttColumn, GanttFactory, GanttTreeRow } from './types';
import { formatTaskDate, getEffectiveTask, getTaskEndDate } from './utils';

export const defaultColumns: GanttColumn[] = [
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
  /** Only the rows in the visible range - see `offsetTop` / `contentHeight`. */
  rows: GanttTreeRow[];
  columns?: GanttColumn[];
  getStyles: GetStylesApi<GanttFactory>;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  collapsedIds: Set<string>;
  onToggleExpand: (taskId: string) => void;
  /** Height of the rows scrolled off above the visible range. */
  offsetTop: number;
  /** Height of the whole list, visible or not - keeps scrollHeight in sync with the timeline. */
  contentHeight: number;
}

export function TaskList({
  rows,
  columns = defaultColumns,
  getStyles,
  bodyRef,
  onScroll,
  collapsedIds,
  onToggleExpand,
  offsetTop,
  contentHeight,
}: TaskListProps) {
  // Flex the first flexible column, fix the rest to their width. Set inline because the
  // column set is runtime data - same pattern as the timeline's inline geometry.
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
        <div
          {...getStyles('taskListContent', {
            style: { height: contentHeight, paddingTop: offsetTop },
          })}
        >
          {rows.map((row) => {
            const task = getEffectiveTask(row);
            const collapsed = collapsedIds.has(row.task.id);
            return (
              <div key={row.task.id} {...getStyles('taskListRow')} style={{ gridTemplateColumns }}>
                {columns.map((col, i) => {
                  const content = col.render(task);
                  const indent =
                    i === 0 && row.depth > 0
                      ? {
                          style: {
                            paddingLeft: `calc(var(--mantine-spacing-sm) + var(--gantt-indent))`,
                            ['--gantt-indent' as string]: `${row.depth * 16}px`,
                          },
                        }
                      : undefined;
                  return (
                    <div
                      key={i}
                      {...getStyles('taskListCell', indent)}
                      title={typeof content === 'string' ? content : undefined}
                    >
                      {i === 0 && row.hasChildren && (
                        <button
                          type="button"
                          {...getStyles('expandChevron')}
                          data-collapsed={collapsed || undefined}
                          aria-expanded={!collapsed}
                          aria-label={collapsed ? `Expand ${task.label}` : `Collapse ${task.label}`}
                          onClick={() => onToggleExpand(row.task.id)}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                            <polyline
                              points="2,3.5 5,6.5 8,3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </button>
                      )}
                      {content}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

TaskList.displayName = 'TaskList';
