"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { StudentDAO } from "@/lib/dao/student.dao";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const studentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  admissionNo: z.string().min(1, "Admission number is required"),
});

export async function createStudentAction(prevState: unknown, formData: FormData) {
  try {
    const tenantCtx = await requireAuth();
    
    const data = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      admissionNo: formData.get("admissionNo") as string,
    };
    
    const parsed = studentSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    await StudentDAO.createStudent(tenantCtx, parsed.data);
    
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return { error: "A student with this admission number already exists." };
    }
    return { error: (error as Error).message || "An unexpected error occurred." };
  }
  
  revalidatePath("/students");
  redirect("/students");
}
