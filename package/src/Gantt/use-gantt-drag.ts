import dayjs from 'dayjs';
import { useCallback, useRef, useState } from 'react';
import type { GanttDragType, GanttTask } from './types';
import { snapToGrid } from './utils';

// Auto-scroll tuning (mirrors @mantine/schedule's use-auto-scroll-on-drag).
const EDGE_THRESHOLD = 50;
const MAX_SCROLL_SPEED = 12;
// Pointer must travel this far before a drag begins, so a plain click still fires onTaskClick.
const DRAG_ACTIVATION_DISTANCE = 5;

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
  setTasks: React.Dispatch<React.SetStateAction<GanttTask[]>>;
  /** Effective column width in px (already adjusted for viewMode). */
  columnWidth: number;
  /** Scroll container — drives scroll-adjusted delta and auto-scroll. */
  bodyRef: React.RefObject<HTMLDivElement | null>;
  /** Positioned content — its rect maps client coords to timeline pixels. */
  contentRef: React.RefObject<HTMLDivElement | null>;
  onTaskUpdate?: (task: GanttTask) => void;
  onLinkCreate?: (fromTaskId: string, toTaskId: string) => void;
  /** Push a message to the aria-live region (drag/keyboard commits). */
  announce?: (message: string) => void;
}

interface DragRef {
  type: GanttDragType;
  taskId: string;
  startClientX: number;
  startScrollLeft: number;
  lastClientX: number;
  lastClientY: number;
  moved: boolean;
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
 * events — no @dnd-kit. pointerdown → document pointermove → pointerup, snapping to whole
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
  const rafRef = useRef<number | null>(null);
  const scrollVec = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

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
      // Hit-test the task under the cursor via the DOM (O(1) per move).
      // ponytail: elementFromPoint is fine here; cache row rects on drag start if it ever shows up hot.
      const el = document.elementFromPoint(drag.lastClientX, drag.lastClientY);
      const targetEl = el?.closest('[data-task-id]') as HTMLElement | null;
      const targetId = targetEl?.dataset.taskId ?? null;
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
      if (!drag) {
        return;
      }
      // Enforce the activation threshold so a click without real movement is not a drag.
      if (!drag.moved) {
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

  const commit = useCallback((drag: DragRef) => {
    const { setTasks, columnWidth, onTaskUpdate, onLinkCreate, announce, bodyRef } =
      optsRef.current;

    if (drag.type === 'link') {
      const el = document.elementFromPoint(drag.lastClientX, drag.lastClientY);
      const targetEl = el?.closest('[data-task-id]') as HTMLElement | null;
      const toTaskId = targetEl?.dataset.taskId;
      if (toTaskId && toTaskId !== drag.taskId) {
        setTasks((current) =>
          current.map((task) => {
            if (task.id !== toTaskId) {
              return task;
            }
            const deps = task.dependencies || [];
            return deps.includes(drag.taskId)
              ? task
              : { ...task, dependencies: [...deps, drag.taskId] };
          })
        );
        onLinkCreate?.(drag.taskId, toTaskId);
      }
      return;
    }

    const body = bodyRef.current;
    const deltaX =
      drag.lastClientX - drag.startClientX + (body ? body.scrollLeft - drag.startScrollLeft : 0);
    const days = Math.round(snapToGrid(deltaX, columnWidth) / columnWidth);
    if (days === 0) {
      return;
    }

    setTasks((current) => {
      const next = current.map((task) => {
        if (task.id !== drag.taskId) {
          return task;
        }
        if (drag.type === 'move') {
          return {
            ...task,
            startDate: dayjs(task.startDate).add(days, 'day').format('YYYY-MM-DD'),
          };
        }
        if (drag.type === 'resize-end') {
          return { ...task, duration: Math.max(1, task.duration + days) };
        }
        // resize-start: shift start, keep the right edge (duration shrinks/grows by -days).
        return {
          ...task,
          startDate: dayjs(task.startDate).add(days, 'day').format('YYYY-MM-DD'),
          duration: Math.max(1, task.duration - days),
        };
      });
      const updated = next.find((t) => t.id === drag.taskId);
      if (updated) {
        onTaskUpdate?.(updated);
        announce?.(`${updated.label} ${updated.startDate}, ${updated.duration} day duration`);
      }
      return next;
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    stopAutoScroll();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    if (drag && drag.moved) {
      commit(drag);
      // Swallow the click that follows a real drag (see didDrag).
      requestAnimationFrame(() => {
        didDragRef.current = false;
      });
    } else {
      didDragRef.current = false;
    }

    dragRef.current = null;
    setState(null);
  }, [commit, handlePointerMove, stopAutoScroll]);

  const startDrag = useCallback(
    (type: GanttDragType, taskId: string, event: React.PointerEvent) => {
      event.stopPropagation();
      const body = optsRef.current.bodyRef.current;
      dragRef.current = {
        type,
        taskId,
        startClientX: event.clientX,
        startScrollLeft: body ? body.scrollLeft : 0,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        moved: false,
      };
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [handlePointerMove, handlePointerUp]
  );

  const didDrag = useCallback(() => didDragRef.current, []);

  const nudge = useCallback((taskId: string, action: 'move' | 'resize', days: number) => {
    const { setTasks, onTaskUpdate, announce } = optsRef.current;
    setTasks((current) => {
      const next = current.map((task) => {
        if (task.id !== taskId) {
          return task;
        }
        if (action === 'move') {
          return {
            ...task,
            startDate: dayjs(task.startDate).add(days, 'day').format('YYYY-MM-DD'),
          };
        }
        return { ...task, duration: Math.max(1, task.duration + days) };
      });
      const updated = next.find((t) => t.id === taskId);
      if (updated) {
        onTaskUpdate?.(updated);
        announce?.(`${updated.label} ${updated.startDate}, ${updated.duration} day duration`);
      }
      return next;
    });
  }, []);

  return { state, startDrag, didDrag, nudge };
}
