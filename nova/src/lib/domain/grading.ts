import { Assessment, Mark, MarkStatus } from "@prisma/client";

/**
 * Pure calculation functions for grading logic.
 * These do not interact with the database directly.
 */

export interface AssessmentWithMark {
  assessment: Pick<Assessment, 'maxScore' | 'weight'>;
  mark: Pick<Mark, 'score' | 'status'> | null;
}

/**
 * Calculates the normalized percentage score for a single assessment mark.
 * e.g. Score of 15 out of 20 = 75%.
 * Returns null if the mark is not entered, absent, exempt, or malpractice.
 */
export function calculateNormalizedPercentage(assessment: Pick<Assessment, 'maxScore'>, mark: Pick<Mark, 'score' | 'status'> | null): number | null {
  if (!mark || mark.status !== MarkStatus.SCORED || mark.score === null) {
    return null;
  }
  
  if (assessment.maxScore === 0) return 0; // Prevent division by zero
  
  return (mark.score / assessment.maxScore) * 100;
}

/**
 * Calculates the weighted contribution of a single assessment mark.
 * e.g. 75% on an assessment worth 20% of the term grade = 15 points.
 * Returns null if the mark is not scored.
 */
export function calculateWeightedContribution(assessment: Pick<Assessment, 'maxScore' | 'weight'>, mark: Pick<Mark, 'score' | 'status'> | null): number | null {
  const percentage = calculateNormalizedPercentage(assessment, mark);
  if (percentage === null) return null;

  return (percentage / 100) * assessment.weight;
}

/**
 * Calculates the total accumulated score for a subject based on a list of assessments and their marks.
 * Scales the result to out of 100% based on the expected total weights.
 * Example: If a student took two assessments weighted 20% and 80%, and earned full marks on both, total is 100.
 * If they took an assessment weighted 20% and missed the 80% one (ABSENT), their total is just what they earned on the 20% one.
 */
export function calculateSubjectTotal(records: AssessmentWithMark[]): number {
  let totalContribution = 0;

  for (const record of records) {
    const contribution = calculateWeightedContribution(record.assessment, record.mark);
    if (contribution !== null) {
      totalContribution += contribution;
    }
  }

  // We could normalize based on the sum of weights, but typically in standard systems,
  // weights add up to 100, and if you miss an exam, you lose those points.
  // We simply return the sum of the weighted contributions.
  
  // Math.round to 1 decimal place to prevent floating point weirdness
  return Math.round(totalContribution * 10) / 10;
}
