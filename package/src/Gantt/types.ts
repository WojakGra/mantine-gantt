import type { BoxProps, ElementProps, Factory, MantineColor, StylesApiProps } from '@mantine/core';

/** Represents a single task in the Gantt chart */
export interface GanttTask {
  /** Unique identifier for the task */
  id: string;
  /** Display name of the task */
  label: string;
  /** Start date in ISO format (YYYY-MM-DD) */
  startDate: string;
  /** Duration in days */
  duration: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** IDs of tasks this task depends on */
  dependencies?: string[];
  /** Custom color for the task bar */
  color?: MantineColor;
}

export type GanttStylesNames =
  | 'root'
  | 'taskList'
  | 'taskListHeader'
  | 'taskListBody'
  | 'taskListRow'
  | 'taskListCell'
  | 'timeline'
  | 'timelineHeader'
  | 'timelineHeaderRow'
  | 'timelineHeaderCell'
  | 'weekHeader'
  | 'weekHeaderCell'
  | 'timelineBody'
  | 'timelineContent'
  | 'timelineRow'
  | 'timelineGrid'
  | 'gridLine'
  | 'taskBar'
  | 'taskBarLabel'
  | 'taskBarProgress'
  | 'resizeHandle'
  | 'resizeHandleLeft'
  | 'linkConnector';

export type GanttCssVariables = {
  root:
    | '--gantt-column-width'
    | '--gantt-row-height'
    | '--gantt-header-height'
    | '--gantt-task-list-width';
};

export interface GanttBaseProps {
  /** Array of tasks to display */
  tasks: GanttTask[];

  /** Callback when a task is updated (moved or resized) */
  onTaskUpdate?: (task: GanttTask) => void;

  /** Callback when a task is clicked */
  onTaskClick?: (task: GanttTask) => void;

  /** Callback when a dependency link is created (fromTaskId, toTaskId) */
  onLinkCreate?: (fromTaskId: string, toTaskId: string) => void;

  /** Width of each day column in pixels, default 40 */
  columnWidth?: number;

  /** Height of each task row in pixels, default 44 */
  rowHeight?: number;

  /** Width of the task list panel in pixels, default 320 */
  taskListWidth?: number;

  /** Start date of the timeline, defaults to earliest task start - 7 days */
  startDate?: Date;

  /** End date of the timeline, defaults to latest task end + 7 days */
  endDate?: Date;

  /** View mode: 'day' | 'week' | 'month', default 'day' */
  viewMode?: 'day' | 'week' | 'month';
}

export type GanttFactory = Factory<{
  props: GanttProps;
  ref: HTMLDivElement;
  stylesNames: GanttStylesNames;
  vars: GanttCssVariables;
}>;

export interface GanttProps
  extends BoxProps,
    StylesApiProps<GanttFactory>,
    ElementProps<'div', 'onChange'>,
    GanttBaseProps {}

/** Context for drag operations */
export interface DragContext {
  type: 'move' | 'resize';
  taskId: string;
  initialX: number;
}
