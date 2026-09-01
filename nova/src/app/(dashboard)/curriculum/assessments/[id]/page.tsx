import { requireAuth } from "@/lib/auth/require-auth";
import { AssessmentDAO } from "@/lib/dao/assessment.dao";
import { MarkDAO } from "@/lib/dao/mark.dao";
import MarkEntryClient from "@/components/curriculum/MarkEntryClient";
import Link from "next/link";

export default async function MarkEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenantCtx = await requireAuth();
  const { id } = await params;

  const assessment = await AssessmentDAO.getAssessment(tenantCtx, id);
  const eligibleMarks = await MarkDAO.getEligibleMarksForAssessment(tenantCtx, id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="text-sm text-slate-500 mb-1">
            <Link href="/curriculum/assessments" className="text-indigo-600 hover:underline">Assessments</Link> 
            {" > "} {assessment.term.name} {" > "} {assessment.classSubject.classRef.name} {" > "} {assessment.classSubject.subject.name}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{assessment.name}</h1>
          <p className="text-slate-500 mt-1">
            Max Score: {assessment.maxScore} | Weight: {assessment.weight}%
          </p>
        </div>
      </div>
      
      <MarkEntryClient 
        assessment={assessment}
        initialMarks={eligibleMarks}
      />
    </div>
  );
}
