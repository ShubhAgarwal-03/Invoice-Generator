export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface Customer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  country: string;
  currency: string;
  gstin?: string;
  createdAt: string;
}


export interface Item {
  _id: string;
  name: string;
  description?: string;
  unit_price: number;
  tax_percent: number;
  unit_of_measure?: string;
  item_type?: 'simple' | 'compound';
  currency?: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  line_total: number;
}

export interface CustomerSnapshot {
  _id: string;
  name: string;
  email?: string;
  address?: string;
  gstin?: string;
  country: string;
  currency: string;
}

export interface Invoice {
  _id: string;
  invoice_number: string;
  customer_id: string;
  customer_snapshot: CustomerSnapshot;
  status: InvoiceStatus;
  issue_date: string;
  due_date?: string;
  items: LineItem[];
  subtotal: number;
  tax_total: number;
  total: number;
  notes?: string;
  createdAt: string;
}

export interface CompanyConfig {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: PaginationMeta;
}