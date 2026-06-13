import apiClient from './apiClient';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card' | 'other';

export interface Payment {
  _id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  notes?: string;
  createdAt: string;
}

export interface RecordPaymentPayload {
  amount: number;
  method: PaymentMethod;
  paid_at?: string;
  notes?: string;
}

export const paymentsService = {
  getForInvoice: (invoiceId: string) =>
    apiClient.get<Payment[]>(`/api/invoices/${invoiceId}/payments`).then(r => r.data),

  record: (invoiceId: string, payload: RecordPaymentPayload) =>
    apiClient
      .post<{ payment: Payment; invoice: import('@/types').Invoice }>(
        `/api/invoices/${invoiceId}/payments`,
        payload
      )
      .then(r => r.data),
};