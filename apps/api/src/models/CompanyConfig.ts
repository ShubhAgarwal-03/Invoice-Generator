import mongoose, { Schema, Document } from 'mongoose';

export interface ICompanyConfig extends Document {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
}

const CompanyConfigSchema = new Schema<ICompanyConfig>({
  name: { type: String, required: true },
  address: String,
  email: String,
  phone: String,
  logo_url: String,
});

export default mongoose.model<ICompanyConfig>('CompanyConfig', CompanyConfigSchema);