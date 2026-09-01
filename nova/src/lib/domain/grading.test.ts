import { describe, it, expect } from 'vitest';
import { calculateNormalizedPercentage, calculateWeightedContribution, calculateSubjectTotal } from './grading';
import { MarkStatus } from '@prisma/client';

describe('Grading Logic', () => {
  describe('calculateNormalizedPercentage', () => {
    it('returns null if mark is null or not SCORED', () => {
      expect(calculateNormalizedPercentage({ maxScore: 100 }, null)).toBeNull();
      expect(calculateNormalizedPercentage({ maxScore: 100 }, { score: null, status: MarkStatus.ABSENT })).toBeNull();
      expect(calculateNormalizedPercentage({ maxScore: 100 }, { score: 50, status: MarkStatus.EXEMPT })).toBeNull();
    });

    it('returns correct percentage for SCORED marks', () => {
      expect(calculateNormalizedPercentage({ maxScore: 20 }, { score: 15, status: MarkStatus.SCORED })).toBe(75);
      expect(calculateNormalizedPercentage({ maxScore: 50 }, { score: 25, status: MarkStatus.SCORED })).toBe(50);
      expect(calculateNormalizedPercentage({ maxScore: 100 }, { score: 0, status: MarkStatus.SCORED })).toBe(0);
    });

    it('handles maxScore of 0 safely', () => {
      expect(calculateNormalizedPercentage({ maxScore: 0 }, { score: 0, status: MarkStatus.SCORED })).toBe(0);
    });
  });

  describe('calculateWeightedContribution', () => {
    it('returns null if mark is not SCORED', () => {
      expect(calculateWeightedContribution({ maxScore: 100, weight: 20 }, { score: null, status: MarkStatus.ABSENT })).toBeNull();
    });

    it('calculates weighted contribution correctly', () => {
      // 15 out of 20 = 75%. Weight is 20%. Contribution = 75% of 20 = 15.
      expect(calculateWeightedContribution({ maxScore: 20, weight: 20 }, { score: 15, status: MarkStatus.SCORED })).toBe(15);
      
      // 50 out of 100 = 50%. Weight is 80%. Contribution = 50% of 80 = 40.
      expect(calculateWeightedContribution({ maxScore: 100, weight: 80 }, { score: 50, status: MarkStatus.SCORED })).toBe(40);
    });
  });

  describe('calculateSubjectTotal', () => {
    it('calculates total accumulated score accurately', () => {
      const records = [
        {
          assessment: { maxScore: 20, weight: 20 },
          mark: { score: 15, status: MarkStatus.SCORED } // Contributes 15
        },
        {
          assessment: { maxScore: 100, weight: 80 },
          mark: { score: 80, status: MarkStatus.SCORED } // Contributes 64
        }
      ];
      // 15 + 64 = 79
      expect(calculateSubjectTotal(records)).toBe(79);
    });

    it('ignores non-scored assessments in the sum', () => {
      const records = [
        {
          assessment: { maxScore: 20, weight: 20 },
          mark: { score: 15, status: MarkStatus.SCORED } // Contributes 15
        },
        {
          assessment: { maxScore: 100, weight: 80 },
          mark: { score: null, status: MarkStatus.ABSENT } // Contributes 0 (null)
        }
      ];
      // 15 + 0 = 15
      expect(calculateSubjectTotal(records)).toBe(15);
    });
    
    it('rounds to 1 decimal place', () => {
      const records = [
        {
          assessment: { maxScore: 3, weight: 33.33 },
          mark: { score: 1, status: MarkStatus.SCORED } // 33.33% of 33.33 = 11.1111...
        }
      ];
      expect(calculateSubjectTotal(records)).toBe(11.1);
    });
  });
});
