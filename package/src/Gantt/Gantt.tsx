import dayjs from 'dayjs';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  createVarsResolver,
  factory,
  getThemeColor,
  useMantineTheme,
  useProps,
  useStyles,
  VisuallyHidden,
} from '@mantine/core';
import { useUncontrolled } from '@mantine/hooks';
import { DependencyLinks } from './DependencyLinks';
import { TaskBar } from './TaskBar';
import { defaultColumns, TaskList } from './TaskList';
import { TimelineGrid } from './TimelineGrid';
import { TimelineHeader } from './TimelineHeader';
import type {
  GanttColumn,
  GanttDependencyType,
  GanttFactory,
  GanttProps,
  GanttTask,
} from './types';
import { useGanttDrag } from './use-gantt-drag';
import {
  barAnchors,
  buildTaskTree,
  calculateTimelineBounds,
  dateToPixel,
  durationToPixels,
  getCriticalPath,
  getEffectiveTask,
  getTaskSpan,
  isWeekend,
  normalizeDependency,
  visibleRowRange,
} from './utils';
import classes from './Gantt.module.css';

// Right-side room kept ahead of the dragged bar; the END grows dynamically by this much
// so dragging into the future is effectively unbounded.
const DRAG_BUFFER_DAYS = 30;

// Stable empty set so the reference doesn't change on every render when the feature is off.
const EMPTY_CRITICAL = new Set<string>();

// Width given to a column that declares none, when the panel width is auto-sized.
const FLEX_COLUMN_WIDTH = 200;

// Floor for a flexible column when an explicit `taskListWidth` would squeeze it.
const FLEX_COLUMN_MIN_WIDTH = 100;

/** Panel width the columns need, giving each flexible (width-less) column `flexWidth`. */
function columnsWidth(columns: GanttColumn[] = defaultColumns, flexWidth: number) {
  return columns.reduce((sum, col) => sum + (col.width ?? flexWidth), 0);
}

/** Auto-sized when `taskListWidth` is omitted; an explicit value is clamped so the fixed
 *  columns never overflow the panel onto the timeline. */
function resolveTaskListWidth(taskListWidth: number | undefined, columns?: GanttColumn[]) {
  return taskListWidth === undefined
    ? columnsWidth(columns, FLEX_COLUMN_WIDTH)
    : Math.max(taskListWidth, columnsWidth(columns, FLEX_COLUMN_MIN_WIDTH));
}

const defaultProps: Partial<GanttProps> = {
  columnWidth: 40,
  rowHeight: 44,
  showTitle: false,
  showTodayMarker: true,
  viewMode: 'day',
  weekStart: 1,
  locale: 'en',
  highlightCriticalPath: false,
  criticalPathColor: 'red',
  showBaselines: true,
  autoSchedule: false,
  showDragLabel: true,
};

const varsResolver = createVarsResolver<GanttFactory>(
  (theme, { columnWidth, rowHeight, taskListWidth, columns, criticalPathColor }) => ({
    root: {
      '--gantt-column-width': `${columnWidth}px`,
      '--gantt-row-height': `${rowHeight}px`,
      '--gantt-header-height': '50px',
      '--gantt-task-list-width': `${resolveTaskListWidth(taskListWidth, columns)}px`,
      '--gantt-critical-color': getThemeColor(criticalPathColor, theme),
    },
  })
);

