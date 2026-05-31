import type { Dayjs } from 'dayjs';
import React, { useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { getThemeColor, useMantineTheme, type GetStylesApi } from '@mantine/core';
import type { GanttFactory, GanttTask } from './types';
import { dateToPixel, durationToPixels } from './utils';

interface TaskBarProps {
  task: GanttTask;
  startDate: Dayjs;
  columnWidth: number;
  getStyles: GetStylesApi<GanttFactory>;
  isDragging?: boolean;
  isLinkDragging?: boolean;
  linkSourceId?: string | null;
  /** Pointer-derived left (px) for an active move drag. When set, it positions the bar
      instead of dnd-kit's transform, so it follows the cursor through auto-scroll. */
  overrideLeft?: number | null;
  onClick?: () => void;
}

function TaskBarComponent({
  task,
  startDate,
  columnWidth,
  getStyles,
  isDragging,
  isLinkDragging,
  linkSourceId,
  overrideLeft,
  onClick,
}: TaskBarProps) {
  const theme = useMantineTheme();

  // Calculate base position and width from task data
  const baseLeft = dateToPixel(task.startDate, startDate, columnWidth);
  const baseWidth = durationToPixels(task.duration, columnWidth);

  // Get task color
  const barColor = task.color
    ? getThemeColor(task.color, theme)
    : 'var(--mantine-primary-color-filled)';

  // Draggable for moving the entire bar
  const {
    attributes: moveAttributes,
    listeners: moveListeners,
    setNodeRef: setMoveRef,
    transform: moveTransform,
  } = useDraggable({
    id: `move-${task.id}`,
    data: { type: 'move', taskId: task.id },
  });

  // Draggable for resizing from end (right side)
  const {
    attributes: resizeEndAttributes,
    listeners: resizeEndListeners,
    setNodeRef: setResizeEndRef,
    transform: resizeEndTransform,
  } = useDraggable({
    id: `resize-end-${task.id}`,
    data: { type: 'resize-end', taskId: task.id },
  });

  // Draggable for resizing from start (left side)
  const {
    attributes: resizeStartAttributes,
    listeners: resizeStartListeners,
    setNodeRef: setResizeStartRef,
    transform: resizeStartTransform,
  } = useDraggable({
    id: `resize-start-${task.id}`,
    data: { type: 'resize-start', taskId: task.id },
  });

  // Draggable for creating a link (from right side)
  const {
    attributes: linkAttributes,
    listeners: linkListeners,
    setNodeRef: setLinkRef,
  } = useDraggable({
    id: `link-from-${task.id}`,
    data: { type: 'link', taskId: task.id },
  });

  // Droppable for receiving a link
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `link-to-${task.id}`,
    data: { taskId: task.id },
  });

  // Stable ref callback to prevent re-registration on every render
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setMoveRef(node);
      setDropRef(node);
    },
    [setMoveRef, setDropRef]
  );

  // Show link target outline only when link is being dragged and hovering this task (not self)
  const showLinkTarget = isLinkDragging && isOver && linkSourceId !== task.id;

  // Live drag geometry. The bar is positioned by `left`/`width` from task data; the
  // active drag offset is applied as a CSS transform (for move) or by adjusting
  // width/left (for resize). Using a CSS transform for move lets dnd-kit's own
  // coordinate tracking — including auto-scroll — keep the bar under the cursor.
  // Snapping to whole days happens on drop (handleDragEnd), so the drag itself is
  // smooth and never diverges from the pointer.
  let translateX = 0;
  let visualLeft = baseLeft;
  let visualWidth = baseWidth;

  if (overrideLeft != null) {
    // Pointer-driven move: position directly, ignore dnd-kit's transform.
    visualLeft = overrideLeft;
  } else if (moveTransform) {
    translateX = moveTransform.x;
  }

  if (resizeEndTransform) {
    visualWidth = Math.max(columnWidth, baseWidth + resizeEndTransform.x);
  }

  if (resizeStartTransform) {
    // Right edge stays put; left edge follows the cursor but can't cross it.
    const delta = Math.min(resizeStartTransform.x, baseWidth - columnWidth);
    visualLeft = baseLeft + delta;
    visualWidth = baseWidth - delta;
  }

  return (
    <div
      ref={setNodeRef}
      {...getStyles('taskBar')}
      {...moveAttributes}
      {...moveListeners}
      role="button"
      tabIndex={0}
      data-dragging={isDragging || undefined}
      data-link-target={showLinkTarget || undefined}
      style={{
        left: visualLeft,
        width: visualWidth,
        transform: translateX ? `translateX(${translateX}px)` : undefined,
        ['--task-bar-color' as string]: barColor,
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Left resize handle */}
      <div
        ref={setResizeStartRef}
        {...getStyles('resizeHandleLeft')}
        {...resizeStartAttributes}
        {...resizeStartListeners}
        role="button"
        tabIndex={-1}
        aria-label="Resize task start"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />

      {/* Progress indicator */}
      <div {...getStyles('taskBarProgress')} style={{ width: `${task.progress}%` }} />

      {/* Label */}
      <span {...getStyles('taskBarLabel')}>{task.label}</span>

      {/* Right resize handle */}
      <div
        ref={setResizeEndRef}
        {...getStyles('resizeHandle')}
        {...resizeEndAttributes}
        {...resizeEndListeners}
        role="button"
        tabIndex={-1}
        aria-label="Resize task end"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />

      {/* Link connector (right side) */}
      <div
        ref={setLinkRef}
        {...getStyles('linkConnector')}
        {...linkAttributes}
        {...linkListeners}
        role="button"
        tabIndex={-1}
        aria-label="Create dependency link"
        onPointerDown={(e) => {
          e.stopPropagation();
          (linkListeners as any)?.onPointerDown?.(e);
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
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
    prevProps.isLinkDragging === nextProps.isLinkDragging &&
    prevProps.linkSourceId === nextProps.linkSourceId &&
    prevProps.overrideLeft === nextProps.overrideLeft &&
    prevProps.startDate.isSame(nextProps.startDate)
  );
}

export const TaskBar = React.memo(TaskBarComponent, arePropsEqual);

TaskBar.displayName = 'TaskBar';
