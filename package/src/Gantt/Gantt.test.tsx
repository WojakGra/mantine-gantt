import React, { StrictMode } from 'react';
import { act, fireEvent } from '@testing-library/react';
import { render, screen } from '@mantine-tests/core';
import { Gantt, GanttTask } from './index';

// jsdom has no PointerEvent, so fireEvent.pointer* drops clientX. Dispatch a plain bubbling
// Event with clientX attached — React reads nativeEvent.clientX and native listeners read it too.
// Wrapped in act() so the resulting state updates (and onTaskUpdate) flush before assertions.
function pointer(node: Element | Document, type: string, clientX: number) {
  act(() => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { clientX, clientY: 100 });
    node.dispatchEvent(event);
  });
}

const mockTasks: GanttTask[] = [
  {
    id: '1',
    label: 'Project Planning',
    startDate: '2026-02-01',
    duration: 5,
    progress: 100,
  },
  {
    id: '2',
    label: 'Requirements Analysis',
    startDate: '2026-02-03',
    duration: 7,
    progress: 80,
    dependencies: ['1'],
    color: 'teal',
  },
  {
    id: '3',
    label: 'UI/UX Design',
    startDate: '2026-02-08',
    duration: 10,
    progress: 50,
    dependencies: ['2'],
    color: 'violet',
  },
];

