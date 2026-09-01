import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Create Organizations
  let org1 = await prisma.organization.findFirst({ where: { name: 'Alpha Education Trust' } });
  if (!org1) {
    org1 = await prisma.organization.create({ data: { name: 'Alpha Education Trust' } });
  }

  let org2 = await prisma.organization.findFirst({ where: { name: 'Beta Schools Group' } });
  if (!org2) {
    org2 = await prisma.organization.create({ data: { name: 'Beta Schools Group' } });
  }

  // 2. Create Schools
  let school1 = await prisma.school.findFirst({ where: { name: 'Alpha High School', organizationId: org1.id } });
  if (!school1) {
    school1 = await prisma.school.create({ data: { name: 'Alpha High School', organizationId: org1.id } });
  }

  let school2 = await prisma.school.findFirst({ where: { name: 'Beta International', organizationId: org2.id } });
  if (!school2) {
    school2 = await prisma.school.create({ data: { name: 'Beta International', organizationId: org2.id } });
  }

  // 3. Create Branches
  let branch1 = await prisma.branch.findFirst({ where: { name: 'Alpha Main Campus', schoolId: school1.id } });
  if (!branch1) {
    branch1 = await prisma.branch.create({ data: { name: 'Alpha Main Campus', schoolId: school1.id } });
  }

  let branch2 = await prisma.branch.findFirst({ where: { name: 'Beta City Campus', schoolId: school2.id } });
  if (!branch2) {
    branch2 = await prisma.branch.create({ data: { name: 'Beta City Campus', schoolId: school2.id } });
  }

  // 4. Create Roles
  let adminRole1 = await prisma.role.findFirst({ where: { name: 'Admin', organizationId: org1.id } });
  if (!adminRole1) {
    adminRole1 = await prisma.role.create({ data: { name: 'Admin', permissions: ['all'], organizationId: org1.id } });
  }

  let teacherRole1 = await prisma.role.findFirst({ where: { name: 'Teacher', organizationId: org1.id } });
  if (!teacherRole1) {
    teacherRole1 = await prisma.role.create({
      data: {
        name: 'Teacher',
        permissions: ['attendance:write', 'attendance:read', 'students:read', 'students:write', 'staff:read'],
        organizationId: org1.id
      }
    });
  }

  let adminRole2 = await prisma.role.findFirst({ where: { name: 'Admin', organizationId: org2.id } });
  if (!adminRole2) {
    adminRole2 = await prisma.role.create({ data: { name: 'Admin', permissions: ['all'], organizationId: org2.id } });
  }

  let teacherRole2 = await prisma.role.findFirst({ where: { name: 'Teacher', organizationId: org2.id } });
  if (!teacherRole2) {
    teacherRole2 = await prisma.role.create({
      data: {
        name: 'Teacher',
        permissions: ['attendance:write', 'attendance:read', 'students:read', 'students:write', 'staff:read'],
        organizationId: org2.id
      }
    });
  }

  // 5. Create Users & Branch Access
  const passwordHash = await bcrypt.hash('password123', 10);

  // Admin User Alpha
  let adminUser1 = await prisma.user.findFirst({ where: { email: 'admin@alpha.edu' } });
  if (!adminUser1) {
    adminUser1 = await prisma.user.create({
      data: {
        email: 'admin@alpha.edu',
        firstName: 'System',
        lastName: 'Admin',
        passwordHash,
        userType: 'STAFF',
        status: 'ACTIVE',
        organizationId: org1.id
      }
    });
  } else {
    adminUser1 = await prisma.user.update({
      where: { id: adminUser1.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        organizationId: org1.id
      }
    });
  }
  const adminAccess1 = await prisma.userBranchAccess.findUnique({
    where: { userId_branchId: { userId: adminUser1.id, branchId: branch1.id } }
  });
  if (!adminAccess1) {
    await prisma.userBranchAccess.create({
      data: { userId: adminUser1.id, branchId: branch1.id, roleId: adminRole1.id }
    });
  } else {
    await prisma.userBranchAccess.update({
      where: { id: adminAccess1.id },
      data: { roleId: adminRole1.id }
    });
  }

  // Teacher User Alpha
  let user1 = await prisma.user.findFirst({ where: { email: 'teacher@alpha.edu' } });
  if (!user1) {
    user1 = await prisma.user.create({
      data: {
        email: 'teacher@alpha.edu',
        firstName: 'Alice',
        lastName: 'Smith',
        passwordHash,
        userType: 'STAFF',
        status: 'ACTIVE',
        organizationId: org1.id
      }
    });
  } else {
    user1 = await prisma.user.update({
      where: { id: user1.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        organizationId: org1.id
      }
    });
  }
  const userAccess1 = await prisma.userBranchAccess.findUnique({
    where: { userId_branchId: { userId: user1.id, branchId: branch1.id } }
  });
  if (!userAccess1) {
    await prisma.userBranchAccess.create({
      data: { userId: user1.id, branchId: branch1.id, roleId: teacherRole1.id }
    });
  } else {
    await prisma.userBranchAccess.update({
      where: { id: userAccess1.id },
      data: { roleId: teacherRole1.id }
    });
  }

  // Teacher User Beta
  let user2 = await prisma.user.findFirst({ where: { email: 'teacher@beta.edu' } });
  if (!user2) {
    user2 = await prisma.user.create({
      data: {
        email: 'teacher@beta.edu',
        firstName: 'Bob',
        lastName: 'Jones',
        passwordHash,
        userType: 'STAFF',
        status: 'ACTIVE',
        organizationId: org2.id
      }
    });
  } else {
    user2 = await prisma.user.update({
      where: { id: user2.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        organizationId: org2.id
      }
    });
  }
  const userAccess2 = await prisma.userBranchAccess.findUnique({
    where: { userId_branchId: { userId: user2.id, branchId: branch2.id } }
  });
  if (!userAccess2) {
    await prisma.userBranchAccess.create({
      data: { userId: user2.id, branchId: branch2.id, roleId: teacherRole2.id }
    });
  } else {
    await prisma.userBranchAccess.update({
      where: { id: userAccess2.id },
      data: { roleId: teacherRole2.id }
    });
  }

  // 6. Create Employee Types
  let teachingStaff1 = await prisma.employeeType.findFirst({ where: { name: 'Teacher', branchId: branch1.id } });
  if (!teachingStaff1) {
    teachingStaff1 = await prisma.employeeType.create({ data: { name: 'Teacher', isTeachingStaff: true, branchId: branch1.id } });
  }

  let adminStaffType1 = await prisma.employeeType.findFirst({ where: { name: 'Administrator', branchId: branch1.id } });
  if (!adminStaffType1) {
    adminStaffType1 = await prisma.employeeType.create({ data: { name: 'Administrator', isTeachingStaff: false, branchId: branch1.id } });
  }

  let teachingStaff2 = await prisma.employeeType.findFirst({ where: { name: 'Teacher', branchId: branch2.id } });
  if (!teachingStaff2) {
    teachingStaff2 = await prisma.employeeType.create({ data: { name: 'Teacher', isTeachingStaff: true, branchId: branch2.id } });
  }

  // 7. Create Departments
  let scienceDept1 = await prisma.department.findFirst({ where: { name: 'Sciences', branchId: branch1.id } });
  if (!scienceDept1) {
    scienceDept1 = await prisma.department.create({
      data: { name: 'Sciences', description: 'Science & Mathematics Department', branchId: branch1.id }
    });
  }

  let humanitiesDept1 = await prisma.department.findFirst({ where: { name: 'Humanities', branchId: branch1.id } });
  if (!humanitiesDept1) {
    humanitiesDept1 = await prisma.department.create({
      data: { name: 'Humanities', description: 'Arts & Humanities Department', branchId: branch1.id }
    });
  }

  let languagesDept2 = await prisma.department.findFirst({ where: { name: 'Languages', branchId: branch2.id } });
  if (!languagesDept2) {
    languagesDept2 = await prisma.department.create({
      data: { name: 'Languages', description: 'Languages Department', branchId: branch2.id }
    });
  }

  // 8. Create Employees linked to Users and Departments
  let emp1 = await prisma.employee.findFirst({ where: { branchId: branch1.id, employeeCode: 'EMP-001' } });
  if (!emp1) {
    emp1 = await prisma.employee.create({
      data: {
        branchId: branch1.id,
        employeeCode: 'EMP-001',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'teacher@alpha.edu',
        employeeTypeId: teachingStaff1.id,
        departmentId: scienceDept1.id,
        userId: user1.id
      }
    });
  } else {
    emp1 = await prisma.employee.update({
      where: { id: emp1.id },
      data: {
        userId: user1.id,
        departmentId: scienceDept1.id,
        employeeTypeId: teachingStaff1.id
      }
    });
  }

  // Update HOD for Science Department
  await prisma.department.update({
    where: { id: scienceDept1.id },
    data: { hodId: emp1.id }
  });

  let emp2 = await prisma.employee.findFirst({ where: { branchId: branch2.id, employeeCode: 'EMP-002' } });
  if (!emp2) {
    emp2 = await prisma.employee.create({
      data: {
        branchId: branch2.id,
        employeeCode: 'EMP-002',
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'teacher@beta.edu',
        employeeTypeId: teachingStaff2.id,
        departmentId: languagesDept2.id,
        userId: user2.id
      }
    });
  } else {
    emp2 = await prisma.employee.update({
      where: { id: emp2.id },
      data: {
        userId: user2.id,
        departmentId: languagesDept2.id,
        employeeTypeId: teachingStaff2.id
      }
    });
  }

  // 9. Create GradeScales & Bands
  let gradeScale1 = await prisma.gradeScale.findFirst({ where: { name: 'O-Level Standard', branchId: branch1.id } });
  if (!gradeScale1) {
    gradeScale1 = await prisma.gradeScale.create({
      data: {
        name: 'O-Level Standard',
        description: 'Standard O-Level grading scale',
        branchId: branch1.id,
        bands: {
          create: [
            { grade: 'D1', minScore: 90, maxScore: 100, points: 1, remarks: 'Excellent' },
            { grade: 'D2', minScore: 80, maxScore: 89, points: 2, remarks: 'Very Good' },
            { grade: 'C3', minScore: 70, maxScore: 79, points: 3, remarks: 'Good' },
            { grade: 'C4', minScore: 65, maxScore: 69, points: 4, remarks: 'Fairly Good' },
            { grade: 'C5', minScore: 60, maxScore: 64, points: 5, remarks: 'Passable' },
            { grade: 'C6', minScore: 55, maxScore: 59, points: 6, remarks: 'Fair' },
            { grade: 'P7', minScore: 50, maxScore: 54, points: 7, remarks: 'Pass' },
            { grade: 'P8', minScore: 45, maxScore: 49, points: 8, remarks: 'Weak Pass' },
            { grade: 'F9', minScore: 0, maxScore: 44, points: 9, remarks: 'Fail' },
          ]
        }
      }
    });
  }

  let gradeScale2 = await prisma.gradeScale.findFirst({ where: { name: 'O-Level Standard', branchId: branch2.id } });
  if (!gradeScale2) {
    gradeScale2 = await prisma.gradeScale.create({
      data: {
        name: 'O-Level Standard',
        description: 'Standard O-Level grading scale',
        branchId: branch2.id,
        bands: {
          create: [
            { grade: 'D1', minScore: 90, maxScore: 100, points: 1, remarks: 'Excellent' },
            { grade: 'D2', minScore: 80, maxScore: 89, points: 2, remarks: 'Very Good' },
            { grade: 'C3', minScore: 70, maxScore: 79, points: 3, remarks: 'Good' },
            { grade: 'C4', minScore: 65, maxScore: 69, points: 4, remarks: 'Fairly Good' },
            { grade: 'C5', minScore: 60, maxScore: 64, points: 5, remarks: 'Passable' },
            { grade: 'C6', minScore: 55, maxScore: 59, points: 6, remarks: 'Fair' },
            { grade: 'P7', minScore: 50, maxScore: 54, points: 7, remarks: 'Pass' },
            { grade: 'P8', minScore: 45, maxScore: 49, points: 8, remarks: 'Weak Pass' },
            { grade: 'F9', minScore: 0, maxScore: 44, points: 9, remarks: 'Fail' },
          ]
        }
      }
    });
  }

  // 10. Create Classes
  let class1 = await prisma.class.findFirst({ where: { name: 'Grade 10 Science', branchId: branch1.id } });
  if (!class1) {
    class1 = await prisma.class.create({
      data: { 
        name: 'Grade 10 Science', 
        branchId: branch1.id,
        gradeScaleId: gradeScale1.id,
        aggregationStrategy: 'SumAllStrategy'
      }
    });
  } else {
    await prisma.class.update({
      where: { id: class1.id },
      data: { gradeScaleId: gradeScale1.id, aggregationStrategy: 'SumAllStrategy' }
    });
  }

  let class2 = await prisma.class.findFirst({ where: { name: 'Grade 10 Arts', branchId: branch2.id } });
  if (!class2) {
    class2 = await prisma.class.create({
      data: { 
        name: 'Grade 10 Arts', 
        branchId: branch2.id,
        gradeScaleId: gradeScale2.id,
        aggregationStrategy: 'SumAllStrategy'
      }
    });
  } else {
    await prisma.class.update({
      where: { id: class2.id },
      data: { gradeScaleId: gradeScale2.id, aggregationStrategy: 'SumAllStrategy' }
    });
  }

  // 11. Create Academic Year and Term
  let ay1 = await prisma.academicYear.findFirst({ where: { name: '2026', branchId: branch1.id } });
  if (!ay1) {
    ay1 = await prisma.academicYear.create({
      data: { name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), branchId: branch1.id }
    });
  }

  let ay2 = await prisma.academicYear.findFirst({ where: { name: '2026', branchId: branch2.id } });
  if (!ay2) {
    ay2 = await prisma.academicYear.create({
      data: { name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), branchId: branch2.id }
    });
  }

  let term1_1 = await prisma.term.findFirst({ where: { name: 'Term 1', academicYearId: ay1.id } });
  if (!term1_1) {
    term1_1 = await prisma.term.create({
      data: { name: 'Term 1', startDate: new Date('2026-01-01'), endDate: new Date('2026-04-30'), academicYearId: ay1.id }
    });
  }

  let term1_2 = await prisma.term.findFirst({ where: { name: 'Term 1', academicYearId: ay2.id } });
  if (!term1_2) {
    term1_2 = await prisma.term.create({
      data: { name: 'Term 1', startDate: new Date('2026-01-01'), endDate: new Date('2026-04-30'), academicYearId: ay2.id }
    });
  }

  // 12. Setup Branch Settings
  await prisma.branchSettings.upsert({
    where: { branchId: branch1.id },
    create: { branchId: branch1.id, activeAcademicYearId: ay1.id, activeTermId: term1_1.id },
    update: { activeAcademicYearId: ay1.id, activeTermId: term1_1.id }
  });

  await prisma.branchSettings.upsert({
    where: { branchId: branch2.id },
    create: { branchId: branch2.id, activeAcademicYearId: ay2.id, activeTermId: term1_2.id },
    update: { activeAcademicYearId: ay2.id, activeTermId: term1_2.id }
  });

  // 13. Create Subjects and ClassSubjects
  let mathSubject = await prisma.subject.findFirst({ where: { branchId: branch1.id, code: 'MTH101' } });
  if (!mathSubject) {
    mathSubject = await prisma.subject.create({
      data: { branchId: branch1.id, name: 'Mathematics', code: 'MTH101', description: 'Core Mathematics' }
    });
  }

  const classSubject1 = await prisma.classSubject.findUnique({
    where: { classId_subjectId_academicYearId: { classId: class1.id, subjectId: mathSubject.id, academicYearId: ay1.id } }
  });
  if (!classSubject1) {
    await prisma.classSubject.create({
      data: {
        classId: class1.id,
        subjectId: mathSubject.id,
        academicYearId: ay1.id,
        teacherId: emp1.id
      }
    });
  }

  // 14. Create Students and Enrollments
  const studentsData = [
    { firstName: 'Charlie', lastName: 'Brown', admissionNo: 'A1001', branchId: branch1.id, classId: class1.id, ayId: ay1.id },
    { firstName: 'Diana', lastName: 'Prince', admissionNo: 'A1002', branchId: branch1.id, classId: class1.id, ayId: ay1.id },
    { firstName: 'Eve', lastName: 'Polastri', admissionNo: 'B2001', branchId: branch2.id, classId: class2.id, ayId: ay2.id },
  ];

  for (const s of studentsData) {
    let student = await prisma.student.findFirst({ where: { admissionNo: s.admissionNo } });
    if (!student) {
      student = await prisma.student.create({
        data: { firstName: s.firstName, lastName: s.lastName, admissionNo: s.admissionNo, branchId: s.branchId, classId: s.classId }
      });
    } else {
      await prisma.student.update({
        where: { id: student.id },
        data: { branchId: s.branchId, classId: s.classId }
      });
    }
    
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: student.id, academicYearId: s.ayId, classId: s.classId }
    });
    
    if (!enrollment) {
      await prisma.enrollment.create({
        data: { studentId: student.id, academicYearId: s.ayId, classId: s.classId, status: 'ACTIVE' }
      });
    }
  }

  // 15. Fee Configuration Seed (Phase 3.1A)
  let tuitionType1 = await prisma.feeType.findUnique({
    where: { branchId_code: { branchId: branch1.id, code: 'TUITION' } }
  });
  if (!tuitionType1) {
    tuitionType1 = await prisma.feeType.create({
      data: {
        branchId: branch1.id,
        name: 'Tuition Fee',
        code: 'TUITION',
        description: 'Standard termly academic tuition'
      }
    });
  }

  let devFeeType1 = await prisma.feeType.findUnique({
    where: { branchId_code: { branchId: branch1.id, code: 'DEV_FEE' } }
  });
  if (!devFeeType1) {
    devFeeType1 = await prisma.feeType.create({
      data: {
        branchId: branch1.id,
        name: 'Development Levy',
        code: 'DEV_FEE',
        description: 'Infrastructure and school development fund'
      }
    });
  }

  let uniformType1 = await prisma.feeType.findUnique({
    where: { branchId_code: { branchId: branch1.id, code: 'UNIFORM' } }
  });
  if (!uniformType1) {
    uniformType1 = await prisma.feeType.create({
      data: {
        branchId: branch1.id,
        name: 'School Uniform',
        code: 'UNIFORM',
        description: 'Complete school uniform package'
      }
    });
  }

  let feeStructure1 = await prisma.feeStructure.findFirst({
    where: {
      branchId: branch1.id,
      classId: class1.id,
      academicYearId: ay1.id,
      termId: term1_1.id,
      name: 'P.1 Term 1 Standard'
    }
  });

  if (!feeStructure1) {
    feeStructure1 = await prisma.feeStructure.create({
      data: {
        branchId: branch1.id,
        name: 'P.1 Term 1 Standard',
        classId: class1.id,
        academicYearId: ay1.id,
        termId: term1_1.id,
        description: 'Standard Term 1 fee structure for Primary 1',
        currency: 'UGX',
        items: {
          create: [
            { feeTypeId: tuitionType1.id, amount: 650000, isOptional: false, description: 'Tuition for Term 1' },
            { feeTypeId: devFeeType1.id, amount: 100000, isOptional: false, description: 'Annual development levy' },
            { feeTypeId: uniformType1.id, amount: 150000, isOptional: true, description: 'Optional uniform kit' }
          ]
        }
      }
    });
  }

  // 16. Invoicing & Billing Seed (Phase 3.1B)
  const student1 = await prisma.student.findUnique({ where: { admissionNo: 'P1-001' } });
  if (student1 && tuitionType1) {
    const existingDiscount = await prisma.studentFeeDiscount.findFirst({
      where: {
        branchId: branch1.id,
        studentId: student1.id,
        feeTypeId: tuitionType1.id,
        reason: 'Staff Child 50% Tuition Bursary'
      }
    });

    if (!existingDiscount) {
      await prisma.studentFeeDiscount.create({
        data: {
          branchId: branch1.id,
          studentId: student1.id,
          feeTypeId: tuitionType1.id,
          discountType: 'PERCENTAGE',
          value: 50,
          reason: 'Staff Child 50% Tuition Bursary',
          isActive: true
        }
      });
    }
  }

  // 17. Subledger & Payment Seed (Phase 3.1C)
  if (student1) {
    const existingOpening = await prisma.studentLedgerEntry.findFirst({
      where: {
        branchId: branch1.id,
        studentId: student1.id,
        referenceType: 'SYSTEM_OPENING'
      }
    });

    if (!existingOpening) {
      await prisma.studentLedgerEntry.create({
        data: {
          branchId: branch1.id,
          studentId: student1.id,
          academicYearId: ay1.id,
          termId: term1_1.id,
          entryType: 'OPENING_BALANCE',
          direction: 'DEBIT',
          amount: new Prisma.Decimal('150000.00'),
          referenceType: 'SYSTEM_OPENING',
          referenceId: `OPENING:${student1.id}`,
          description: 'Historical Arrears brought forward from 2025 Term 3',
          balanceAfter: new Prisma.Decimal('150000.00')
        }
      });
    }
  }

  // 18. Expense Categories & Sample Expenses (Phase 3.1D)
  const defaultCategories = [
    { name: 'Utilities', code: 'UTIL', description: 'Electricity, Water, Gas, Internet' },
    { name: 'Academic Supplies', code: 'SUPPLIES', description: 'Exam papers, textbooks, science lab consumables' },
    { name: 'Repairs & Maintenance', code: 'REPAIRS', description: 'Classroom repairs, plumbing, painting, generator' },
    { name: 'Boarding & Catering', code: 'CATERING', description: 'Student meals, posho, beans, kitchen supplies' },
    { name: 'Staff Allowances', code: 'ALLOWANCES', description: 'Teacher duty allowances, workshop transport' }
  ];

  for (const cat of defaultCategories) {
    const existingCat = await prisma.expenseCategory.findFirst({
      where: { branchId: branch1.id, name: cat.name }
    });
    if (!existingCat) {
      await prisma.expenseCategory.create({
        data: {
          branchId: branch1.id,
          name: cat.name,
          code: cat.code,
          description: cat.description,
          isActive: true
        }
      });
    }
  }

  const utilCat = await prisma.expenseCategory.findFirst({
    where: { branchId: branch1.id, code: 'UTIL' }
  });

  if (utilCat) {
    const existingExpense = await prisma.expense.findFirst({
      where: { branchId: branch1.id, idempotencyKey: 'SEED_EXPENSE_001' }
    });

    if (!existingExpense) {
      await prisma.expense.create({
        data: {
          branchId: branch1.id,
          categoryId: utilCat.id,
          idempotencyKey: 'SEED_EXPENSE_001',
          voucherNumber: 'VOUCH-2026-00001',
          title: 'Umeme Electricity Bill (Main Campus)',
          amount: new Prisma.Decimal('450000.00'),
          expenseDate: new Date('2026-02-15'),
          paymentMethod: 'BANK_TRANSFER',
          vendorName: 'Umeme Uganda Ltd',
          receiptRef: 'EFRIS-UMEME-9921',
          notes: 'Standard monthly power bill for campus and ICT lab',
          status: 'COMPLETED',
          recordedById: user1.id
        }
      });

      await prisma.expenseSequence.upsert({
        where: { branchId_year: { branchId: branch1.id, year: 2026 } },
        create: { branchId: branch1.id, year: 2026, lastValue: 1 },
        update: { lastValue: { increment: 0 } }
      });
    }
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
