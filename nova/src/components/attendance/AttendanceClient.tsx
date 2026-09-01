"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, CalendarDays } from "lucide-react";
import { saveAttendanceAction } from "@/app/(dashboard)/attendance/actions";

type ClassInfo = { id: string; name: string };
type StudentAttendance = { 
  id: string; 
  firstName: string; 
  lastName: string; 
  admissionNo: string;
  attendance: { status: string }[];
};

export default function AttendanceClient({ 
  classes, 
  students, 
  initialClassId, 
  initialDate 
}: { 
  classes: ClassInfo[];
  students: StudentAttendance[];
  initialClassId?: string;
  initialDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Local state to track attendance modifications before saving
  const [attendanceState, setAttendanceState] = useState<Record<string, string>>(() => {
    const initialState: Record<string, string> = {};
    students.forEach(s => {
      if (s.attendance && s.attendance.length > 0) {
        initialState[s.id] = s.attendance[0].status;
      }
    });
    return initialState;
  });

  const handleFilterChange = (classId: string, date: string) => {
    startTransition(() => {
      router.push(`/attendance?classId=${classId}&date=${date}`);
    });
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSave = async () => {
    if (!initialClassId) return;
    
    setIsSaving(true);
    setError(null);
    
    const records = Object.entries(attendanceState).map(([studentId, status]) => ({
      studentId,
      status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
    }));
    
    const result = await saveAttendanceAction(initialClassId, initialDate, records);
    setIsSaving(false);
    
    if (result.error) {
      setError(result.error);
    } else {
      // Success feedback could be a toast here
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="date" 
              defaultValue={initialDate}
              onChange={(e) => handleFilterChange(initialClassId || "", e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
            />
          </div>
          
          <select 
            value={initialClassId || ""}
            onChange={(e) => handleFilterChange(e.target.value, initialDate)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-w-[200px]"
          >
            {classes.length === 0 && <option value="">No classes found</option>}
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-b border-red-200 text-sm">
          {error}
        </div>
      )}
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student Name</TableHead>
            <TableHead className="w-[400px]">Attendance Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center py-8 text-slate-500">
                No students found for this class.
              </TableCell>
            </TableRow>
          ) : (
            students.map((student) => {
              const currentStatus = attendanceState[student.id];
              return (
                <TableRow key={student.id}>
                  <TableCell className="font-medium text-slate-900">
                    {student.firstName} {student.lastName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleStatusChange(student.id, 'PRESENT')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        currentStatus === 'PRESENT' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}>
                        <CheckCircle2 size={14} /> Present
                      </button>
                      <button 
                        onClick={() => handleStatusChange(student.id, 'LATE')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        currentStatus === 'LATE' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-500/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}>
                        <Clock size={14} /> Late
                      </button>
                      <button 
                        onClick={() => handleStatusChange(student.id, 'ABSENT')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        currentStatus === 'ABSENT' ? 'bg-red-100 text-red-700 ring-1 ring-red-500/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}>
                        <XCircle size={14} /> Absent
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
        <Button 
          type="button" 
          onClick={handleSave} 
          disabled={isSaving || isPending || students.length === 0 || Object.keys(attendanceState).length === 0}
        >
          {isSaving ? "Saving..." : "Save Attendance"}
        </Button>
      </div>
    </div>
  );
}
