 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceDAO } from './attendance.dao';
import { UnauthorizedError } from './tenant-context';
import { db } from '../db';

// Mock the Prisma DB module
vi.mock('../db', () => ({
  db: {
    class: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    student: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    academicYear: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('AttendanceDAO Tenant Isolation', () => {
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
    await expect(AttendanceDAO.getClasses(invalidCtx)).rejects.toThrow(UnauthorizedError);
  });

  it('enforces branchId when getting classes', async () => {
    vi.mocked(db.class.findMany).mockResolvedValue([]);
    await AttendanceDAO.getClasses(mockCtx);

    expect(db.class.findMany).toHaveBeenCalledWith({
      where: { branchId: 'branch_1' },
      orderBy: expect.any(Object),
    });
  });

  it('enforces branchId when getting students with attendance', async () => {
    // Mock that the class belongs to the branch
     
    vi.mocked(db.class.findFirst).mockResolvedValue({ id: 'c1', branchId: 'branch_1' } as import('@prisma/client').Class);
     
    vi.mocked(db.academicYear.findFirst).mockResolvedValue({ id: 'ay1' } as import('@prisma/client').AcademicYear);
    vi.mocked(db.student.findMany).mockResolvedValue([] as import('@prisma/client').Student[]);

    await AttendanceDAO.getStudentsWithAttendance(mockCtx, 'c1', new Date());

    expect(db.class.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', branchId: 'branch_1' }
    });

    expect(db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch_1',
        }),
      })
    );
  });
});
