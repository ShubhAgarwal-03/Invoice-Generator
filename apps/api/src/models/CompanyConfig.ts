import mongoose, { Schema, Document } from 'mongoose';

const CompanyConfigSchema = new Schema<ICompanyConfig>({
  name: { type: String, required: true },
  address: String,
  email: String,
  phone: String,
  logo_url: String,
  gstin: String,
  pan: String,
  bank_name: String,
  account_number: String,
  ifsc_code: String,
  branch: String,
});

export interface ICompanyConfig extends Document {
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



export default mongoose.model<ICompanyConfig>('CompanyConfig', CompanyConfigSchema);