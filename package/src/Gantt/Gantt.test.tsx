import React from 'react';
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
