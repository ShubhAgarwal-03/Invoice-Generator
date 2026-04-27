import apiClient from './apiClient';
import { Invoice, InvoiceListResponse, InvoiceStatus } from '@/types';

export interface InvoiceFilters {
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const invoicesService = {
  getAll: (filters: InvoiceFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.append(k, String(v));
    });
    return apiClient.get<InvoiceListResponse>(`/api/invoices?${params}`).then(r => r.data);
  },
  getOne: (id: string) => apiClient.get<Invoice>(`/api/invoices/${id}`).then(r => r.data),
  create: (data: Partial<Invoice>) => apiClient.post<Invoice>('/api/invoices', data).then(r => r.data),
  update: (id: string, data: Partial<Invoice>) => apiClient.put<Invoice>(`/api/invoices/${id}`, data).then(r => r.data),
  updateStatus: (id: string, status: InvoiceStatus) => apiClient.patch<Invoice>(`/api/invoices/${id}/status`, { status }).then(r => r.data),
  duplicate: (id: string) => apiClient.post<Invoice>(`/api/invoices/${id}/duplicate`).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/api/invoices/${id}`).then(r => r.data),
};