import type { Dayjs } from 'dayjs';
import React, { useMemo } from 'react';
import type { GetStylesApi } from '@mantine/core';
import type { GanttFactory } from './types';
import { isWeekend } from './utils';

interface TimelineGridProps {
  startDate: Dayjs;
  endDate: Dayjs;
  columnWidth: number;
  rowCount: number;
  rowHeight: number;
  getStyles: GetStylesApi<GanttFactory>;
  viewMode: 'day' | 'week' | 'month';
  weekStart: 0 | 1;
  isNonWorkingDay?: (date: Date) => boolean;
  /** Day columns `[firstDay, lastDay)` whose shading is rendered in day view. */
  firstDay: number;
  lastDay: number;
}

function TimelineGridComponent({
  startDate,
  endDate,
  columnWidth,
  rowCount,
  rowHeight,
  getStyles,
  viewMode,
  weekStart,
  isNonWorkingDay = isWeekend,
  firstDay,
  lastDay,
}: TimelineGridProps) {
  // Generate day-based grid data (always needed for positioning)
  const dayGridData = useMemo(() => {
    const columns: Array<{ x: number; isWeekend: boolean; date: Dayjs }> = [];
    let current = startDate;
    let x = 0;

    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      columns.push({ x, isWeekend: isNonWorkingDay(current.toDate()), date: current });
      current = current.add(1, 'day');
      x += columnWidth;
    }

    return columns;
  }, [startDate, endDate, columnWidth, isNonWorkingDay]);

  // Generate week separator positions
  const weekSeparators = useMemo(() => {
    const separators: number[] = [];
    dayGridData.forEach((col) => {
      // Add separator at the start of each week (weekStart: 0 = Sunday, 1 = Monday)
      if (col.date.day() === weekStart) {
        separators.push(col.x);
      }
    });
    return separators;
  }, [dayGridData, weekStart]);

  // Generate month separator positions
  const monthSeparators = useMemo(() => {
    const separators: number[] = [];
    dayGridData.forEach((col) => {
      // Add separator at the start of each month
      if (col.date.date() === 1) {
        separators.push(col.x);
      }
    });
    return separators;
  }, [dayGridData]);

  const totalHeight = rowCount * rowHeight;

  // Day view: a line per day, weeks as major lines. Week/month view: weeks, months as major.
  // The day lines are one element with a repeating CSS mask instead of a div per day.
  const gridLines = viewMode === 'day' ? [] : weekSeparators;
  const majorGridLines = viewMode === 'day' ? weekSeparators : monthSeparators;

  return (
    <div {...getStyles('timelineGrid', { style: { height: totalHeight } })}>
      {/* Weekend backgrounds (only in day view) */}
      {viewMode === 'day' &&
        dayGridData
          .slice(firstDay, lastDay)
          .filter((col) => col.isWeekend)
          .map((col) => (
            <div
              key={`weekend-${col.x}`}
              {...getStyles('weekendBackground', {
                style: { left: col.x, width: columnWidth, height: totalHeight },
              })}
            />
          ))}

      {viewMode === 'day' && (
        <div {...getStyles('gridLine', { style: { height: totalHeight } })} data-days />
      )}

      {/* Regular grid lines */}
      {gridLines.map((x, index) => (
        <div
          key={`line-${index}`}
          {...getStyles('gridLine', { style: { left: x - 1, height: totalHeight } })}
        />
      ))}

      {/* Major grid lines (week/month boundaries) */}
      {majorGridLines.map((x, index) => (
        <div
          key={`major-${index}`}
          {...getStyles('majorGridLine', { style: { left: x - 1, height: totalHeight } })}
        />
      ))}
    </div>
  );
}

export const TimelineGrid = React.memo(TimelineGridComponent);

TimelineGrid.displayName = 'TimelineGrid';
