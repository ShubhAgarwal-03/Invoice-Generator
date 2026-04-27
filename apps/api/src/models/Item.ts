import mongoose, { Schema, Document } from 'mongoose';

export interface IItem extends Document {
  name: string;
  description?: string;
  unit_price: number;
  tax_percent: number;
  is_deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<IItem>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    unit_price: { type: Number, required: true, min: 0 },
    tax_percent: { type: Number, required: true, min: 0, max: 99, default: 0 },
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IItem>('Item', ItemSchema);