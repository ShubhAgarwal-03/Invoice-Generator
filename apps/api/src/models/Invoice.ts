import mongoose, { Schema, Document } from 'mongoose';

export interface ILineItemTax {
  tax_id?: string;
  name: string;
  percent: number;
  tax_amount: number;
}

export interface ILineItem {
  description: string;
  quantity: number;
  unit_price: number;
  taxes: ILineItemTax[];
  line_total: number;
  hsn_sac?: string;
}

export interface ICustomerSnapshot {
  _id: string;
  customer_code?: string;
  customer_type: 'individual' | 'business';
  customer_name: string;
  company_name?: string;
  email?: string;
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
  phone?: string;
  ship_to?: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface IInvoice extends Document {
  invoice_number: string;
  po_so_number?: string;
  customer_id: mongoose.Types.ObjectId;
  customer_snapshot: ICustomerSnapshot;
  status: InvoiceStatus;
  issue_date: Date;
  due_date?: Date;
  items: ILineItem[];
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_total: number;
  total: number;
  amount_paid?: number;
  balance_due?: number;
  payment_status?: 'unpaid' | 'partial' | 'paid';
  notes?: string;
  shipping_address?: string | null;
  is_interstate: boolean;
  tax_exempt?: boolean;
  payment_terms?: string;
  terms_and_conditions?: string;
  auto_payment_reminder?: boolean;
  created_by?: string;
  is_deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LineItemTaxSchema = new Schema<ILineItemTax>({
  tax_id: { type: String },
  name: { type: String, required: true },
  percent: { type: Number, required: true, min: 0, max: 100 },
  tax_amount: { type: Number, required: true },
}, { _id: false });

const LineItemSchema = new Schema<ILineItem>({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unit_price: { type: Number, required: true, min: 0 },
  taxes: { type: [LineItemTaxSchema], default: [] },
  line_total: { type: Number, required: true },
  hsn_sac: { type: String },
}, { _id: false });

const CustomerSnapshotSchema = new Schema<ICustomerSnapshot>({
  _id: { type: String, required: true },
  customer_code: { type: String },
  customer_type: { type: String, enum: ['individual', 'business'], default: 'business' },
  customer_name: { type: String, required: true },
  company_name: { type: String },
  email: String,
  address: String,
  billing_address_1: String,
  billing_address_2: String,
  city: String,
  state: String,
  postal_code: String,
  gstin: String,
  pan: String,
  registration_number: String,
  country: { type: String, required: true },
  currency: { type: String, required: true },
  phone: String,
}, { _id: false });

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoice_number: { type: String, required: true, unique: true },
    po_so_number: { type: String },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customer_snapshot: { type: CustomerSnapshotSchema, required: true },
    status: { type: String, enum: ['draft', 'sent', 'paid'], default: 'draft' },
    issue_date: { type: Date, required: true },
    due_date: { type: Date },
    items: { type: [LineItemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount_percent: { type: Number, min: 0, max: 100 },
    discount_amount: { type: Number, min: 0 },
    tax_total: { type: Number, required: true },
    total: { type: Number, required: true },
    amount_paid:    { type: Number, default: 0 },
    balance_due:    { type: Number },
    payment_status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    notes: { type: String },
    shipping_address: { type: String, default: null },
    is_interstate: { type: Boolean, default: true },
    tax_exempt: { type: Boolean, default: false },
    payment_terms: { type: String },
    terms_and_conditions: { type: String },
    auto_payment_reminder: { type: Boolean, default: false },
    created_by: { type: String },
    is_deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);