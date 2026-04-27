import mongoose, { Schema, Document } from 'mongoose';

export interface ILineItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  line_total: number;
}

export interface ICustomerSnapshot {
  _id: string;
  name: string;
  email?: string;
  address?: string;
  gstin?: string;
  country: string;
  currency: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface IInvoice extends Document {
  invoice_number: string;
  customer_id: mongoose.Types.ObjectId;
  customer_snapshot: ICustomerSnapshot;
  status: InvoiceStatus;
  issue_date: Date;
  due_date?: Date;
  items: ILineItem[];
  subtotal: number;
  tax_total: number;
  total: number;
  notes?: string;
  is_deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema<ILineItem>({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  unit_price: { type: Number, required: true, min: 0 },
  tax_percent: { type: Number, required: true, min: 0, max: 99 },
  line_total: { type: Number, required: true },
}, { _id: false });

const CustomerSnapshotSchema = new Schema<ICustomerSnapshot>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  email: String,
  address: String,
  gstin: String,
  country: { type: String, required: true },
  currency: { type: String, required: true },
}, { _id: false });

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoice_number: { type: String, required: true, unique: true },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customer_snapshot: { type: CustomerSnapshotSchema, required: true },
    status: { type: String, enum: ['draft', 'sent', 'paid'], default: 'draft' },
    issue_date: { type: Date, required: true },
    due_date: { type: Date },
    items: { type: [LineItemSchema], required: true },
    subtotal: { type: Number, required: true },
    tax_total: { type: Number, required: true },
    total: { type: Number, required: true },
    notes: { type: String },
    is_deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);