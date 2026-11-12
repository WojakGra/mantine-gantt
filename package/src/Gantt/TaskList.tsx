import dayjs from 'dayjs';
import React from 'react';
import type { GetStylesApi } from '@mantine/core';
import { defaultLabels } from './labels';
import type { GanttColumn, GanttFactory, GanttLabels, GanttTreeRow } from './types';
import { formatTaskDate, getEffectiveTask } from './utils';

const getDefaultColumns = (labels: GanttLabels): GanttColumn[] => [
  { header: labels.taskName, render: (t) => t.label },
  { header: labels.start, render: (t, locale) => formatTaskDate(t.startDate, locale), width: 90 },
  {
    header: labels.end,
    // `span` is the calendar length of the bar, so this holds with `workingDays` too.
    render: (t, locale, row) =>
      formatTaskDate(dayjs(t.startDate).add(Math.max(0, row.span - 1), 'day'), locale),
    width: 90,
  },
  { header: labels.duration, render: (t) => labels.days(t.duration), width: 80 },
];

/** English default set - what `Gantt` sizes the panel from (labels don't change widths). */
export const defaultColumns = getDefaultColumns(defaultLabels);

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
  selectedTaskId?: string | null;
  locale: string;
  labels: GanttLabels;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function TaskListComponent({
  locale,
  labels,
  rows,
  columns = getDefaultColumns(labels),
  getStyles,
  bodyRef,
  onScroll,
  collapsedIds,
  onToggleExpand,
  offsetTop,
  contentHeight,
  selectedTaskId,
  collapsed,
  onToggleCollapsed,
}: TaskListProps) {
  // Flex the first flexible column, fix the rest to their width. Set inline because the
  // column set is runtime data - same pattern as the timeline's inline geometry.
  const gridTemplateColumns = columns.map((c) => (c.width ? `${c.width}px` : '1fr')).join(' ');

  return (
    <div {...getStyles('taskList')} data-collapsed={collapsed || undefined}>
      {/* Header */}
      <div {...getStyles('taskListHeader', { style: { gridTemplateColumns } })}>
        {columns.map((col, i) => (
          <div key={i} {...getStyles('taskListCell')}>
            {col.header}
          </div>
        ))}
        <button
          type="button"
          {...getStyles('taskListToggle')}
          aria-expanded={!collapsed}
          aria-label={collapsed ? labels.expandTaskList : labels.collapseTaskList}
          onClick={onToggleCollapsed}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <polyline
              points="6.5,2 3.5,5 6.5,8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
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
              <div
                key={row.task.id}
                {...getStyles('taskListRow', { style: { gridTemplateColumns } })}
                data-selected={row.task.id === selectedTaskId || undefined}
              >
                {columns.map((col, i) => {
                  const content = col.render(task, locale, row);
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
                          aria-label={
                            collapsed
                              ? labels.expandTask(task.label)
                              : labels.collapseTask(task.label)
                          }
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

export const TaskList = React.memo(TaskListComponent);

TaskList.displayName = 'TaskList';
