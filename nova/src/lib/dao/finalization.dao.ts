import { db as prisma } from '../db';
import { AuditService } from "../services/audit.service";
import { GradeScaleDAO } from './grade-scale.dao';
import { getStrategy, SubjectResult } from '../domain/grading/strategies';
import { calculateSubjectTotal } from '../domain/grading';

export class FinalizationDAO {
  /**
   * Generates a preview of the final results for an enrollment without saving them.
   */
  static async previewFinalization(enrollmentId: string, termId: string, branchId: string) {
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: { classRef: { include: { gradeScale: { include: { bands: true } } } } }
    });

    if (enrollment.classRef.branchId !== branchId) {
      throw new Error(`Enrollment does not belong to the active branch`);
    }

    const gradeScale = enrollment.classRef.gradeScale;
    if (!gradeScale) {
      throw new Error(`Class ${enrollment.classRef.name} has no grade scale configured.`);
    }

    const strategyId = enrollment.classRef.aggregationStrategy;
    const strategy = getStrategy(strategyId);

    const enrollmentSubjects = await prisma.enrollmentSubject.findMany({
      where: { enrollmentId },
      include: { subject: true }
    });

    const subjectResults: SubjectResult[] = [];

    for (const es of enrollmentSubjects) {
      const classSubject = await prisma.classSubject.findUnique({
        where: { classId_subjectId_academicYearId: {
          classId: enrollment.classId,
          subjectId: es.subjectId,
          academicYearId: enrollment.academicYearId
        }}
      });

      if (!classSubject) {
        // A student might be enrolled in a subject that wasn't assigned to the class for this year
        continue; 
      }

      const assessments = await prisma.assessment.findMany({
        where: { classSubjectId: classSubject.id, termId },
        include: { marks: { where: { studentId: enrollment.studentId } } }
      });

      const records = assessments.map(a => ({
        assessment: { maxScore: a.maxScore, weight: a.weight },
        mark: a.marks[0] || null
      }));

      // Check if any mark is malpractice
      let status: SubjectResult['status'] = 'COMPLETED';
      
      const hasMalpractice = records.some(r => r.mark?.status === 'MALPRACTICE');
      const allNotEntered = records.every(r => !r.mark || r.mark.status === 'NOT_ENTERED');
      const allAbsent = records.every(r => r.mark?.status === 'ABSENT');
      const hasExempt = records.some(r => r.mark?.status === 'EXEMPT');

      if (hasMalpractice) status = 'MALPRACTICE';
      else if (allNotEntered) status = 'INCOMPLETE';
      else if (allAbsent) status = 'ABSENT';
      else if (hasExempt) status = 'EXEMPT';

      if (status !== 'COMPLETED') {
        subjectResults.push({
          classSubjectId: classSubject.id,
          subjectId: es.subjectId,
          subjectName: es.subject.name,
          totalScore: null,
          grade: status === 'MALPRACTICE' ? 'Y' : (status === 'ABSENT' ? 'X' : null),
          points: null,
          remarks: status,
          status
        });
        continue;
      }

      const totalScore = calculateSubjectTotal(records);
      let grade = null;
      let points = null;
      let remarks = null;
      
      try {
        const band = GradeScaleDAO.mapScoreToGrade(totalScore, gradeScale.bands);
        grade = band.grade;
        points = band.points;
        remarks = band.remarks;
      } catch {
        // Grade band might not be defined for this score
        remarks = 'No Grade Band';
      }

      subjectResults.push({
        classSubjectId: classSubject.id,
        subjectId: es.subjectId,
        subjectName: es.subject.name,
        totalScore,
        grade,
        points,
        remarks,
        status: 'COMPLETED'
      });
    }

    const overall = strategy.calculate(subjectResults);



    return {
      enrollment,
      subjectResults,
      overall,
      gradeScale,
      strategy
    };
  }

  /**
   * Atomically finalizes the term results for an enrollment.
   */
  static async finalizeTermResult(enrollmentId: string, termId: string, branchId: string, actorId: string, correctionReason?: string) {
    const preview = await this.previewFinalization(enrollmentId, termId, branchId);
    
    return prisma.$transaction(async (tx) => {
      // The schema says @@unique([enrollmentId, termId, version]). 
      // Let's find the max version currently.
      const existingResults = await tx.termResult.findMany({
        where: { enrollmentId, termId },
        orderBy: { version: 'desc' },
        take: 1
      });

      const nextVersion = existingResults.length > 0 ? existingResults[0].version + 1 : 1;

      // Ensure subjectIds are passed down from preview
      const termResult = await tx.termResult.create({
        data: {
          enrollmentId,
          termId,
          version: nextVersion,
          status: 'FINALIZED',
          totalScore: preview.overall.totalScore,
          aggregatePoints: preview.overall.aggregate,
          division: preview.overall.division,
          finalizedById: actorId,
          correctionReason,
          subjects: {
            create: preview.subjectResults.map(sr => ({
              subjectId: sr.subjectId, 
              score: sr.totalScore,
              grade: sr.grade,
              points: sr.points,
              remarks: sr.remarks
            }))
          }
        }
      });

      if (existingResults.length > 0) {
        await tx.termResult.update({
          where: { id: existingResults[0].id },
          data: {
            status: 'SUPERSEDED',
            supersededById: termResult.id
          }
        });
      }

      // Audit Logging
      // Because this is called from within a transaction, we log it after.
      // Or we can just log it using the Service which runs in its own connection.
      await AuditService.log(
        { userId: actorId, branchId, organizationId: '', schoolId: '', role: '', permissions: [] }, 
        "FINALIZE_TERM_RESULTS", 
        "TermResult", 
        termResult.id, 
        JSON.stringify({ termId, enrollmentId, version: nextVersion })
      );

      return termResult;
    });
  }
}
