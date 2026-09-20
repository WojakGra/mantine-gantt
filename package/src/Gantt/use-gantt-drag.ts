import { useCallback, useEffect, useRef, useState } from 'react';
import type { GanttDragType, GanttTask } from './types';
import {
  applyAutoSchedule,
  normalizeDependency,
  shiftTask,
  snapToGrid,
  wouldCreateCycle,
  type IsNonWorkingDay,
} from './utils';

// Auto-scroll tuning (mirrors @mantine/schedule's use-auto-scroll-on-drag).
const EDGE_THRESHOLD = 50;
const MAX_SCROLL_SPEED = 12;
// Pointer must travel this far before a drag begins, so a plain click still fires onTaskClick.
const DRAG_ACTIVATION_DISTANCE = 5;
// Touch/pen: a swipe over a bar pans the timeline natively; holding still this long arms the
// drag instead. Moving further than the tolerance before that means "pan", so we bail out.
const LONG_PRESS_MS = 300;
const LONG_PRESS_TOLERANCE = 10;

/** Id of the task bar under a client point, via the DOM (`data-task-id`). */
function taskIdAt(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-task-id]');
  return el?.dataset.taskId ?? null;
}

/** Live drag state, shared with TaskBar (bar geometry) and DependencyLinks (arrows + link line). */
export interface GanttDragState {
  type: GanttDragType;
  taskId: string;
  /** Scroll-adjusted continuous px delta since drag start (not snapped until release). */
  deltaX: number;
  /** For a `link` drag: cursor position in timelineContent coordinates. */
  linkCursor: { x: number; y: number } | null;
  /** For a `link` drag: id of the task currently under the cursor (never the source). */
  dropTargetId: string | null;
}

export interface UseGanttDragOptions {
  tasks: GanttTask[];
  /** Commit a fully computed task list. The hook never assumes the state is local. */
  commitTasks: (next: GanttTask[]) => void;
  /** Effective column width in px (already adjusted for viewMode). */
  columnWidth: number;
  /** Scroll container - drives scroll-adjusted delta and auto-scroll. */
  bodyRef: React.RefObject<HTMLDivElement | null>;
  /** Positioned content - its rect maps client coords to timeline pixels. */
  contentRef: React.RefObject<HTMLDivElement | null>;
  onTaskUpdate?: (task: GanttTask) => void;
  onLinkCreate?: (fromTaskId: string, toTaskId: string) => void;
  /** Cascade successors after a move/resize commit. */
  autoSchedule?: boolean;
  /** Working-day calendar; set only when the chart counts durations in working days. */
  isNonWorkingDay?: IsNonWorkingDay;
  /** Push a message to the aria-live region (drag/keyboard commits). */
  announce?: (message: string) => void;
}

interface DragRef {
  type: GanttDragType;
  taskId: string;
  /** Pointer that owns the drag; events from any other pointer (a second finger) are ignored. */
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  lastClientX: number;
  lastClientY: number;
  moved: boolean;
  /** Touch/pen pointer: activates by long-press, not by distance. */
  touch: boolean;
}

export interface UseGanttDragReturn {
  state: GanttDragState | null;
  /** Begin a drag from a pointerdown on the bar / a resize handle / the link connector. */
  startDrag: (type: GanttDragType, taskId: string, event: React.PointerEvent) => void;
  /** True for one frame after a real drag, so the trailing click doesn't fire onTaskClick. */
  didDrag: () => boolean;
  /** Keyboard nudge: move / resize a task by whole days and announce it. */
  nudge: (taskId: string, action: 'move' | 'resize', days: number) => void;
}

/**
 * Owns every drag interaction (move / resize-start / resize-end / link) on plain pointer
 * events - no @dnd-kit. pointerdown → document pointermove → pointerup, snapping to whole
 * days only on release. Auto-scrolls the viewport near its edges and keeps delta correct
 * across that scroll, so the bar follows the cursor. Modeled on @mantine/schedule's
 * use-horizontal-event-resize + use-auto-scroll-on-drag.
 */
