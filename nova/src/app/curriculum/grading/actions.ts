'use server';

import { GradeScaleDAO, CreateGradeScaleInput } from '@/lib/dao/grade-scale.dao';
import { revalidatePath } from 'next/cache';

export async function createGradeScale(data: CreateGradeScaleInput) {
  try {
    const scale = await GradeScaleDAO.createGradeScale(data);
    revalidatePath('/curriculum/grading');
    return { success: true, data: scale };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) || 'Failed to create grade scale' };
  }
}
