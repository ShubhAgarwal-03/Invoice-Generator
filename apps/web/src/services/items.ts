import apiClient from './apiClient';
import { Item } from '@/types';

export const itemsService = {
  getAll: () => apiClient.get<Item[]>('/api/items').then(r => r.data),
  create: (data: Partial<Item>) => apiClient.post<Item>('/api/items', data).then(r => r.data),
  update: (id: string, data: Partial<Item>) => apiClient.put<Item>(`/api/items/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/api/items/${id}`).then(r => r.data),
};