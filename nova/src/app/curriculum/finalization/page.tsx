import { db as prisma } from '@/lib/db';
import { FinalizationClient } from '@/components/curriculum/FinalizationClient';

export const metadata = {
  title: 'Result Finalization | NOVA',
};

export default async function FinalizationPage() {
  const branchId = 'br_pilot_1'; // Hardcoded for pilot

  // Get active terms
  const terms = await prisma.term.findMany({
    where: { academicYear: { branchId } },
    include: { academicYear: true },
    orderBy: { startDate: 'desc' }
  });

  // Get classes
  const classes = await prisma.class.findMany({
    where: { branchId },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Result Finalization</h1>
        <p className="text-gray-500 mt-2">
          Lock and publish term results for students. Once finalized, results become immutable historical records.
        </p>
      </div>

      <FinalizationClient 
        terms={terms}
        classes={classes}
      />
    </div>
  );
}
