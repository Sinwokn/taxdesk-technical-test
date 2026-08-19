export interface VatCategorySummary {
  vatRate: number;
  transactionCount: number;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface MoneyTotals {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface VatReport {
  reportId: string;
  sourceFileName: string;
  generatedAtUtc: string;
  transactionCount: number;
  dateFrom: string;
  dateTo: string;
  categories: VatCategorySummary[];
  totals: MoneyTotals;
}

export interface ValidationError {
  row: number | null;
  field: string;
  message: string;
}

export interface ApiError {
  title: string;
  status?: number;
  errors?: ValidationError[];
}
