import type { Dayjs } from 'dayjs';
import React from 'react';
import { getThemeColor, Tooltip, useMantineTheme, type GetStylesApi } from '@mantine/core';
import type { GanttDragType, GanttFactory, GanttTask } from './types';
import { dateToPixel, durationToPixels, formatTaskDate, getTaskEndDate } from './utils';

interface TaskBarProps {
  task: GanttTask;
  startDate: Dayjs;
  columnWidth: number;
  getStyles: GetStylesApi<GanttFactory>;
  isDragging?: boolean;
  /** True when this bar is the current link drop target (highlight it). */
  isLinkTarget?: boolean;
  /** True when this task is on the critical path. */
  isCritical?: boolean;
  /** True when this task has children and renders as a non-interactive summary bar. */
  isSummary?: boolean;
  /** Show a Mantine Tooltip with the task's schedule on hover. */
  showTooltip?: boolean;
  /** Active drag type when THIS bar is the one being dragged, else null. */
  dragType?: GanttDragType | null;
  /** Continuous, scroll-adjusted px delta for the active drag of THIS bar. */
  dragDeltaX?: number;
  startDrag: (type: GanttDragType, taskId: string, event: React.PointerEvent) => void;
  didDrag: () => boolean;
  nudge: (taskId: string, action: 'move' | 'resize', days: number) => void;
  onTaskClick?: (task: GanttTask) => void;
}

function TaskBarComponent({
  task,
  startDate,
  columnWidth,
  getStyles,
  isDragging,
  isLinkTarget,
  isCritical,
  isSummary,
  showTooltip,
  dragType,
  dragDeltaX = 0,
  startDrag,
  didDrag,
  nudge,
  onTaskClick,
}: TaskBarProps) {
  const theme = useMantineTheme();

  const isMilestone = task.type === 'milestone';
  // Milestones are zero-length markers rendered as a fixed-size diamond.
  const baseLeft = dateToPixel(task.startDate, startDate, columnWidth);
  const baseWidth = isMilestone ? columnWidth : durationToPixels(task.duration, columnWidth);

  const barColor = task.color
    ? getThemeColor(task.color, theme)
    : 'var(--mantine-primary-color-filled)';

  // Live drag geometry. Delta is continuous px (snapped to whole days only on release), so
  // the bar tracks the pointer smoothly. move → slide; resize-end → widen; resize-start →
  // pin the right edge and follow the left (min one column). Milestones only ever move.
  let visualLeft = baseLeft;
  let visualWidth = baseWidth;
  if (dragType === 'move') {
    visualLeft = baseLeft + dragDeltaX;
  } else if (dragType === 'resize-end' && !isMilestone) {
    visualWidth = Math.max(columnWidth, baseWidth + dragDeltaX);
  } else if (dragType === 'resize-start' && !isMilestone) {
    const delta = Math.min(dragDeltaX, baseWidth - columnWidth);
    visualLeft = baseLeft + delta;
    visualWidth = baseWidth - delta;
  }

  const tooltipLabel = isMilestone
    ? `${task.label} - ${formatTaskDate(task.startDate)}`
    : `${task.label} - ${formatTaskDate(task.startDate)} → ${formatTaskDate(
        getTaskEndDate(task.startDate, task.duration)
      )}${task.progress > 0 ? ` (${task.progress}%)` : ''}`;

  const bar = (
    <div
      {...getStyles('taskBar')}
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      data-dragging={isDragging || undefined}
      data-link-target={isLinkTarget || undefined}
      data-critical={isCritical || undefined}
      data-summary={isSummary || undefined}
      data-milestone={isMilestone || undefined}
      aria-label={
        isSummary
          ? `${task.label}, summary, starts ${task.startDate}, ${task.duration} day duration.`
          : isMilestone
            ? `${task.label}, milestone, ${task.startDate}. Arrow keys move.`
            : `${task.label}, starts ${task.startDate}, ${task.duration} day duration. Arrow keys move, Shift+Arrow resize.`
      }
      style={{
        left: visualLeft,
        width: visualWidth,
        ['--task-bar-color' as string]: barColor,
      }}
      onPointerDown={isSummary ? undefined : (e) => startDrag('move', task.id, e)}
      onClick={() => {
        if (didDrag()) {
          return;
        }
        onTaskClick?.(task);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTaskClick?.(task);
        } else if (e.key === 'ArrowLeft' && !isSummary) {
          e.preventDefault();
          nudge(task.id, e.shiftKey && !isMilestone ? 'resize' : 'move', -1);
        } else if (e.key === 'ArrowRight' && !isSummary) {
          e.preventDefault();
          nudge(task.id, e.shiftKey && !isMilestone ? 'resize' : 'move', 1);
        }
      }}
    >
      {/* Bracket end caps for summary bars */}
      {isSummary && (
        <>
          <div {...getStyles('summaryBar')} data-side="start" aria-hidden="true" />
          <div {...getStyles('summaryBar')} data-side="end" aria-hidden="true" />
        </>
      )}

      {/* Milestone diamond */}
      {isMilestone && <div {...getStyles('milestone')} aria-hidden="true" />}

      {/* Left resize handle */}
      {!isSummary && !isMilestone && (
        <div
          {...getStyles('resizeHandleLeft')}
          aria-hidden="true"
          onPointerDown={(e) => startDrag('resize-start', task.id, e)}
        />
      )}

      {/* Progress indicator */}
      {!isMilestone && (
        <div {...getStyles('taskBarProgress')} style={{ width: `${task.progress}%` }} />
      )}

      {/* Label */}
      {!isMilestone && <span {...getStyles('taskBarLabel')}>{task.label}</span>}

      {/* Right resize handle */}
      {!isSummary && !isMilestone && (
        <div
          {...getStyles('resizeHandle')}
          aria-hidden="true"
          onPointerDown={(e) => startDrag('resize-end', task.id, e)}
        />
      )}

      {/* Link connector (right side) */}
      {!isSummary && (
        <div
          {...getStyles('linkConnector')}
          aria-hidden="true"
          onPointerDown={(e) => startDrag('link', task.id, e)}
        />
      )}
    </div>
  );

  if (!showTooltip || isSummary) {
    return bar;
  }

  return (
    <Tooltip label={tooltipLabel} withinPortal disabled={isDragging}>
      {bar}
    </Tooltip>
  );
}

