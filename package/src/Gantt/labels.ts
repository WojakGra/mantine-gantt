import type { GanttDependencyType, GanttLabels } from './types';

const dependencyNames: Record<GanttDependencyType, string> = {
  FS: 'finish-to-start',
  SS: 'start-to-start',
  FF: 'finish-to-finish',
  SF: 'start-to-finish',
};

export const defaultLabels: GanttLabels = {
  taskName: 'Task Name',
  start: 'Start',
  end: 'End',
  duration: 'Duration',
  days: (count) => `${count}d`,
  week: (weekNumber) => `Week ${weekNumber}`,
  expandTaskList: 'Expand task list',
  collapseTaskList: 'Collapse task list',
  expandTask: (label) => `Expand ${label}`,
  collapseTask: (label) => `Collapse ${label}`,
  taskBar: (task, kind, editable) => {
    if (kind === 'summary') {
      return `${task.label}, summary, starts ${task.startDate}, ${task.duration} day duration.`;
    }
    if (kind === 'milestone') {
      return `${task.label}, milestone, ${task.startDate}.${editable ? ' Arrow keys move.' : ''}`;
    }
    return `${task.label}, starts ${task.startDate}, ${task.duration} day duration.${
      editable ? ' Arrow keys move, Shift+Arrow resize.' : ''
    }`;
  },
  taskUpdated: (task) => `${task.label} ${task.startDate}, ${task.duration} day duration`,
  linkCycle: 'Link not created: it would create a circular dependency',
  deleteLink: (fromLabel, toLabel, type) =>
    `Delete ${dependencyNames[type]} dependency from ${fromLabel} to ${toLabel}`,
};
