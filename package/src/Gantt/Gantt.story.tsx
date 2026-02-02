import React, { useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { Gantt } from './Gantt';
import { mockTasks } from './mockData';
import type { GanttTask } from './types';

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
    console.log('Task updated:', updatedTask);
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleTaskClick = (task: GanttTask) => {
    console.log('Task clicked:', task);
  };

  const handleLinkCreate = (fromTaskId: string, toTaskId: string) => {
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
