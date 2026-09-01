import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { FinalizationDAO } from './finalization.dao';
import { GradeScaleDAO } from './grade-scale.dao';
import { db as prisma } from '../db';

describe('FinalizationDAO', () => {
  let orgId: string;
  let branchId: string;
  let academicYearId: string;
  let termId: string;
  let classId: string;
  let studentId: string;
  let enrollmentId: string;
  let subjectId: string;
  let classSubjectId: string;
  let actorId: string;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Basic scoped test setup
    const org = await prisma.organization.create({ data: { name: `Finalization_Org_${Date.now()}` } });
    orgId = org.id;
    const school = await prisma.school.create({ data: { name: 'School', organizationId: org.id } });
    const branch = await prisma.branch.create({ data: { name: 'Branch', schoolId: school.id } });
    branchId = branch.id;

    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `test_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        userType: 'STAFF'
      }
    });
    actorId = user.id;

    const ay = await prisma.academicYear.create({
      data: { branchId, name: '2026', startDate: new Date(), endDate: new Date() }
    });
    academicYearId = ay.id;

    const term = await prisma.term.create({
      data: { academicYearId, name: 'Term 1', startDate: new Date(), endDate: new Date() }
    });
    termId = term.id;

    const scale = await GradeScaleDAO.createGradeScale({
      branchId,
      name: 'Test Scale',
      bands: [
        { minScore: 0, maxScore: 49, grade: 'F', points: 9, remarks: 'Fail' },
        { minScore: 50, maxScore: 100, grade: 'A', points: 1, remarks: 'Distinction' }
      ]
    });

    const cls = await prisma.class.create({
      data: { branchId, name: 'S1', gradeScaleId: scale.id, aggregationStrategy: 'SUM_ALL' }
    });
    classId = cls.id;

    const student = await prisma.student.create({
      data: { branchId, admissionNo: `STU_${Date.now()}_${Math.random().toString(36).slice(2)}`, firstName: 'John', lastName: 'Doe' }
    });
    studentId = student.id;

    const enr = await prisma.enrollment.create({
      data: { studentId, academicYearId, classId }
    });
    enrollmentId = enr.id;

    const subj = await prisma.subject.create({
      data: { branchId, name: 'Math', code: `MTH_${Date.now()}` }
    });
    subjectId = subj.id;

    const cs = await prisma.classSubject.create({
      data: { classId, subjectId, academicYearId }
    });
    classSubjectId = cs.id;

    await prisma.enrollmentSubject.create({
      data: { enrollmentId, subjectId }
    });

    const assessment = await prisma.assessment.create({
      data: { classSubjectId, termId, name: 'MidTerm', maxScore: 100, weight: 100 }
    });

    await prisma.mark.create({
      data: { studentId, assessmentId: assessment.id, score: 75, status: 'SCORED' }
    });
  });

  afterEach(async () => {
    if (orgId) {
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
  });

  it('previews finalization correctly', async () => {
    const preview = await FinalizationDAO.previewFinalization(enrollmentId, termId, branchId);
    
    expect(preview.subjectResults).toHaveLength(1);
    expect(preview.subjectResults[0].totalScore).toBe(75);
    expect(preview.subjectResults[0].grade).toBe('A');
    expect(preview.subjectResults[0].points).toBe(1);
    
    expect(preview.overall.totalScore).toBe(75);
    expect(preview.overall.aggregate).toBe(1);
    expect(preview.overall.division).toBe('I');
  });

  it('finalizes term result atomically', async () => {
    const result = await FinalizationDAO.finalizeTermResult(enrollmentId, termId, branchId, actorId);
    
    expect(result.status).toBe('FINALIZED');
    expect(result.version).toBe(1);
    expect(result.totalScore).toBe(75);
    expect(result.division).toBe('I');

    const subjects = await prisma.termResultSubject.findMany({ where: { termResultId: result.id } });
    expect(subjects).toHaveLength(1);
    expect(subjects[0].score).toBe(75);
    expect(subjects[0].grade).toBe('A');
  });

  it('creates a new version upon correction', async () => {
    const v1 = await FinalizationDAO.finalizeTermResult(enrollmentId, termId, branchId, actorId);
    expect(v1.version).toBe(1);
    
    // Perform correction
    const v2 = await FinalizationDAO.finalizeTermResult(enrollmentId, termId, branchId, actorId, 'Clerical error fix');
    
    expect(v2.version).toBe(2);
    expect(v2.correctionReason).toBe('Clerical error fix');

    const oldV1 = await prisma.termResult.findUnique({ where: { id: v1.id } });
    expect(oldV1?.status).toBe('SUPERSEDED');
    expect(oldV1?.supersededById).toBe(v2.id);
  });
});