describe('@mantine/gantt/Gantt', () => {
  it('renders without crashing', () => {
    const { container } = render(<Gantt tasks={mockTasks} />);
    expect(container.querySelector('[class*="root"]')).toBeInTheDocument();
  });

  it('renders task labels in task list', () => {
    render(<Gantt tasks={mockTasks} />);
    // Use getAllByText since labels appear in both list and bar
    const planningElements = screen.getAllByText('Project Planning');
    expect(planningElements.length).toBeGreaterThanOrEqual(1);

    const analysisElements = screen.getAllByText('Requirements Analysis');
    expect(analysisElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders header columns', () => {
    render(<Gantt tasks={mockTasks} />);
    expect(screen.getByText('Task Name')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
  });

  it('renders with custom column width', () => {
    const { container } = render(<Gantt tasks={mockTasks} columnWidth={60} />);
    const root = container.querySelector('[class*="root"]');
    expect(root).toHaveStyle('--gantt-column-width: 60px');
  });

  it('renders with custom row height', () => {
    const { container } = render(<Gantt tasks={mockTasks} rowHeight={50} />);
    const root = container.querySelector('[class*="root"]');
    expect(root).toHaveStyle('--gantt-row-height: 50px');
  });

  it('renders with custom task list width', () => {
    const { container } = render(<Gantt tasks={mockTasks} taskListWidth={400} />);
    const root = container.querySelector('[class*="root"]');
    expect(root).toHaveStyle('--gantt-task-list-width: 400px');
  });

  it('calls onTaskClick when task bar is clicked', () => {
    const onTaskClick = jest.fn();
    const { container } = render(<Gantt tasks={mockTasks} onTaskClick={onTaskClick} />);

    // Find the first task bar wrapper (use timelineRow)
    const taskRows = container.querySelectorAll('[class*="mantine-Gantt-timelineRow"]');
    expect(taskRows.length).toBe(3);

    // Click the task bar inside the first row
    const firstTaskBar = taskRows[0].querySelector('[class*="taskBar"]');
    if (firstTaskBar) {
      fireEvent.click(firstTaskBar);
      expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    }
  });

  it('commits a pointer move drag as a new startDate', () => {
    const onTaskUpdate = jest.fn();
    const { container } = render(<Gantt tasks={mockTasks} onTaskUpdate={onTaskUpdate} />);
    const bar = container.querySelector('[data-task-id="1"]')!;

    // Default columnWidth is 40px, so +40px snaps to +1 day.
    pointer(bar, 'pointerdown', 100);
    pointer(document, 'pointermove', 140);
    pointer(document, 'pointerup', 140);

    expect(onTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', startDate: '2026-02-02' })
    );
  });

  it('treats a pointerdown without movement as a click, not a drag', () => {
    const onTaskUpdate = jest.fn();
    const onTaskClick = jest.fn();
    const { container } = render(
      <Gantt tasks={mockTasks} onTaskUpdate={onTaskUpdate} onTaskClick={onTaskClick} />
    );
    const bar = container.querySelector('[data-task-id="1"]')!;

    pointer(bar, 'pointerdown', 100);
    pointer(document, 'pointerup', 100);
    fireEvent.click(bar);

    expect(onTaskUpdate).not.toHaveBeenCalled();
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('moves a task by one day with the arrow keys', () => {
    const onTaskUpdate = jest.fn();
    const { container } = render(<Gantt tasks={mockTasks} onTaskUpdate={onTaskUpdate} />);
    const bar = container.querySelector('[data-task-id="1"]')!;

    fireEvent.keyDown(bar, { key: 'ArrowRight' });

    expect(onTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', startDate: '2026-02-02' })
    );
  });

  it('clamps keyboard resize so duration never drops below one day', () => {
    const onTaskUpdate = jest.fn();
    const oneDayTask: GanttTask[] = [
      { id: '1', label: 'Tiny', startDate: '2026-02-01', duration: 1, progress: 0 },
    ];
    const { container } = render(<Gantt tasks={oneDayTask} onTaskUpdate={onTaskUpdate} />);
    const bar = container.querySelector('[data-task-id="1"]')!;

    fireEvent.keyDown(bar, { key: 'ArrowLeft', shiftKey: true });

    expect(onTaskUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: '1', duration: 1 }));
  });

  it('renders with empty tasks array', () => {
    const { container } = render(<Gantt tasks={[]} />);
    expect(container.querySelector('[class*="root"]')).toBeInTheDocument();
  });

  it('renders showTitle attribute when enabled', () => {
    const { container } = render(<Gantt tasks={mockTasks} showTitle />);
    const labels = container.querySelectorAll('[class*="timelineRow"]');
    expect(labels[0]).toHaveAttribute('title', 'Project Planning');
  });

  it('does not render title attribute when showTitle is disabled', () => {
    const { container } = render(<Gantt tasks={mockTasks} showTitle={false} />);
    const labels = container.querySelectorAll('[class*="timelineRow"]');
    expect(labels[0]).not.toHaveAttribute('title');
  });
});

describe('@mantine/gantt/Gantt - Task Data', () => {
  it('renders correct number of task rows', () => {
    const { container } = render(<Gantt tasks={mockTasks} />);
    const taskRows = container.querySelectorAll('[class*="mantine-Gantt-taskListRow"]');
    expect(taskRows.length).toBe(3);
  });

  it('renders task dates correctly', () => {
    render(<Gantt tasks={mockTasks} />);
    expect(screen.getByText('Feb 1, 2026')).toBeInTheDocument();
  });

  it('handles tasks with dependencies', () => {
    const { container } = render(<Gantt tasks={mockTasks} />);
    const dependencyLines = container.querySelectorAll('[class*="dependencyLine"]');
    expect(dependencyLines.length).toBe(2);
  });

  it('handles tasks without dependencies', () => {
    const tasksNoDeps: GanttTask[] = [
      { id: '1', label: 'Task 1', startDate: '2026-02-01', duration: 5, progress: 50 },
      { id: '2', label: 'Task 2', startDate: '2026-02-05', duration: 3, progress: 25 },
    ];
    const { container } = render(<Gantt tasks={tasksNoDeps} />);
    const dependencyLines = container.querySelectorAll('[class*="dependencyLine"]');
    expect(dependencyLines.length).toBe(0);
  });

  it('renders timeline rows for each task', () => {
    const { container } = render(<Gantt tasks={mockTasks} />);
    const timelineRows = container.querySelectorAll('[class*="mantine-Gantt-timelineRow"]');
    expect(timelineRows.length).toBe(3);
  });
});

describe('critical path', () => {
  it('marks critical bars with data-critical when highlightCriticalPath is set', () => {
    const { container } = render(<Gantt tasks={mockTasks} highlightCriticalPath />);
    // mockTasks is a simple chain 1 -> 2 -> 3: all critical
    expect(container.querySelectorAll('[class*="taskBar"][data-critical]').length).toBe(3);
    // both dependency lines connect critical tasks
    expect(container.querySelectorAll('polyline[data-critical]').length).toBe(2);
  });

  it('does not mark anything without the prop', () => {
    const { container } = render(<Gantt tasks={mockTasks} />);
    expect(container.querySelector('[data-critical]')).toBeNull();
  });

  it('exposes --gantt-critical-color from criticalPathColor', () => {
    const { container } = render(
      <Gantt tasks={mockTasks} highlightCriticalPath criticalPathColor="grape" />
    );
    const root = container.querySelector('[class*="root"]');
    expect(root).toHaveStyle('--gantt-critical-color: var(--mantine-color-grape-filled)');
  });
});

describe('baselines', () => {
  const tasksWithBaseline: GanttTask[] = [
    {
      id: '1',
      label: 'Task',
      startDate: '2026-02-05',
      duration: 5,
      progress: 0,
      baseline: { startDate: '2026-02-01', duration: 5 },
    },
  ];

  it('renders a baseline bar with correct geometry', () => {
    const { container } = render(
      <Gantt tasks={tasksWithBaseline} startDate={new Date(2026, 0, 25)} columnWidth={40} />
    );
    const baseline = container.querySelector('[class*="baselineBar"]');
    expect(baseline).toBeInTheDocument();
    // Feb 1 is 7 days after Jan 25 timeline start: left = 7 * 40, width = 5 * 40
    expect(baseline).toHaveStyle({ left: '280px', width: '200px' });
  });

  it('hides baselines with showBaselines={false}', () => {
    const { container } = render(<Gantt tasks={tasksWithBaseline} showBaselines={false} />);
    expect(container.querySelector('[class*="baselineBar"]')).toBeNull();
  });

  it('renders no baseline bar for tasks without baseline data', () => {
    const { container } = render(<Gantt tasks={mockTasks} />);
    expect(container.querySelector('[class*="baselineBar"]')).toBeNull();
  });
});

describe('hierarchy', () => {
  const treeTasks: GanttTask[] = [
    { id: 'p', label: 'Phase', startDate: '2026-02-01', duration: 1, progress: 0 },
    {
      id: 'a',
      label: 'Child A',
      parentId: 'p',
      startDate: '2026-02-01',
      duration: 4,
      progress: 100,
    },
    {
      id: 'b',
      label: 'Child B',
      parentId: 'p',
      startDate: '2026-02-05',
      duration: 6,
      progress: 50,
      dependencies: ['a'],
    },
    { id: 'solo', label: 'Standalone', startDate: '2026-02-03', duration: 3, progress: 0 },
  ];

  it('renders a chevron only for parents and indents children', () => {
    const { container } = render(<Gantt tasks={treeTasks} />);
    expect(container.querySelectorAll('[class*="expandChevron"]').length).toBe(1);

    const listRows = container.querySelectorAll('[class*="mantine-Gantt-taskListRow"]');
    // Row order is depth-first: p, a, b, solo
    const childFirstCell = listRows[1].querySelector('[class*="taskListCell"]')!;
    expect(childFirstCell.getAttribute('style')).toContain('16px');
    const rootFirstCell = listRows[0].querySelector('[class*="taskListCell"]')!;
    expect(rootFirstCell.getAttribute('style') ?? '').not.toContain('16px');
  });

  it('collapse hides subtree rows and their arrows, and fires onToggleExpand', () => {
    const onToggleExpand = jest.fn();
    const { container } = render(<Gantt tasks={treeTasks} onToggleExpand={onToggleExpand} />);

    expect(container.querySelectorAll('[class*="mantine-Gantt-timelineRow"]').length).toBe(4);
    expect(container.querySelectorAll('polyline[class*="dependencyLine"]').length).toBe(1);

    fireEvent.click(container.querySelector('[class*="expandChevron"]')!);
    expect(onToggleExpand).toHaveBeenCalledWith('p', false);
    expect(container.querySelectorAll('[class*="mantine-Gantt-timelineRow"]').length).toBe(2);
    expect(container.querySelectorAll('[class*="mantine-Gantt-taskListRow"]').length).toBe(2);
    expect(container.querySelectorAll('polyline[class*="dependencyLine"]').length).toBe(0);

    fireEvent.click(container.querySelector('[class*="expandChevron"]')!);
    expect(onToggleExpand).toHaveBeenLastCalledWith('p', true);
    expect(container.querySelectorAll('[class*="mantine-Gantt-timelineRow"]').length).toBe(4);
  });

  it('starts collapsed for parents not listed in defaultExpandedIds', () => {
    const { container } = render(<Gantt tasks={treeTasks} defaultExpandedIds={[]} />);
    expect(container.querySelectorAll('[class*="mantine-Gantt-timelineRow"]').length).toBe(2);
  });

  it('renders the parent as a summary bar with envelope geometry and no handles', () => {
    const { container } = render(
      <Gantt tasks={treeTasks} startDate={new Date(2026, 0, 25)} endDate={new Date(2026, 2, 1)} />
    );
    const bar = container.querySelector('[data-task-id="p"]')!;
    expect(bar).toHaveAttribute('data-summary');
    // Envelope Feb 1 → Feb 11 (exclusive): left = 7 * 40, width = 10 * 40
    expect(bar).toHaveStyle({ left: '280px', width: '400px' });
    expect(bar.querySelector('[class*="resizeHandle"]')).toBeNull();
    expect(bar.querySelector('[class*="linkConnector"]')).toBeNull();
    expect(bar.querySelectorAll('[class*="summaryBar"]').length).toBe(2);
    // Leaves keep their handles
    const leaf = container.querySelector('[data-task-id="a"]')!;
    expect(leaf.querySelector('[class*="resizeHandle"]')).not.toBeNull();
  });

  it('summary bars ignore pointer drags and keyboard nudges', () => {
    const onTaskUpdate = jest.fn();
    const { container } = render(<Gantt tasks={treeTasks} onTaskUpdate={onTaskUpdate} />);
    const bar = container.querySelector('[data-task-id="p"]')!;

    pointer(bar, 'pointerdown', 100);
    pointer(document, 'pointermove', 180);
    pointer(document, 'pointerup', 180);
    fireEvent.keyDown(bar, { key: 'ArrowRight' });

    expect(onTaskUpdate).not.toHaveBeenCalled();
  });

  it('never marks summary parents as critical', () => {
    const { container } = render(<Gantt tasks={treeTasks} highlightCriticalPath />);
    // Chain a(4d) → b(6d) is the longest path; p is out of the CPM graph.
    expect(container.querySelector('[data-task-id="p"]')).not.toHaveAttribute('data-critical');
    expect(container.querySelectorAll('[class*="taskBar"][data-critical]').length).toBe(2);
  });

  it('shows envelope dates for parents in the task list', () => {
    render(<Gantt tasks={treeTasks} />);
    // Parent effective end = Feb 1 + 10 days − 1 = Feb 10 (b's last day); own dates ignored.
    expect(screen.getAllByText('Feb 10, 2026').length).toBeGreaterThanOrEqual(2);
  });
});

describe('callbacks under StrictMode', () => {
  it('fires onTaskUpdate exactly once per keyboard nudge', () => {
    const onTaskUpdate = jest.fn();
    const { container } = render(
      <StrictMode>
        <Gantt defaultTasks={mockTasks} onTaskUpdate={onTaskUpdate} />
      </StrictMode>
    );
    const bar = container.querySelector('[data-task-id="1"]')!;

    fireEvent.keyDown(bar, { key: 'ArrowRight' });

    expect(onTaskUpdate).toHaveBeenCalledTimes(1);
    expect(onTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', startDate: '2026-02-02' })
    );
  });
});

describe('link cycle guard', () => {
  it('refuses a link that would close a dependency cycle', () => {
    const onLinkCreate = jest.fn();
    const onTasksChange = jest.fn();
    const { container } = render(
      <Gantt defaultTasks={mockTasks} onLinkCreate={onLinkCreate} onTasksChange={onTasksChange} />
    );
    // Task 2 already depends on task 1, so linking 2 -> 1 would close a loop.
    const source = container.querySelector('[data-task-id="2"]')!;
    const target = container.querySelector('[data-task-id="1"]')!;
    const arrowsBefore = container.querySelectorAll('[class*="dependencyLine"]').length;

    // jsdom has no elementFromPoint; the hook uses it to find the drop target.
    (document as any).elementFromPoint = () => target;
    pointer(source.querySelector('[class*="linkConnector"]')!, 'pointerdown', 100);
    pointer(document, 'pointermove', 300);
    pointer(document, 'pointerup', 300);
    delete (document as any).elementFromPoint;

    expect(onLinkCreate).not.toHaveBeenCalled();
    expect(onTasksChange).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[class*="dependencyLine"]')).toHaveLength(arrowsBefore);
  });

  it('still creates an acyclic link', () => {
    const onLinkCreate = jest.fn();
    const { container } = render(<Gantt defaultTasks={mockTasks} onLinkCreate={onLinkCreate} />);
    // 1 -> 3 adds no cycle (3 depends on 2 depends on 1).
    const source = container.querySelector('[data-task-id="1"]')!;
    const target = container.querySelector('[data-task-id="3"]')!;

    // jsdom has no elementFromPoint; the hook uses it to find the drop target.
    (document as any).elementFromPoint = () => target;
    pointer(source.querySelector('[class*="linkConnector"]')!, 'pointerdown', 100);
    pointer(document, 'pointermove', 300);
    pointer(document, 'pointerup', 300);
    delete (document as any).elementFromPoint;

    expect(onLinkCreate).toHaveBeenCalledWith('1', '3');
  });
});

describe('controlled / uncontrolled tasks', () => {
  it('re-renders when the tasks prop changes', () => {
    const { container, rerender } = render(<Gantt tasks={mockTasks} />);
    const moved = mockTasks.map((t) => (t.id === '1' ? { ...t, startDate: '2026-02-06' } : t));

    rerender(<Gantt tasks={moved} />);

    expect(container.querySelector('[data-task-id="1"]')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('starts 2026-02-06') as unknown as string
    );
  });

  it('controlled: a nudge reports the new list but does not move the bar on its own', () => {
    const onTasksChange = jest.fn();
    const onTaskUpdate = jest.fn();
    const { container } = render(
      <Gantt tasks={mockTasks} onTasksChange={onTasksChange} onTaskUpdate={onTaskUpdate} />
    );
    const bar = container.querySelector('[data-task-id="1"]')!;

    fireEvent.keyDown(bar, { key: 'ArrowRight' });

    expect(onTasksChange).toHaveBeenCalledTimes(1);
    expect(onTasksChange.mock.calls[0][0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '1', startDate: '2026-02-02' })])
    );
    // Granular callback still fires alongside onTasksChange.
    expect(onTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', startDate: '2026-02-02' })
    );
    // The parent ignored the change, so the bar stays put.
    expect(bar.getAttribute('aria-label')).toContain('starts 2026-02-01');
  });

  it('uncontrolled: defaultTasks keeps the 0.2 behaviour', () => {
    const { container } = render(<Gantt defaultTasks={mockTasks} />);
    const bar = container.querySelector('[data-task-id="1"]')!;

    fireEvent.keyDown(bar, { key: 'ArrowRight' });

    expect(container.querySelector('[data-task-id="1"]')!.getAttribute('aria-label')).toContain(
      'starts 2026-02-02'
    );
  });
});

describe('task list width', () => {
  const width = (container: HTMLElement) =>
    (container.querySelector('[class*="root"]') as HTMLElement).style.getPropertyValue(
      '--gantt-task-list-width'
    );

  it('sizes the panel from the columns when taskListWidth is omitted', () => {
    // Default set: Task Name (flex, 200) + Start 90 + End 90 + Duration 80.
    const { container } = render(<Gantt tasks={mockTasks} />);
    expect(width(container)).toBe('460px');
  });

  it('sizes the panel from custom columns', () => {
    const { container } = render(
      <Gantt
        tasks={mockTasks}
        columns={[
          { header: 'Name', render: (t) => t.label },
          { header: 'Days', render: (t) => t.duration, width: 60 },
        ]}
      />
    );
    expect(width(container)).toBe('260px');
  });

  it('honours an explicit taskListWidth', () => {
    const { container } = render(<Gantt tasks={mockTasks} taskListWidth={240} />);
    expect(width(container)).toBe('240px');
  });
});
