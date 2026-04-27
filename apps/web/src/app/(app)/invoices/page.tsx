'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { invoicesService } from '@/services/invoices';
import { Invoice, InvoiceStatus } from '@/types';
import { formatDate } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import {
  Loader2, FileText, Plus, MoreVertical,
  Search, X, ChevronLeft, ChevronRight
} from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [filters, setFilters] = useState({ status: '', from: '', to: '', search: '' });
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteNumber, setDeleteNumber] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await invoicesService.getAll({ ...filters, page, limit: pagination.limit });
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => { fetchInvoices(1); }, [filters]);

  // Close menu on outside click
  useEffect(() => {
    function handleClick() { setActiveMenu(null); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  function handleFilterChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function clearFilters() {
    setFilters({ status: '', from: '', to: '', search: '' });
  }

  const hasFilters = Object.values(filters).some(v => v !== '');

  async function handleStatusChange(id: string, status: InvoiceStatus) {
    try {
      const updated = await invoicesService.updateStatus(id, status);
      setInvoices(prev => prev.map(inv => inv._id === id ? updated : inv));
      toast.success(`Status updated to ${status.charAt(0).toUpperCase() + status.slice(1)}.`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setActiveMenu(null);
  }

  async function handleDuplicate(id: string) {
    try {
      const dup = await invoicesService.duplicate(id);
      toast.success(`Invoice duplicated as ${dup.invoice_number}.`);
      fetchInvoices(pagination.page);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setActiveMenu(null);
  }

  function confirmDelete(inv: Invoice) {
    setDeleteId(inv._id);
    setDeleteNumber(inv.invoice_number);
    setActiveMenu(null);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await invoicesService.delete(deleteId);
      setInvoices(prev => prev.filter(inv => inv._id !== deleteId));
      toast.success(`Invoice ${deleteNumber} deleted.`);
      setDeleteId(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const inputClass = "border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-slate-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Invoices</h1>
            <p className="text-slate-500 text-sm">{pagination.total} total</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/invoices/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search invoice # or customer..."
              className={`${inputClass} pl-9 w-full`}
            />
          </div>

          {/* Status */}
          <select name="status" value={filters.status} onChange={handleFilterChange}
            className={inputClass}>
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>

          {/* From */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">From</label>
            <input type="date" name="from" value={filters.from}
              onChange={handleFilterChange} className={inputClass} />
          </div>

          {/* To */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">To</label>
            <input type="date" name="to" value={filters.to}
              onChange={handleFilterChange} className={inputClass} />
          </div>

          {/* Clear */}
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50">
              <X className="w-4 h-4" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-12 h-12 text-slate-300 mb-4" />
          {hasFilters ? (
            <>
              <p className="text-slate-500 font-medium">No invoices match your current filters.</p>
              <p className="text-slate-400 text-sm mb-4">Try adjusting your search.</p>
              <button onClick={clearFilters}
                className="text-blue-600 text-sm hover:underline">Clear filters</button>
            </>
          ) : (
            <>
              <p className="text-slate-500 font-medium">No invoices yet.</p>
              <p className="text-slate-400 text-sm mb-4">Click 'New Invoice' to create your first one.</p>
              <button onClick={() => router.push('/invoices/new')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
                New Invoice
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Invoice #', 'Customer', 'Issue Date', 'Due Date', 'Total', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <tr key={inv._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/invoices/${inv._id}`)}
                      className="font-mono text-blue-600 hover:underline font-medium">
                      {inv.invoice_number}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{inv.customer_snapshot.name}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.issue_date)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.due_date)}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">
                    {formatCurrency(inv.total, inv.customer_snapshot.currency, inv.customer_snapshot.country)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === inv._id ? null : inv._id); }}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenu === inv._id && (
                      <div className="absolute right-4 top-10 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-44 py-1"
                        onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => router.push(`/invoices/${inv._id}`)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          View
                        </button>
                        <button
                          onClick={() => router.push(`/invoices/${inv._id}/edit`)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          Edit
                        </button>
                        {inv.status !== 'sent' && (
                          <button
                            onClick={() => handleStatusChange(inv._id, 'sent')}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            Mark as Sent
                          </button>
                        )}
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => handleStatusChange(inv._id, 'paid')}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            Mark as Paid
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(inv._id)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          Duplicate
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={() => confirmDelete(inv)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.pages} — {pagination.total} invoices
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchInvoices(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => fetchInvoices(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-2">Delete Invoice?</h2>
            <p className="text-slate-500 text-sm mb-6">
              Invoice <span className="font-mono font-medium">{deleteNumber}</span> will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)}
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