export const Gantt = factory<GanttFactory>((_props, ref) => {
  const props = useProps('Gantt', defaultProps, _props);
  const theme = useMantineTheme();
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    attributes,
    tasks: tasksProp,
    defaultTasks,
    onTasksChange,
    columns,
    onTaskUpdate,
    onTaskClick,
    onLinkCreate,
    onLinkDelete,
    columnWidth = 40,
    rowHeight = 44,
    taskListWidth,
    showTitle,
    showTodayMarker,
    autoSchedule,
    startDate,
    endDate,
    viewMode = 'day',
    weekStart = 1,
    locale = 'en',
    highlightCriticalPath,
    criticalPathColor,
    showBaselines,
    defaultExpandedIds,
    onToggleExpand,
    scrollTo,
    isNonWorkingDay,
    selectedTaskId,
    markers,
    readOnly,
    workingDays,
    onColumnWidthChange,
    showDragLabel,
    ...others
  } = props;

  // Ctrl+wheel zoom; null = follow the prop. Reset whenever the prop itself changes.
  const [zoomWidth, setZoomWidth] = useState<number | null>(null);
  useEffect(() => setZoomWidth(null), [columnWidth]);
  const baseColumnWidth = zoomWidth ?? columnWidth;

  const getStyles = useStyles<GanttFactory>({
    name: 'Gantt',
    classes,
    props: { ...props, columnWidth: baseColumnWidth },
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    attributes,
    varsResolver,
  });

  // Calculate effective column width based on viewMode
  // Week view: narrower columns to show more days
  // Month view: even narrower to show more time range
  const effectiveColumnWidth = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return Math.max(baseColumnWidth / 6, 7); // Each day is 1/6th, min 7px
      case 'week':
        return Math.max(baseColumnWidth / 2, 14); // Each day is 1/2nd, min 14px
      case 'day':
      default:
        // Clamp to ≥1 so columnWidth={0} can't produce division-by-zero (deltaX / width).
        return Math.max(baseColumnWidth, 1);
    }
  }, [viewMode, baseColumnWidth]);

  // Working-day calendar for all schedule math; undefined = durations are calendar days.
  const calendar = workingDays ? (isNonWorkingDay ?? isWeekend) : undefined;

  // Controlled (`tasks` + `onTasksChange`) or uncontrolled (`defaultTasks`) - in controlled
  // mode nothing is stored here, every change goes out through onTasksChange.
  const [tasks, setTasks] = useUncontrolled<GanttTask[]>({
    value: tasksProp,
    defaultValue: defaultTasks,
    finalValue: [],
    onChange: onTasksChange,
  });

  // Collapse state (uncontrolled). When defaultExpandedIds is given, every parent
  // not listed starts collapsed; otherwise everything starts expanded.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    if (!defaultExpandedIds) {
      return new Set();
    }
    const expanded = new Set(defaultExpandedIds);
    return new Set(
      buildTaskTree(tasksProp ?? defaultTasks ?? [], new Set())
        .filter((row) => row.hasChildren && !expanded.has(row.task.id))
        .map((row) => row.task.id)
    );
  });

  const toggleExpand = useCallback(
    (taskId: string) => {
      // A currently collapsed row is about to become expanded.
      onToggleExpand?.(taskId, collapsedIds.has(taskId));
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return next;
      });
    },
    [onToggleExpand, collapsedIds]
  );

  // Visible rows in render order; parents carry their computed envelope schedule.
  // Recomputed only when tasks settle (drag commits) or collapse toggles.
  const rows = useMemo(
    () => buildTaskTree(tasks, collapsedIds, calendar),
    [tasks, collapsedIds, calendar]
  );

  // Critical path (CPM over dependencies) - only recomputed when tasks settle (drag commits),
  // not live during drag.
  const criticalIds = useMemo(
    () => (highlightCriticalPath ? getCriticalPath(tasks) : EMPTY_CRITICAL),
    [highlightCriticalPath, tasks]
  );
  // Screen-reader announcement for drag/keyboard commits.
  const [announcement, setAnnouncement] = useState('');
  // Visible size of the timeline body: the width extends the grid/header to fill the screen
  // even when the tasks span fewer days than the viewport, the height drives row virtualization.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  // Refs for scroll synchronization
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const taskListBodyRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  // All drag interactions (move / resize / link) on plain pointer events - no @dnd-kit.
  const drag = useGanttDrag({
    tasks,
    commitTasks: setTasks,
    columnWidth: effectiveColumnWidth,
    bodyRef: timelineBodyRef,
    contentRef: timelineContentRef,
    onTaskUpdate,
    onLinkCreate,
    autoSchedule,
    isNonWorkingDay: calendar,
    announce: setAnnouncement,
  });
  const active = drag.state;

  // Clicking a rendered dependency line deletes the link: the target's `dependencies`
  // loses the source id, mirroring how onLinkCreate adds it. Only the clicked type goes -
  // a pair may be tied by several dependencies of different types.
  const handleLinkDelete = useCallback(
    (fromTaskId: string, toTaskId: string, type: GanttDependencyType) => {
      setTasks(
        tasks.map((task) =>
          task.id === toTaskId
            ? {
                ...task,
                dependencies: (task.dependencies ?? []).filter((dep) => {
                  const normalized = normalizeDependency(dep);
                  return normalized.taskId !== fromTaskId || normalized.type !== type;
                }),
              }
            : task
        )
      );
      onLinkDelete?.(fromTaskId, toTaskId, type);
    },
    [tasks, setTasks, onLinkDelete]
  );

  // Calculate timeline bounds
  const calculatedBounds = useMemo(
    () => calculateTimelineBounds(tasks, startDate, endDate, undefined, calendar),
    [tasks, startDate, endDate, calendar]
  );

  // Freeze bounds while dragging so the axis doesn't reflow under the cursor. The origin
  // (start) never moves during a drag; only the END grows so dragging into the future has
  // room to auto-scroll into. Computed purely in a memo - no ref writes during render.
  // The 30-day buffer dwarfs typical back-and-forth movement, so letting the end shrink
  // again when the pointer moves left is invisible in practice.
  const bounds = useMemo(() => {
    if (!active || active.type === 'link') {
      return calculatedBounds;
    }
    const task = tasks.find((t) => t.id === active.taskId);
    if (!task) {
      return calculatedBounds;
    }
    const startDay = dayjs(task.startDate).diff(calculatedBounds.start, 'day');
    const barEndDay =
      startDay +
      getTaskSpan(task.startDate, task.duration, calendar) +
      Math.round(active.deltaX / effectiveColumnWidth);
    const needed = calculatedBounds.start.add(barEndDay + DRAG_BUFFER_DAYS, 'day');
    if (!needed.isAfter(calculatedBounds.end)) {
      return calculatedBounds;
    }
    return { start: calculatedBounds.start, end: needed };
  }, [calculatedBounds, active, tasks, effectiveColumnWidth, calendar]);

  // Calculate total timeline width, extended to at least fill the visible viewport so
  // there is no empty area to the right of the last column.
  const fillDays = effectiveColumnWidth > 0 ? Math.ceil(viewport.width / effectiveColumnWidth) : 0;
  const totalDays = Math.max(bounds.end.diff(bounds.start, 'day') + 1, fillDays);
  const displayEnd = bounds.start.add(totalDays - 1, 'day');
  const timelineWidth = totalDays * effectiveColumnWidth;

  // Row virtualization: rows are a fixed height, so the visible slice is pure arithmetic.
  // Both panes render only [firstRow, lastRow); the rest is padding/absolute offset, which
  // keeps scrollHeight - and therefore the scroll sync - unchanged.
  const [firstRow, lastRow] = visibleRowRange(scrollTop, viewport.height, rowHeight, rows.length);
  const visibleRows = rows.slice(firstRow, lastRow);

  // Sync scroll between task list and timeline. Assigning an unchanged scrollTop fires no
  // scroll event, so the two handlers can't echo back and forth.
  const handleTimelineScroll = useCallback(() => {
    const body = timelineBodyRef.current;
    if (!body) {
      return;
    }
    if (taskListBodyRef.current) {
      taskListBodyRef.current.scrollTop = body.scrollTop;
    }
    // Sync horizontal scroll with header
    if (timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = body.scrollLeft;
    }
    // Both panes are kept in sync, so the timeline's scrollTop is the single source for
    // the virtualized row range.
    setScrollTop(body.scrollTop);
  }, []);

  const handleTaskListScroll = useCallback(() => {
    if (taskListBodyRef.current && timelineBodyRef.current) {
      timelineBodyRef.current.scrollTop = taskListBodyRef.current.scrollTop;
    }
  }, []);

  // Measure the timeline body so the grid can be widened to fill the viewport.
  useEffect(() => {
    const node = timelineBodyRef.current;
    if (!node) {
      return undefined;
    }
    setViewport({ width: node.clientWidth, height: node.clientHeight });
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setViewport({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Ctrl+wheel zooms the day column width around the cursor. Native listener because React's
  // wheel handler is passive and cannot preventDefault the browser's page zoom.
  const zoomAnchorRef = useRef(0);
  const zoomRef = useRef({ width: baseColumnWidth, onChange: onColumnWidthChange });
  zoomRef.current = { width: baseColumnWidth, onChange: onColumnWidthChange };
  useEffect(() => {
    const body = timelineBodyRef.current;
    if (!body) {
      return undefined;
    }
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) {
        return;
      }
      e.preventDefault();
      zoomAnchorRef.current = e.clientX - body.getBoundingClientRect().left;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = Math.round(Math.min(200, Math.max(8, zoomRef.current.width * factor)));
      setZoomWidth(next);
      zoomRef.current.onChange?.(next);
    };
    body.addEventListener('wheel', onWheel, { passive: false });
    return () => body.removeEventListener('wheel', onWheel);
  }, []);

  // When the column width changes (zoom, viewMode) keep the date under the zoom anchor
  // (cursor for wheel zoom, left edge otherwise) at the same screen position.
  const prevColumnWidthRef = useRef(effectiveColumnWidth);
  useLayoutEffect(() => {
    const prev = prevColumnWidthRef.current;
    if (prev === effectiveColumnWidth) {
      return;
    }
    prevColumnWidthRef.current = effectiveColumnWidth;
    const body = timelineBodyRef.current;
    if (body) {
      const anchor = zoomAnchorRef.current;
      body.scrollLeft = (body.scrollLeft + anchor) * (effectiveColumnWidth / prev) - anchor;
    }
    zoomAnchorRef.current = 0;
  }, [effectiveColumnWidth]);

  // Programmatic scroll: on mount and whenever `scrollTo` changes (by value, not identity).
  const scrollToKey =
    scrollTo instanceof Date
      ? scrollTo.getTime()
      : typeof scrollTo === 'object' && scrollTo
        ? `task:${scrollTo.taskId}`
        : scrollTo;
  useEffect(() => {
    const body = timelineBodyRef.current;
    if (!scrollTo || !body) {
      return;
    }
    let date: dayjs.Dayjs;
    let rowIndex = -1;
    if (scrollTo === 'today') {
      date = dayjs();
    } else if (scrollTo instanceof Date) {
      date = dayjs(scrollTo);
    } else {
      rowIndex = rows.findIndex((r) => r.task.id === scrollTo.taskId);
      if (rowIndex === -1) {
        return;
      }
      date = dayjs(rows[rowIndex].startDate);
    }
    // One column of context to the left of the target.
    body.scrollLeft = dateToPixel(date, bounds.start, effectiveColumnWidth) - effectiveColumnWidth;
    if (rowIndex >= 0) {
      // `body.clientHeight`, not `viewport.height`: on mount the measurement effect has not
      // committed yet and the state is still 0.
      body.scrollTop = Math.max(0, rowIndex * rowHeight - (body.clientHeight - rowHeight) / 2);
    }
    // Intentionally only re-runs when the target changes, not on every layout/row change.
  }, [scrollToKey]);

  // Stable so TaskBar's memo comparator can rely on reference equality.
  const handleTaskClick = useCallback(
    (task: GanttTask) => {
      onTaskClick?.(task);
    },
    [onTaskClick]
  );

  // Drag-to-pan the timeline with the mouse on empty space (the scrollbar is hidden). Bars and
  // handles stopPropagation on pointerdown, so any pointerdown reaching here is empty canvas.
  // Touch/pen keep native scroll+momentum - only mouse lacks a grab affordance.
  // Middle button: hold-and-drag autoscroll (like Windows browsers do natively, but on every
  // platform) - the scroll speed grows with the distance from the press point.
  const panRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    auto: boolean;
    raf: number | null;
  } | null>(null);
  const autoScrollTick = useCallback(() => {
    const pan = panRef.current;
    const body = timelineBodyRef.current;
    if (!pan?.auto || !body) {
      return;
    }
    // `left`/`top` hold the latest pointer position in auto mode. 8px dead zone, then
    // 1px per frame for every 4px of distance, capped at 30px per frame.
    const speed = (d: number) => Math.sign(d) * Math.min(30, Math.max(0, Math.abs(d) - 8) / 4);
    body.scrollLeft += speed(pan.left - pan.x);
    body.scrollTop += speed(pan.top - pan.y);
    pan.raf = requestAnimationFrame(autoScrollTick);
  }, []);
  const handlePanStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const body = timelineBodyRef.current;
      if (e.pointerType !== 'mouse' || !body || (e.button && e.button !== 1)) {
        return;
      }
      e.preventDefault(); // stop text/SVG selection (and the browser's own middle-click behavior)
      const auto = e.button === 1;
      panRef.current = auto
        ? { x: e.clientX, y: e.clientY, left: e.clientX, top: e.clientY, auto, raf: null }
        : {
            x: e.clientX,
            y: e.clientY,
            left: body.scrollLeft,
            top: body.scrollTop,
            auto,
            raf: null,
          };
      body.setPointerCapture?.(e.pointerId);
      body.style.cursor = auto ? 'all-scroll' : 'grabbing';
      document.body.style.userSelect = 'none';
      if (auto) {
        panRef.current.raf = requestAnimationFrame(autoScrollTick);
      }
    },
    [autoScrollTick]
  );
  const handlePanMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const body = timelineBodyRef.current;
    if (!pan || !body) {
      return;
    }
    if (pan.auto) {
      pan.left = e.clientX;
      pan.top = e.clientY;
      return;
    }
    body.scrollLeft = pan.left - (e.clientX - pan.x);
    body.scrollTop = pan.top - (e.clientY - pan.y);
  }, []);
  const handlePanEnd = useCallback(() => {
    if (panRef.current?.raf !== null && panRef.current?.raf !== undefined) {
      cancelAnimationFrame(panRef.current.raf);
    }
    panRef.current = null;
    document.body.style.userSelect = '';
    if (timelineBodyRef.current) {
      timelineBodyRef.current.style.cursor = '';
    }
  }, []);
  // Unmount mid-autoscroll: stop the rAF loop.
  useEffect(() => handlePanEnd, [handlePanEnd]);

  // Keep the viewport visually pinned whenever the timeline origin (bounds.start)
  // shifts - e.g. when bounds re-tighten on drag end. A date sits at pixel
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
    const srcIndex = rows.findIndex((r) => r.task.id === active.taskId);
    if (srcIndex === -1) {
      return null;
    }
    // Anchor on the drawn bar: its calendar span, not its duration.
    const src = { ...getEffectiveTask(rows[srcIndex]), duration: rows[srcIndex].span };
    const x1 = barAnchors(src, bounds.start, effectiveColumnWidth, rowHeight).right;
    const y1 = srcIndex * rowHeight + rowHeight / 2;
    return { x1, y1, x2: active.linkCursor.x, y2: active.linkCursor.y };
  }, [active, rows, bounds.start, effectiveColumnWidth, rowHeight]);

  // Calculate today line position
  const today = dayjs();
  const todayPosition = dateToPixel(today, bounds.start, effectiveColumnWidth);
  const showTodayLine =
    showTodayMarker && today.isAfter(bounds.start) && today.isBefore(displayEnd);

  return (
    <Box ref={ref} {...getStyles('root')} {...others}>
      {/* Left Pane - Task List */}
      <TaskList
        rows={visibleRows}
        columns={columns}
        locale={locale}
        getStyles={getStyles}
        bodyRef={taskListBodyRef}
        onScroll={handleTaskListScroll}
        collapsedIds={collapsedIds}
        onToggleExpand={toggleExpand}
        offsetTop={firstRow * rowHeight}
        contentHeight={rows.length * rowHeight}
        selectedTaskId={selectedTaskId}
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
            weekStart={weekStart}
            locale={locale}
            isNonWorkingDay={isNonWorkingDay}
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
            style={{ width: timelineWidth, height: rows.length * rowHeight }}
          >
            <TimelineGrid
              startDate={bounds.start}
              endDate={displayEnd}
              columnWidth={effectiveColumnWidth}
              rowCount={rows.length}
              rowHeight={rowHeight}
              getStyles={getStyles}
              viewMode={viewMode}
              weekStart={weekStart}
              isNonWorkingDay={isNonWorkingDay}
            />

            {/* Today line */}
            {showTodayLine && (
              <div {...getStyles('todayLine', { style: { left: todayPosition } })} />
            )}

            {markers?.map((marker) => {
              const date = dayjs(marker.date);
              if (date.isBefore(bounds.start) || date.isAfter(displayEnd)) {
                return null;
              }
              return (
                <div
                  key={`${marker.date}-${marker.color ?? ''}`}
                  {...getStyles('marker', {
                    style: {
                      left: dateToPixel(date, bounds.start, effectiveColumnWidth),
                      ['--marker-color' as string]: getThemeColor(marker.color ?? 'orange', theme),
                    },
                  })}
                >
                  {marker.label != null && (
                    <span {...getStyles('markerLabel')}>{marker.label}</span>
                  )}
                </div>
              );
            })}

            {/* Task rows with bars */}
            {visibleRows.map((row, i) => {
              const index = firstRow + i;
              const task = getEffectiveTask(row);
              return (
                <div
                  key={task.id}
                  {...getStyles('timelineRow')}
                  data-first={index === Math.floor(scrollTop / rowHeight) || undefined}
                  title={showTitle ? task.label : undefined}
                  style={{ top: index * rowHeight }}
                >
                  <TaskBar
                    task={task}
                    startDate={bounds.start}
                    columnWidth={effectiveColumnWidth}
                    getStyles={getStyles}
                    span={row.span}
                    isNonWorkingDay={calendar}
                    isSummary={row.hasChildren}
                    isLocked={readOnly || task.locked}
                    isDragging={active?.taskId === task.id && active.type !== 'link'}
                    isLinkTarget={active?.type === 'link' && active.dropTargetId === task.id}
                    dragType={active?.taskId === task.id ? active.type : null}
                    dragDeltaX={active?.taskId === task.id ? active.deltaX : 0}
                    startDrag={drag.startDrag}
                    didDrag={drag.didDrag}
                    nudge={drag.nudge}
                    locale={locale}
                    onTaskClick={handleTaskClick}
                    isCritical={criticalIds.has(task.id)}
                    isSelected={task.id === selectedTaskId}
                    showTooltip={showTitle}
                    showDragLabel={showDragLabel}
                  />

                  {showBaselines && task.baseline && (
                    <div
                      {...getStyles('baselineBar')}
                      data-task-id={task.id}
                      style={{
                        left: dateToPixel(
                          task.baseline.startDate,
                          bounds.start,
                          effectiveColumnWidth
                        ),
                        width: durationToPixels(
                          getTaskSpan(task.baseline.startDate, task.baseline.duration, calendar),
                          effectiveColumnWidth
                        ),
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* Dependency arrows + live link line */}
            <DependencyLinks
              rows={rows}
              startDate={bounds.start}
              columnWidth={effectiveColumnWidth}
              rowHeight={rowHeight}
              getStyles={getStyles}
              activeDragId={active && active.type !== 'link' ? active.taskId : null}
              activeDragType={active && active.type !== 'link' ? active.type : null}
              dragDelta={active && active.type !== 'link' ? active.deltaX : 0}
              linkPreview={linkPreview}
              criticalIds={criticalIds}
              firstRow={firstRow}
              lastRow={lastRow}
              onLinkClick={readOnly ? undefined : handleLinkDelete}
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
