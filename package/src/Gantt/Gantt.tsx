import dayjs from 'dayjs';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  createVarsResolver,
  factory,
  useProps,
  useStyles,
  VisuallyHidden,
} from '@mantine/core';
import { DependencyLinks } from './DependencyLinks';
import { TaskBar } from './TaskBar';
import { TaskList } from './TaskList';
import { TimelineGrid } from './TimelineGrid';
import { TimelineHeader } from './TimelineHeader';
import type { GanttFactory, GanttProps, GanttTask } from './types';
import { useGanttDrag } from './use-gantt-drag';
import { calculateTimelineBounds, dateToPixel, durationToPixels } from './utils';
import classes from './Gantt.module.css';

// Right-side room kept ahead of the dragged bar; the END grows dynamically by this much
// so dragging into the future is effectively unbounded.
const DRAG_BUFFER_DAYS = 30;

const defaultProps: Partial<GanttProps> = {
  columnWidth: 40,
  rowHeight: 44,
  taskListWidth: 320,
  showTitle: false,
  showTodayMarker: true,
  viewMode: 'day',
};

const varsResolver = createVarsResolver<GanttFactory>(
  (_, { columnWidth, rowHeight, taskListWidth }) => ({
    root: {
      '--gantt-column-width': `${columnWidth}px`,
      '--gantt-row-height': `${rowHeight}px`,
      '--gantt-header-height': '50px',
      '--gantt-task-list-width': `${taskListWidth}px`,
    },
  })
);

