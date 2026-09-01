import { ReportDTO } from '../dto/report.dto';

interface JiddahClientConfig {
  baseUrl: string;
  apiSecret: string;
}

export interface RenderReportResponse {
  success: boolean;
  html?: string;
  error?: string;
  details?: unknown;
}

export class JiddahReportClient {
  private config: JiddahClientConfig;

  constructor() {
    const baseUrl = process.env.JIDDAH_URL || 'http://localhost:3001';
    const apiSecret = process.env.JIDDAH_API_SECRET || 'dev_secret';
    
    this.config = {
      baseUrl,
      apiSecret
    };
  }

  async renderReport(
    dto: ReportDTO,
    tenant: { id: string; name: string; motto?: string; logoUrl?: string },
    context: { reportType: 'nursery' | 'lower_primary' | 'upper_primary', scoreType: 'mot' | 'eot', hasTheology: boolean }
  ): Promise<RenderReportResponse> {
    
    const payload = {
      version: '2.0',
      tenant,
      context,
      data: {
        termResultId: dto.termResultId,
        student: dto.student,
        academic: dto.academic,
        performance: dto.performance,
        // Assuming we are splitting them here, but for now we pass all as circular unless marked otherwise.
        // In a real scenario, theology subjects need to be explicitly parsed.
        circularSubjects: dto.subjects, 
        theologySubjects: [] // TODO: Extract from dto.subjects if theology exists
      }
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v2/render-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiSecret}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let details = response.statusText;
        try {
           const body = await response.json();
           details = JSON.stringify(body);
        } catch { /* ignore */ }
        return { success: false, error: `Invalid payload or server error: ${response.status} - ${details}` };
      }

      const result = await response.json();
      return {
        success: true,
        html: result.html
      };

    } catch (err) {
      const e = err as Error;
      return {
        success: false,
        error: e.message || 'Unknown error'
      };
    }
  }
}
