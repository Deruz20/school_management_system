import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { GradeScaleDAO } from './grade-scale.dao';
import { db as prisma } from '../db';

describe('GradeScaleDAO', () => {
  let orgId: string;
  let branchId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: `GradeScale_Org_${Date.now()}` } });
    orgId = org.id;
    const school = await prisma.school.create({ data: { name: 'Test School', organizationId: org.id } });
    const branch = await prisma.branch.create({ data: { name: 'Test Branch', schoolId: school.id } });
    branchId = branch.id;
  });

  afterEach(async () => {
    if (orgId) {
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a grade scale with non-overlapping bands', async () => {
    const scale = await GradeScaleDAO.createGradeScale({
      branchId,
      name: 'O-Level',
      bands: [
        { minScore: 0, maxScore: 39, grade: 'F9', points: 9 },
        { minScore: 40, maxScore: 49, grade: 'P8', points: 8 },
      ]
    });

    expect(scale.name).toBe('O-Level');
    expect(scale.bands).toHaveLength(2);
    
    // Sort logic test
    const fetched = await GradeScaleDAO.getGradeScale(scale.id, branchId);
    expect(fetched?.bands[0].minScore).toBe(40); // ordered by desc
  });

  it('throws error when bands overlap', async () => {
    await expect(GradeScaleDAO.createGradeScale({
      branchId,
      name: 'Overlap',
      bands: [
        { minScore: 0, maxScore: 45, grade: 'F9', points: 9 },
        { minScore: 40, maxScore: 50, grade: 'P8', points: 8 },
      ]
    })).rejects.toThrow('overlap');
  });

  it('maps score to correct grade', () => {
    const bands = [
      { minScore: 0, maxScore: 39, grade: 'F9', points: 9, remarks: 'Fail' },
      { minScore: 40, maxScore: 49, grade: 'P8', points: 8, remarks: 'Pass' },
    ];

    const result = GradeScaleDAO.mapScoreToGrade(45, bands);
    expect(result.grade).toBe('P8');
  });

  it('throws if score outside bands', () => {
    const bands = [
      { minScore: 0, maxScore: 39, grade: 'F9', points: 9, remarks: 'Fail' },
    ];

    expect(() => GradeScaleDAO.mapScoreToGrade(45, bands)).toThrow('does not match');
  });
});
