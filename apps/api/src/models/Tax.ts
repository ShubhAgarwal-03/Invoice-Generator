import mongoose, { Schema, Document } from 'mongoose';

export interface ITax extends Document {
  tax_id: string;
  name: string;
  percent: number;
  is_deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaxSchema = new Schema<ITax>(
  {
    tax_id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<ITax>('Tax', TaxSchema);
