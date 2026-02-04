import React, { useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { Gantt } from './Gantt';
import type { GanttTask } from './types';

const mockTasks: GanttTask[] = [
  {
    id: '1',
    label: 'Project Planning',
    startDate: '2026-02-01',
    duration: 5,
    progress: 100,
    dependencies: [],
  },
  {
    id: '2',
    label: 'Requirements Analysis',
    startDate: '2026-02-03',
    duration: 7,
    progress: 80,
    dependencies: ['1'],
  },
  {
    id: '3',
    label: 'UI/UX Design',
    startDate: '2026-02-08',
    duration: 10,
    progress: 60,
    dependencies: ['2'],
    color: 'violet',
  },
  {
    id: '4',
    label: 'Database Schema Design',
    startDate: '2026-02-10',
    duration: 5,
    progress: 40,
    dependencies: ['2'],
    color: 'teal',
  },
  {
    id: '5',
    label: 'API Development',
    startDate: '2026-02-15',
    duration: 14,
    progress: 20,
    dependencies: ['4'],
    color: 'orange',
  },
  {
    id: '6',
    label: 'Frontend Development',
    startDate: '2026-02-18',
    duration: 18,
    progress: 10,
    dependencies: ['3'],
  },
  {
    id: '7',
    label: 'Integration Testing',
    startDate: '2026-03-05',
    duration: 7,
    progress: 0,
    dependencies: ['5', '6'],
    color: 'red',
  },
  {
    id: '8',
    label: 'User Acceptance Testing',
    startDate: '2026-03-12',
    duration: 5,
    progress: 0,
    dependencies: ['7'],
    color: 'pink',
  },
  {
    id: '9',
    label: 'Documentation',
    startDate: '2026-02-20',
    duration: 20,
    progress: 15,
    dependencies: ['2'],
    color: 'gray',
  },
  {
    id: '10',
    label: 'Deployment & Launch',
    startDate: '2026-03-17',
    duration: 3,
    progress: 0,
    dependencies: ['8'],
    color: 'green',
  },
];

export default { title: 'Gantt' };

export function Default() {
  return (
    <div style={{ padding: 20, height: 600 }}>
      <Gantt tasks={mockTasks} />
    </div>
  );
}

export function Interactive() {
  const [tasks, setTasks] = useState<GanttTask[]>(mockTasks);

  const handleTaskUpdate = (updatedTask: GanttTask) => {
    // eslint-disable-next-line no-console
    console.log('Task updated:', updatedTask);
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleTaskClick = (task: GanttTask) => {
    // eslint-disable-next-line no-console
    console.log('Task clicked:', task);
  };

  const handleLinkCreate = (fromTaskId: string, toTaskId: string) => {
    // eslint-disable-next-line no-console
    console.log('Link created:', fromTaskId, '->', toTaskId);
  };

  return (
    <div style={{ padding: 20, height: 600 }}>
      <Gantt
        tasks={tasks}
        onTaskUpdate={handleTaskUpdate}
        onTaskClick={handleTaskClick}
        onLinkCreate={handleLinkCreate}
      />
    </div>
  );
}

export function CustomColumnWidth() {
  return (
    <div style={{ padding: 20, height: 600 }}>
      <Gantt tasks={mockTasks} columnWidth={60} rowHeight={50} />
    </div>
  );
}

export function NarrowTaskList() {
  return (
    <div style={{ padding: 20, height: 600 }}>
      <Gantt tasks={mockTasks} taskListWidth={240} />
    </div>
  );
}

export function SmallDataset() {
  const smallTasks: GanttTask[] = [
    {
      id: '1',
      label: 'Task A',
      startDate: '2026-02-01',
      duration: 3,
      progress: 100,
    },
    {
      id: '2',
      label: 'Task B',
      startDate: '2026-02-04',
      duration: 5,
      progress: 50,
      color: 'teal',
    },
    {
      id: '3',
      label: 'Task C',
      startDate: '2026-02-07',
      duration: 4,
      progress: 0,
      color: 'orange',
    },
  ];

  return (
    <div style={{ padding: 20, height: 300 }}>
      <Gantt tasks={smallTasks} />
    </div>
  );
}

export function LargeDataset() {
  const largeTasks: GanttTask[] = Array.from({ length: 1000 }, (_, i) => {
    // Create some dependencies (each task depends on previous one in its group)
    const groupSize = 10;
    const dependencies: string[] = [];
    if (i % groupSize !== 0 && i > 0) {
      dependencies.push(String(i)); // depends on previous task
    }

    return {
      id: String(i + 1),
      label: `Task ${i + 1}: ${['Planning', 'Development', 'Testing', 'Review', 'Deployment'][i % 5]}`,
      startDate: new Date(2026, 1, 1 + Math.floor(i / 5) * 2).toISOString().split('T')[0],
      duration: 3 + (i % 7),
      progress: Math.floor(Math.random() * 100),
      color: ['blue', 'teal', 'violet', 'orange', 'pink', 'green', 'red'][i % 7],
      dependencies,
    };
  });

  return (
    <div style={{ padding: 20, height: 800 }}>
      <Gantt tasks={largeTasks} />
    </div>
  );
}

export function WithMantineProvider() {
  return (
    <MantineProvider>
      <div style={{ padding: 20, height: 600 }}>
        <Gantt tasks={mockTasks} />
      </div>
    </MantineProvider>
  );
}

export function DarkMode() {
  return (
    <MantineProvider forceColorScheme="dark">
      <div style={{ padding: 20, height: 600, backgroundColor: '#1a1b1e' }}>
        <Gantt tasks={mockTasks} />
      </div>
    </MantineProvider>
  );
}

export function CompactView() {
  return (
    <div style={{ padding: 20, height: 400 }}>
      <Gantt tasks={mockTasks} columnWidth={25} rowHeight={32} taskListWidth={400} />
    </div>
  );
}

export function WideView() {
  return (
    <div style={{ padding: 20, height: 700 }}>
      <Gantt tasks={mockTasks} columnWidth={80} rowHeight={60} taskListWidth={400} />
    </div>
  );
}

export function NoDependencies() {
  const noDepsTask: GanttTask[] = [
    { id: '1', label: 'Independent Task 1', startDate: '2026-02-01', duration: 5, progress: 100 },
    {
      id: '2',
      label: 'Independent Task 2',
      startDate: '2026-02-03',
      duration: 8,
      progress: 60,
      color: 'violet',
    },
    {
      id: '3',
      label: 'Independent Task 3',
      startDate: '2026-02-10',
      duration: 4,
      progress: 30,
      color: 'teal',
    },
    {
      id: '4',
      label: 'Independent Task 4',
      startDate: '2026-02-05',
      duration: 12,
      progress: 10,
      color: 'orange',
    },
  ];

  return (
    <div style={{ padding: 20, height: 350 }}>
      <Gantt tasks={noDepsTask} />
    </div>
  );
}

export function ComplexDependencies() {
  const complexTasks: GanttTask[] = [
    { id: '1', label: 'Project Kickoff', startDate: '2026-02-01', duration: 1, progress: 100 },
    {
      id: '2',
      label: 'Research Phase',
      startDate: '2026-02-02',
      duration: 5,
      progress: 100,
      dependencies: ['1'],
    },
    {
      id: '3',
      label: 'Design Sprint 1',
      startDate: '2026-02-07',
      duration: 5,
      progress: 80,
      dependencies: ['2'],
      color: 'violet',
    },
    {
      id: '4',
      label: 'Design Sprint 2',
      startDate: '2026-02-12',
      duration: 5,
      progress: 50,
      dependencies: ['3'],
      color: 'violet',
    },
    {
      id: '5',
      label: 'Backend Setup',
      startDate: '2026-02-07',
      duration: 3,
      progress: 100,
      dependencies: ['2'],
      color: 'teal',
    },
    {
      id: '6',
      label: 'API Development',
      startDate: '2026-02-10',
      duration: 10,
      progress: 40,
      dependencies: ['5'],
      color: 'teal',
    },
    {
      id: '7',
      label: 'Frontend Setup',
      startDate: '2026-02-12',
      duration: 3,
      progress: 60,
      dependencies: ['3'],
      color: 'orange',
    },
    {
      id: '8',
      label: 'UI Implementation',
      startDate: '2026-02-15',
      duration: 12,
      progress: 20,
      dependencies: ['4', '7'],
      color: 'orange',
    },
    {
      id: '9',
      label: 'Integration',
      startDate: '2026-02-20',
      duration: 5,
      progress: 0,
      dependencies: ['6', '8'],
      color: 'red',
    },
    {
      id: '10',
      label: 'Testing',
      startDate: '2026-02-25',
      duration: 7,
      progress: 0,
      dependencies: ['9'],
      color: 'pink',
    },
    {
      id: '11',
      label: 'Documentation',
      startDate: '2026-02-15',
      duration: 18,
      progress: 15,
      dependencies: ['2'],
      color: 'gray',
    },
    {
      id: '12',
      label: 'Launch',
      startDate: '2026-03-04',
      duration: 2,
      progress: 0,
      dependencies: ['10', '11'],
      color: 'green',
    },
  ];

  return (
    <div style={{ padding: 20, height: 600 }}>
      <Gantt tasks={complexTasks} />
    </div>
  );
}

export function AllColors() {
  const colors = [
    'red',
    'pink',
    'grape',
    'violet',
    'indigo',
    'blue',
    'cyan',
    'teal',
    'green',
    'lime',
    'yellow',
    'orange',
  ];
  const colorTasks: GanttTask[] = colors.map((color, i) => ({
    id: String(i + 1),
    label: `${color.charAt(0).toUpperCase() + color.slice(1)} Task`,
    startDate: new Date(2026, 1, 1 + i).toISOString().split('T')[0],
    duration: 5,
    progress: Math.floor((i / colors.length) * 100),
    color,
    dependencies: i > 0 ? [String(i)] : [],
  }));

  return (
    <div style={{ padding: 20, height: 600 }}>
      <Gantt tasks={colorTasks} />
    </div>
  );
}

export function VariableDurations() {
  const varTasks: GanttTask[] = [
    { id: '1', label: '1 Day Task', startDate: '2026-02-01', duration: 1, progress: 100 },
    {
      id: '2',
      label: '3 Day Task',
      startDate: '2026-02-03',
      duration: 3,
      progress: 80,
      color: 'teal',
    },
    {
      id: '3',
      label: '7 Day Task',
      startDate: '2026-02-06',
      duration: 7,
      progress: 60,
      color: 'violet',
    },
    {
      id: '4',
      label: '14 Day Task',
      startDate: '2026-02-13',
      duration: 14,
      progress: 40,
      color: 'orange',
    },
    {
      id: '5',
      label: '30 Day Task',
      startDate: '2026-02-27',
      duration: 30,
      progress: 20,
      color: 'pink',
    },
  ];

  return (
    <div style={{ padding: 20, height: 400 }}>
      <Gantt tasks={varTasks} />
    </div>
  );
}

export function WithHoverTitle() {
  return (
    <div style={{ padding: 20, height: 600 }}>
      <Gantt tasks={mockTasks} showTitle />
    </div>
  );
}

export function WeekView() {
  return (
    <div style={{ padding: 20, height: 600 }}>
      <Gantt tasks={mockTasks} viewMode="week" />
    </div>
  );
}

export function MonthView() {
  return (
    <div style={{ padding: 20, height: 600 }}>
      <Gantt tasks={mockTasks} viewMode="month" />
    </div>
  );
}
