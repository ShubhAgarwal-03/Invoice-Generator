import apiClient from './apiClient';
import { Customer } from '@/types';

export const customersService = {
  getAll: () => apiClient.get<Customer[]>('/api/customers').then(r => r.data),
  getOne: (id: string) => apiClient.get<Customer>(`/api/customers/${id}`).then(r => r.data),
  create: (data: Partial<Customer>) => apiClient.post<Customer>('/api/customers', data).then(r => r.data),
  update: (id: string, data: Partial<Customer>) => apiClient.put<Customer>(`/api/customers/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/api/customers/${id}`).then(r => r.data),
};