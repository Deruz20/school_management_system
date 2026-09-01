"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createStudentAction } from "@/app/(dashboard)/students/actions";
import Link from "next/link";

export default function NewStudentForm() {
  const [state, formAction, isPending] = useActionState(createStudentAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
          {state.error}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="firstName" className="text-sm font-medium text-slate-700">First Name</label>
          <input 
            type="text" 
            id="firstName" 
            name="firstName" 
            required
            className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lastName" className="text-sm font-medium text-slate-700">Last Name</label>
          <input 
            type="text" 
            id="lastName" 
            name="lastName" 
            required
            className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>
      
      <div className="flex flex-col gap-1.5">
        <label htmlFor="admissionNo" className="text-sm font-medium text-slate-700">Admission Number</label>
        <input 
          type="text" 
          id="admissionNo" 
          name="admissionNo" 
          required
          className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
        <Link href="/students">
          <Button variant="outline" type="button" disabled={isPending}>Cancel</Button>
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Student"}
        </Button>
      </div>
    </form>
  );
}
