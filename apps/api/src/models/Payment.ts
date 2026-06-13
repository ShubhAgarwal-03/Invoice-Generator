import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card' | 'other';

export interface IPayment extends Document {
  invoice_id: mongoose.Types.ObjectId;
  amount: number;
  method: PaymentMethod;
  paid_at: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other'],
      required: true,
    },
    paid_at: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model<IPayment>('Payment', PaymentSchema);