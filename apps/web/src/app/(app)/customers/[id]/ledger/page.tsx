'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, BookOpen, ArrowLeft, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { customersService, LedgerRow, LedgerSummary } from '@/services/customers';
import { Customer } from '@/types';
import { formatDate } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';

export default function CustomerLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    customersService
      .getLedger(id)
      .then(data => {
        setCustomer(data.customer);
        setRows(data.rows);
        setSummary(data.summary);
      })
      .catch(() => toast.error('Failed to load ledger'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const url = customersService.getStatementPdfUrl(id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${customer?.customer_name ?? id}.pdf`;
      a.click();
    } catch {
      toast.error('Failed to download statement');
    } finally {
      setDownloading(false);
    }
  }

  const fmt = (n: number) =>
    summary ? formatCurrency(n, summary.currency, summary.country) : String(n);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!customer || !summary) {
    return (
      <div className="text-center py-20 text-slate-500">Customer not found.</div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <BookOpen className="w-5 h-5 text-slate-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Account Ledger</h1>
            <p className="text-slate-500 text-sm">{customer.customer_name}</p>
          </div>
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {downloading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Download className="w-4 h-4" />}
          Download Statement
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Invoiced</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{fmt(summary.total_invoiced)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-green-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Paid</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{fmt(summary.total_paid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Minus className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Balance Due</span>
          </div>
          <p className={`text-2xl font-bold ${summary.closing_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {fmt(summary.closing_balance)}
          </p>
        </div>
      </div>

      {/* Ledger table */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No transactions yet.</p>
          <p className="text-slate-400 text-sm">Invoices and payments for this customer will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Date', 'Description', 'Invoice #', 'Debit', 'Credit', 'Balance'].map(h => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${
                      ['Debit', 'Credit', 'Balance'].includes(h) ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`hover:bg-slate-50 transition-colors ${row.type === 'payment' ? 'bg-green-50/30' : ''}`}
                >
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.description}</td>
                  <td className="px-4 py-3">
                    {row.invoice_id ? (
                      <button
                        onClick={() => router.push(`/invoices/${row.invoice_id}`)}
                        className="font-mono text-blue-600 hover:underline text-xs cursor-pointer"
                      >
                        {row.invoice_number}
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.debit > 0 ? (
                      <span className="font-medium text-red-600">{fmt(row.debit)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.credit > 0 ? (
                      <span className="font-medium text-green-600">{fmt(row.credit)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${row.balance > 0 ? 'text-slate-800' : 'text-green-600'}`}>
                      {fmt(row.balance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Closing balance footer */}
            <tfoot>
              <tr className="bg-slate-800">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-white">
                  Closing Balance
                </td>
                <td className={`px-4 py-3 text-right text-sm font-bold ${summary.closing_balance > 0 ? 'text-red-300' : 'text-green-300'}`}>
                  {fmt(summary.closing_balance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}