import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { GanttTask, GanttTreeRow } from './types';

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
 * First day of the week containing `date`, for a given week start (0 = Sunday, 1 = Monday).
 */
export function startOfWeek(date: Dayjs, weekStart: 0 | 1 = 1): Dayjs {
  return date.subtract((date.day() - weekStart + 7) % 7, 'day').startOf('day');
}

/**
 * Generate week headers
 */
export function generateWeekHeaders(
  startDate: Dayjs,
  endDate: Dayjs,
  weekStart: 0 | 1 = 1
): Array<{ startDate: Dayjs; endDate: Dayjs; label: string; days: number; weekNumber: number }> {
  const weeks: Array<{
    startDate: Dayjs;
    endDate: Dayjs;
    label: string;
    days: number;
    weekNumber: number;
  }> = [];
  let current = startOfWeek(startDate, weekStart);

  while (current.isBefore(endDate)) {
    const weekEnd = current.add(6, 'day').endOf('day');
    const actualEnd = weekEnd.isAfter(endDate) ? endDate : weekEnd;
    const actualStart = current.isBefore(startDate) ? startDate : current;
    const days = actualEnd.diff(actualStart, 'day') + 1;

    // Format label as just month abbreviation
    const label = actualStart.format('MMM');

    // isoWeek() numbers Monday-based weeks, so a Sunday-start week takes the number
    // of the Monday it contains — otherwise its Sunday would report the previous week.
    const weekNumber = current.add(weekStart === 0 ? 1 : 0, 'day').isoWeek();

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
    // Today is only the fallback — an explicitly passed bound always wins.
    const today = dayjs();
    return {
      start: startDate ? normalize(startDate) : today.subtract(padding, 'day'),
      end: endDate ? normalize(endDate) : today.add(30 + padding, 'day'),
    };
  }

  let earliest = dayjs(tasks[0].startDate);
  let latest = getTaskEndDate(tasks[0].startDate, tasks[0].duration);

  tasks.forEach((task) => {
    const taskStart = dayjs(task.startDate);
    const taskEnd = getTaskEndDate(task.startDate, task.duration);

    if (taskStart.isBefore(earliest)) {
      earliest = taskStart;
    }
    if (taskEnd.isAfter(latest)) {
      latest = taskEnd;
    }

    if (task.baseline) {
      const baseStart = dayjs(task.baseline.startDate);
      const baseEnd = getTaskEndDate(task.baseline.startDate, task.baseline.duration);
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
 * True when making `toId` depend on `fromId` would close a dependency cycle — i.e. `fromId`
 * already depends on `toId`, directly or transitively. Self-links count as a cycle. Tolerates
 * an already-cyclic input graph (visited set), unknown ids are ignored.
 */
export function wouldCreateCycle(tasks: GanttTask[], fromId: string, toId: string): boolean {
  if (fromId === toId) {
    return true;
  }
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const stack = [fromId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === toId) {
      return true;
    }
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    stack.push(...(byId.get(id)?.dependencies ?? []));
  }
  return false;
}

/**
 * Build the ordered list of visible rows from the flat task list. Depth-first:
 * parent, then its children recursively, stable within siblings by input order.
 * An unknown, self-referencing, or cycle-closing parentId demotes the task to a
 * root (same tolerance as unknown dependency ids in getCriticalPath). Rows inside
 * a collapsed subtree are omitted.
 */
export function buildTaskTree(tasks: GanttTask[], collapsedIds: Set<string>): GanttTreeRow[] {
  const ids = new Set(tasks.map((t) => t.id));

  // Valid parent links; unknown/self links are dropped up front.
  const parentOf = new Map<string, string>();
  tasks.forEach((t) => {
    if (t.parentId && t.parentId !== t.id && ids.has(t.parentId)) {
      parentOf.set(t.id, t.parentId);
    }
  });

  // A task whose parent chain loops back on itself becomes a root.
  const isCyclic = (id: string): boolean => {
    const seen = new Set<string>([id]);
    let current = parentOf.get(id);
    while (current !== undefined) {
      if (seen.has(current)) {
        return true;
      }
      seen.add(current);
      current = parentOf.get(current);
    }
    return false;
  };

  const childrenOf = new Map<string, GanttTask[]>();
  const roots: GanttTask[] = [];
  tasks.forEach((t) => {
    const parentId = parentOf.get(t.id);
    if (parentId !== undefined && !isCyclic(t.id)) {
      childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), t]);
    } else {
      roots.push(t);
    }
  });

  // Effective schedule: own dates for leaves; subtree envelope + duration-weighted
  // progress for parents. Memoized per task id.
  interface Envelope {
    start: Dayjs;
    end: Dayjs;
    duration: number;
    progress: number;
  }
  const envelopes = new Map<string, Envelope>();
  const getEnvelope = (task: GanttTask): Envelope => {
    const cached = envelopes.get(task.id);
    if (cached) {
      return cached;
    }
    const children = childrenOf.get(task.id) ?? [];
    let env: Envelope;
    if (children.length === 0) {
      const start = dayjs(task.startDate);
      env = {
        start,
        end: start.add(task.duration, 'day'),
        duration: task.duration,
        progress: task.progress,
      };
    } else {
      const childEnvelopes = children.map(getEnvelope);
      let { start, end } = childEnvelopes[0];
      let weighted = 0;
      let total = 0;
      childEnvelopes.forEach((e) => {
        if (e.start.isBefore(start)) {
          start = e.start;
        }
        if (e.end.isAfter(end)) {
          end = e.end;
        }
        weighted += e.progress * e.duration;
        total += e.duration;
      });
      env = {
        start,
        end,
        duration: end.diff(start, 'day'),
        progress: total > 0 ? Math.round(weighted / total) : 0,
      };
    }
    envelopes.set(task.id, env);
    return env;
  };

  const rows: GanttTreeRow[] = [];
  const visit = (task: GanttTask, depth: number) => {
    const children = childrenOf.get(task.id) ?? [];
    const env = getEnvelope(task);
    rows.push({
      task,
      depth,
      hasChildren: children.length > 0,
      startDate: env.start.format('YYYY-MM-DD'),
      duration: env.duration,
      progress: env.progress,
    });
    if (!collapsedIds.has(task.id)) {
      children.forEach((child) => visit(child, depth + 1));
    }
  };
  roots.forEach((root) => visit(root, 0));
  return rows;
}

