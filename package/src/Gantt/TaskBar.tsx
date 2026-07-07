import type { Dayjs } from 'dayjs';
import React from 'react';
import { getThemeColor, useMantineTheme, type GetStylesApi } from '@mantine/core';
import type { GanttDragType, GanttFactory, GanttTask } from './types';
import { dateToPixel, durationToPixels } from './utils';

interface TaskBarProps {
  task: GanttTask;
  startDate: Dayjs;
  columnWidth: number;
  getStyles: GetStylesApi<GanttFactory>;
  isDragging?: boolean;
  /** True when this bar is the current link drop target (highlight it). */
  isLinkTarget?: boolean;
  /** Active drag type when THIS bar is the one being dragged, else null. */
  dragType?: GanttDragType | null;
  /** Continuous, scroll-adjusted px delta for the active drag of THIS bar. */
  dragDeltaX?: number;
  startDrag: (type: GanttDragType, taskId: string, event: React.PointerEvent) => void;
  didDrag: () => boolean;
  nudge: (taskId: string, action: 'move' | 'resize', days: number) => void;
  onClick?: () => void;
}

function TaskBarComponent({
  task,
  startDate,
  columnWidth,
  getStyles,
  isDragging,
  isLinkTarget,
  dragType,
  dragDeltaX = 0,
  startDrag,
  didDrag,
  nudge,
  onClick,
}: TaskBarProps) {
  const theme = useMantineTheme();

  // Base position/width from task data.
  const baseLeft = dateToPixel(task.startDate, startDate, columnWidth);
  const baseWidth = durationToPixels(task.duration, columnWidth);

  const barColor = task.color
    ? getThemeColor(task.color, theme)
    : 'var(--mantine-primary-color-filled)';

  // Live drag geometry. Delta is continuous px (snapped to whole days only on release), so
  // the bar tracks the pointer smoothly. move → slide; resize-end → widen; resize-start →
  // pin the right edge and follow the left (min one column).
  let visualLeft = baseLeft;
  let visualWidth = baseWidth;
  if (dragType === 'move') {
    visualLeft = baseLeft + dragDeltaX;
  } else if (dragType === 'resize-end') {
    visualWidth = Math.max(columnWidth, baseWidth + dragDeltaX);
  } else if (dragType === 'resize-start') {
    const delta = Math.min(dragDeltaX, baseWidth - columnWidth);
    visualLeft = baseLeft + delta;
    visualWidth = baseWidth - delta;
  }

  return (
    <div
      {...getStyles('taskBar')}
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      data-dragging={isDragging || undefined}
      data-link-target={isLinkTarget || undefined}
      aria-label={`${task.label}, starts ${task.startDate}, ${task.duration} day duration. Arrow keys move, Shift+Arrow resize.`}
      style={{
        left: visualLeft,
        width: visualWidth,
        ['--task-bar-color' as string]: barColor,
      }}
      onPointerDown={(e) => startDrag('move', task.id, e)}
      onClick={() => {
        if (didDrag()) {
          return;
        }
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          nudge(task.id, e.shiftKey ? 'resize' : 'move', -1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nudge(task.id, e.shiftKey ? 'resize' : 'move', 1);
        }
      }}
    >
      {/* Left resize handle */}
      <div
        {...getStyles('resizeHandleLeft')}
        aria-hidden="true"
        onPointerDown={(e) => startDrag('resize-start', task.id, e)}
      />

      {/* Progress indicator */}
      <div {...getStyles('taskBarProgress')} style={{ width: `${task.progress}%` }} />

      {/* Label */}
      <span {...getStyles('taskBarLabel')}>{task.label}</span>

      {/* Right resize handle */}
      <div
        {...getStyles('resizeHandle')}
        aria-hidden="true"
        onPointerDown={(e) => startDrag('resize-end', task.id, e)}
      />

      {/* Link connector (right side) */}
      <div
        {...getStyles('linkConnector')}
        aria-hidden="true"
        onPointerDown={(e) => startDrag('link', task.id, e)}
      />
    </div>
  );
}

// Custom comparison to prevent re-renders when task data hasn't changed
function arePropsEqual(prevProps: TaskBarProps, nextProps: TaskBarProps): boolean {
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.startDate === nextProps.task.startDate &&
    prevProps.task.duration === nextProps.task.duration &&
    prevProps.task.progress === nextProps.task.progress &&
    prevProps.task.label === nextProps.task.label &&
    prevProps.task.color === nextProps.task.color &&
    prevProps.columnWidth === nextProps.columnWidth &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isLinkTarget === nextProps.isLinkTarget &&
    prevProps.dragType === nextProps.dragType &&
    prevProps.dragDeltaX === nextProps.dragDeltaX &&
    prevProps.startDate.isSame(nextProps.startDate)
  );
}

export const TaskBar = React.memo(TaskBarComponent, arePropsEqual);

TaskBar.displayName = 'TaskBar';
