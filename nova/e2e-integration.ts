/* eslint-disable */
import { db as prisma } from './src/lib/db';
import { renderReportAction } from './src/lib/integrations/print-actions';
import { ReportDTOBuilder } from './src/lib/dto/report.dto';

async function runE2E() {
  console.log('--- STARTING E2E INTEGRATION TEST ---');
  
  // 1. Find a finalized term result
  let termResult = await prisma.termResult.findFirst({
    where: { status: 'FINALIZED' },
    include: {
      enrollment: {
        include: {
          student: true,
          classRef: true,
          academicYear: true
        }
      },
      term: true
    }
  });

  if (!termResult) {
    console.log('No finalized term result found. Attempting to finalize one...');
    const enrollment = await prisma.enrollment.findFirst({ include: { classRef: true } });
    const term = await prisma.term.findFirst();
    if (!enrollment || !term) {
       console.error('No enrollment or term found in DB to finalize.');
       process.exit(1);
    }

    if (!enrollment.classRef.gradeScaleId) {
       const scale = await prisma.gradeScale.create({
         data: {
           name: 'E2E Grade Scale',
           branchId: enrollment.classRef.branchId,
           bands: {
             create: [
               { grade: 'D1', minScore: 90, maxScore: 100, points: 1 },
               { grade: 'D2', minScore: 80, maxScore: 89, points: 2 },
               { grade: 'C3', minScore: 70, maxScore: 79, points: 3 },
               { grade: 'F9', minScore: 0, maxScore: 69, points: 9 },
             ]
           }
         }
       });
       await prisma.class.update({
         where: { id: enrollment.classId },
         data: { gradeScaleId: scale.id, aggregationStrategy: 'SUM_ALL' }
       });
    }
    
    const { FinalizationDAO } = require('./src/lib/dao/finalization.dao');
    const user = await prisma.user.findFirst();
    const branch = await prisma.branch.findFirst();
    const result = await FinalizationDAO.finalizeTermResult(enrollment.id, term.id, branch!.id, user!.id, "E2E Test Finalization");
    console.log('Successfully finalized result.');
    termResult = await prisma.termResult.findFirst({
      where: { status: 'FINALIZED' },
      include: {
        enrollment: {
          include: {
            student: true,
            classRef: true,
            academicYear: true
          }
        },
        term: true
      }
    });
  }

  if (!termResult) {
    console.error('Failed to retrieve finalized result.');
    process.exit(1);
  }

  console.log(`Found finalized result for student ${termResult.enrollment.student.firstName} ${termResult.enrollment.student.lastName}, class ${termResult.enrollment.classRef.name}`);

  // 2. Fetch the DTO to verify business logic bypass
  const dto = await ReportDTOBuilder.buildForTermResult(termResult.id);
  console.log(`DTO total score: ${dto.performance.totalScore}`);
  console.log(`DTO aggregate: ${dto.performance.aggregatePoints}`);
  console.log(`DTO division: ${dto.performance.division}`);
  
  // 3. Call the Action
  console.log('\nCalling renderReportAction...');
  const { renderReportAction } = require('./src/lib/integrations/print-actions');
  const result = await renderReportAction(termResult.id);

  if (!result.success) {
    console.error('Action failed:', result.error);
    if (result.message) console.error('Details:', result.message);
    process.exit(1);
  }

  console.log('Action succeeded. Checking HTML output...');
  
  // 4. Verify Output HTML
  const html = result.html;
  if (!html) {
     console.error('No HTML returned');
     process.exit(1);
  }

  // Check if identity details are in HTML
  const checks = [
    dto.student.name,
    dto.academic.className,
    dto.performance.division,
    dto.performance.totalScore?.toString()
  ];

  let passed = true;
  for (const check of checks) {
    if (check && !html.includes(check)) {
      console.error(`❌ HTML does not contain expected value: ${check}`);
      passed = false;
    } else if (check) {
      console.log(`✅ HTML contains: ${check}`);
    }
  }

  if (passed) {
    console.log('\n✅ E2E Verification Passed!');
    // Print snippet of HTML
    console.log('\nHTML Snippet:');
    console.log(html.substring(0, 500) + '...');
  } else {
    console.error('\n❌ E2E Verification Failed!');
    console.log('\nHTML Output Snippet (first 2000 chars):');
    console.log(html.substring(0, 2000));
    process.exit(1);
  }
}

runE2E().catch(console.error).finally(() => prisma.$disconnect());
