import dayjs, { type Dayjs } from 'dayjs';
import React, { useMemo } from 'react';
import type { GetStylesApi } from '@mantine/core';
import type { GanttFactory } from './types';
import { generateDayHeaders, generateWeekHeaders } from './utils';
import classes from './Gantt.module.css';

interface TimelineHeaderProps {
  startDate: Dayjs;
  endDate: Dayjs;
  columnWidth: number;
  getStyles: GetStylesApi<GanttFactory>;
  totalWidth: number;
  viewMode: 'day' | 'week' | 'month';
}

export function TimelineHeader({
  startDate,
  endDate,
  columnWidth,
  totalWidth,
  viewMode,
}: TimelineHeaderProps) {
  const today = dayjs();

  const dayHeaders = useMemo(() => generateDayHeaders(startDate, endDate), [startDate, endDate]);

  const weekHeaders = useMemo(() => generateWeekHeaders(startDate, endDate), [startDate, endDate]);

  // Generate month headers for month view
  const monthHeaders = useMemo(() => {
    const months: Array<{ label: string; days: number }> = [];
    let current = startDate.startOf('month');

    while (current.isBefore(endDate) || current.isSame(endDate, 'month')) {
      const monthEnd = current.endOf('month');
      const actualEnd = monthEnd.isAfter(endDate) ? endDate : monthEnd;
      const actualStart = current.isBefore(startDate) ? startDate : current;
      const days = actualEnd.diff(actualStart, 'day') + 1;

      months.push({
        label: current.format('MMMM YYYY'),
        days,
      });
      current = current.add(1, 'month').startOf('month');
    }

    return months;
  }, [startDate, endDate]);

  if (viewMode === 'month') {
    return (
      <div className={classes.timelineHeaderInner} style={{ width: totalWidth }}>
        {/* Month row only - double height to span both rows */}
        <div className={classes.weekHeader} style={{ height: '100%' }}>
          {monthHeaders.map((month, index) => (
            <div
              key={index}
              className={classes.weekHeaderCell}
              style={{ 
                width: month.days * columnWidth,
                height: '100%',
                alignItems: 'center',
              }}
            >
              {month.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === 'week') {
    return (
      <div className={classes.timelineHeaderInner} style={{ width: totalWidth }}>
        {/* Month row */}
        <div className={classes.weekHeader}>
          {monthHeaders.map((month, index) => (
            <div
              key={index}
              className={classes.weekHeaderCell}
              style={{ width: month.days * columnWidth }}
            >
              {month.label}
            </div>
          ))}
        </div>

        {/* Week number row */}
        <div className={classes.timelineHeaderRow}>
          {weekHeaders.map((week, index) => (
            <div
              key={index}
              className={classes.timelineHeaderCell}
              style={{ width: week.days * columnWidth }}
            >
              Week {week.weekNumber}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: day view
  return (
    <div className={classes.timelineHeaderInner} style={{ width: totalWidth }}>
      {/* Month row */}
      <div className={classes.weekHeader}>
        {monthHeaders.map((month, index) => (
          <div
            key={index}
            className={classes.weekHeaderCell}
            style={{ width: month.days * columnWidth }}
          >
            {month.label}
          </div>
        ))}
      </div>

      {/* Day row */}
      <div className={classes.timelineHeaderRow}>
        {dayHeaders.map((day, index) => (
          <div
            key={index}
            className={classes.timelineHeaderCell}
            data-weekend={day.isWeekend || undefined}
            data-today={day.date.isSame(today, 'day') || undefined}
          >
            {day.label}
          </div>
        ))}
      </div>
    </div>
  );
}

TimelineHeader.displayName = 'TimelineHeader';
