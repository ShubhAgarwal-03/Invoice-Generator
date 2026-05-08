'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { invoicesService } from '@/services/invoices';
import { companyService } from '@/services/company';
import { Invoice, CompanyConfig, InvoiceStatus } from '@/types';
import { formatDate } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import { Loader2, Pencil, Download, Copy, Trash2, ArrowLeft } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
};

function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHundreds(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    return ones[Math.floor(n / 100)] + ' Hundred ' + convertHundreds(n % 100);
  }

  if (amount === 0) return 'Zero';
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  let result = '';
  if (intPart >= 10000000) { result += convertHundreds(Math.floor(intPart / 10000000)) + 'Crore '; }
  if (intPart >= 100000) { result += convertHundreds(Math.floor((intPart % 10000000) / 100000)) + 'Lakh '; }
  if (intPart >= 1000) { result += convertHundreds(Math.floor((intPart % 100000) / 1000)) + 'Thousand '; }
  result += convertHundreds(intPart % 1000);
  if (decPart > 0) result += 'and ' + convertHundreds(decPart) + 'Paise';

  return result.trim() + ' Only';
}

function getTaxBreakdown(items: Invoice['items'], country: string, isInterstate: boolean) {
  let totalTax = 0;
  items.forEach(item => {
    const base = item.quantity * item.unit_price;
    totalTax += base * (item.tax_percent / 100);
  });

  // For Indian invoices: IGST for interstate, CGST+SGST for intrastate
  // Default to IGST (interstate) — can be made configurable via invoice field later
  if (country === 'IN' && !isInterstate) {
    return { igst: 0, cgst: totalTax / 2, sgst: totalTax / 2 };
  }
  return { igst: totalTax, cgst: 0, sgst: 0 };
}

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
    // Use the existing toast library to provide immediate feedback
    const toastId = toast.info('Preparing your PDF... this may take a moment.');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
      
      const res = await fetch(`${apiUrl}/api/invoices/${id}/pdf`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
        // Render free tier can take up to 50 seconds to boot; 90s provides a safety margin
        signal: AbortSignal.timeout(90000), 
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('PDF Generation Error:', errorText);
        throw new Error(`Server returned ${res.status}`);
      }

      const blob = await res.blob();
      
      // Ensure we actually received a PDF and not an HTML error page
      if (blob.type !== 'application/pdf') {
        throw new Error('Invalid file format received');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      // Uses the invoice number from your state for the filename
      a.download = `${invoice?.invoice_number || 'invoice'}.pdf`; 
      
      document.body.appendChild(a);
      a.click();
      
      // Cleanup to prevent memory leaks
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success('Download started!', { id: toastId });
    } catch (err: any) {
      console.error('Download Error:', err);
      const isTimeout = err.name === 'TimeoutError';
      toast.error(
        isTimeout 
          ? 'The server is taking too long to wake up. Please try again in 10 seconds.' 
          : 'Failed to generate PDF. Please check your connection.',
        { id: toastId }
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );
  if (!invoice) return <div className="text-center py-20 text-slate-500">Invoice not found.</div>;

  const fmt = (n: number) => formatCurrency(n, invoice.customer_snapshot.currency, invoice.customer_snapshot.country);
  const taxBreakdown = getTaxBreakdown(invoice.items, invoice.customer_snapshot.country, invoice.is_interstate ?? true);

  return (
    <div className="max-w-5xl">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/invoices')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status !== 'sent' && (
            <button onClick={() => handleStatusChange('sent')} disabled={updatingStatus}
              className="px-3 py-1.5 text-sm border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50 cursor-pointer">
              Mark as Sent
            </button>
          )}
          {invoice.status !== 'paid' && (
            <button onClick={() => handleStatusChange('paid')} disabled={updatingStatus}
              className="px-3 py-1.5 text-sm border border-green-200 text-green-600 rounded-md hover:bg-green-50 disabled:opacity-50 cursor-pointer">
              Mark as Paid
            </button>
          )}
          <button onClick={handleDuplicate} disabled={duplicating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 disabled:opacity-50 cursor-pointer">
            {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Duplicate
          </button>
          <button onClick={() => router.push(`/invoices/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 cursor-pointer">
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button onClick={handleDownloadPdf} disabled={downloadingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
          <button onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 cursor-pointer">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {/* Invoice Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* Top color bar */}
        <div className="h-2 bg-blue-600" />

        <div className="p-8 space-y-8">

          {/* Header */}
          <div className="flex justify-between items-start">
          {/* Company */}
            <div className="space-y-1">
            {company?.logo_url ? (
            <img src={company.logo_url} alt="Logo" className="h-14 mb-3 object-contain" />
              ) : (
              /* Professional Placeholder Logo */
              <div className="h-14 w-14 mb-3 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-8 h-8"
                >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
               <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              )}
              <h2 className="text-xl font-bold text-slate-800">{company?.name || 'Your Company'}</h2>
              {company?.address && <p className="text-sm text-slate-500">{company.address}</p>}

              {company?.email && <p className="text-sm text-slate-500">{company.email}</p>}
              {company?.phone && <p className="text-sm text-slate-500">{company.phone}</p>}
              {company?.gstin && (
                <p className="text-xs text-slate-500 mt-1">
                  <span className="font-semibold">GSTIN:</span> {company.gstin}
                </p>
              )}
              {company?.pan && (
                <p className="text-xs text-slate-500">
                  <span className="font-semibold">PAN:</span> {company.pan}
                </p>
              )}
            </div>

            

            {/* Invoice meta */}
            <div className="text-right space-y-2">
              <div className="text-3xl font-bold text-blue-600">INVOICE</div>
              <div className="font-mono text-lg font-semibold text-slate-700">{invoice.invoice_number}</div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[invoice.status]}`}>
                {invoice.status}
              </span>
              <div className="text-sm text-slate-500 space-y-1 pt-1">
                <div className="flex justify-end gap-3">
                  <span className="text-slate-400">Issue Date:</span>
                  <span>{formatDate(invoice.issue_date)}</span>
                </div>
                <div className="flex justify-end gap-3">
                  <span className="text-slate-400">Due Date:</span>
                  <span>{formatDate(invoice.due_date)}</span>
                </div>
                <div className="flex justify-end gap-3">
                  <span className="text-slate-400">Currency:</span>
                  <span>{invoice.customer_snapshot.currency}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bill To + Ship To */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 rounded-lg p-5 border border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bill To</p>
              <p className="font-bold text-slate-800 text-base">{invoice.customer_snapshot.name}</p>
              {invoice.customer_snapshot.address && (
                <p className="text-sm text-slate-500 mt-1">{invoice.customer_snapshot.address}</p>
              )}
              {(invoice.customer_snapshot as any).phone && (
                <p className="text-sm text-slate-500">{(invoice.customer_snapshot as any).phone}</p>
              )}
              {invoice.customer_snapshot.email && (
                <p className="text-sm text-slate-500">{invoice.customer_snapshot.email}</p>
              )}
              {invoice.customer_snapshot.gstin && (
                <p className="text-xs text-slate-500 mt-2">
                  <span className="font-semibold">GSTIN:</span> {invoice.customer_snapshot.gstin}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Ship To</p>
              {invoice.shipping_address ? (
                <p className="text-sm text-slate-700">{invoice.shipping_address}</p>
            ) : (
              <>
              <p className="font-bold text-slate-800 text-base">{invoice.customer_snapshot.name}</p>
              <p className="text-sm text-slate-500 italic mt-1">
                  {invoice.customer_snapshot.address || 'Same as billing address'}
              </p>
            </>
          )}
          </div>
        </div>

          {/* Line Items Table */}
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="text-left px-3 py-3 text-xs font-semibold rounded-tl-md">#</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold">Description</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold">HSN/SAC</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold">Qty</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold">Unit Price</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold">Tax %</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold rounded-tr-md">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-3 text-slate-700">{item.description}</td>
                    <td className="px-3 py-3 text-slate-500 font-mono text-xs">
                      {(item as any).hsn_sac || '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-500">{item.quantity}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{fmt(item.unit_price)}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{item.tax_percent}%</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-700">{fmt(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals + Tax Breakdown */}
          <div className="space-y-4">

          {/* Totals summary — right aligned */}
          <div className="flex justify-end">
          <div className="w-72">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Summary</p>
          </div>
          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>{fmt(invoice.subtotal)}</span>
            </div>
            {taxBreakdown.igst > 0 && (
              <div className="flex justify-between text-slate-500 text-xs">
                <span>IGST</span><span>{fmt(taxBreakdown.igst)}</span>
              </div>
            )}
            {taxBreakdown.cgst > 0 && (
              <div className="flex justify-between text-slate-500 text-xs">
                <span>CGST</span><span>{fmt(taxBreakdown.cgst)}</span>
              </div>
            )}
            {taxBreakdown.sgst > 0 && (
              <div className="flex justify-between text-slate-500 text-xs">
                <span>SGST</span><span>{fmt(taxBreakdown.sgst)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Tax Total</span><span>{fmt(invoice.tax_total)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800 text-base">
              <span>Grand Total</span><span>{fmt(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

          {/* Amount in Words — full width, below Grand Total */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Amount in Words</p>
              <p className="text-sm text-slate-700 font-medium italic">
              {numberToWords(invoice.total)}
            </p>
          </div>

          {/* Bank Details — full width */}
          {(company?.bank_name || company?.account_number) && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Bank Details</p>
            <div className="text-xs text-slate-600 space-y-1">
              {company.bank_name && <p><span className="font-semibold">Bank:</span> {company.bank_name}</p>}
              {company.account_number && <p><span className="font-semibold">Account No:</span> {company.account_number}</p>}
              {company.ifsc_code && <p><span className="font-semibold">IFSC:</span> {company.ifsc_code}</p>}
              {company.branch && <p><span className="font-semibold">Branch:</span> {company.branch}</p>}
            </div>
          </div>
        )}
        </div>

          
          {/* Notes */}
          {invoice.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Notes</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          {/* Authorized Signatory */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <div className="text-center w-56">
              <div className="border-b border-slate-300 mb-2 pb-12" />
              <p className="text-xs font-semibold text-slate-500">Authorized Signatory</p>
              <p className="text-xs text-slate-400">{company?.name}</p>
            </div>
          </div>

        </div>
      </div>

      {/* Delete Dialog */}
      {deleteOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-2">Delete Invoice?</h2>
            <p className="text-slate-500 text-sm mb-6">
              Invoice <span className="font-mono font-medium">{invoice.invoice_number}</span> will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
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