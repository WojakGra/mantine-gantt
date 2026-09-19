import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { GanttDependency, GanttTask, GanttTreeRow } from './types';

dayjs.extend(isoWeek);

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Locale-aware date formatting on native Intl; formatters are cached because constructing one is slow
 */
export function formatDate(
  date: string | Date | Dayjs,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  const key = locale + JSON.stringify(options);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter.format(dayjs(date).toDate());
}

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
 * Left/right x of a task's visual: bar edges, or the diamond tips of a milestone.
 * `.milestone` is (rowHeight - 16) * 0.7 square, rotated 45° and centered in a column-wide box,
 * so its tips sit ±(side / √2) from the column center.
 */
export function barAnchors(
  task: Pick<GanttTask, 'type' | 'startDate' | 'duration'>,
  timelineStart: Dayjs,
  columnWidth: number,
  rowHeight: number
): { left: number; right: number } {
  const left = dateToPixel(task.startDate, timelineStart, columnWidth);
  if (task.type === 'milestone') {
    const center = left + columnWidth / 2;
    const diamondHalf = ((rowHeight - 16) * 0.7) / Math.SQRT2;
    return { left: center - diamondHalf, right: center + diamondHalf };
  }
  return { left, right: left + durationToPixels(task.duration, columnWidth) };
}

/**
 * Calculate duration from pixel width
 */
export function pixelsToDuration(pixels: number, columnWidth: number): number {
  return Math.max(1, Math.round(pixels / columnWidth));
}

/** Default `isNonWorkingDay`: Saturday and Sunday. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Generate timeline header data for days
 */
