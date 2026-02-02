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
}

export function TimelineGrid({
  startDate,
  endDate,
  columnWidth,
  rowCount,
  rowHeight,
}: TimelineGridProps) {
  const gridData = useMemo(() => {
    const columns: Array<{ x: number; isWeekend: boolean }> = [];
    let current = startDate;
    let x = 0;

    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      const dayOfWeek = current.day();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      columns.push({ x, isWeekend });
      current = current.add(1, 'day');
      x += columnWidth;
    }

    return columns;
  }, [startDate, endDate, columnWidth]);

  const totalHeight = rowCount * rowHeight;

  return (
    <div className={classes.timelineGrid} style={{ height: totalHeight }}>
      {/* Weekend backgrounds */}
      {gridData
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

      {/* Day separator lines */}
      {gridData.map((col, index) => (
        <div
          key={`line-${index}`}
          className={classes.gridLine}
          style={{
            left: col.x,
            height: totalHeight,
          }}
        />
      ))}

      {/* Row separator lines */}
      {Array.from({ length: rowCount }).map((_, index) => (
        <div
          key={`row-${index}`}
          className={classes.rowLine}
          style={{
            top: (index + 1) * rowHeight,
          }}
        />
      ))}
    </div>
  );
}

TimelineGrid.displayName = 'TimelineGrid';