export function useGanttDrag(options: UseGanttDragOptions): UseGanttDragReturn {
  const [state, setState] = useState<GanttDragState | null>(null);

  // Latest options, read inside document listeners that outlive a single render.
  const optsRef = useRef(options);
  optsRef.current = options;

  const dragRef = useRef<DragRef | null>(null);
  // Latest endDrag, so the document listeners below can stay referentially stable.
  const endDragRef = useRef<(commitDrag: boolean) => void>(() => {});
  const rafRef = useRef<number | null>(null);
  const scrollVec = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    scrollVec.current = { x: 0, y: 0 };
  }, []);

  // Rebuild live state from the last pointer position and the current scroll offset.
  const recompute = useCallback(() => {
    const drag = dragRef.current;
    const body = optsRef.current.bodyRef.current;
    const content = optsRef.current.contentRef.current;
    if (!drag || !body) {
      return;
    }

    if (drag.type === 'link') {
      const rect = content?.getBoundingClientRect();
      const x = rect ? drag.lastClientX - rect.left : 0;
      const y = rect ? drag.lastClientY - rect.top : 0;
      // ponytail: elementFromPoint per move is fine; cache row rects on drag start if it ever shows up hot.
      const targetId = taskIdAt(drag.lastClientX, drag.lastClientY);
      setState({
        type: 'link',
        taskId: drag.taskId,
        deltaX: 0,
        linkCursor: { x, y },
        dropTargetId: targetId && targetId !== drag.taskId ? targetId : null,
      });
      return;
    }

    const deltaX = drag.lastClientX - drag.startClientX + (body.scrollLeft - drag.startScrollLeft);
    setState({
      type: drag.type,
      taskId: drag.taskId,
      deltaX,
      linkCursor: null,
      dropTargetId: null,
    });
  }, []);

  const autoScrollTick = useCallback(() => {
    const body = optsRef.current.bodyRef.current;
    const v = scrollVec.current;
    if (!body || (v.x === 0 && v.y === 0)) {
      rafRef.current = null;
      return;
    }
    body.scrollLeft += v.x;
    body.scrollTop += v.y;
    recompute();
    rafRef.current = requestAnimationFrame(autoScrollTick);
  }, [recompute]);

  // Update auto-scroll velocity from the pointer's proximity to the viewport edges.
  const updateAutoScroll = useCallback(
    (clientX: number, clientY: number, allowVertical: boolean) => {
      const body = optsRef.current.bodyRef.current;
      if (!body) {
        return;
      }
      const rect = body.getBoundingClientRect();
      let vx = 0;
      let vy = 0;

      const fromLeft = clientX - rect.left;
      const fromRight = rect.right - clientX;
      if (fromLeft < EDGE_THRESHOLD) {
        vx = -Math.ceil((1 - fromLeft / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      } else if (fromRight < EDGE_THRESHOLD) {
        vx = Math.ceil((1 - fromRight / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      }

      if (allowVertical) {
        const fromTop = clientY - rect.top;
        const fromBottom = rect.bottom - clientY;
        if (fromTop < EDGE_THRESHOLD) {
          vy = -Math.ceil((1 - fromTop / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
        } else if (fromBottom < EDGE_THRESHOLD) {
          vy = Math.ceil((1 - fromBottom / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
        }
      }

      scrollVec.current = { x: vx, y: vy };
      if ((vx !== 0 || vy !== 0) && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(autoScrollTick);
      }
    },
    [autoScrollTick]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) {
        return;
      }
      // Enforce the activation threshold so a click without real movement is not a drag.
      if (!drag.moved) {
        if (drag.touch) {
          // Not armed yet: real movement is a pan, not a drag.
          if (
            Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) >
            LONG_PRESS_TOLERANCE
          ) {
            endDragRef.current(false);
          }
          return;
        }
        if (Math.abs(e.clientX - drag.startClientX) < DRAG_ACTIVATION_DISTANCE) {
          return;
        }
        drag.moved = true;
        didDragRef.current = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = drag.type === 'link' ? 'crosshair' : 'grabbing';
      }
      e.preventDefault();
      drag.lastClientX = e.clientX;
      drag.lastClientY = e.clientY;
      updateAutoScroll(e.clientX, e.clientY, drag.type === 'link');
      recompute();
    },
    [recompute, updateAutoScroll]
  );

  // Callbacks fire here, never inside a state updater - React StrictMode invokes updaters
  // twice, which would double-fire onTaskUpdate/onLinkCreate for a single drag.
  const commit = useCallback((drag: DragRef) => {
    const {
      tasks,
      commitTasks,
      columnWidth,
      onTaskUpdate,
      onLinkCreate,
      autoSchedule,
      isNonWorkingDay,
      announce,
      bodyRef,
    } = optsRef.current;

    if (drag.type === 'link') {
      const toTaskId = taskIdAt(drag.lastClientX, drag.lastClientY);
      if (!toTaskId || toTaskId === drag.taskId) {
        return;
      }
      if (wouldCreateCycle(tasks, drag.taskId, toTaskId)) {
        announce?.('Link not created: it would create a circular dependency');
        return;
      }
      commitTasks(
        tasks.map((task) => {
          if (task.id !== toTaskId) {
            return task;
          }
          const deps = task.dependencies || [];
          return deps.some((dep) => normalizeDependency(dep).taskId === drag.taskId)
            ? task
            : { ...task, dependencies: [...deps, drag.taskId] };
        })
      );
      onLinkCreate?.(drag.taskId, toTaskId);
      return;
    }

    const body = bodyRef.current;
    const deltaX =
      drag.lastClientX - drag.startClientX + (body ? body.scrollLeft - drag.startScrollLeft : 0);
    const days = Math.round(snapToGrid(deltaX, columnWidth) / columnWidth);
    if (days === 0) {
      return;
    }

    const dragged = tasks.find((t) => t.id === drag.taskId);
    const isMilestone = dragged?.type === 'milestone';
    // Milestones have no length: resize is a no-op (TaskBar hides the handles too).
    if (isMilestone && drag.type !== 'move') {
      return;
    }

    const dragType = drag.type;
    let next = tasks.map((task) =>
      task.id === drag.taskId
        ? { ...task, ...shiftTask(task, dragType, days, isNonWorkingDay) }
        : task
    );

    // Cascade successors so their dependencies still hold.
    if (autoSchedule) {
      next = applyAutoSchedule(next, drag.taskId, isNonWorkingDay);
    }

    commitTasks(next);

    const updated = next.find((t) => t.id === drag.taskId);
    if (updated) {
      onTaskUpdate?.(updated);
      announce?.(`${updated.label} ${updated.startDate}, ${updated.duration} day duration`);
    }
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerId === dragRef.current?.pointerId) {
      endDragRef.current(true);
    }
  }, []);
  // Escape cancels the drag: the bar snaps back and nothing is committed.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      endDragRef.current(false);
    }
  }, []);

  const detach = useCallback(() => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('pointercancel', handlePointerUp);
    document.removeEventListener('keydown', handleKeyDown);
    stopAutoScroll();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [handlePointerMove, handlePointerUp, handleKeyDown, stopAutoScroll]);

  const endDrag = useCallback(
    (commitDrag: boolean) => {
      const drag = dragRef.current;
      detach();

      if (drag && drag.moved) {
        if (commitDrag) {
          commit(drag);
          // Swallow the click that follows a real drag (see didDrag).
          requestAnimationFrame(() => {
            didDragRef.current = false;
          });
        } else {
          // Cancelled by Escape: the pointer is still down, so swallow the click that
          // follows the eventual pointerup instead.
          const reset = () => {
            document.removeEventListener('pointerup', reset);
            document.removeEventListener('pointercancel', reset);
            requestAnimationFrame(() => {
              didDragRef.current = false;
            });
          };
          document.addEventListener('pointerup', reset);
          document.addEventListener('pointercancel', reset);
        }
      } else {
        didDragRef.current = false;
      }

      dragRef.current = null;
      setState(null);
    },
    [commit, detach]
  );
  endDragRef.current = endDrag;

  const startDrag = useCallback(
    (type: GanttDragType, taskId: string, event: React.PointerEvent) => {
      // Only the primary button drags; middle/right bubble up (browser autoscroll, context menu).
      if (event.button) {
        return;
      }
      event.stopPropagation();
      // A second finger landing on a bar must not replace the drag already in progress.
      if (dragRef.current) {
        return;
      }
      const body = optsRef.current.bodyRef.current;
      dragRef.current = {
        type,
        taskId,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: body ? body.scrollLeft : 0,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        moved: false,
        touch: event.pointerType === 'touch' || event.pointerType === 'pen',
      };
      if (dragRef.current.touch) {
        longPressRef.current = setTimeout(() => {
          longPressRef.current = null;
          const drag = dragRef.current;
          if (!drag) {
            return;
          }
          drag.moved = true;
          didDragRef.current = true;
          document.body.style.userSelect = 'none';
          navigator.vibrate?.(10);
          // Publish the (zero-delta) drag state so the bar shows it is armed.
          recompute();
        }, LONG_PRESS_MS);
      }
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      // pointercancel: the OS/browser can take the gesture over (touch scrolling, alerts) -
      // treat it like pointerup so cursors/listeners/auto-scroll never stay stuck.
      document.addEventListener('pointercancel', handlePointerUp);
      document.addEventListener('keydown', handleKeyDown);
    },
    [handlePointerMove, handlePointerUp, handleKeyDown, recompute]
  );

  // An armed touch drag must stop the browser from panning. The listener has to exist before
  // the gesture starts: iOS Safari ignores preventDefault from one added after touchstart.
  useEffect(() => {
    const content = optsRef.current.contentRef.current;
    if (!content) {
      return undefined;
    }
    const blockPan = (e: TouchEvent) => {
      if (dragRef.current?.moved) {
        e.preventDefault();
      }
    };
    content.addEventListener('touchmove', blockPan, { passive: false });
    return () => content.removeEventListener('touchmove', blockPan);
  }, []);

  const didDrag = useCallback(() => didDragRef.current, []);

  // Unmount mid-drag (view switch etc.): drop document listeners and stop auto-scroll,
  // otherwise they leak and keep firing setState on a dead component.
  useEffect(
    () => () => {
      if (dragRef.current) {
        dragRef.current = null;
        detach();
      }
    },
    [detach]
  );

  const nudge = useCallback((taskId: string, action: 'move' | 'resize', days: number) => {
    const { tasks, commitTasks, onTaskUpdate, autoSchedule, isNonWorkingDay, announce } =
      optsRef.current;
    const dragged = tasks.find((t) => t.id === taskId);
    // Milestones have no length: resize is a no-op (TaskBar ignores Shift+Arrow too).
    if (action === 'resize' && dragged?.type === 'milestone') {
      return;
    }
    let next = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }
      // Keyboard resize changes the duration itself: a one-calendar-day step from a Friday
      // would land on Saturday and add no working day.
      return action === 'move'
        ? { ...task, ...shiftTask(task, 'move', days, isNonWorkingDay) }
        : { ...task, duration: Math.max(1, task.duration + days) };
    });
    if (autoSchedule) {
      next = applyAutoSchedule(next, taskId, isNonWorkingDay);
    }
    commitTasks(next);

    const updated = next.find((t) => t.id === taskId);
    if (updated) {
      onTaskUpdate?.(updated);
      announce?.(`${updated.label} ${updated.startDate}, ${updated.duration} day duration`);
    }
  }, []);

  return { state, startDrag, didDrag, nudge };
}
