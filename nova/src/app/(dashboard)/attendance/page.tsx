import { requireAuth } from "@/lib/auth/require-auth";
import { AttendanceDAO } from "@/lib/dao/attendance.dao";
import AttendanceClient from "@/components/attendance/AttendanceClient";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string }>;
}) {
  const tenantCtx = await requireAuth();
  
  const params = await searchParams;
  
  // Default to today
  const defaultDate = new Date().toISOString().split('T')[0];
  const dateStr = params.date || defaultDate;
  const selectedDate = new Date(dateStr);
  
  const classes = await AttendanceDAO.getClasses(tenantCtx);
  
  const classId = params.classId || (classes.length > 0 ? classes[0].id : undefined);
  
    let studentsWithAttendance: Awaited<ReturnType<typeof AttendanceDAO.getStudentsWithAttendance>> = [];
  if (classId) {
    studentsWithAttendance = await AttendanceDAO.getStudentsWithAttendance(tenantCtx, classId, selectedDate);
  }
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Attendance</h1>
          <p className="text-slate-500 mt-1">Record and monitor student attendance across classes.</p>
        </div>
      </div>
      
      <AttendanceClient 
        classes={classes}
        students={studentsWithAttendance}
        initialClassId={classId}
        initialDate={dateStr}
      />
    </div>
  );
}