export const Gantt = factory<GanttFactory>((_props, ref) => {
  const props = useProps('Gantt', defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    tasks: initialTasks,
    columns,
    onTaskUpdate,
    onTaskClick,
    onLinkCreate,
    columnWidth,
    rowHeight,
    taskListWidth,
    showTitle,
    showTodayMarker,
    startDate,
    endDate,
    viewMode,
    ...others
  } = props;

  const getStyles = useStyles<GanttFactory>({
    name: 'Gantt',
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
  });

  // Calculate effective column width based on viewMode
  // Week view: narrower columns to show more days
  // Month view: even narrower to show more time range
  const effectiveColumnWidth = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return Math.max(columnWidth / 6, 7); // Each day is 1/6th, min 7px
      case 'week':
        return Math.max(columnWidth / 2, 14); // Each day is 1/2nd, min 14px
      case 'day':
      default:
        return columnWidth;
    }
  }, [viewMode, columnWidth]);

  // Internal state for tasks
  const [tasks, setTasks] = useState<GanttTask[]>(initialTasks);
  // Screen-reader announcement for drag/keyboard commits.
  const [announcement, setAnnouncement] = useState('');
  // Visible width of the timeline body, so the grid/header can be extended to fill the
  // screen even when the tasks span fewer days than the viewport.
  const [viewportWidth, setViewportWidth] = useState(0);

  // Refs for scroll synchronization
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const taskListBodyRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  // All drag interactions (move / resize / link) on plain pointer events — no @dnd-kit.
  const drag = useGanttDrag({
    tasks,
    setTasks,
    columnWidth: effectiveColumnWidth,
    bodyRef: timelineBodyRef,
    contentRef: timelineContentRef,
    onTaskUpdate,
    onLinkCreate,
    announce: setAnnouncement,
  });
  const active = drag.state;

  // Calculate timeline bounds
  const calculatedBounds = useMemo(
    () => calculateTimelineBounds(tasks, startDate, endDate),
    [tasks, startDate, endDate]
  );

  // Freeze bounds while dragging so the axis doesn't reflow under the cursor. The origin
  // (start) never moves during a drag; only the END grows so dragging into the future has
  // room to auto-scroll into.
  const stableBoundsRef = useRef(calculatedBounds);
  if (!active) {
    stableBoundsRef.current = calculatedBounds;
  }
  let bounds = stableBoundsRef.current;
  if (active && active.type !== 'link') {
    const task = tasks.find((t) => t.id === active.taskId);
    if (task) {
      const startDay = dayjs(task.startDate).diff(bounds.start, 'day');
      const barEndDay = startDay + task.duration + Math.round(active.deltaX / effectiveColumnWidth);
      const needed = bounds.start.add(barEndDay + DRAG_BUFFER_DAYS, 'day');
      if (needed.isAfter(bounds.end)) {
        bounds = { start: bounds.start, end: needed };
        stableBoundsRef.current = bounds;
      }
    }
  }

  // Calculate total timeline width, extended to at least fill the visible viewport so
  // there is no empty area to the right of the last column.
  const fillDays = effectiveColumnWidth > 0 ? Math.ceil(viewportWidth / effectiveColumnWidth) : 0;
  const totalDays = Math.max(bounds.end.diff(bounds.start, 'day') + 1, fillDays);
  const displayEnd = bounds.start.add(totalDays - 1, 'day');
  const timelineWidth = totalDays * effectiveColumnWidth;

  // Sync scroll between task list and timeline
  const handleTimelineScroll = useCallback(() => {
    if (timelineBodyRef.current && taskListBodyRef.current) {
      taskListBodyRef.current.scrollTop = timelineBodyRef.current.scrollTop;
    }
    // Sync horizontal scroll with header
    if (timelineBodyRef.current && timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = timelineBodyRef.current.scrollLeft;
    }
  }, []);

  // Measure the timeline body so the grid can be widened to fill the viewport.
  useEffect(() => {
    const node = timelineBodyRef.current;
    if (!node) {
      return undefined;
    }
    setViewportWidth(node.clientWidth);
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      setViewportWidth(entries[0].contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleTaskListScroll = useCallback(() => {
    if (timelineBodyRef.current && taskListBodyRef.current) {
      timelineBodyRef.current.scrollTop = taskListBodyRef.current.scrollTop;
    }
  }, []);

  // Drag-to-pan the timeline with the mouse on empty space (the scrollbar is hidden). Bars and
  // handles stopPropagation on pointerdown, so any pointerdown reaching here is empty canvas.
  // Touch/pen keep native scroll+momentum — only mouse lacks a grab affordance.
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const handlePanStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const body = timelineBodyRef.current;
    if (e.pointerType !== 'mouse' || !body) {
      return;
    }
    e.preventDefault(); // stop text/SVG selection from starting
    panRef.current = { x: e.clientX, y: e.clientY, left: body.scrollLeft, top: body.scrollTop };
    body.setPointerCapture?.(e.pointerId);
    body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, []);
  const handlePanMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const body = timelineBodyRef.current;
    if (!pan || !body) {
      return;
    }
    body.scrollLeft = pan.left - (e.clientX - pan.x);
    body.scrollTop = pan.top - (e.clientY - pan.y);
  }, []);
  const handlePanEnd = useCallback(() => {
    panRef.current = null;
    document.body.style.userSelect = '';
    if (timelineBodyRef.current) {
      timelineBodyRef.current.style.cursor = '';
    }
  }, []);

  // Keep the viewport visually pinned whenever the timeline origin (bounds.start)
  // shifts — e.g. when bounds re-tighten on drag end. A date sits at pixel
  // (date - start) * columnWidth; if start moves by N days, every position shifts by
  // N * columnWidth, so counter-scroll by the same amount.
  const prevStartRef = useRef(bounds.start);
  useLayoutEffect(() => {
    const prev = prevStartRef.current;
    if (!prev.isSame(bounds.start, 'day')) {
      const deltaDays = bounds.start.diff(prev, 'day');
      const px = -deltaDays * effectiveColumnWidth;
      if (timelineBodyRef.current) {
        timelineBodyRef.current.scrollLeft += px;
      }
      if (timelineHeaderRef.current) {
        timelineHeaderRef.current.scrollLeft += px;
      }
      prevStartRef.current = bounds.start;
    }
  });

  // Live link-creation line (replaces the old DragOverlay), in content coordinates.
  const linkPreview = useMemo(() => {
    if (active?.type !== 'link' || !active.linkCursor) {
      return null;
    }
    const srcIndex = tasks.findIndex((t) => t.id === active.taskId);
    if (srcIndex === -1) {
      return null;
    }
    const src = tasks[srcIndex];
    const x1 =
      dateToPixel(src.startDate, bounds.start, effectiveColumnWidth) +
      durationToPixels(src.duration, effectiveColumnWidth);
    const y1 = srcIndex * rowHeight + rowHeight / 2;
    return { x1, y1, x2: active.linkCursor.x, y2: active.linkCursor.y };
  }, [active, tasks, bounds.start, effectiveColumnWidth, rowHeight]);

  // Calculate today line position
  const today = dayjs();
  const todayPosition = dateToPixel(today, bounds.start, effectiveColumnWidth);
  const showTodayLine =
    showTodayMarker && today.isAfter(bounds.start) && today.isBefore(displayEnd);

  return (
    <Box ref={ref} {...getStyles('root')} {...others}>
      {/* Left Pane - Task List */}
      <TaskList
        tasks={tasks}
        columns={columns}
        getStyles={getStyles}
        bodyRef={taskListBodyRef}
        onScroll={handleTaskListScroll}
      />

      {/* Right Pane - Timeline */}
      <div {...getStyles('timeline')}>
        <div {...getStyles('timelineHeader')} ref={timelineHeaderRef}>
          <TimelineHeader
            startDate={bounds.start}
            endDate={displayEnd}
            columnWidth={effectiveColumnWidth}
            getStyles={getStyles}
            totalWidth={timelineWidth}
            viewMode={viewMode}
          />
        </div>

        <div
          {...getStyles('timelineBody')}
          ref={timelineBodyRef}
          onScroll={handleTimelineScroll}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerCancel={handlePanEnd}
        >
          <div
            {...getStyles('timelineContent')}
            ref={timelineContentRef}
            style={{ width: timelineWidth, height: tasks.length * rowHeight }}
          >
            <TimelineGrid
              startDate={bounds.start}
              endDate={displayEnd}
              columnWidth={effectiveColumnWidth}
              rowCount={tasks.length}
              rowHeight={rowHeight}
              getStyles={getStyles}
              viewMode={viewMode}
            />

            {/* Today line */}
            {showTodayLine && <div className={classes.todayLine} style={{ left: todayPosition }} />}

            {/* Task rows with bars */}
            {tasks.map((task, index) => (
              <div
                key={task.id}
                {...getStyles('timelineRow')}
                title={showTitle ? task.label : undefined}
                style={{ top: index * rowHeight }}
              >
                <TaskBar
                  key={`taskbar-${task.id}`}
                  task={task}
                  startDate={bounds.start}
                  columnWidth={effectiveColumnWidth}
                  getStyles={getStyles}
                  isDragging={active?.taskId === task.id && active.type !== 'link'}
                  isLinkTarget={active?.type === 'link' && active.dropTargetId === task.id}
                  dragType={active?.taskId === task.id ? active.type : null}
                  dragDeltaX={active?.taskId === task.id ? active.deltaX : 0}
                  startDrag={drag.startDrag}
                  didDrag={drag.didDrag}
                  nudge={drag.nudge}
                  onClick={() => onTaskClick?.(task)}
                />
              </div>
            ))}

            {/* Dependency arrows + live link line */}
            <DependencyLinks
              tasks={tasks}
              startDate={bounds.start}
              columnWidth={effectiveColumnWidth}
              rowHeight={rowHeight}
              getStyles={getStyles}
              activeDragId={active && active.type !== 'link' ? active.taskId : null}
              activeDragType={active && active.type !== 'link' ? active.type : null}
              dragDelta={active && active.type !== 'link' ? active.deltaX : 0}
              linkPreview={linkPreview}
            />
          </div>
        </div>
      </div>

      <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
    </Box>
  );
});

Gantt.displayName = 'Gantt';
Gantt.classes = classes;
