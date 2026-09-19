// Gantt Chart component
export { Gantt } from './Gantt';
export type {
  GanttProps,
  GanttTask,
  GanttColumn,
  GanttMarker,
  GanttDependency,
  GanttDependencyType,
  GanttTreeRow,
  GanttStylesNames,
  GanttFactory,
  GanttCssVariables,
} from './Gantt';

// Utility exports
export {
  dateToPixel,
  pixelToDate,
  snapToGrid,
  durationToPixels,
  formatTaskDate,
  getTaskEndDate,
  calculateTimelineBounds,
  wouldCreateCycle,
  buildSuccessorMap,
  applyAutoSchedule,
  normalizeDependency,
  addWorkingDays,
  getTaskSpan,
} from './Gantt';
