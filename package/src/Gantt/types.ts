import type { ReactNode } from 'react';
import type { BoxProps, ElementProps, Factory, MantineColor, StylesApiProps } from '@mantine/core';

/** A column in the left-hand task list */
export interface GanttColumn {
  /** Header label */
  header: ReactNode;
  /** Cell content for a given task */
  render: (task: GanttTask) => ReactNode;
  /** Fixed column width in px; omit to flex (1fr, 200px when the panel width is auto-sized) */
  width?: number;
}

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
  /**
   * Kind of row: a regular schedulable `'task'` (default) or a `'milestone'` - a
   * zero-length marker rendered as a diamond. Milestones cannot be resized (their
   * duration is ignored for rendering) but can be moved and linked like tasks.
   */
  type?: 'task' | 'milestone';
  /** IDs of tasks this task depends on */
  dependencies?: string[];
  /** Custom color for the task bar */
  color?: MantineColor;
  /** Id of the parent task; a task that has children renders as a summary bar */
  parentId?: string;
  /** Planned (baseline) schedule to compare against the actual bar */
  baseline?: {
    /** Baseline start date in ISO format (YYYY-MM-DD) */
    startDate: string;
    /** Baseline duration in days */
    duration: number;
  };
}

/** A visible row produced by buildTaskTree: the original task plus its effective schedule */
export interface GanttTreeRow {
  task: GanttTask;
  /** Nesting level, 0 for roots */
  depth: number;
  hasChildren: boolean;
  /** Effective start (YYYY-MM-DD): own for leaves, subtree envelope for parents */
  startDate: string;
  /** Effective duration in days: own for leaves, envelope span for parents */
  duration: number;
  /** Effective progress: own for leaves, duration-weighted child average for parents */
  progress: number;
}

export type GanttStylesNames =
  | 'root'
  | 'taskList'
  | 'taskListHeader'
  | 'taskListBody'
  | 'taskListContent'
  | 'taskListRow'
  | 'taskListCell'
  | 'expandChevron'
  | 'timeline'
  | 'timelineHeader'
  | 'timelineHeaderInner'
  | 'timelineHeaderRow'
  | 'timelineHeaderCell'
  | 'weekHeader'
  | 'weekHeaderCell'
  | 'timelineBody'
  | 'timelineContent'
  | 'timelineRow'
  | 'timelineGrid'
  | 'gridLine'
  | 'majorGridLine'
  | 'weekendBackground'
  | 'todayLine'
  | 'taskBar'
  | 'taskBarLabel'
  | 'taskBarProgress'
  | 'milestone'
  | 'baselineBar'
  | 'summaryBar'
  | 'resizeHandle'
  | 'resizeHandleLeft'
  | 'linkConnector'
  | 'dragLabel'
  | 'dependencyLinks'
  | 'dependencyLine'
  | 'linkArrow';

export type GanttCssVariables = {
  root:
    | '--gantt-column-width'
    | '--gantt-row-height'
    | '--gantt-header-height'
    | '--gantt-task-list-width'
    | '--gantt-critical-color';
};

export interface GanttBaseProps {
  /**
   * Tasks to display - controlled mode. The component keeps no copy of its own: every
   * drag/resize/link/keyboard change is reported through `onTasksChange` and the bars only
   * move once this prop comes back updated.
   */
  tasks?: GanttTask[];

  /** Initial tasks - uncontrolled mode. The component owns the task list from then on. */
  defaultTasks?: GanttTask[];

  /** Called with the full new task list after any change (drag, resize, link, keyboard) */
  onTasksChange?: (tasks: GanttTask[]) => void;

  /** Columns shown in the left task list. Defaults to Name / Start / End / Duration. */
  columns?: GanttColumn[];

  /** Callback when a task is updated (moved or resized) */
  onTaskUpdate?: (task: GanttTask) => void;

  /** Callback when a task is clicked */
  onTaskClick?: (task: GanttTask) => void;

  /** Callback when a dependency link is created (fromTaskId, toTaskId) */
  onLinkCreate?: (fromTaskId: string, toTaskId: string) => void;

