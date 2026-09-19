import dayjs, { type Dayjs } from 'dayjs';
import React, { useMemo } from 'react';
import type { GetStylesApi } from '@mantine/core';
import type { GanttFactory } from './types';
import { formatDate, generateDayHeaders, generateWeekHeaders } from './utils';

interface TimelineHeaderProps {
  startDate: Dayjs;
  endDate: Dayjs;
  columnWidth: number;
  getStyles: GetStylesApi<GanttFactory>;
  totalWidth: number;
  viewMode: 'day' | 'week' | 'month';
  weekStart: 0 | 1;
  locale: string;
  isNonWorkingDay?: (date: Date) => boolean;
}

export function TimelineHeader({
  startDate,
  endDate,
  columnWidth,
  getStyles,
  totalWidth,
  viewMode,
  weekStart,
  locale,
  isNonWorkingDay,
}: TimelineHeaderProps) {
  const today = dayjs();

  const dayHeaders = useMemo(
    () => generateDayHeaders(startDate, endDate, isNonWorkingDay),
    [startDate, endDate, isNonWorkingDay]
  );

  const weekHeaders = useMemo(
    () => generateWeekHeaders(startDate, endDate, weekStart, locale),
    [startDate, endDate, weekStart, locale]
  );

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
        label: formatDate(current, locale, { month: 'long', year: 'numeric' }),
        days,
      });
      current = current.add(1, 'month').startOf('month');
    }

    return months;
  }, [startDate, endDate, locale]);

  return (
    <div {...getStyles('timelineHeaderInner', { style: { width: totalWidth } })}>
      {/* Month row - the only row in month view */}
      <div {...getStyles('weekHeader')} data-single-row={viewMode === 'month' || undefined}>
        {monthHeaders.map((month, index) => (
          <div
            key={index}
            {...getStyles('weekHeaderCell', { style: { width: month.days * columnWidth } })}
          >
            {month.label}
          </div>
        ))}
      </div>

      {viewMode === 'week' && (
        <div {...getStyles('timelineHeaderRow')}>
          {weekHeaders.map((week, index) => (
            <div
              key={index}
              {...getStyles('timelineHeaderCell', { style: { width: week.days * columnWidth } })}
            >
              Week {week.weekNumber}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'day' && (
        <div {...getStyles('timelineHeaderRow')}>
          {dayHeaders.map((day, index) => (
            <div
              key={index}
              {...getStyles('timelineHeaderCell')}
              data-weekend={day.isWeekend || undefined}
              data-today={day.date.isSame(today, 'day') || undefined}
            >
              {day.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

TimelineHeader.displayName = 'TimelineHeader';
