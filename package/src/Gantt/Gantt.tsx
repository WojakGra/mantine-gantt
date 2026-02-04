import dayjs from 'dayjs';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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

  // Calculate total timeline width
  const totalDays = bounds.end.diff(bounds.start, 'day') + 1;
  const timelineWidth = totalDays * effectiveColumnWidth;

  // Refs for scroll synchronization
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const taskListBodyRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);

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

  const handleTaskListScroll = useCallback(() => {
    if (timelineBodyRef.current && taskListBodyRef.current) {
      timelineBodyRef.current.scrollTop = taskListBodyRef.current.scrollTop;
    }
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Handle drag start - track which task is being dragged and type
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as {
      type: 'move' | 'resize-end' | 'resize-start' | 'link';
      taskId: string;
    };
    setActiveDragId(data.taskId);
    setActiveDragType(data.type);
    setDragDelta(0);
  }, []);

  // Handle drag move - update delta for live link updates
  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
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

      // Snap delta to grid
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

              if (data.type === 'move') {
                // Move entire bar - update start date, keep duration
                const newStartDate = dayjs(task.startDate).add(daysDelta, 'day');
                return {
                  ...task,
                  startDate: newStartDate.format('YYYY-MM-DD'),
                };
              } else if (data.type === 'resize-end') {
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
    [effectiveColumnWidth, onTaskUpdate, onLinkCreate]
  );

  // Calculate today line position
  const today = dayjs();
  const todayPosition = dateToPixel(today, bounds.start, effectiveColumnWidth);
  const showTodayLine =
    showTodayMarker && today.isAfter(bounds.start) && today.isBefore(bounds.end);

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
            endDate={bounds.end}
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
              style={{ width: timelineWidth, height: tasks.length * rowHeight }}
            >
              <TimelineGrid
                startDate={bounds.start}
                endDate={bounds.end}
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
                activeDragId={activeDragId}
                activeDragType={activeDragType}
                dragDelta={dragDelta}
              />
            </div>
          </div>

          {/* Drag overlay for link connector */}
          <DragOverlay>
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
