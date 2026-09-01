'use server';

import { ReportDTOBuilder } from '../dto/report.dto';
import { JiddahReportClient, RenderReportResponse } from './jiddah-client';
import { db as prisma } from '../db';

export async function renderReportAction(termResultId: string): Promise<RenderReportResponse> {
  try {
    // 1. Build the DTO
    const dto = await ReportDTOBuilder.buildForTermResult(termResultId);
    
    // 2. Fetch tenant details and determine class context
    const termResult = await prisma.termResult.findUniqueOrThrow({
      where: { id: termResultId },
      include: {
        enrollment: {
          include: {
            classRef: {
              include: {
                branch: {
                  include: {
                    school: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const school = termResult.enrollment.classRef.branch.school;
    const tenant = {
      id: school.id,
      name: school.name,
      // Optional: add motto/logo if added to schema in the future
    };

    const className = termResult.enrollment.classRef.name.toLowerCase();
    
    let reportType: 'nursery' | 'lower_primary' | 'upper_primary' = 'lower_primary';
    if (className.includes('baby') || className.includes('middle') || className.includes('top') || className.includes('nursery')) {
      reportType = 'nursery';
    } else if (className.includes('p.1') || className.includes('p.2') || className.includes('p.3') || className.includes('p.4')) { // p.4 is usually upper, but let's say upper is 5-7. Or 4-7. 
       // Often in Uganda lower primary is P1-P3. 
       reportType = className.includes('p.4') ? 'upper_primary' : 'lower_primary';
    } else if (className.includes('p.5') || className.includes('p.6') || className.includes('p.7')) {
      reportType = 'upper_primary';
    } else {
      reportType = 'upper_primary'; // default fallback for older students
    }

    const client = new JiddahReportClient();
    
    // For now we assume EOT and no theology for testing
    const result = await client.renderReport(
      dto,
      tenant,
      { reportType, scoreType: 'eot', hasTheology: false }
    );

    if (!result.success) {
      let details = '';
      try {
        details = JSON.stringify(result.error);
      } catch {
        details = String(result.error);
      }
      return { success: false, error: `Jiddah API error: ${details}` };
    }

    return result;

  } catch (error) {
    const e = error as Error;
    console.error('Render Action Error:', e);
    return { success: false, error: e.message || 'Unknown error' };
  }
}
