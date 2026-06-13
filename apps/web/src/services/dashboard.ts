import apiClient from './apiClient';

export interface DashboardKPIs {
  total_revenue: number;
  revenue_this_month: number;
  total_outstanding: number;
  overdue_amount: number;
  overdue_count: number;
  total_invoices: number;
  draft_count: number;
  sent_count: number;
  paid_count: number;
}

export interface ChartPoint {
  month: string;
  revenue: number;
  count: number;
}

export interface TopCustomer {
  customer_id: string;
  name: string;
  total_invoiced: number;
  total_paid: number;
  invoice_count: number;
}

export interface DashboardSummary {
  kpis: DashboardKPIs;
  chart: ChartPoint[];
  top_customers: TopCustomer[];
}

export const dashboardService = {
  getSummary: () =>
    apiClient.get<DashboardSummary>('/api/dashboard/summary').then(r => r.data),
};