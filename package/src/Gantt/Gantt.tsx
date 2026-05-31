import dayjs from 'dayjs';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { flushSync } from 'react-dom';
import { Box, createVarsResolver, factory, useProps, useStyles } from '@mantine/core';
import { DependencyLinks } from './DependencyLinks';
import { TaskBar } from './TaskBar';
import { TaskList } from './TaskList';
import { TimelineGrid } from './TimelineGrid';
import { TimelineHeader } from './TimelineHeader';
import type { GanttFactory, GanttProps, GanttTask } from './types';
import { calculateTimelineBounds, dateToPixel, snapToGrid } from './utils';
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
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<
    'move' | 'resize-end' | 'resize-start' | 'link' | null
  >(null);
  const [dragDelta, setDragDelta] = useState<number>(0);
  // Visible width of the timeline body, so the grid/header can be extended to fill the
  // screen even when the tasks span fewer days than the viewport.
  const [viewportWidth, setViewportWidth] = useState(0);

  // Calculate timeline bounds
  const calculatedBounds = useMemo(
    () => calculateTimelineBounds(tasks, startDate, endDate),
    [tasks, startDate, endDate]
  );

  // Use ref to stabilize bounds - only update when NOT dragging
  const stableBoundsRef = useRef(calculatedBounds);
  if (!activeDragId) {
    stableBoundsRef.current = calculatedBounds;
  }
  const bounds = stableBoundsRef.current;

  // Calculate total timeline width, extended to at least fill the visible viewport so
  // there is no empty area to the right of the last column.
  const fillDays = effectiveColumnWidth > 0 ? Math.ceil(viewportWidth / effectiveColumnWidth) : 0;
  const totalDays = Math.max(bounds.end.diff(bounds.start, 'day') + 1, fillDays);
  const displayEnd = bounds.start.add(totalDays - 1, 'day');
  const timelineWidth = totalDays * effectiveColumnWidth;

  // Refs for scroll synchronization
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const taskListBodyRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  // Pointer-driven MOVE positioning. We derive the dragged bar's position from the live
  // pointer X relative to the timeline content rect, recomputed on both pointer-move and
  // scroll. This is a single source of truth that follows the cursor through dnd-kit
  // auto-scroll (whose transform does not track our scroll container) and makes the
  // committed date identical to what is shown.
  const [moveLeft, setMoveLeft] = useState<number | null>(null);
  // Captured at drag start. grabOffsetX = where inside the bar (px) the pointer grabbed,
  // so the bar doesn't snap its left edge to the cursor; duration drives end-extension.
  const moveInfoRef = useRef<{ taskId: string; grabOffsetX: number; duration: number } | null>(
    null
  );
  const lastClientXRef = useRef(0);
  const moveDayIndexRef = useRef(0);

  const recomputeMove = useCallback(() => {
    const info = moveInfoRef.current;
    const content = timelineContentRef.current;
    if (!info || !content) {
      return;
    }
    const rect = content.getBoundingClientRect();
    const pointerContentX = lastClientXRef.current - rect.left;
    // Day index of the bar's left edge, relative to the current timeline origin.
    const dayIndex = Math.round((pointerContentX - info.grabOffsetX) / effectiveColumnWidth);

    // Grow the timeline END (only) as the bar nears the right edge, so dragging far into
    // the future always has room to auto-scroll. The origin (start) never moves during a
    // drag — shifting it per-frame fights the scroll-compensation and runs away. Left-side
    // room is reserved once at drag start (see handleDragStart).
    const start = stableBoundsRef.current.start;
    const neededEndDay = dayIndex + info.duration + DRAG_BUFFER_DAYS;
    if (neededEndDay > stableBoundsRef.current.end.diff(start, 'day')) {
      stableBoundsRef.current = { start, end: start.add(neededEndDay, 'day') };
    }

    moveDayIndexRef.current = dayIndex;
    setMoveLeft(dayIndex * effectiveColumnWidth);
  }, [effectiveColumnWidth]);

  // Sync scroll between task list and timeline
  const handleTimelineScroll = useCallback(() => {
    if (timelineBodyRef.current && taskListBodyRef.current) {
      taskListBodyRef.current.scrollTop = timelineBodyRef.current.scrollTop;
    }
    // Sync horizontal scroll with header
    if (timelineBodyRef.current && timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = timelineBodyRef.current.scrollLeft;
    }
    // Keep the dragged bar under the cursor while (auto-)scrolling.
    if (moveInfoRef.current) {
      recomputeMove();
    }
  }, [recomputeMove]);

  // Track the pointer during a move drag so the bar follows the cursor (and auto-scroll).
  useEffect(() => {
    if (activeDragType !== 'move' || !activeDragId) {
      return undefined;
    }
    const onPointerMove = (e: PointerEvent) => {
      lastClientXRef.current = e.clientX;
      recomputeMove();
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [activeDragId, activeDragType, recomputeMove]);

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

  // Keep the viewport visually pinned whenever the timeline origin (bounds.start)
  // shifts — e.g. when freezing/expanding on drag start or re-tightening on drag end.
  // A date at pixel (date - start) * columnWidth; if start moves by N days, every
  // position shifts by N * columnWidth, so counter-scroll by the same amount.
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

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Handle drag start - track which task is being dragged and type
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const data = active.data.current as {
        type: 'move' | 'resize-end' | 'resize-start' | 'link';
        taskId: string;
      };
      // For a move drag, capture where inside the bar the pointer grabbed (origin-
      // invariant) BEFORE extending bounds, so the live pointer math stays correct.
      if (data.type === 'move') {
        const task = tasks.find((t) => t.id === data.taskId);
        const content = timelineContentRef.current;
        const pe = event.activatorEvent as PointerEvent;
        if (task && content && typeof pe?.clientX === 'number') {
          const baseLeft = dateToPixel(
            task.startDate,
            stableBoundsRef.current.start,
            effectiveColumnWidth
          );
          const rect = content.getBoundingClientRect();
          lastClientXRef.current = pe.clientX;
          moveInfoRef.current = {
            taskId: data.taskId,
            grabOffsetX: pe.clientX - rect.left - baseLeft,
            duration: task.duration,
          };
        }
        // Don't position from the (pre-compensation) rect yet — leave moveLeft null so
        // the bar renders at its base; the first pointermove drives recomputeMove.
        setMoveLeft(null);
      }

      // Freeze the timeline for the drag and extend only the END (grows further
      // dynamically). The origin (start) is never moved during a drag: shifting it would
      // require scroll-compensation that snaps the viewport back on drop. Left-side room
      // is therefore bounded by the timeline's normal start padding.
      if (data.type !== 'link') {
        stableBoundsRef.current = {
          start: calculatedBounds.start,
          end: calculatedBounds.end.add(DRAG_BUFFER_DAYS, 'day'),
        };
      }

      setActiveDragId(data.taskId);
      setActiveDragType(data.type);
      setDragDelta(0);
    },
    [calculatedBounds, tasks, effectiveColumnWidth]
  );

  // Handle drag move - update delta for live link updates
  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      // event.delta is dnd-kit's scrollAdjustedTranslate — already includes auto-scroll.
      const snappedDelta = snapToGrid(event.delta.x, effectiveColumnWidth);
      setDragDelta(snappedDelta);
    },
    [effectiveColumnWidth]
  );

  // Handle drag end - apply the final delta or create link
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, delta } = event;
      const data = active.data.current as {
        type: 'move' | 'resize-end' | 'resize-start' | 'link';
        taskId: string;
      };

      // Handle link creation - always return early for link type
      if (data.type === 'link') {
        if (over) {
          const overData = over.data.current as { taskId: string } | undefined;
          if (overData && overData.taskId !== data.taskId) {
            // Create link from source to target
            const fromTaskId = data.taskId;
            const toTaskId = overData.taskId;

            // Update internal state
            setTasks((currentTasks) =>
              currentTasks.map((task) => {
                if (task.id !== toTaskId) {
                  return task;
                }
                // Add dependency if not already present
                const deps = task.dependencies || [];
                if (deps.includes(fromTaskId)) {
                  return task;
                }
                return {
                  ...task,
                  dependencies: [...deps, fromTaskId],
                };
              })
            );

            // Fire callback
            if (onLinkCreate) {
              onLinkCreate(fromTaskId, toTaskId);
            }
          }
        }

        // Always clear drag state and return for link type
        setActiveDragId(null);
        setActiveDragType(null);
        setDragDelta(0);
        return;
      }

      // Move: commit the pointer-derived day index (single source of truth shared with
      // the visual), so the bar lands exactly where it was shown — including after
      // auto-scroll.
      if (data.type === 'move') {
        const newStart = stableBoundsRef.current.start.add(moveDayIndexRef.current, 'day');
        const current = tasks.find((t) => t.id === data.taskId);
        const changed = !current || !dayjs(current.startDate).isSame(newStart, 'day');
        flushSync(() => {
          if (changed) {
            setTasks((currentTasks) => {
              const updatedTasks = currentTasks.map((task) =>
                task.id === data.taskId
                  ? { ...task, startDate: newStart.format('YYYY-MM-DD') }
                  : task
              );
              const updatedTask = updatedTasks.find((t) => t.id === data.taskId);
              if (updatedTask && onTaskUpdate) {
                onTaskUpdate(updatedTask);
              }
              return updatedTasks;
            });
          }
          moveInfoRef.current = null;
          setMoveLeft(null);
          setActiveDragId(null);
          setActiveDragType(null);
          setDragDelta(0);
        });
        return;
      }

      // Resize: snap dnd-kit's delta (scrollAdjustedTranslate already accounts for scroll).
      const snappedDelta = snapToGrid(delta.x, effectiveColumnWidth);
      const daysDelta = Math.round(snappedDelta / effectiveColumnWidth);

      // Only update if there was a change
      if (daysDelta !== 0) {
        // Use flushSync to ensure ALL state updates happen in one synchronous render
        flushSync(() => {
          setTasks((currentTasks) => {
            const updatedTasks = currentTasks.map((task) => {
              if (task.id !== data.taskId) {
                return task;
              }

              if (data.type === 'resize-end') {
                // Resize from end - keep start date, update duration
                const newDuration = Math.max(1, task.duration + daysDelta);
                return {
                  ...task,
                  duration: newDuration,
                };
              }
              // Resize from start - update start date AND duration
              const newDuration = Math.max(1, task.duration - daysDelta);
              const newStartDate = dayjs(task.startDate).add(daysDelta, 'day');
              return {
                ...task,
                startDate: newStartDate.format('YYYY-MM-DD'),
                duration: newDuration,
              };
            });

            // Fire callback with updated task
            const updatedTask = updatedTasks.find((t) => t.id === data.taskId);
            if (updatedTask && onTaskUpdate) {
              onTaskUpdate(updatedTask);
            }

            return updatedTasks;
          });

          // Clear drag state in same synchronous update
          setActiveDragId(null);
          setActiveDragType(null);
          setDragDelta(0);
        });
      } else {
        // No position change, just clear drag state
        setActiveDragId(null);
        setActiveDragType(null);
        setDragDelta(0);
      }
    },
    [effectiveColumnWidth, onTaskUpdate, onLinkCreate, tasks]
  );

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

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <div {...getStyles('timelineBody')} ref={timelineBodyRef} onScroll={handleTimelineScroll}>
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
              {showTodayLine && (
                <div className={classes.todayLine} style={{ left: todayPosition }} />
              )}

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
                    isDragging={activeDragId === task.id}
                    isLinkDragging={activeDragType === 'link'}
                    linkSourceId={activeDragType === 'link' ? activeDragId : null}
                    overrideLeft={
                      activeDragType === 'move' && activeDragId === task.id ? moveLeft : null
                    }
                    onClick={() => onTaskClick?.(task)}
                  />
                </div>
              ))}

              {/* Dependency arrows */}
              <DependencyLinks
                tasks={tasks}
                startDate={bounds.start}
                columnWidth={effectiveColumnWidth}
                rowHeight={rowHeight}
                getStyles={getStyles}
                activeDragId={activeDragId}
                activeDragType={activeDragType}
                dragDelta={dragDelta}
              />
            </div>
          </div>

          {/* Drag overlay for link connector. dropAnimation disabled: the default
              animation hides the source bar (opacity:0) for 250ms while animating an
              overlay clone — but move/resize use no overlay, so the bar would vanish. */}
          <DragOverlay dropAnimation={null}>
            {activeDragType === 'link' && (
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-primary-color-filled)',
                  border: '2px solid white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </Box>
  );
});

Gantt.displayName = 'Gantt';
Gantt.classes = classes;
