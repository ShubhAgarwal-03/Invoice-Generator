'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CreditCard, Plus, X } from 'lucide-react';
import { paymentsService, Payment, PaymentMethod } from '@/services/payments';
import { Invoice } from '@/types';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

const PAYMENT_STATUS_BADGE = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
};

interface Props {
  invoice: Invoice;
  onInvoiceUpdate: (updated: Invoice) => void;
}

export default function PaymentPanel({ invoice, onInvoiceUpdate }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    method: 'bank_transfer' as PaymentMethod,
    paid_at: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const fmt = (n: number) =>
    formatCurrency(n, invoice.customer_snapshot.currency, invoice.customer_snapshot.country);

  useEffect(() => {
    paymentsService
      .getForInvoice(invoice._id)
      .then(setPayments)
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setLoading(false));
  }, [invoice._id]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const balance = invoice.balance_due ?? invoice.total;
    if (amount > balance + 0.1) {
      toast.error(`Amount exceeds balance due (${fmt(balance)})`);
      return;
    }
    setSubmitting(true);
    try {
      const { payment, invoice: updatedInvoice } = await paymentsService.record(invoice._id, {
        amount,
        method: form.method,
        paid_at: form.paid_at || undefined,
        notes: form.notes || undefined,
      });
      setPayments(prev => [payment, ...prev]);
      onInvoiceUpdate(updatedInvoice);
      setForm({ amount: '', method: 'bank_transfer', paid_at: new Date().toISOString().split('T')[0], notes: '' });
      setShowForm(false);
      toast.success(`Payment of ${fmt(amount)} recorded.`);
    } catch {
      toast.error('Failed to record payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const paymentStatus = invoice.payment_status ?? 'unpaid';
  const amountPaid = invoice.amount_paid ?? 0;
  const balanceDue = (invoice.amount_paid ?? 0) === 0 && (invoice.balance_due ?? 0) === 0
  ? invoice.total
  : (invoice.balance_due ?? invoice.total);

  const inputClass =
    'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <CreditCard className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-800 text-sm">Payments</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PAYMENT_STATUS_BADGE[paymentStatus]}`}>
            {paymentStatus}
          </span>
        </div>
        {paymentStatus !== 'paid' && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Record Payment'}
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50">
        <div className="px-6 py-3">
          <p className="text-xs text-slate-400 mb-0.5">Invoice total</p>
          <p className="text-sm font-semibold text-slate-800">{fmt(invoice.total)}</p>
        </div>
        <div className="px-6 py-3">
          <p className="text-xs text-slate-400 mb-0.5">Amount paid</p>
          <p className="text-sm font-semibold text-green-600">{fmt(amountPaid)}</p>
        </div>
        <div className="px-6 py-3">
          <p className="text-xs text-slate-400 mb-0.5">Balance due</p>
          <p className={`text-sm font-semibold ${balanceDue > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {fmt(balanceDue)}
          </p>
        </div>
      </div>

      {/* Record payment form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="px-6 py-4 border-b border-slate-100 bg-blue-50/40">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Amount <span className="text-slate-400">(max {fmt(balanceDue)})</span>
              </label>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
              <select name="method" value={form.method} onChange={handleChange} className={inputClass}>
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map(m => (
                  <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input
                name="paid_at"
                type="date"
                value={form.paid_at}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
              <input
                name="notes"
                type="text"
                placeholder="Reference number, remarks…"
                value={form.notes}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Payment
            </button>
          </div>
        </form>
      )}

      {/* Payment history */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No payments recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p._id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-slate-700">{fmt(p.amount)}</span>
                    <span className="text-xs text-slate-400 ml-2">{METHOD_LABELS[p.method]}</span>
                    {p.notes && <span className="text-xs text-slate-400 ml-2">· {p.notes}</span>}
                  </div>
                </div>
                <span className="text-xs text-slate-400">{formatDate(p.paid_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}