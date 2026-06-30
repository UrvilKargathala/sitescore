export interface ScanJobData {
  scanId: string;
  url: string;
}

export interface CategoryScores {
  performance: number;
  seo: number;
  security: number;
  accessibility: number;
  mobile: number;
}

export type ScanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL";

export interface ReportJobData {
  leadId: string;
  scanId: string;
}
