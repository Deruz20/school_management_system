import { db as prisma } from '../db';

export interface CreateGradeBandInput {
  minScore: number;
  maxScore: number;
  grade: string;
  points: number;
  remarks?: string;
}

export interface CreateGradeScaleInput {
  branchId: string;
  name: string;
  description?: string;
  bands: CreateGradeBandInput[];
}

export class GradeScaleDAO {
  static async createGradeScale(data: CreateGradeScaleInput) {
    this.validateBands(data.bands);
    
    return prisma.gradeScale.create({
      data: {
        branchId: data.branchId,
        name: data.name,
        description: data.description,
        bands: {
          create: data.bands
        }
      },
      include: {
        bands: true
      }
    });
  }

  static async getGradeScale(id: string, branchId: string) {
    return prisma.gradeScale.findUnique({
      where: {
        id,
        branchId // Enforce tenant isolation
      },
      include: {
        bands: {
          orderBy: {
            minScore: 'desc'
          }
        }
      }
    });
  }

  static async listGradeScales(branchId: string) {
    return prisma.gradeScale.findMany({
      where: { branchId },
      include: {
        bands: {
          orderBy: { minScore: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  static validateBands(bands: CreateGradeBandInput[]) {
    // Check for overlaps
    const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
    
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].maxScore >= sorted[i + 1].minScore) {
        throw new Error(`Grade bands overlap between ${sorted[i].grade} and ${sorted[i + 1].grade}`);
      }
    }
  }

  static mapScoreToGrade(score: number, bands: { minScore: number; maxScore: number; grade: string; points: number; remarks: string | null }[]) {
    // Find the matching band
    const band = bands.find(b => score >= b.minScore && score <= b.maxScore);
    if (!band) {
      throw new Error(`Score ${score} does not match any grade band`);
    }
    return band;
  }
}
