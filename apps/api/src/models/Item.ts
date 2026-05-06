
import mongoose, { Schema, Document } from 'mongoose';

export interface IItem extends Document {
  name: string;
  description?: string;
  unit_price: number;
  tax_percent: number;
  unit_of_measure?: string;
  item_type: 'simple' | 'compound';
  currency?: string;
  is_deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  hsn_sac: { type: String, trim: true };
}


const ItemSchema = new Schema<IItem>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    unit_price: { type: Number, required: true, min: 0 },
    tax_percent: { type: Number, required: true, min: 0, max: 99, default: 0 },
    unit_of_measure: { type: String, trim: true },
    item_type: { type: String, enum: ['simple', 'compound'], default: 'simple' },
    currency: { type: String, trim: true },
    is_deleted: { type: Boolean, default: false },
    hsn_sac: { type: String, trim: true }, 
  },
  { timestamps: true }
);

export default mongoose.model<IItem>('Item', ItemSchema);