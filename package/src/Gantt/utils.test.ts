import dayjs from 'dayjs';
import type { GanttTask } from './types';
import {
  calculateTimelineBounds,
  dateToPixel,
  durationToPixels,
  formatTaskDate,
  generateDayHeaders,
  generateWeekHeaders,
  getTaskEndDate,
  pixelsToDuration,
  pixelToDate,
  snapToGrid,
} from './utils';

describe('utils', () => {
  describe('dateToPixel', () => {
    it('returns 0 for same date as start', () => {
      const startDate = dayjs('2026-02-01');
      expect(dateToPixel('2026-02-01', startDate, 40)).toBe(0);
    });

    it('calculates correct pixel position for date after start', () => {
      const startDate = dayjs('2026-02-01');
      expect(dateToPixel('2026-02-05', startDate, 40)).toBe(160); // 4 days * 40px
    });

    it('handles negative positions for dates before start', () => {
      const startDate = dayjs('2026-02-05');
      expect(dateToPixel('2026-02-01', startDate, 40)).toBe(-160);
    });

    it('works with different column widths', () => {
      const startDate = dayjs('2026-02-01');
      expect(dateToPixel('2026-02-03', startDate, 60)).toBe(120); // 2 days * 60px
    });
  });

  describe('pixelToDate', () => {
    it('returns start date for position 0', () => {
      const startDate = dayjs('2026-02-01');
      const result = pixelToDate(0, startDate, 40);
      expect(result.isSame(startDate, 'day')).toBe(true);
    });

    it('calculates correct date from pixel position', () => {
      const startDate = dayjs('2026-02-01');
      const result = pixelToDate(160, startDate, 40); // 160px / 40 = 4 days
      expect(result.isSame(dayjs('2026-02-05'), 'day')).toBe(true);
    });

    it('rounds to nearest day', () => {
      const startDate = dayjs('2026-02-01');
      const result = pixelToDate(145, startDate, 40); // ~3.6 days -> 4 days
      expect(result.isSame(dayjs('2026-02-05'), 'day')).toBe(true);
    });
  });

  describe('snapToGrid', () => {
    it('snaps to nearest grid position', () => {
      expect(snapToGrid(45, 40)).toBe(40);
      expect(snapToGrid(55, 40)).toBe(40);
      expect(snapToGrid(60, 40)).toBe(80);
    });

    it('returns 0 for small values', () => {
      expect(snapToGrid(15, 40)).toBe(0);
    });

    it('handles negative values', () => {
      expect(snapToGrid(-45, 40)).toBe(-40);
    });
  });

  describe('durationToPixels', () => {
    it('calculates correct width from duration', () => {
      expect(durationToPixels(5, 40)).toBe(200);
      expect(durationToPixels(1, 40)).toBe(40);
      expect(durationToPixels(10, 60)).toBe(600);
    });
  });

  describe('pixelsToDuration', () => {
    it('calculates correct duration from pixels', () => {
      expect(pixelsToDuration(200, 40)).toBe(5);
      expect(pixelsToDuration(40, 40)).toBe(1);
    });

    it('returns minimum of 1 for very small widths', () => {
      expect(pixelsToDuration(10, 40)).toBe(1);
      expect(pixelsToDuration(0, 40)).toBe(1);
    });

    it('rounds to nearest day', () => {
      expect(pixelsToDuration(145, 40)).toBe(4); // 3.6 -> 4
    });
  });

  describe('generateDayHeaders', () => {
    it('generates correct number of headers', () => {
      const start = dayjs('2026-02-01');
      const end = dayjs('2026-02-07');
      const headers = generateDayHeaders(start, end);
      expect(headers.length).toBe(7);
    });

    it('includes weekend flag', () => {
      const start = dayjs('2026-02-01'); // Sunday
      const end = dayjs('2026-02-07');
      const headers = generateDayHeaders(start, end);

      // Feb 1, 2026 is a Sunday, Feb 7 is a Saturday
      expect(headers[0].isWeekend).toBe(true); // Sunday
      expect(headers[1].isWeekend).toBe(false); // Monday
      expect(headers[6].isWeekend).toBe(true); // Saturday
    });

    it('formats label as day number', () => {
      const start = dayjs('2026-02-01');
      const end = dayjs('2026-02-03');
      const headers = generateDayHeaders(start, end);
      expect(headers[0].label).toBe('1');
      expect(headers[1].label).toBe('2');
      expect(headers[2].label).toBe('3');
    });
  });

  describe('generateWeekHeaders', () => {
    it('generates week headers', () => {
      const start = dayjs('2026-02-01');
      const end = dayjs('2026-02-14');
      const headers = generateWeekHeaders(start, end);
      expect(headers.length).toBeGreaterThan(0);
    });

    it('calculates correct number of days per week', () => {
      // Use a full week Sunday to Saturday
      const start = dayjs('2026-02-01'); // Sunday
      const end = dayjs('2026-02-28');
      const headers = generateWeekHeaders(start, end);
      // Each full week should have days calculated
      expect(headers.length).toBeGreaterThan(0);
      // At least one week should have entries
      headers.forEach((week) => {
        expect(week.days).toBeGreaterThan(0);
        expect(week.days).toBeLessThanOrEqual(7);
      });
    });
  });

  describe('calculateTimelineBounds', () => {
    it('returns provided dates when both are specified', () => {
      const start = new Date('2026-02-01');
      const end = new Date('2026-02-28');
      const bounds = calculateTimelineBounds([], start, end);
      expect(bounds.start.isSame(dayjs(start), 'day')).toBe(true);
      expect(bounds.end.isSame(dayjs(end), 'day')).toBe(true);
    });

    it('calculates bounds from tasks when no dates provided', () => {
      const tasks: GanttTask[] = [
        { id: '1', label: 'Task 1', startDate: '2026-02-05', duration: 5, progress: 50 },
        { id: '2', label: 'Task 2', startDate: '2026-02-10', duration: 10, progress: 25 },
      ];
      const bounds = calculateTimelineBounds(tasks);

      // Should be earliest task start - 7 days padding
      expect(bounds.start.isSame(dayjs('2026-01-29'), 'day')).toBe(true);
      // Should be latest task end + 7 days padding
      expect(bounds.end.isSame(dayjs('2026-02-27'), 'day')).toBe(true);
    });

    it('returns default range for empty tasks', () => {
      const bounds = calculateTimelineBounds([]);
      const today = dayjs();
      expect(bounds.start.isBefore(today)).toBe(true);
      expect(bounds.end.isAfter(today)).toBe(true);
    });
  });

  describe('formatTaskDate', () => {
    it('formats date correctly', () => {
      expect(formatTaskDate('2026-02-15')).toBe('Feb 15, 2026');
    });

    it('handles Date objects', () => {
      expect(formatTaskDate(new Date('2026-03-01'))).toBe('Mar 1, 2026');
    });
  });

  describe('getTaskEndDate', () => {
    it('calculates end date from start and duration', () => {
      const endDate = getTaskEndDate('2026-02-01', 5);
      expect(endDate.isSame(dayjs('2026-02-05'), 'day')).toBe(true);
    });

    it('handles duration of 1', () => {
      const endDate = getTaskEndDate('2026-02-01', 1);
      expect(endDate.isSame(dayjs('2026-02-01'), 'day')).toBe(true);
    });
  });
});
