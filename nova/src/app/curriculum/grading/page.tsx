import { GradeScaleClient } from '@/components/curriculum/GradeScaleClient';
import { GradeScaleDAO } from '@/lib/dao/grade-scale.dao';

export const metadata = {
  title: 'Grade Scales | NOVA',
};

export default async function GradeScalesPage() {
  const branchId = 'br_pilot_1'; // Hardcoded for pilot
  const scales = await GradeScaleDAO.listGradeScales(branchId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Grade Scales</h1>
        <p className="text-gray-500 mt-2">
          Manage grading scales and grade bands for academic evaluation.
        </p>
      </div>

      <GradeScaleClient initialScales={scales} branchId={branchId} />
    </div>
  );
}
