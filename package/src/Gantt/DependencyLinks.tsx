import type { Dayjs } from 'dayjs';
import React, { useMemo } from 'react';
import type { GetStylesApi } from '@mantine/core';
import type { GanttDragType, GanttFactory, GanttTask, GanttTreeRow } from './types';
import { dateToPixel, durationToPixels, getEffectiveTask } from './utils';

interface DependencyLinksProps {
  /** Visible rows in render order — hidden tasks get no arrows. */
  rows: GanttTreeRow[];
  startDate: Dayjs;
  columnWidth: number;
  rowHeight: number;
  getStyles: GetStylesApi<GanttFactory>;
  activeDragId?: string | null;
  activeDragType?: GanttDragType | null;
  /** Continuous, scroll-adjusted px delta of the active move/resize drag. */
  dragDelta?: number;
  /** Live link-creation line, in timelineContent coordinates. */
  linkPreview?: { x1: number; y1: number; x2: number; y2: number } | null;
  /** IDs of tasks on the critical path; a link is critical when both endpoints are. */
  criticalIds?: Set<string>;
}

export function DependencyLinks({
  rows,
  startDate,
  columnWidth,
  rowHeight,
  getStyles,
  activeDragId,
  activeDragType,
  dragDelta = 0,
  linkPreview = null,
  criticalIds,
}: DependencyLinksProps) {
  const taskMap = useMemo(() => {
    const map = new Map<string, { task: GanttTask; index: number }>();
    rows.forEach((row, index) => {
      map.set(row.task.id, { task: getEffectiveTask(row), index });
    });
    return map;
  }, [rows]);

  const links = useMemo(() => {
    const result: Array<{ id: string; points: string; critical: boolean }> = [];
    // Bar is vertically centered in the row, so midY is simply rowHeight / 2
    const barMidYOffset = rowHeight / 2;

    rows.forEach((toRow) => {
      const deps = toRow.task.dependencies;
      if (!deps || deps.length === 0) {
        return;
      }
      const { task: toTask, index: toIndex } = taskMap.get(toRow.task.id)!;

      deps.forEach((fromId) => {
        const fromData = taskMap.get(fromId);
        if (!fromData) {
          // Unknown id, or endpoint hidden inside a collapsed subtree → no arrow.
          return;
        }

        const { task: fromTask, index: fromIndex } = fromData;

        // Calculate base positions
        let fromBarRight =
          dateToPixel(fromTask.startDate, startDate, columnWidth) +
          durationToPixels(fromTask.duration, columnWidth);
        const fromBarMidY = fromIndex * rowHeight + barMidYOffset;

        let toBarLeft = dateToPixel(toTask.startDate, startDate, columnWidth);
        const toBarMidY = toIndex * rowHeight + barMidYOffset;

        // Apply drag delta if this task is being dragged
        if (activeDragId === fromTask.id && dragDelta !== 0) {
          if (activeDragType === 'move' || activeDragType === 'resize-end') {
            fromBarRight += dragDelta;
          }
          // resize-start doesn't affect the right edge position visually during drag
          // because the width shrinks as start moves
        }

        if (activeDragId === toTask.id && dragDelta !== 0) {
          if (activeDragType === 'move' || activeDragType === 'resize-start') {
            toBarLeft += dragDelta;
          }
          // resize-end doesn't affect left position
        }

        // Generate polyline points
        const points = generateSvarStylePoints(
          fromBarRight,
          fromBarMidY,
          toBarLeft,
          toBarMidY,
          fromIndex,
          toIndex,
          rowHeight
        );

        result.push({
          id: `${fromId}-${toTask.id}`,
          points,
          critical: (criticalIds?.has(fromId) && criticalIds?.has(toTask.id)) || false,
        });
      });
    });

    return result;
  }, [
    rows,
    taskMap,
    startDate,
    columnWidth,
    rowHeight,
    activeDragId,
    activeDragType,
    dragDelta,
    criticalIds,
  ]);

  if (links.length === 0 && !linkPreview) {
    return null;
  }

  const hasCriticalLink = links.some((link) => link.critical);

  return (
    <svg {...getStyles('dependencyLinks')}>
      <defs>
        <marker id="dep-arrow" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <path d="M0,0 L5,2 L0,4 z" {...getStyles('linkArrow')} />
        </marker>
        {hasCriticalLink && (
          <marker
            id="dep-arrow-critical"
            markerWidth="5"
            markerHeight="4"
            refX="4"
            refY="2"
            orient="auto"
          >
            <path d="M0,0 L5,2 L0,4 z" data-critical {...getStyles('linkArrow')} />
          </marker>
        )}
      </defs>

      {links.map((link) => (
        <polyline
          key={link.id}
          {...getStyles('dependencyLine')}
          data-critical={link.critical || undefined}
          points={link.points}
          markerEnd={link.critical ? 'url(#dep-arrow-critical)' : 'url(#dep-arrow)'}
        />
      ))}

      {linkPreview && (
        <line
          {...getStyles('dependencyLine')}
          x1={linkPreview.x1}
          y1={linkPreview.y1}
          x2={linkPreview.x2}
          y2={linkPreview.y2}
          markerEnd="url(#dep-arrow)"
        />
      )}
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
  fromMidY: number,
  toX: number,
  toMidY: number,
  fromIndex: number,
  toIndex: number,
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
  // Route through the gap between rows (use the row boundary)
  const routeRowIndex = Math.max(fromIndex, toIndex);
  const routeY = routeRowIndex * rowHeight;

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