  /** Callback when a dependency link is deleted by clicking it (fromTaskId, toTaskId) */
  onLinkDelete?: (fromTaskId: string, toTaskId: string) => void;

  /**
   * Automatically shift dependent tasks (finish-to-start, zero lag) when a task is
   * moved or resized, so successors never start before their predecessors finish.
   * <br>Default: `false`.
   */
  autoSchedule?: boolean;

  /**
   * Width of each day column in pixels
   * <br>Default: `40`
   */
  columnWidth?: number;

  /**
   * Height of each task row in pixels
   * <br>Default: `44`
   */
  rowHeight?: number;

  /**
   * Width of the task list panel in pixels. Omitted: computed from `columns` - fixed columns
   * at their `width`, flexible ones at 200px (so the default set gives 460px). Set it only to
   * override; a narrower value squeezes the flexible column down to 100px, below which the
   * width is clamped so the columns never overflow the panel.
   */
  taskListWidth?: number;

  /**
   * Start date of the timeline, defaults to earliest task start - 7 days.
   * Interpreted as a local calendar day (its local getFullYear/getMonth/getDate), so
   * construct it with `new Date(year, monthIndex, day)` - or otherwise ensure it is local
   * midnight - rather than `new Date('YYYY-MM-DD')`, which is UTC midnight and can resolve
   * to the previous local day in timezones behind UTC.
   */
  startDate?: Date;

  /**
   * End date of the timeline, defaults to latest task end + 7 days.
   * Interpreted as a local calendar day - see `startDate` for construction guidance.
   */
  endDate?: Date;

  /**
   * View mode: 'day' | 'week' | 'month', default 'day'
   */
  viewMode?: 'day' | 'week' | 'month';

  /**
   * First day of the week - 0 = Sunday, 1 = Monday, default 1. Drives both the week numbers
   * in the header (ISO numbering) and the week separators in the grid.
   */
  weekStart?: 0 | 1;

  /**
   * Whether to show task titles on hover
   * <br>Default: `false`
   * */
  showTitle?: boolean;

  /**
   * Whether to show today marker line
   * <br>Default: `true`
   * */
  showTodayMarker?: boolean;

  /**
   * Highlight the critical path (CPM over dependencies)
   * <br>Default: `false`
   */
  highlightCriticalPath?: boolean;

  /**
   * Color for critical bars and links
   * <br>Default: `red`
   */
  criticalPathColor?: MantineColor;

  /**
   * Whether to render baseline bars for tasks that define `baseline`
   * <br>Default: `true`
   */
  showBaselines?: boolean;

  /** Ids of parents expanded initially; when omitted, all parents start expanded */
  defaultExpandedIds?: string[];

  /** Called when a parent row is expanded or collapsed via its chevron */
  onToggleExpand?: (taskId: string, expanded: boolean) => void;

  /**
   * Scroll the timeline to `'today'`, a date, or a task (`{ taskId }`) - applied on mount
   * and whenever the value changes. A task also scrolls its row into view; a task hidden
   * inside a collapsed parent is ignored (expand it first).
   */
  scrollTo?: 'today' | Date | { taskId: string };

  /**
   * Marks non-working days (shaded columns in the grid/header)
   * <br>Default: `Saturday and Sunday`
   */
  isNonWorkingDay?: (date: Date) => boolean;

  /**
   * Show the snapped start/end readout above a bar while it is dragged
   * <br>Default: `true`
   */
  showDragLabel?: boolean;

  /** Id of the selected task - its bar and list row get `data-selected` */
  selectedTaskId?: string | null;

  /**
   * Called with the new day column width after a Ctrl+wheel zoom over the timeline
   * (clamped to 8-200px). Zoom works uncontrolled too; the callback just reports it.
   */
  onColumnWidthChange?: (columnWidth: number) => void;
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

/** Kind of drag interaction driven by useGanttDrag */
export type GanttDragType = 'move' | 'resize-end' | 'resize-start' | 'link';
