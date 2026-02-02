// Gantt Chart component
export { Gantt, mockTasks } from './Gantt';
export type { GanttProps, GanttTask, GanttStylesNames, GanttCssVariables } from './Gantt';

// Utility exports for advanced usage
export {
  dateToPixel,
  pixelToDate,
  snapToGrid,
  durationToPixels,
  formatTaskDate,
  getTaskEndDate,
  calculateTimelineBounds,
} from './Gantt';
