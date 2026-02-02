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
}

export function TimelineHeader({
  startDate,
  endDate,
  columnWidth,
  totalWidth,
}: TimelineHeaderProps) {
  const today = dayjs();

  const dayHeaders = useMemo(() => generateDayHeaders(startDate, endDate), [startDate, endDate]);

  const weekHeaders = useMemo(() => generateWeekHeaders(startDate, endDate), [startDate, endDate]);

  return (
    <div className={classes.timelineHeaderInner} style={{ width: totalWidth }}>
      {/* Week row */}
      <div className={classes.weekHeader}>
        {weekHeaders.map((week, index) => (
          <div
            key={index}
            className={classes.weekHeaderCell}
            style={{ width: week.days * columnWidth }}
          >
            {week.label}
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
