import apiClient from './apiClient';
import { Customer, LedgerResponse } from '@/types';

export const customersService = {
  getAll: () => apiClient.get<Customer[]>('/api/customers').then(r => r.data),
  getOne: (id: string) => apiClient.get<Customer>(`/api/customers/${id}`).then(r => r.data),
  create: (data: Partial<Customer>) => apiClient.post<Customer>('/api/customers', data).then(r => r.data),
  update: (id: string, data: Partial<Customer>) => apiClient.put<Customer>(`/api/customers/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/api/customers/${id}`).then(r => r.data),

  getLedger: (id: string) =>  apiClient.get<LedgerResponse>(`/api/customers/${id}/ledger`).then(r => r.data),
  getStatementPdfUrl: (id: string): string =>    `${apiClient.defaults.baseURL}/api/customers/${id}/statement/pdf`,
};
