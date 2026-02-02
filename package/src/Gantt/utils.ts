import dayjs, { Dayjs } from 'dayjs';
import type { GanttTask } from './types';

/**
 * Convert a date to pixel position relative to timeline start
 */
export function dateToPixel(
  date: string | Date | Dayjs,
  startDate: Dayjs,
  columnWidth: number
): number {
  const d = dayjs(date);
  const diffDays = d.diff(startDate, 'day');
  return diffDays * columnWidth;
}

/**
 * Convert pixel position to date
 */
export function pixelToDate(x: number, startDate: Dayjs, columnWidth: number): Dayjs {
  const days = Math.round(x / columnWidth);
  return startDate.add(days, 'day');
}

/**
 * Snap a value to the nearest grid cell
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Calculate pixel width from duration
 */
export function durationToPixels(duration: number, columnWidth: number): number {
  return duration * columnWidth;
}

/**
 * Calculate duration from pixel width
 */
export function pixelsToDuration(pixels: number, columnWidth: number): number {
  return Math.max(1, Math.round(pixels / columnWidth));
}

/**
 * Generate timeline header data for days
 */
export function generateDayHeaders(
  startDate: Dayjs,
  endDate: Dayjs
): Array<{ date: Dayjs; label: string; isWeekend: boolean }> {
  const headers: Array<{ date: Dayjs; label: string; isWeekend: boolean }> = [];
  let current = startDate;

  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    const dayOfWeek = current.day();
    headers.push({
      date: current,
      label: current.format('D'),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
    current = current.add(1, 'day');
  }

  return headers;
}

/**
 * Generate week headers
 */
export function generateWeekHeaders(
  startDate: Dayjs,
  endDate: Dayjs
): Array<{ startDate: Dayjs; endDate: Dayjs; label: string; days: number }> {
  const weeks: Array<{ startDate: Dayjs; endDate: Dayjs; label: string; days: number }> = [];
  let current = startDate.startOf('week');

  while (current.isBefore(endDate)) {
    const weekEnd = current.endOf('week');
    const actualEnd = weekEnd.isAfter(endDate) ? endDate : weekEnd;
    const actualStart = current.isBefore(startDate) ? startDate : current;
    const days = actualEnd.diff(actualStart, 'day') + 1;

    // Format label based on number of days
    let label: string;
    if (days === 1) {
      label = actualStart.format('MMM D');
    } else if (actualStart.month() === actualEnd.month()) {
      // Same month: "Jan 1-7"
      label = `${actualStart.format('MMM D')}-${actualEnd.format('D')}`;
    } else {
      // Different months: "Jan 28 - Feb 3"
      label = `${actualStart.format('MMM D')} - ${actualEnd.format('MMM D')}`;
    }

    weeks.push({
      startDate: actualStart,
      endDate: actualEnd,
      label,
      days,
    });
    current = current.add(1, 'week');
  }

  return weeks;
}

/**
 * Calculate timeline bounds from tasks
 */
export function calculateTimelineBounds(
  tasks: GanttTask[],
  startDate?: Date,
  endDate?: Date,
  padding = 7
): { start: Dayjs; end: Dayjs } {
  if (startDate && endDate) {
    return { start: dayjs(startDate), end: dayjs(endDate) };
  }

  if (tasks.length === 0) {
    const today = dayjs();
    return {
      start: today.subtract(padding, 'day'),
      end: today.add(30 + padding, 'day'),
    };
  }

  let earliest = dayjs(tasks[0].startDate);
  let latest = dayjs(tasks[0].startDate).add(tasks[0].duration, 'day');

  tasks.forEach((task) => {
    const taskStart = dayjs(task.startDate);
    const taskEnd = taskStart.add(task.duration, 'day');

    if (taskStart.isBefore(earliest)) {
      earliest = taskStart;
    }
    if (taskEnd.isAfter(latest)) {
      latest = taskEnd;
    }
  });

  return {
    start: startDate ? dayjs(startDate) : earliest.subtract(padding, 'day'),
    end: endDate ? dayjs(endDate) : latest.add(padding, 'day'),
  };
}

/**
 * Format date for display in task list
 */
export function formatTaskDate(date: string | Date | Dayjs): string {
  return dayjs(date).format('MMM D, YYYY');
}

/**
 * Calculate end date from start date and duration
 */
export function getTaskEndDate(startDate: string, duration: number): Dayjs {
  return dayjs(startDate).add(duration - 1, 'day');
}