// Custom comparison to prevent re-renders when task data hasn't changed. Every callback is
// compared too - they are part of the props contract, and skipping them would let a bar
// keep calling a stale closure (e.g. an old onTaskClick) after its parent re-rendered.
function arePropsEqual(prevProps: TaskBarProps, nextProps: TaskBarProps): boolean {
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.startDate === nextProps.task.startDate &&
    prevProps.task.duration === nextProps.task.duration &&
    prevProps.task.progress === nextProps.task.progress &&
    prevProps.task.label === nextProps.task.label &&
    prevProps.task.color === nextProps.task.color &&
    prevProps.task.type === nextProps.task.type &&
    prevProps.columnWidth === nextProps.columnWidth &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isLinkTarget === nextProps.isLinkTarget &&
    prevProps.isCritical === nextProps.isCritical &&
    prevProps.isSummary === nextProps.isSummary &&
    prevProps.showTooltip === nextProps.showTooltip &&
    prevProps.dragType === nextProps.dragType &&
    prevProps.dragDeltaX === nextProps.dragDeltaX &&
    prevProps.startDrag === nextProps.startDrag &&
    prevProps.didDrag === nextProps.didDrag &&
    prevProps.nudge === nextProps.nudge &&
    prevProps.onTaskClick === nextProps.onTaskClick &&
    prevProps.startDate.isSame(nextProps.startDate)
  );
}

export const TaskBar = React.memo(TaskBarComponent, arePropsEqual);

TaskBar.displayName = 'TaskBar';
