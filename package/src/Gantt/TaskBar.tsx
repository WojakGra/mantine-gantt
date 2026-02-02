import type { Dayjs } from 'dayjs';
import React from 'react';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { getThemeColor, useMantineTheme, type GetStylesApi } from '@mantine/core';
import type { GanttFactory, GanttTask } from './types';
import { dateToPixel, durationToPixels, snapToGrid } from './utils';

interface TaskBarProps {
  task: GanttTask;
  startDate: Dayjs;
  columnWidth: number;
  getStyles: GetStylesApi<GanttFactory>;
  isDragging?: boolean;
  onClick?: () => void;
}

export function TaskBar({
  task,
  startDate,
  columnWidth,
  getStyles,
  isDragging,
  onClick,
}: TaskBarProps) {
  const theme = useMantineTheme();
  const { active } = useDndContext();

  // Check if a link is being dragged
  const isLinkDragging = active?.data.current?.type === 'link';
  const linkSourceId = isLinkDragging ? active?.data.current?.taskId : null;

  // Calculate base position and width
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

  // Droppable for receiving a link (only active when a link is being dragged)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `link-to-${task.id}`,
    data: { taskId: task.id },
    disabled: !isLinkDragging || linkSourceId === task.id,
  });

  // Show link target outline only when link is being dragged and hovering this task
  const showLinkTarget = isLinkDragging && isOver && linkSourceId !== task.id;

  // Calculate visual position during drag
  let visualLeft = baseLeft;
  let visualWidth = baseWidth;

  if (moveTransform) {
    const snappedDelta = snapToGrid(moveTransform.x, columnWidth);
    visualLeft = baseLeft + snappedDelta;
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
      ref={(node) => {
        setMoveRef(node);
        setDropRef(node);
      }}
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
      <span {...getStyles('taskBarLabel')}>{task.label}</span>

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
          // Call the original handler from linkListeners
          (linkListeners as any)?.onPointerDown?.(e);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

TaskBar.displayName = 'TaskBar';
