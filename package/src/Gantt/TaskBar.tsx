import type { Dayjs } from 'dayjs';
import React, { useCallback, useRef } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { getThemeColor, useMantineTheme, type GetStylesApi } from '@mantine/core';
import type { GanttFactory, GanttTask } from './types';
import { dateToPixel, durationToPixels, snapToGrid } from './utils';

interface TaskBarProps {
  task: GanttTask;
  startDate: Dayjs;
  columnWidth: number;
  getStyles: GetStylesApi<GanttFactory>;
  isDragging?: boolean;
  isLinkDragging?: boolean;
  linkSourceId?: string | null;
  showTitle?: boolean;
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
  showTitle,
  onClick,
}: TaskBarProps) {
  const theme = useMantineTheme();

  // Track if we were just dragging to prevent flicker
  const wasDraggingRef = useRef(false);

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

  // Calculate visual position during drag
  let visualLeft = baseLeft;
  let visualWidth = baseWidth;

  if (moveTransform) {
    const snappedDelta = snapToGrid(moveTransform.x, columnWidth);
    visualLeft = baseLeft + snappedDelta;
    wasDraggingRef.current = true;
  } else if (wasDraggingRef.current) {
    // Just stopped dragging - use baseLeft (state has updated)
    // Clear the flag after this render
    wasDraggingRef.current = false;
  }

  if (resizeEndTransform) {
    const snappedDelta = snapToGrid(resizeEndTransform.x, columnWidth);
    visualWidth = Math.max(columnWidth, baseWidth + snappedDelta);
  }

  if (resizeStartTransform) {
    const snappedDelta = snapToGrid(resizeStartTransform.x, columnWidth);
    visualLeft = baseLeft + snappedDelta;
    visualWidth = Math.max(columnWidth, baseWidth - snappedDelta);
  }

  return (
    <div
      ref={setNodeRef}
      {...getStyles('taskBar')}
      {...moveAttributes}
      {...moveListeners}
      data-dragging={isDragging || undefined}
      data-link-target={showLinkTarget || undefined}
      style={{
        left: visualLeft,
        width: visualWidth,
        ['--task-bar-color' as string]: barColor,
      }}
      onClick={onClick}
    >
      {/* Left resize handle */}
      <div
        ref={setResizeStartRef}
        {...getStyles('resizeHandleLeft')}
        {...resizeStartAttributes}
        {...resizeStartListeners}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Progress indicator */}
      <div {...getStyles('taskBarProgress')} style={{ width: `${task.progress}%` }} />

      {/* Label */}
      <span {...getStyles('taskBarLabel')} title={showTitle ? task.label : undefined}>
        {task.label}
      </span>

      {/* Right resize handle */}
      <div
        ref={setResizeEndRef}
        {...getStyles('resizeHandle')}
        {...resizeEndAttributes}
        {...resizeEndListeners}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Link connector (right side) */}
      <div
        ref={setLinkRef}
        {...getStyles('linkConnector')}
        {...linkAttributes}
        {...linkListeners}
        onPointerDown={(e) => {
          e.stopPropagation();
          (linkListeners as any)?.onPointerDown?.(e);
        }}
        onClick={(e) => e.stopPropagation()}
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
    prevProps.showTitle === nextProps.showTitle &&
    prevProps.startDate.isSame(nextProps.startDate)
  );
}

export const TaskBar = React.memo(TaskBarComponent, arePropsEqual);

TaskBar.displayName = 'TaskBar';
