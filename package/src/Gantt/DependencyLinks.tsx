import type { Dayjs } from 'dayjs';
import React, { useId, useMemo } from 'react';
import type { GetStylesApi } from '@mantine/core';
import type { GanttDragType, GanttFactory, GanttTask, GanttTreeRow } from './types';
import { dateToPixel, durationToPixels, getEffectiveTask } from './utils';

// Horizontal stub before/after an elbow, and the default elbow rounding radius.
const CORNER_OFFSET = 10;
const ELBOW_RADIUS = 6;

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
  /** Virtualized row range `[firstRow, lastRow)`; links entirely above or below it are skipped. */
  firstRow?: number;
  lastRow?: number;
  /** Called with (fromTaskId, toTaskId) when a rendered dependency line is clicked. */
  onLinkClick?: (fromTaskId: string, toTaskId: string) => void;
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
  firstRow = 0,
  lastRow = Infinity,
  onLinkClick,
}: DependencyLinksProps) {
  // Marker id must be unique per instance: two charts on one page would otherwise share
  // `url(#...)` references and resolve them to the first SVG in the document.
  const uid = useId();
  const arrowMarkerId = `${uid}-dep-arrow`;

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

        // Both endpoints on the same side of the viewport → nothing of the arrow is on screen.
        // One above and one below still draws vertical segments across it, so keep those.
        if (
          (fromIndex < firstRow && toIndex < firstRow) ||
          (fromIndex >= lastRow && toIndex >= lastRow)
        ) {
          return;
        }

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
        const points = generateLinkPoints(
          fromBarRight,
          fromBarMidY,
          toBarLeft,
          toBarMidY,
          fromIndex,
          toIndex,
          rowHeight
        );

        result.push({
          id: `${fromId}~${toTask.id}`,
          // Path data ("M ... Q ..."), rendered into a <path d>.
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
    firstRow,
    lastRow,
  ]);

  if (links.length === 0 && !linkPreview) {
    return null;
  }

  return (
    <svg {...getStyles('dependencyLinks')}>
      <defs>
        {/* A single marker: the arrowhead paints itself with `context-stroke` (see CSS),
            so it always matches the referencing line — base color, :hover and critical
            alike. markerUnits=userSpaceOnUse keeps the head the same size regardless of
            stroke-width, so thicker critical lines don't get oversized heads. */}
        <marker
          id={arrowMarkerId}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0.5 L7,4 L0,7.5 Z" {...getStyles('linkArrow')} />
        </marker>
      </defs>

      {links.map((link) => {
        // `~` separator: task ids may themselves contain `-`, so split on the first `~`.
        const sep = link.id.indexOf('~');
        const fromId = link.id.slice(0, sep);
        const toId = link.id.slice(sep + 1);
        return (
          <g key={link.id}>
            {/* Invisible fat stroke: the visible line is 1.5–2.5px, far too thin to click
                reliably. This overlay widens the hit area without changing the look.
                pointerdown must not reach .timelineBody: its pan handler captures the
                pointer, which would retarget the trailing click to the body and the
                link deletion would never fire. */}
            <path
              {...getStyles('dependencyLine')}
              data-hit
              d={link.points}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onLinkClick ? () => onLinkClick(fromId, toId) : undefined}
            />
            <path
              {...getStyles('dependencyLine')}
              data-critical={link.critical || undefined}
              d={link.points}
              markerEnd={`url(#${arrowMarkerId})`}
            />
          </g>
        );
      })}

      {linkPreview && (
        <line
          {...getStyles('dependencyLine')}
          data-preview
          x1={linkPreview.x1}
          y1={linkPreview.y1}
          x2={linkPreview.x2}
          y2={linkPreview.y2}
          markerEnd={`url(#${arrowMarkerId})`}
        />
      )}
    </svg>
  );
}

/**
 * Orthogonal routing between the source bar's right edge and the target bar's left edge:
 * exit right, route through the gap between the two rows, enter left. Used for every
 * link, including backward ones (target starts before the source ends) — there the
 * horizontal segment simply runs behind the bars in between, which is fine because the
 * links SVG renders below the bars (z-index 1 vs 10).
 *
 * Corners are emitted as separate points; rounding is applied by `roundCorners`.
 */
function generateLinkPoints(
  fromX: number,
  fromMidY: number,
  toX: number,
  toMidY: number,
  fromIndex: number,
  toIndex: number,
  rowHeight: number
): string {
  const points: Array<[number, number]> = [];
  // Route through the gap between rows (the row boundary), never across a bar.
  const routeY = Math.max(fromIndex, toIndex) * rowHeight;

  // Exit RIGHT of source → row gap → enter LEFT of target.
  const exitX = fromX + CORNER_OFFSET;
  points.push([fromX, fromMidY]);
  points.push([exitX, fromMidY]);
  points.push([exitX, routeY]);
  const entryX = toX - CORNER_OFFSET;
  points.push([entryX, routeY]);
  points.push([entryX, toMidY]);
  points.push([toX, toMidY]);
  return roundCorners(points, ELBOW_RADIUS);
}

/**
 * Replace each interior corner of an orthogonal polyline with a quadratic curve, giving
 * dependency lines smooth elbows instead of sharp right angles. Returns SVG path data
 * ("M x,y L x,y Q x,y x,y ...") for a `<path d>` attribute. The first/last points are
 * kept exactly (they anchor to the bars); corner radius shrinks to fit short segments.
 */
function roundCorners(points: Array<[number, number]>, radius = 6): string {
  if (points.length < 3) {
    return `M ${points.map((p) => p.join(',')).join(' L ')}`;
  }
  const parts: string[] = [`M ${points[0][0]},${points[0][1]}`];
  for (let i = 1; i < points.length - 1; i++) {
    const [prevX, prevY] = points[i - 1];
    const [x, y] = points[i];
    const [nextX, nextY] = points[i + 1];

    // Distance available on each side of the corner — clamp so a curve never eats a
    // whole short segment (e.g. the little stub before the arrowhead).
    const inLen = Math.hypot(x - prevX, y - prevY);
    const outLen = Math.hypot(nextX - x, nextY - y);
    const r = Math.min(radius, inLen / 2, outLen / 2);

    const inX = x - ((x - prevX) / inLen) * r;
    const inY = y - ((y - prevY) / inLen) * r;
    const outX = x + ((nextX - x) / outLen) * r;
    const outY = y + ((nextY - y) / outLen) * r;

    parts.push(`L ${inX},${inY}`, `Q ${x},${y} ${outX},${outY}`);
  }
  const last = points[points.length - 1];
  parts.push(`L ${last[0]},${last[1]}`);
  return parts.join(' ');
}

DependencyLinks.displayName = 'DependencyLinks';