export function generateDayHeaders(
  startDate: Dayjs,
  endDate: Dayjs,
  isNonWorkingDay: (date: Date) => boolean = isWeekend
): Array<{ date: Dayjs; label: string; isWeekend: boolean }> {
  const headers: Array<{ date: Dayjs; label: string; isWeekend: boolean }> = [];
  let current = startDate;

  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    headers.push({
      date: current,
      label: current.format('D'),
      isWeekend: isNonWorkingDay(current.toDate()),
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
  weekStart: 0 | 1 = 1,
  locale = 'en'
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
    const label = formatDate(actualStart, locale, { month: 'short' });

    // isoWeek() numbers Monday-based weeks, so a Sunday-start week takes the number
    // of the Monday it contains - otherwise its Sunday would report the previous week.
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
  padding = 7,
  isNonWorkingDay?: IsNonWorkingDay
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
    // Today is only the fallback - an explicitly passed bound always wins.
    const today = dayjs();
    return {
      start: startDate ? normalize(startDate) : today.subtract(padding, 'day'),
      end: endDate ? normalize(endDate) : today.add(30 + padding, 'day'),
    };
  }

  let earliest = dayjs(tasks[0].startDate);
  let latest = getTaskEndDate(tasks[0].startDate, tasks[0].duration, isNonWorkingDay);

  tasks.forEach((task) => {
    const taskStart = dayjs(task.startDate);
    const taskEnd = getTaskEndDate(task.startDate, task.duration, isNonWorkingDay);

    if (taskStart.isBefore(earliest)) {
      earliest = taskStart;
    }
    // getTaskEndDate clamps to ≥ start, so this can never move `latest` backwards.
    if (taskEnd.isAfter(latest)) {
      latest = taskEnd;
    }

    if (task.baseline) {
      const baseStart = dayjs(task.baseline.startDate);
      const baseEnd = getTaskEndDate(
        task.baseline.startDate,
        task.baseline.duration,
        isNonWorkingDay
      );
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
export function formatTaskDate(date: string | Date | Dayjs, locale = 'en'): string {
  return formatDate(date, locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Working-day calendar: returns true for days nobody works. Every function below takes it
 * as an optional last argument - omitted means calendar-day mode, where every day counts.
 */
export type IsNonWorkingDay = (date: Date) => boolean;

/** Nearest working day at or after (`step` 1) / at or before (`step` -1) `date`. */
function snapToWorkingDay(date: Dayjs, step: 1 | -1, isNonWorkingDay: IsNonWorkingDay): Dayjs {
  let d = date;
  // ponytail: a calendar with no working day at all would loop forever; give up after a year.
  for (let i = 0; i < 366 && isNonWorkingDay(d.toDate()); i++) {
    d = d.add(step, 'day');
  }
  return d;
}

/**
 * Shift a date by `days` working days (negative = backwards). The result is always a
 * working day, so 0 days from a Saturday is the following Monday.
 */
export function addWorkingDays(
  date: Dayjs,
  days: number,
  isNonWorkingDay?: IsNonWorkingDay
): Dayjs {
  if (!isNonWorkingDay) {
    return date.add(days, 'day');
  }
  const step = days < 0 ? -1 : 1;
  let d = snapToWorkingDay(date, step, isNonWorkingDay);
  for (let left = Math.abs(days); left > 0; left--) {
    d = snapToWorkingDay(d.add(step, 'day'), step, isNonWorkingDay);
  }
  return d;
}

/** Working days in `[start, end]`, both inclusive. */
function countWorkingDays(start: Dayjs, end: Dayjs, isNonWorkingDay: IsNonWorkingDay): number {
  let count = 0;
  for (let d = start; !d.isAfter(end); d = d.add(1, 'day')) {
    if (!isNonWorkingDay(d.toDate())) {
      count++;
    }
  }
  return count;
}

/**
 * Calculate end date from start date and duration. Duration is inclusive of the start
 * day; a milestone (duration 0) starts and ends on the same day.
 */
export function getTaskEndDate(
  startDate: string,
  duration: number,
  isNonWorkingDay?: IsNonWorkingDay
): Dayjs {
  return addWorkingDays(dayjs(startDate), Math.max(0, duration - 1), isNonWorkingDay);
}

/**
 * Calendar days a task's bar covers. Equals `duration` in calendar-day mode; with a
 * working-day calendar it also includes the non-working days in between.
 */
export function getTaskSpan(
  startDate: string,
  duration: number,
  isNonWorkingDay?: IsNonWorkingDay
): number {
  if (!isNonWorkingDay || duration <= 0) {
    return duration;
  }
  return getTaskEndDate(startDate, duration, isNonWorkingDay).diff(dayjs(startDate), 'day') + 1;
}

/**
 * New schedule after a move / resize by `days` CALENDAR days (what a pointer drag yields).
 * The one place this math lives: the drag commit, the keyboard move and the live drag
 * label all call it, so what the label shows is what gets committed.
 */
export function shiftTask(
  task: Pick<GanttTask, 'startDate' | 'duration'>,
  action: 'move' | 'resize-start' | 'resize-end',
  days: number,
  isNonWorkingDay?: IsNonWorkingDay
): Pick<GanttTask, 'startDate' | 'duration'> {
  const start = dayjs(task.startDate);
  const format = (d: Dayjs) => d.format('YYYY-MM-DD');

  if (action === 'move') {
    const moved = start.add(days, 'day');
    // Snap in the direction of travel, or a one-day nudge off a Monday would bounce back.
    const snapped = isNonWorkingDay
      ? snapToWorkingDay(moved, days < 0 ? -1 : 1, isNonWorkingDay)
      : moved;
    return { startDate: format(snapped), duration: task.duration };
  }

  if (!isNonWorkingDay) {
    return action === 'resize-end'
      ? { startDate: task.startDate, duration: Math.max(1, task.duration + days) }
      : // resize-start: shift start, keep the right edge (duration shrinks/grows by -days).
        // Like the working-day branch, the start can never pass the end.
        {
          startDate: format(start.add(Math.min(days, task.duration - 1), 'day')),
          duration: Math.max(1, task.duration - days),
        };
  }

  const end = getTaskEndDate(task.startDate, task.duration, isNonWorkingDay);
  if (action === 'resize-end') {
    const newEnd = end.add(days, 'day');
    return {
      startDate: task.startDate,
      duration: Math.max(1, countWorkingDays(start, newEnd, isNonWorkingDay)),
    };
  }
  // resize-start: the end is a working day, so snapping forward can never pass it.
  const moved = start.add(days, 'day');
  const newStart = snapToWorkingDay(moved.isAfter(end) ? end : moved, 1, isNonWorkingDay);
  return {
    startDate: format(newStart),
    duration: Math.max(1, countWorkingDays(newStart, end, isNonWorkingDay)),
  };
}

/** Expand the string shorthand (`'id'` = finish-to-start, no lag) into the full object. */
export function normalizeDependency(
  dependency: string | GanttDependency
): Required<GanttDependency> {
  return typeof dependency === 'string'
    ? { taskId: dependency, type: 'FS', lag: 0 }
    : { taskId: dependency.taskId, type: dependency.type ?? 'FS', lag: dependency.lag ?? 0 };
}

/** Ids of the tasks `task` depends on, whatever shape each dependency is written in. */
function dependencyIds(task: GanttTask | undefined): string[] {
  return (task?.dependencies ?? []).map((dep) => normalizeDependency(dep).taskId);
}

/**
 * True when making `toId` depend on `fromId` would close a dependency cycle - i.e. `fromId`
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
    stack.push(...dependencyIds(byId.get(id)));
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
export function buildTaskTree(
  tasks: GanttTask[],
  collapsedIds: Set<string>,
  isNonWorkingDay?: IsNonWorkingDay
): GanttTreeRow[] {
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
        end: start.add(getTaskSpan(task.startDate, task.duration, isNonWorkingDay), 'day'),
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
        // `end` is exclusive, hence the day subtracted for the inclusive count.
        duration: isNonWorkingDay
          ? countWorkingDays(start, end.subtract(1, 'day'), isNonWorkingDay)
          : end.diff(start, 'day'),
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
      span: env.end.diff(env.start, 'day'),
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
 * Critical path (CPM) over the dependency graph, honouring each dependency's type and
 * lag; unit is days (working days when the chart counts those - the math is the same);
 * startDate is ignored (durations + graph only). Tasks with zero total slack are critical. Edges that would close a
 * cycle are skipped, unknown dependency ids are ignored. Tasks with children
 * (summary parents) are excluded from the graph entirely.
 */
export function getCriticalPath(tasks: GanttTask[]): Set<string> {
  // Summary parents are excluded from the CPM graph - only leaves carry a real
  // schedule. A dependency edge pointing at a parent id then behaves like an
  // unknown id and is ignored.
  const leafTasks = buildTaskTree(tasks, new Set())
    .filter((row) => !row.hasChildren)
    .map((row) => row.task);

  const byId = new Map(leafTasks.map((t) => [t.id, t]));

  // Reduce to a DAG once (unknown ids and cycle-closing edges dropped) and use the same
  // typed edges for both passes, so earliest/latest finish stay consistent on cyclic input.
  interface Edge extends Required<GanttDependency> {
    to: string;
  }
  const successors = buildSuccessorMap(leafTasks);
  const incoming = new Map<string, Edge[]>(leafTasks.map((t) => [t.id, []]));
  const outgoing = new Map<string, Edge[]>(leafTasks.map((t) => [t.id, []]));
  leafTasks.forEach((task) =>
    (task.dependencies ?? []).forEach((raw) => {
      const edge = { ...normalizeDependency(raw), to: task.id };
      if (successors.get(edge.taskId)?.includes(task.id)) {
        incoming.get(task.id)!.push(edge);
        outgoing.get(edge.taskId)!.push(edge);
      }
    })
  );
  const duration = (id: string) => byId.get(id)!.duration;

  // Forward pass: earliest start, memoized DFS over the DAG. The first letter of the type
  // picks the predecessor's end of the constraint, the second letter the successor's.
  const earliestStart = new Map<string, number>();
  const getES = (id: string): number => {
    const cached = earliestStart.get(id);
    if (cached !== undefined) {
      return cached;
    }
    let es = 0;
    for (const edge of incoming.get(id)!) {
      const from = getES(edge.taskId) + (edge.type[0] === 'F' ? duration(edge.taskId) : 0);
      es = Math.max(es, from + edge.lag - (edge.type[1] === 'F' ? duration(id) : 0));
    }
    earliestStart.set(id, es);
    return es;
  };
  const earliestFinish = new Map(leafTasks.map((t) => [t.id, getES(t.id) + t.duration]));

  const projectEnd = leafTasks.length === 0 ? 0 : Math.max(...earliestFinish.values());

  // Backward pass: latest finish over the same edges, reversed.
  const latestFinish = new Map<string, number>();
  const getLF = (id: string): number => {
    const cached = latestFinish.get(id);
    if (cached !== undefined) {
      return cached;
    }
    let lf = projectEnd;
    for (const edge of outgoing.get(id)!) {
      const to = getLF(edge.to) - (edge.type[1] === 'S' ? duration(edge.to) : 0);
      lf = Math.min(lf, to - edge.lag + (edge.type[0] === 'S' ? duration(id) : 0));
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

/**
 * Map of task id → ids of tasks that depend on it (successors). Unknown dependency ids
 * are ignored; edges that would close a cycle are skipped, so the result is always a DAG
 * even for cyclic input. Shared by CPM and auto-scheduling.
 */
export function buildSuccessorMap(tasks: GanttTask[]): Map<string, string[]> {
  const successors = new Map<string, string[]>();
  const ids = new Set(tasks.map((t) => t.id));

  // ponytail: wouldCreateCycle rebuilds its id map per edge (O(edges * tasks)); share the map if it ever shows up hot.
  tasks.forEach((task) => {
    dependencyIds(task).forEach((depId) => {
      // Edge depId → task.id closes a cycle when depId already depends on task.id.
      if (!ids.has(depId) || wouldCreateCycle(tasks, depId, task.id)) {
        return;
      }
      successors.set(depId, [...(successors.get(depId) ?? []), task.id]);
    });
  });
  return successors;
}

/**
 * Auto-scheduling cascade: after `movedTaskId` moved/resized, push every transitive
 * successor later until its dependencies (any type, with lag) hold again. Never pulls a
 * task earlier. Only leaves
 * are cascaded - summary parents derive their schedule from children. Returns the input
 * array unchanged when nothing needs to move. Assumes an acyclic dependency graph
 * (guaranteed upstream by wouldCreateCycle); tolerates cyclic input without hanging by
 * cascading only the DAG-reachable, topologically ordered part.
 */
export function applyAutoSchedule(
  tasks: GanttTask[],
  movedTaskId: string,
  isNonWorkingDay?: IsNonWorkingDay
): GanttTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const successors = buildSuccessorMap(tasks);
  const next = new Map(byId);

  // Topological order over the successor DAG (Kahn). Nodes left with a positive
  // indegree belong to a cyclic input and are left untouched.
  const indegree = new Map<string, number>();
  successors.forEach((succs) => succs.forEach((s) => indegree.set(s, (indegree.get(s) ?? 0) + 1)));
  const queue = tasks.filter((t) => !indegree.has(t.id)).map((t) => t.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const succ of successors.get(id) ?? []) {
      const d = (indegree.get(succ) ?? 0) - 1;
      indegree.set(succ, d);
      if (d === 0) {
        queue.push(succ);
      }
    }
  }

  let changed = false;
  for (const id of order) {
    const task = next.get(id);
    if (!task) {
      continue;
    }
    // Earliest allowed start: the latest of what each dependency demands.
    let earliestStart: Dayjs | null = null;
    for (const raw of task.dependencies ?? []) {
      const { taskId, type, lag } = normalizeDependency(raw);
      const dep = next.get(taskId);
      if (!dep) {
        continue;
      }
      // Days are inclusive, so "after the finish" is end + 1 and "before the start" is
      // start - 1: FS start >= end + 1, SS start >= start, FF end >= end, SF end >= start - 1.
      const from =
        type[0] === 'F'
          ? getTaskEndDate(dep.startDate, dep.duration, isNonWorkingDay)
          : dayjs(dep.startDate);
      const offset = lag + (type === 'FS' ? 1 : 0) - (type === 'SF' ? 1 : 0);
      let minStart = addWorkingDays(from, offset, isNonWorkingDay);
      if (type[1] === 'F') {
        // The constraint is on the end: walk back by the task's own length.
        minStart = addWorkingDays(minStart, -Math.max(0, task.duration - 1), isNonWorkingDay);
      }
      if (!earliestStart || minStart.isAfter(earliestStart)) {
        earliestStart = minStart;
      }
    }
    if (!earliestStart) {
      continue;
    }
    if (dayjs(task.startDate).isBefore(earliestStart)) {
      next.set(id, { ...task, startDate: earliestStart.format('YYYY-MM-DD') });
      changed = true;
    }
  }

  // Unused: the cascade checks every task against its predecessors. Kept for API stability.
  void movedTaskId;
  return changed ? tasks.map((t) => next.get(t.id) ?? t) : tasks;
}

/**
 * Row range `[first, last)` to render for a scroller of fixed-height rows.
 *
 * Both ends are aligned to blocks of `overscan` rows, with one extra block of slack on each
 * side: the rendered set then only changes every `overscan` rows of scrolling instead of on
 * every scroll event, which is what keeps rows from flickering as they come into view.
 *
 * `viewportHeight <= 0` means "not measured yet" (first paint, jsdom) - render everything,
 * because rendering nothing would blank the chart on environments that never measure.
 */
export function visibleRowRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  rowCount: number,
  overscan = 5
): [number, number] {
  if (viewportHeight <= 0 || rowHeight <= 0) {
    return [0, rowCount];
  }
  const firstVisible = Math.max(0, scrollTop) / rowHeight;
  const lastVisible = (Math.max(0, scrollTop) + viewportHeight) / rowHeight;
  const first = Math.max(0, (Math.floor(firstVisible / overscan) - 1) * overscan);
  const last = Math.min(rowCount, (Math.ceil(lastVisible / overscan) + 1) * overscan);
  return [Math.min(first, last), last];
}
