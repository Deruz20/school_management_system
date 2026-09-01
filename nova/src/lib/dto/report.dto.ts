import { db as prisma } from '../db';

export interface SubjectResultDTO {
  subjectName: string;
  subjectCode: string;
  score: number | null;
  grade: string | null;
  points: number | null;
  remarks: string | null;
}

export interface ReportDTO {
  termResultId: string;
  student: {
    name: string;
    admissionNo: string;
  };
  academic: {
    termName: string;
    academicYearName: string;
    className: string;
    streamName?: string;
  };
  performance: {
    totalScore: number | null;
    aggregatePoints: number | null;
    division: string | null;
    position: number | null;
    totalStudents: number | null;
    classTeacherComment: string | null;
    headTeacherComment: string | null;
    conductRemark: string | null;
  };
  subjects: SubjectResultDTO[];
}

export class ReportDTOBuilder {
  static async buildForTermResult(termResultId: string): Promise<ReportDTO> {
    const result = await prisma.termResult.findUniqueOrThrow({
      where: { id: termResultId },
      include: {
        enrollment: {
          include: {
            student: true,
            classRef: true,
            streamRef: true,
            academicYear: true
          }
        },
        term: true,
        subjects: {
          include: {
            subject: true
          }
        }
      }
    });

    const dto: ReportDTO = {
      termResultId: result.id,
      student: {
        name: `${result.enrollment.student.firstName} ${result.enrollment.student.lastName}`,
        admissionNo: result.enrollment.student.admissionNo
      },
      academic: {
        termName: result.term.name,
        academicYearName: result.enrollment.academicYear.name,
        className: result.enrollment.classRef.name,
        streamName: result.enrollment.streamRef?.name
      },
      performance: {
        totalScore: result.totalScore,
        aggregatePoints: result.aggregatePoints,
        division: result.division,
        position: result.position,
        totalStudents: result.totalStudents,
        classTeacherComment: result.classTeacherComment,
        headTeacherComment: result.headTeacherComment,
        conductRemark: result.conductRemark,
      },
      subjects: result.subjects.map(sub => ({
        subjectName: sub.subject.name,
        subjectCode: sub.subject.code,
        score: sub.score,
        grade: sub.grade,
        points: sub.points,
        remarks: sub.remarks
      }))
    };

    return dto;
  }
}
