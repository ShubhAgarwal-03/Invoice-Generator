import apiClient from './apiClient';
import { CompanyConfig } from '@/types';

export const companyService = {
  get: () => apiClient.get<CompanyConfig>('/api/company').then(r => r.data),
  save: (data: CompanyConfig) => apiClient.post<CompanyConfig>('/api/company', data).then(r => r.data),
};