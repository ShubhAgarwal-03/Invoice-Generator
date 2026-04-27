'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { invoicesService } from '@/services/invoices';
import { companyService } from '@/services/company';
import { Invoice, CompanyConfig, InvoiceStatus } from '@/types';
import { formatDate } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import {
  Loader2, FileText, Pencil, Download,
  Copy, Trash2, ArrowLeft, Building2
} from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    Promise.all([invoicesService.getOne(id), companyService.get()])
      .then(([inv, co]) => { setInvoice(inv); setCompany(co); })
      .catch(() => toast.error('Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(status: InvoiceStatus) {
    if (!invoice) return;
    setUpdatingStatus(true);
    try {
      const updated = await invoicesService.updateStatus(id, status);
      setInvoice(updated);
      toast.success(`Status updated to ${status.charAt(0).toUpperCase() + status.slice(1)}.`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const dup = await invoicesService.duplicate(id);
      toast.success(`Invoice duplicated as ${dup.invoice_number}.`);
      router.push(`/invoices/${dup._id}/edit`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await invoicesService.delete(id);
      toast.success(`Invoice ${invoice?.invoice_number} deleted.`);
      router.push('/invoices');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    toast.info('Preparing your PDF…');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/api/invoices/${id}/pdf`
      );
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice?.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  if (!invoice) return (
    <div className="text-center py-20 text-slate-500">Invoice not found.</div>
  );

  const fmt = (n: number) => formatCurrency(n,
    invoice.customer_snapshot.currency,
    invoice.customer_snapshot.country
  );

  return (
    <div className="max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/invoices')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </button>
        <div className="flex items-center gap-2">
          {/* Status toggles */}
          {invoice.status !== 'sent' && (
            <button onClick={() => handleStatusChange('sent')} disabled={updatingStatus}
              className="px-3 py-1.5 text-sm border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50">
              Mark as Sent
            </button>
          )}
          {invoice.status !== 'paid' && (
            <button onClick={() => handleStatusChange('paid')} disabled={updatingStatus}
              className="px-3 py-1.5 text-sm border border-green-200 text-green-600 rounded-md hover:bg-green-50 disabled:opacity-50">
              Mark as Paid
            </button>
          )}
          <button onClick={handleDuplicate} disabled={duplicating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 disabled:opacity-50">
            {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Duplicate
          </button>
          <button onClick={() => router.push(`/invoices/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600">
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button onClick={handleDownloadPdf} disabled={downloadingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
          <button onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {/* Invoice card */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-8">

        {/* Header — company + invoice meta */}
        <div className="flex justify-between items-start">
          <div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Logo" className="h-12 mb-3 object-contain" />
            )}
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-800 text-lg">{company?.name || 'Your Company'}</span>
            </div>
            {company?.address && <p className="text-sm text-slate-500">{company.address}</p>}
            {company?.email && <p className="text-sm text-slate-500">{company.email}</p>}
            {company?.phone && <p className="text-sm text-slate-500">{company.phone}</p>}
          </div>

          <div className="text-right">
            <div className="flex items-center gap-3 justify-end mb-2">
              <span className="font-mono text-2xl font-bold text-slate-800">
                {invoice.invoice_number}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[invoice.status]}`}>
                {invoice.status}
              </span>
            </div>
            <div className="text-sm text-slate-500 space-y-1">
              <p><span className="text-slate-400">Issue date:</span> {formatDate(invoice.issue_date)}</p>
              <p><span className="text-slate-400">Due date:</span> {formatDate(invoice.due_date)}</p>
              <p><span className="text-slate-400">Currency:</span> {invoice.customer_snapshot.currency}</p>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="border-t border-slate-100 pt-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Bill To</p>
          <p className="font-semibold text-slate-800">{invoice.customer_snapshot.name}</p>
          {invoice.customer_snapshot.email && (
            <p className="text-sm text-slate-500">{invoice.customer_snapshot.email}</p>
          )}
          {invoice.customer_snapshot.address && (
            <p className="text-sm text-slate-500">{invoice.customer_snapshot.address}</p>
          )}
          {invoice.customer_snapshot.gstin && (
            <p className="text-sm text-slate-500">GSTIN: {invoice.customer_snapshot.gstin}</p>
          )}
        </div>

        {/* Line Items */}
        <div className="border-t border-slate-100 pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {['Description', 'Qty', 'Unit Price', 'Tax %', 'Total'].map(h => (
                  <th key={h} className={`py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide
                    ${h === 'Total' || h === 'Unit Price' || h === 'Tax %' || h === 'Qty' ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 text-slate-700">{item.description}</td>
                  <td className="py-3 text-right text-slate-500">{item.quantity}</td>
                  <td className="py-3 text-right text-slate-500">{fmt(item.unit_price)}</td>
                  <td className="py-3 text-right text-slate-500">{item.tax_percent}%</td>
                  <td className="py-3 text-right font-medium text-slate-700">{fmt(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax</span><span>{fmt(invoice.tax_total)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-2">
              <span>Total</span><span>{fmt(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Delete dialog */}
      {deleteOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-2">Delete Invoice?</h2>
            <p className="text-slate-500 text-sm mb-6">
              Invoice <span className="font-mono font-medium">{invoice.invoice_number}</span> will
              be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}