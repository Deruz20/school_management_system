 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentDAO } from './student.dao';
import { UnauthorizedError } from './tenant-context';
import { db } from '../db';

// Mock the Prisma DB module
vi.mock('../db', () => ({
  db: {
    student: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('StudentDAO Tenant Isolation', () => {
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

  it('throws UnauthorizedError if branchId is missing in context', async () => {
    const invalidCtx = { ...mockCtx, branchId: '' };
    
    await expect(StudentDAO.getStudents(invalidCtx)).rejects.toThrow(UnauthorizedError);
    await expect(StudentDAO.createStudent(invalidCtx, {
      firstName: 'Test', lastName: 'Student', admissionNo: '123'
    })).rejects.toThrow(UnauthorizedError);
  });

  it('enforces branchId in getStudents query', async () => {
    vi.mocked(db.student.count).mockResolvedValue(10);
    vi.mocked(db.student.findMany).mockResolvedValue([]);

    await StudentDAO.getStudents(mockCtx, { search: 'Test' });

    // Verify count query enforces branchId
    expect(db.student.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        branchId: 'branch_1',
      }),
    });

    // Verify findMany query enforces branchId
    expect(db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch_1',
        }),
      })
    );
  });

  it('enforces branchId when creating a student', async () => {
     
    vi.mocked(db.student.create).mockResolvedValue({ id: 's1' } as import('@prisma/client').Student);

    await StudentDAO.createStudent(mockCtx, {
      firstName: 'Alice',
      lastName: 'Smith',
      admissionNo: 'A001',
    });

    expect(db.student.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Alice',
        lastName: 'Smith',
        admissionNo: 'A001',
        branchId: 'branch_1', // Must inject the correct branchId
      }),
    });
  });
});
