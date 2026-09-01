 
 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubjectDAO } from './subject.dao';
import { ClassSubjectDAO } from './class-subject.dao';
import { EnrollmentSubjectDAO } from './enrollment-subject.dao';
import { UnauthorizedError } from './tenant-context';
import { db } from '../db';

// Mock Prisma
vi.mock('../db', () => ({
  db: {
    subject: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    subjectCombination: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    class: { findUnique: vi.fn() },
    academicYear: { findUnique: vi.fn() },
    employee: { findUnique: vi.fn() },
    classSubject: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    enrollment: { findUnique: vi.fn() },
    enrollmentSubject: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(db)),
  },
}));

describe('Curriculum DAOs Tenant Isolation', () => {
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

  describe('SubjectDAO', () => {
    it('throws UnauthorizedError if branchId is missing', async () => {
      const invalidCtx = { ...mockCtx, branchId: '' };
      await expect(SubjectDAO.listSubjects(invalidCtx)).rejects.toThrow(UnauthorizedError);
    });

    it('enforces branchId when listing subjects', async () => {
      vi.mocked(db.subject.findMany).mockResolvedValue([]);
      await SubjectDAO.listSubjects(mockCtx);
      expect(db.subject.findMany).toHaveBeenCalledWith({
        where: { branchId: 'branch_1', isActive: true },
        orderBy: { name: 'asc' }
      });
    });

    it('prevents cross-tenant subject retrieval', async () => {
      vi.mocked(db.subject.findUnique).mockResolvedValue({ id: 'sub_1', branchId: 'branch_2' } as never);
      await expect(SubjectDAO.getSubject(mockCtx, 'sub_1')).rejects.toThrow("Subject not found or access denied");
    });
    
    it('prevents duplicate subject codes during creation', async () => {
      vi.mocked(db.subject.findFirst).mockResolvedValue({ id: 'sub_old', code: 'MTH' } as never);
      await expect(SubjectDAO.createSubject(mockCtx, { name: 'Math', code: 'MTH' }))
        .rejects.toThrow("Subject with code MTH already exists");
    });
  });

  describe('ClassSubjectDAO', () => {
    it('prevents assigning cross-tenant class or subject', async () => {
      vi.mocked(db.class.findUnique).mockResolvedValue({ id: 'c1', branchId: 'branch_2' } as never);
      vi.mocked(db.subject.findUnique).mockResolvedValue({ id: 's1', branchId: 'branch_1' } as never);
      vi.mocked(db.academicYear.findUnique).mockResolvedValue({ id: 'ay1', branchId: 'branch_1' } as never);

      await expect(ClassSubjectDAO.assignSubject(mockCtx, {
        classId: 'c1', subjectId: 's1', academicYearId: 'ay1'
      })).rejects.toThrow("Class not found");
    });

    it('prevents duplicate assignment for the same academic year', async () => {
      vi.mocked(db.class.findUnique).mockResolvedValue({ id: 'c1', branchId: 'branch_1' } as never);
      vi.mocked(db.subject.findUnique).mockResolvedValue({ id: 's1', branchId: 'branch_1' } as never);
      vi.mocked(db.academicYear.findUnique).mockResolvedValue({ id: 'ay1', branchId: 'branch_1' } as never);
      vi.mocked(db.classSubject.findUnique).mockResolvedValue({ id: 'cs1' } as never); // Duplicate exists

      await expect(ClassSubjectDAO.assignSubject(mockCtx, {
        classId: 'c1', subjectId: 's1', academicYearId: 'ay1'
      })).rejects.toThrow("Subject is already assigned to this class for the given academic year");
    });
  });

  describe('EnrollmentSubjectDAO', () => {
    it('prevents assigning subjects to an enrollment outside tenant', async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({ 
        id: 'e1', student: { branchId: 'branch_2' } 
      } as never);

      await expect(EnrollmentSubjectDAO.assignSubjects(mockCtx, 'e1', ['s1']))
        .rejects.toThrow("Enrollment not found");
    });

    it('verifies all subjects belong to the branch', async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({ 
        id: 'e1', student: { branchId: 'branch_1' } 
      } as never);
      // Mock count returning less than requested subjects
      vi.mocked(db.subject.count).mockResolvedValue(1);

      await expect(EnrollmentSubjectDAO.assignSubjects(mockCtx, 'e1', ['s1', 's2']))
        .rejects.toThrow("One or more subjects do not exist or belong to another branch");
    });
    
    it('upserts enrollment subjects', async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({ 
        id: 'e1', student: { branchId: 'branch_1' } 
      } as never);
      vi.mocked(db.subject.count).mockResolvedValue(1);
      vi.mocked(db.enrollmentSubject.findMany).mockResolvedValue([]);

      await EnrollmentSubjectDAO.assignSubjects(mockCtx, 'e1', ['s1']);
      
      expect(db.enrollmentSubject.upsert).toHaveBeenCalledWith({
        where: { enrollmentId_subjectId: { enrollmentId: 'e1', subjectId: 's1' } },
        update: { isElective: false },
        create: { enrollmentId: 'e1', subjectId: 's1', isElective: false }
      });
    });
  });
});
