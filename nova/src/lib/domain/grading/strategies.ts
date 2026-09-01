export interface SubjectResult {
  classSubjectId: string;
  subjectId: string;
  subjectName: string;
  totalScore: number | null; // null if NOT_ENTERED or ABSENT for all
  grade: string | null;
  points: number | null;
  remarks: string | null;
  status: 'COMPLETED' | 'ABSENT' | 'EXEMPT' | 'MALPRACTICE' | 'INCOMPLETE';
}

export interface AggregationResult {
  totalScore: number;
  aggregate: number; // E.g. Sum of points, or other division logic
  division: string;
  remarks: string;
}

export interface AggregationStrategy {
  id: string;
  name: string;
  calculate(subjectResults: SubjectResult[]): AggregationResult;
}

export class SumAllStrategy implements AggregationStrategy {
  id = 'SUM_ALL';
  name = 'Sum All (Standard)';

  calculate(subjectResults: SubjectResult[]): AggregationResult {
    let totalScore = 0;
    let aggregate = 0;
    let hasMalpractice = false;
    let validSubjects = 0;

    for (const result of subjectResults) {
      if (result.status === 'MALPRACTICE') {
        hasMalpractice = true;
      }
      
      if (result.status === 'COMPLETED') {
        totalScore += (result.totalScore || 0);
        aggregate += (result.points || 0);
        validSubjects++;
      }
    }

    if (hasMalpractice) {
      return {
        totalScore,
        aggregate,
        division: 'X',
        remarks: 'Malpractice Detected'
      };
    }

    if (validSubjects === 0) {
      return {
        totalScore: 0,
        aggregate: 0,
        division: 'U', // Unclassified
        remarks: 'No Valid Subjects'
      };
    }

    // Default division logic based on simple point sum ranges, just for demonstration
    // Since 'SUM_ALL' doesn't explicitly dictate division labels, we use generic ones
    // or we can just leave division empty if not strictly needed.
    // The requirement states: "use SumAllStrategy as the initial supported strategy"
    let division = 'U';
    if (aggregate <= validSubjects * 3) {
      division = 'I';
    } else if (aggregate <= validSubjects * 5) {
      division = 'II';
    } else if (aggregate <= validSubjects * 7) {
      division = 'III';
    } else if (aggregate <= validSubjects * 8) {
      division = 'IV';
    }

    return {
      totalScore,
      aggregate,
      division,
      remarks: 'Computed successfully'
    };
  }
}

const STRATEGIES: Record<string, AggregationStrategy> = {
  'SUM_ALL': new SumAllStrategy()
};

export function getStrategy(id: string | null | undefined): AggregationStrategy {
  if (!id) return STRATEGIES['SUM_ALL']; // Default
  return STRATEGIES[id] || STRATEGIES['SUM_ALL'];
}
