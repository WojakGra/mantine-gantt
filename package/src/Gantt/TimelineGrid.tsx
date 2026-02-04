import type { Dayjs } from 'dayjs';
import React, { useMemo } from 'react';
import type { GetStylesApi } from '@mantine/core';
import type { GanttFactory } from './types';
import classes from './Gantt.module.css';

interface TimelineGridProps {
  startDate: Dayjs;
  endDate: Dayjs;
  columnWidth: number;
  rowCount: number;
  rowHeight: number;
  getStyles: GetStylesApi<GanttFactory>;
  viewMode: 'day' | 'week' | 'month';
}

export function TimelineGrid({
  startDate,
  endDate,
  columnWidth,
  rowCount,
  rowHeight,
  viewMode,
}: TimelineGridProps) {
  // Generate day-based grid data (always needed for positioning)
  const dayGridData = useMemo(() => {
    const columns: Array<{ x: number; isWeekend: boolean; date: Dayjs }> = [];
    let current = startDate;
    let x = 0;

    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      const dayOfWeek = current.day();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      columns.push({ x, isWeekend, date: current });
      current = current.add(1, 'day');
      x += columnWidth;
    }

    return columns;
  }, [startDate, endDate, columnWidth]);

  // Generate week separator positions
  const weekSeparators = useMemo(() => {
    const separators: number[] = [];
    dayGridData.forEach((col) => {
      // Add separator at the start of each week (Sunday = 0)
      if (col.date.day() === 0) {
        separators.push(col.x);
      }
    });
    return separators;
  }, [dayGridData]);

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

  // Get grid line positions based on viewMode
  const gridLines = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return weekSeparators;
      case 'week':
        return weekSeparators;
      case 'day':
      default:
        return dayGridData.map((col) => col.x);
    }
  }, [viewMode, dayGridData, weekSeparators]);

  // Get major grid line positions (more prominent lines)
  const majorGridLines = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return monthSeparators;
      case 'week':
        return monthSeparators;
      case 'day':
      default:
        return weekSeparators;
    }
  }, [viewMode, monthSeparators, weekSeparators]);

  return (
    <div className={classes.timelineGrid} style={{ height: totalHeight }}>
      {/* Weekend backgrounds (only in day view) */}
      {viewMode === 'day' &&
        dayGridData
          .filter((col) => col.isWeekend)
          .map((col, index) => (
            <div
              key={`weekend-${index}`}
              className={classes.weekendBackground}
              style={{
                left: col.x,
                width: columnWidth,
                height: totalHeight,
              }}
            />
          ))}

      {/* Regular grid lines */}
      {gridLines.map((x, index) => (
        <div
          key={`line-${index}`}
          className={classes.gridLine}
          style={{
            left: x - 1,
            height: totalHeight,
          }}
        />
      ))}

      {/* Major grid lines (week/month boundaries) */}
      {majorGridLines.map((x, index) => (
        <div
          key={`major-${index}`}
          className={classes.majorGridLine}
          style={{
            left: x - 1,
            height: totalHeight,
          }}
        />
      ))}
    </div>
  );
}

TimelineGrid.displayName = 'TimelineGrid';
