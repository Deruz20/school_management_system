import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { ReportDTOBuilder } from './report.dto';
import { FinalizationDAO } from '../dao/finalization.dao';
import { GradeScaleDAO } from '../dao/grade-scale.dao';
import { db as prisma } from '../db';

describe('ReportDTOBuilder', () => {
  let termResultId: string;
  let actorId: string;
  let orgId: string;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Basic scoped test setup
    const org = await prisma.organization.create({ data: { name: `ReportDTO_Org_${Date.now()}` } });
    orgId = org.id;
    const school = await prisma.school.create({ data: { name: 'School', organizationId: org.id } });
    const branch = await prisma.branch.create({ data: { name: 'Branch', schoolId: school.id } });
    const branchId = branch.id;

    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `testdto_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
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
    
    const term = await prisma.term.create({
      data: { academicYearId: ay.id, name: 'Term 1', startDate: new Date(), endDate: new Date() }
    });
    
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
    
    const student = await prisma.student.create({
      data: { branchId, admissionNo: `STU_${Date.now()}_${Math.random().toString(36).slice(2)}`, firstName: 'John', lastName: 'Doe' }
    });
    
    const enr = await prisma.enrollment.create({
      data: { studentId: student.id, academicYearId: ay.id, classId: cls.id }
    });
    
    const subj = await prisma.subject.create({
      data: { branchId, name: 'Math', code: `MTH_${Date.now()}` }
    });
    
    const cs = await prisma.classSubject.create({
      data: { classId: cls.id, subjectId: subj.id, academicYearId: ay.id }
    });
    
    await prisma.enrollmentSubject.create({
      data: { enrollmentId: enr.id, subjectId: subj.id }
    });

    const assessment = await prisma.assessment.create({
      data: { classSubjectId: cs.id, termId: term.id, name: 'MidTerm', maxScore: 100, weight: 100 }
    });

    await prisma.mark.create({
      data: { studentId: student.id, assessmentId: assessment.id, score: 75, status: 'SCORED' }
    });

    const result = await FinalizationDAO.finalizeTermResult(enr.id, term.id, branchId, actorId);
    termResultId = result.id;
  });

  afterEach(async () => {
    if (orgId) {
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
  });

  it('builds a ReportDTO from a TermResult snapshot', async () => {
    const dto = await ReportDTOBuilder.buildForTermResult(termResultId);
    
    expect(dto.termResultId).toBe(termResultId);
    expect(dto.student.name).toBe('John Doe');
    expect(dto.student.admissionNo).toMatch(/^STU_/);
    expect(dto.academic.termName).toBe('Term 1');
    expect(dto.academic.academicYearName).toBe('2026');
    expect(dto.academic.className).toBe('S1');
    
    expect(dto.performance.totalScore).toBe(75);
    expect(dto.performance.division).toBe('I');

    expect(dto.subjects).toHaveLength(1);
    expect(dto.subjects[0].subjectName).toBe('Math');
    expect(dto.subjects[0].subjectCode).toMatch(/^MTH_/);
    expect(dto.subjects[0].score).toBe(75);
    expect(dto.subjects[0].grade).toBe('A');
  });
});
