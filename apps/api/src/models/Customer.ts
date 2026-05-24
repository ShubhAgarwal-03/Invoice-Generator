import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  customer_code?: string;
  customer_type: 'individual' | 'business';
  customer_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string; // Kept for backwards compatibility
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
  is_deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customer_code: { type: String, trim: true },
    customer_type: { type: String, enum: ['individual', 'business'], default: 'business' },
    customer_name: { type: String, required: true, trim: true },
    company_name: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    billing_address_1: { type: String, trim: true },
    billing_address_2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postal_code: { type: String, trim: true },
    country: { type: String, required: true },
    currency: { type: String, required: true },
    gstin: { type: String, trim: true },
    pan: { type: String, trim: true },
    registration_number: { type: String, trim: true },
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<ICustomer>('Customer', CustomerSchema);