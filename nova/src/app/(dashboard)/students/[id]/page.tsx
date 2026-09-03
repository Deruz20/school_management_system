import { requireAuth } from "@/lib/auth/require-auth";
import { StudentDAO } from "@/lib/dao/student.dao";
import { StudentProfileView } from "./student-profile-view";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function StudentProfilePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const ctx = await requireAuth();

  const student = await StudentDAO.getStudentById(ctx, id);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Link href="/students" className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <ArrowLeft size={16} />
          <span>Back to Students Directory</span>
        </Link>
      </div>

      <StudentProfileView student={student} />
    </div>
  );
}
