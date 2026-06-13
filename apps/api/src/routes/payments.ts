import { Router, Request, Response } from 'express';
import Payment from '../models/Payment';
import Invoice from '../models/Invoice';

const router = Router();

// Recalculates amount_paid, balance_due, payment_status on the Invoice
// and returns the updated invoice. Call this after any payment mutation.
async function syncInvoicePaymentFields(invoice_id: string) {
  const payments = await Payment.find({ invoice_id });
  const amount_paid = parseFloat(
    payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
  );
  const invoice = await Invoice.findById(invoice_id);
  if (!invoice) return null;

  const balance_due = parseFloat((invoice.total - amount_paid).toFixed(2));
  let payment_status: 'unpaid' | 'partial' | 'paid';
  if (amount_paid <= 0) {
    payment_status = 'unpaid';
  } else if (balance_due <= 0) {
    payment_status = 'paid';
  } else {
    payment_status = 'partial';
  }

  return Invoice.findByIdAndUpdate(
    invoice_id,
    { amount_paid, balance_due, payment_status },
    { new: true }
  );
}

// GET /api/invoices/:id/payments
router.get('/:id/payments', async (req: Request, res: Response) => {
  try {
    const payments = await Payment.find({ invoice_id: req.params.id }).sort({ paid_at: -1 });
    res.json(payments);
  } catch {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/invoices/:id/payments  — record a new payment
router.post('/:id/payments', async (req: Request, res: Response) => {
  try {
    const { amount, method, paid_at, notes } = req.body;

    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    const validMethods = ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other'];
    if (!method || !validMethods.includes(method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const payment = await Payment.create({
      invoice_id: req.params.id,
      amount: parseFloat(Number(amount).toFixed(2)),
      method,
      paid_at: paid_at ? new Date(paid_at) : new Date(),
      notes: notes?.trim() || undefined,
    });

    const updatedInvoice = await syncInvoicePaymentFields(req.params.id);
    res.status(201).json({ payment, invoice: updatedInvoice });
  } catch {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

export { syncInvoicePaymentFields };
export default router;