 
 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssessmentDAO } from './assessment.dao';
import { MarkDAO } from './mark.dao';

import { db } from '../db';
import { MarkStatus } from '@prisma/client';

vi.mock('../db', () => ({
  db: {
    classSubject: { findUnique: vi.fn() },
    term: { findUnique: vi.fn() },
    assessment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    mark: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    }
  },
}));

describe('Assessment & Marks DAOs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCtx = {
    userId: 'user_1',
    organizationId: 'org_1',
    schoolId: 'school_1',
    branchId: 'branch_1',
    role: 'Teacher',
    permissions: [],
  };

  describe('AssessmentDAO', () => {
    it('prevents creation if maxScore is <= 0', async () => {
      await expect(AssessmentDAO.createAssessment(mockCtx, {
        classSubjectId: 'cs1', termId: 't1', name: 'Exam', maxScore: 0, weight: 10
      })).rejects.toThrow("Maximum score must be greater than 0");
    });

    it('prevents creation if term academic year mismatches classSubject academic year', async () => {
      vi.mocked(db.classSubject.findUnique).mockResolvedValue({ academicYearId: 'ay1', classRef: { branchId: 'branch_1' } } as never);
      vi.mocked(db.term.findUnique).mockResolvedValue({ academicYearId: 'ay2', academicYear: { branchId: 'branch_1' } } as never);

      await expect(AssessmentDAO.createAssessment(mockCtx, {
        classSubjectId: 'cs1', termId: 't1', name: 'Exam', maxScore: 100, weight: 10
      })).rejects.toThrow("Term does not belong to the Academic Year of this Class Subject");
    });

    it('enforces tenant isolation on classSubject and term during assessment creation', async () => {
      vi.mocked(db.classSubject.findUnique).mockResolvedValue({ academicYearId: 'ay1', classRef: { branchId: 'branch_2' } } as never);
      vi.mocked(db.term.findUnique).mockResolvedValue({ academicYearId: 'ay1', academicYear: { branchId: 'branch_1' } } as never);

      await expect(AssessmentDAO.createAssessment(mockCtx, {
        classSubjectId: 'cs1', termId: 't1', name: 'Exam', maxScore: 100, weight: 10
      })).rejects.toThrow("ClassSubject not found or access denied");
    });

    it('prevents duplicate assessment names for the same class subject and term', async () => {
      vi.mocked(db.classSubject.findUnique).mockResolvedValue({ academicYearId: 'ay1', classRef: { branchId: 'branch_1' } } as never);
      vi.mocked(db.term.findUnique).mockResolvedValue({ academicYearId: 'ay1', academicYear: { branchId: 'branch_1' } } as never);
      vi.mocked(db.assessment.findUnique).mockResolvedValue({ id: 'existing' } as never);

      await expect(AssessmentDAO.createAssessment(mockCtx, {
        classSubjectId: 'cs1', termId: 't1', name: 'Mid-Term', maxScore: 100, weight: 10
      })).rejects.toThrow("Assessment 'Mid-Term' already exists for this term and class subject");
    });
  });

  describe('MarkDAO', () => {
    const mockAssessment = {
      id: 'a1',
      maxScore: 100,
      classSubject: { classId: 'c1', subjectId: 'sub1', classRef: { branchId: 'branch_1' } },
      term: { academicYearId: 'ay1' }
    };

    beforeEach(() => {
      vi.mocked(db.assessment.findUnique).mockResolvedValue(mockAssessment as never);
    });

    it('enforces score constraints for SCORED status', async () => {
      await expect(MarkDAO.upsertMark(mockCtx, {
        studentId: 's1', assessmentId: 'a1', score: 105, status: MarkStatus.SCORED
      })).rejects.toThrow("Score must be between 0 and 100");

      await expect(MarkDAO.upsertMark(mockCtx, {
        studentId: 's1', assessmentId: 'a1', score: null, status: MarkStatus.SCORED
      })).rejects.toThrow("Score is required when status is SCORED");
    });

    it('forces score to null for non-SCORED statuses (like ABSENT)', async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({
        classId: 'c1',
        student: { branchId: 'branch_1' },
        enrollmentSubjects: [{ subjectId: 'sub1' }]
      } as never);

      await MarkDAO.upsertMark(mockCtx, {
        studentId: 's1', assessmentId: 'a1', score: 0, status: MarkStatus.ABSENT
      });

      expect(db.mark.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ score: null, status: MarkStatus.ABSENT })
      }));
    });

    it('rejects mark entry if student is not enrolled in the subject', async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({
        classId: 'c1',
        student: { branchId: 'branch_1' },
        enrollmentSubjects: [{ subjectId: 'other_sub' }] // Not sub1
      } as never);

      await expect(MarkDAO.upsertMark(mockCtx, {
        studentId: 's1', assessmentId: 'a1', score: 50, status: MarkStatus.SCORED
      })).rejects.toThrow("Student is not enrolled in this subject");
    });

    it('rejects mark entry if student is enrolled in a different class', async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({
        classId: 'c2', // Mismatch with assessment class c1
        student: { branchId: 'branch_1' },
        enrollmentSubjects: [{ subjectId: 'sub1' }]
      } as never);

      await expect(MarkDAO.upsertMark(mockCtx, {
        studentId: 's1', assessmentId: 'a1', score: 50, status: MarkStatus.SCORED
      })).rejects.toThrow("Student is not enrolled in the class tied to this assessment");
    });
  });
});
