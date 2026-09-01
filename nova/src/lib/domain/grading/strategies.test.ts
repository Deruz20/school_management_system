import { describe, it, expect } from 'vitest';
import { getStrategy, SumAllStrategy } from './strategies';

describe('Grading Strategies', () => {
  describe('SumAllStrategy', () => {
    it('returns SUM_ALL as default', () => {
      const strategy = getStrategy(null);
      expect(strategy).toBeInstanceOf(SumAllStrategy);
    });

    it('sums scores and points for COMPLETED subjects', () => {
      const strategy = getStrategy('SUM_ALL');
      const results = [
        { status: 'COMPLETED', totalScore: 80, points: 2 },
        { status: 'COMPLETED', totalScore: 70, points: 3 },
        { status: 'ABSENT', totalScore: null, points: null },
      ];

      const res = strategy.calculate(results as never);
      expect(res.totalScore).toBe(150);
      expect(res.aggregate).toBe(5);
    });

    it('returns division X if malpractice is detected', () => {
      const strategy = getStrategy('SUM_ALL');
      const results = [
        { status: 'COMPLETED', totalScore: 80, points: 2 },
        { status: 'MALPRACTICE', totalScore: null, points: null },
      ];

      const res = strategy.calculate(results as never);
      expect(res.division).toBe('X');
    });

    it('returns U if no valid subjects', () => {
      const strategy = getStrategy('SUM_ALL');
      const results = [
        { status: 'ABSENT', totalScore: null, points: null },
      ];

      const res = strategy.calculate(results as never);
      expect(res.division).toBe('U');
    });
  });
});
