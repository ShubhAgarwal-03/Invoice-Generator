export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface Tax {
  _id: string;
  tax_id: string;
  name: string;
  percent: number;
}

export interface Customer {
  _id: string;
  customer_code?: string;
  customer_type: 'individual' | 'business';
  customer_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  currency: string;
  gstin?: string;
  pan?: string;
  registration_number?: string;
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
  hsn_sac?: string;
}

export interface LineItemTax {
  tax_id?: string;
  name: string;
  percent: number;
  tax_amount: number;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  taxes: LineItemTax[];
  line_total: number;
  hsn_sac?: string; 
}

export interface CustomerSnapshot {
  _id: string;
  customer_code?: string;
  customer_type: 'individual' | 'business';
  customer_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  gstin?: string;
  pan?: string;
  registration_number?: string;
  country: string;
  currency: string;
}

export interface Invoice {
  _id: string;
  invoice_number: string;
  po_so_number?: string;
  customer_id: string;
  customer_snapshot: CustomerSnapshot;
  status: InvoiceStatus;
  issue_date: string;
  due_date?: string;
  items: LineItem[];
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_total: number;
  total: number;
  shipping_address?: string | null;
  is_interstate?: boolean;
  notes?: string;
  tax_exempt?: boolean;
  payment_terms?: string;
  terms_and_conditions?: string;
  auto_payment_reminder?: boolean;
  created_by?: string;
  createdAt: string;
}

export interface CompanyConfig {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
  gstin?: string;
  pan?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch?: string;
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