import type { Dayjs } from 'dayjs';
import React, { useMemo } from 'react';
import type { GanttTask } from './types';
import { dateToPixel, durationToPixels } from './utils';
import classes from './Gantt.module.css';

interface DependencyLinksProps {
  tasks: GanttTask[];
  startDate: Dayjs;
  columnWidth: number;
  rowHeight: number;
  activeDragId?: string | null;
  activeDragType?: 'move' | 'resize-end' | 'resize-start' | 'link' | null;
  dragDelta?: number;
}

export function DependencyLinks({
  tasks,
  startDate,
  columnWidth,
  rowHeight,
  activeDragId,
  activeDragType,
  dragDelta = 0,
}: DependencyLinksProps) {
  const taskMap = useMemo(() => {
    const map = new Map<string, { task: GanttTask; index: number }>();
    tasks.forEach((task, index) => {
      map.set(task.id, { task, index });
    });
    return map;
  }, [tasks]);

  const links = useMemo(() => {
    const result: Array<{ id: string; points: string }> = [];
    const barHeight = 28;
    const barTopOffset = 8;

    tasks.forEach((toTask, toIndex) => {
      if (!toTask.dependencies || toTask.dependencies.length === 0) {
        return;
      }

      toTask.dependencies.forEach((fromId) => {
        const fromData = taskMap.get(fromId);
        if (!fromData) {
          return;
        }

        const { task: fromTask, index: fromIndex } = fromData;

        // Calculate base positions
        let fromBarRight =
          dateToPixel(fromTask.startDate, startDate, columnWidth) +
          durationToPixels(fromTask.duration, columnWidth);
        const fromBarBottom = fromIndex * rowHeight + barTopOffset + barHeight;
        const fromBarMidY = fromIndex * rowHeight + barTopOffset + barHeight / 2;

        let toBarLeft = dateToPixel(toTask.startDate, startDate, columnWidth);
        const toBarMidY = toIndex * rowHeight + barTopOffset + barHeight / 2;

        // Apply drag delta if this task is being dragged
        if (activeDragId === fromTask.id && dragDelta !== 0) {
          if (activeDragType === 'move') {
            fromBarRight += dragDelta;
          } else if (activeDragType === 'resize-end') {
            fromBarRight += dragDelta;
          }
          // resize-start doesn't affect the right edge position visually during drag
          // because the width shrinks as start moves
        }

        if (activeDragId === toTask.id && dragDelta !== 0) {
          if (activeDragType === 'move') {
            toBarLeft += dragDelta;
          } else if (activeDragType === 'resize-start') {
            toBarLeft += dragDelta;
          }
          // resize-end doesn't affect left position
        }

        // Generate polyline points
        const points = generateSvarStylePoints(
          fromBarRight,
          fromBarBottom,
          fromBarMidY,
          toBarLeft,
          toBarMidY,
          rowHeight
        );

        result.push({
          id: `${fromId}-${toTask.id}`,
          points,
        });
      });
    });

    return result;
  }, [tasks, taskMap, startDate, columnWidth, rowHeight, activeDragId, activeDragType, dragDelta]);

  if (links.length === 0) {
    return null;
  }

  return (
    <svg className={classes.dependencyLinks}>
      <defs>
        <marker id="dep-arrow" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <path d="M0,0 L5,2 L0,4 z" className={classes.linkArrow} />
        </marker>
      </defs>

      {links.map((link) => (
        <polyline
          key={link.id}
          className={classes.dependencyLine}
          points={link.points}
          markerEnd="url(#dep-arrow)"
        />
      ))}
    </svg>
  );
}

/**
 * Generate points like svar-gantt style:
 * - Exit from right edge of source, middle height
 * - Go right a bit, then down to gap between rows
 * - Go horizontal to align with target
 * - Go down to target, enter from left at middle height
 */
function generateSvarStylePoints(
  fromX: number,
  fromBottom: number,
  fromMidY: number,
  toX: number,
  toMidY: number,
  rowHeight: number
): string {
  const points: Array<[number, number]> = [];
  const cornerOffset = 10;

  // Start: right edge of source bar, middle height
  points.push([fromX, fromMidY]);

  // Go right a small amount
  const exitX = fromX + cornerOffset;
  points.push([exitX, fromMidY]);

  // Calculate the Y for the horizontal routing lane
  // This should be below the source task bar but in the row gap
  const routeY = fromBottom + (rowHeight - 28 - 8) / 2 + 4;

  // Go down to the routing lane
  points.push([exitX, routeY]);

  // Go horizontal to align with target entry point
  const entryX = toX - cornerOffset;
  points.push([entryX, routeY]);

  // Go down/up to target Y
  points.push([entryX, toMidY]);

  // Enter target (left edge)
  points.push([toX, toMidY]);

  return points.map((p) => `${p[0]},${p[1]}`).join(' ');
}

DependencyLinks.displayName = 'DependencyLinks';
