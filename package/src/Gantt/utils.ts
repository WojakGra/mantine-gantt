import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { GanttTask } from './types';

dayjs.extend(isoWeek);

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
): Array<{ startDate: Dayjs; endDate: Dayjs; label: string; days: number; weekNumber: number }> {
  const weeks: Array<{
    startDate: Dayjs;
    endDate: Dayjs;
    label: string;
    days: number;
    weekNumber: number;
  }> = [];
  let current = startDate.startOf('week');

  while (current.isBefore(endDate)) {
    const weekEnd = current.endOf('week');
    const actualEnd = weekEnd.isAfter(endDate) ? endDate : weekEnd;
    const actualStart = current.isBefore(startDate) ? startDate : current;
    const days = actualEnd.diff(actualStart, 'day') + 1;

    // Format label as just month abbreviation
    const label = actualStart.format('MMM');

    // Get ISO week number
    const weekNumber = current.isoWeek();

    weeks.push({
      startDate: actualStart,
      endDate: actualEnd,
      label,
      days,
      weekNumber,
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
  // Task/baseline dates are bare "YYYY-MM-DD" strings, parsed by dayjs as local midnight.
  // A `Date` prop is expected to represent local midnight of the intended day (e.g. built
  // with `new Date(year, monthIndex, day)`), but may carry a non-midnight local time
  // (e.g. from `new Date('YYYY-MM-DD')`, which is UTC midnight). Normalize using the Date's
  // own local calendar-day getters so bounds line up with string-based task dates on the
  // same day, regardless of time-of-day drift.
  const normalize = (date: Date) =>
    dayjs(new Date(date.getFullYear(), date.getMonth(), date.getDate()));

  if (startDate && endDate) {
    return { start: normalize(startDate), end: normalize(endDate) };
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

    if (task.baseline) {
      const baseStart = dayjs(task.baseline.startDate);
      const baseEnd = baseStart.add(task.baseline.duration, 'day');
      if (baseStart.isBefore(earliest)) {
        earliest = baseStart;
      }
      if (baseEnd.isAfter(latest)) {
        latest = baseEnd;
      }
    }
  });

  return {
    start: startDate ? normalize(startDate) : earliest.subtract(padding, 'day'),
    end: endDate ? normalize(endDate) : latest.add(padding, 'day'),
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

/**
 * Critical path (CPM) over the dependency graph. Every dependency is treated as
 * finish-to-start with zero lag; unit is days; startDate is ignored (durations +
 * graph only). Tasks with zero total slack are critical. Edges that would close a
 * cycle are skipped, unknown dependency ids are ignored.
 */
export function getCriticalPath(tasks: GanttTask[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // Reduce to a DAG once: drop unknown ids and any edge that would close a cycle.
  // Using this same reduced graph for both passes keeps earliest/latest finish
  // consistent even when the input graph is cyclic.
  const dagDeps = new Map<string, string[]>();
  const visiting = new Set<string>();
  const resolved = new Set<string>();
  const resolveDeps = (id: string): void => {
    if (resolved.has(id)) {
      return;
    }
    visiting.add(id);
    const deps: string[] = [];
    for (const depId of byId.get(id)!.dependencies ?? []) {
      if (byId.has(depId) && !visiting.has(depId)) {
        deps.push(depId);
        resolveDeps(depId);
      }
    }
    dagDeps.set(id, deps);
    visiting.delete(id);
    resolved.add(id);
  };
  tasks.forEach((t) => resolveDeps(t.id));

  // Forward pass: earliest finish, memoized DFS over the DAG.
  const earliestFinish = new Map<string, number>();
  const getEF = (id: string): number => {
    const cached = earliestFinish.get(id);
    if (cached !== undefined) {
      return cached;
    }
    let es = 0;
    for (const depId of dagDeps.get(id)!) {
      es = Math.max(es, getEF(depId));
    }
    const ef = es + byId.get(id)!.duration;
    earliestFinish.set(id, ef);
    return ef;
  };
  tasks.forEach((t) => getEF(t.id));

  const projectEnd = tasks.length === 0 ? 0 : Math.max(...earliestFinish.values());

  // Backward pass: latest finish over the successor graph (reverse of the same DAG).
  const successors = new Map<string, string[]>();
  tasks.forEach((t) => {
    dagDeps.get(t.id)!.forEach((depId) => {
      successors.set(depId, [...(successors.get(depId) ?? []), t.id]);
    });
  });

  const latestFinish = new Map<string, number>();
  const getLF = (id: string): number => {
    const cached = latestFinish.get(id);
    if (cached !== undefined) {
      return cached;
    }
    let lf = projectEnd;
    for (const succId of successors.get(id) ?? []) {
      lf = Math.min(lf, getLF(succId) - byId.get(succId)!.duration);
    }
    latestFinish.set(id, lf);
    return lf;
  };
  tasks.forEach((t) => getLF(t.id));

  const critical = new Set<string>();
  tasks.forEach((t) => {
    if (latestFinish.get(t.id)! === earliestFinish.get(t.id)!) {
      critical.add(t.id);
    }
  });
  return critical;
}