/** Task with the row's effective schedule applied (identity for leaves). */
export function getEffectiveTask(row: GanttTreeRow): GanttTask {
  if (!row.hasChildren) {
    return row.task;
  }
  return { ...row.task, startDate: row.startDate, duration: row.duration, progress: row.progress };
}

/**
 * Critical path (CPM) over the dependency graph. Every dependency is treated as
 * finish-to-start with zero lag; unit is days; startDate is ignored (durations +
 * graph only). Tasks with zero total slack are critical. Edges that would close a
 * cycle are skipped, unknown dependency ids are ignored. Tasks with children
 * (summary parents) are excluded from the graph entirely.
 */
export function getCriticalPath(tasks: GanttTask[]): Set<string> {
  // Summary parents are excluded from the CPM graph — only leaves carry a real
  // schedule. A dependency edge pointing at a parent id then behaves like an
  // unknown id and is ignored.
  const leafTasks = buildTaskTree(tasks, new Set())
    .filter((row) => !row.hasChildren)
    .map((row) => row.task);

  const byId = new Map(leafTasks.map((t) => [t.id, t]));

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
  leafTasks.forEach((t) => resolveDeps(t.id));

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
  leafTasks.forEach((t) => getEF(t.id));

  const projectEnd = leafTasks.length === 0 ? 0 : Math.max(...earliestFinish.values());

  // Backward pass: latest finish over the successor graph (reverse of the same DAG).
  const successors = new Map<string, string[]>();
  leafTasks.forEach((t) => {
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
  leafTasks.forEach((t) => getLF(t.id));

  const critical = new Set<string>();
  leafTasks.forEach((t) => {
    if (latestFinish.get(t.id)! === earliestFinish.get(t.id)!) {
      critical.add(t.id);
    }
  });
  return critical;
}
