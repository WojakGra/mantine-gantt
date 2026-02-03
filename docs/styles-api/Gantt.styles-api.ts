import type { GanttFactory } from 'mantine-gantt';
import type { StylesApiData } from '../components/styles-api.types';

export const GanttStylesApi: StylesApiData<GanttFactory> = {
  selectors: {
    root: 'Root element',
    taskList: 'Task list wrapper',
    taskListHeader: 'Task list header',
    taskListBody: 'Task list body',
    taskListRow: 'Task list row',
    taskListCell: 'Task list cell',
    timeline: 'Timeline wrapper',
    timelineHeader: 'Timeline header',
    timelineHeaderRow: 'Timeline header row',
    timelineHeaderCell: 'Timeline header cell',
    weekHeader: 'Week header',
    weekHeaderCell: 'Week header cell',
    timelineBody: 'Timeline body',
    timelineContent: 'Timeline content',
    timelineRow: 'Timeline row',
    timelineGrid: 'Timeline grid',
    gridLine: 'Grid line',
    taskBar: 'Task bar',
    taskBarLabel: 'Task bar label',
    taskBarProgress: 'Task bar progress',
    resizeHandle: 'Resize handle',
    resizeHandleLeft: 'Resize handle left',
    linkConnector: 'Link connector',
  },

  vars: {
    root: {
      '--gantt-column-width': 'Controls column width',
      '--gantt-row-height': 'Controls row height',
      '--gantt-header-height': 'Controls header height',
      '--gantt-task-list-width': 'Controls task list width',
    },
  },

  modifiers: [
    { modifier: 'data-show-title', selector: 'root', condition: '`showTitle` prop is set' },
    { modifier: 'data-view-mode', selector: 'root', condition: '`viewMode` prop is set' },
    {
      modifier: 'data-has-dependencies',
      selector: 'taskBar',
      condition: '`dependencies` prop is set',
    },
  ],
};
