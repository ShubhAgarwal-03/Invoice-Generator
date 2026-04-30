'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { invoicesService } from '@/services/invoices';
import { customersService } from '@/services/customers';
import { itemsService } from '@/services/items';
import { Customer, Item, Invoice, InvoiceStatus } from '@/types';
import { formatCurrency } from '@/utils/currency';
import { Loader2, Plus, Trash2, FileText, X, ArrowLeft } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
  tax_percent: string;
}

const today = new Date().toISOString().split('T')[0];

const emptyLine = (): LineItem => ({
  description: '', 
  quantity: '1', 
  unit_price: '0', 
  tax_percent: '0'
});

const COUNTRIES = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' }, { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'UAE' },
];

const STATUS_OPTIONS: InvoiceStatus[] = ['draft', 'sent', 'paid'];

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '', email: '', phone: '', address: '', country: 'IN', gstin: ''
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({
    name: '', description: '', unit_price: '', tax_percent: '0'
  });
  const [savingItem, setSavingItem] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      try {
        const [inv, allCustomers, allItems] = await Promise.all([
          invoicesService.getOne(id),
          customersService.getAll(),
          itemsService.getAll(),
        ]);

        if (!isMounted) return;

        setInvoice(inv);
        setCustomers(allCustomers);
        setItems(allItems);

        // Pre-fill form
        setCustomerId(inv.customer_id);
        setIssueDate(inv.issue_date.split('T')[0]);
        setDueDate(inv.due_date ? inv.due_date.split('T')[0] : '');
        setStatus(inv.status);
        setNotes(inv.notes ?? '');
        setLineItems(inv.items.map(l => ({
          description: l.description,
          quantity: String(l.quantity),
          unit_price: String(l.unit_price),
          tax_percent: String(l.tax_percent),
        })));

        const found = allCustomers.find(cu => cu._id === inv.customer_id);
        setSelectedCustomer(found ?? null);
      } catch (err) {
        toast.error('Failed to load invoice');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialData();
    return () => { isMounted = false; };
  }, [id]);

  useEffect(() => {
    const c = customers.find(c => c._id === customerId) ?? null;
    setSelectedCustomer(c);
  }, [customerId, customers]);

  // Calculations
  function calcLine(line: LineItem) {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.unit_price) || 0;
    const tax = parseFloat(line.tax_percent) || 0;
    const base = qty * price;
    const taxAmt = base * (tax / 100);
    return { base, taxAmt, total: base + taxAmt };
  }

  const subtotal = lineItems.reduce((s, l) => s + calcLine(l).base, 0);
  const taxTotal = lineItems.reduce((s, l) => s + calcLine(l).taxAmt, 0);
  const grandTotal = subtotal + taxTotal;

  const currency = selectedCustomer?.currency ?? invoice?.customer_snapshot.currency ?? 'USD';
  const country = selectedCustomer?.country ?? invoice?.customer_snapshot.country ?? 'US';
  const fmt = (n: number) => formatCurrency(n, currency, country);

  // Handlers
  function updateLine(index: number, field: keyof LineItem, value: string) {
    setLineItems(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function addLine() { setLineItems(prev => [...prev, emptyLine()]); }

  function removeLine(index: number) {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  }

  function fillFromItem(index: number, itemId: string) {
    const item = items.find(i => i._id === itemId);
    if (!item) return;
    setLineItems(prev => prev.map((l, i) => i === index ? {
      ...l,
      description: item.description ?? item.name,
      unit_price: String(item.unit_price),
      tax_percent: String(item.tax_percent),
    } : l));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!customerId) e.customer = 'Please select a customer';
    if (!issueDate) e.issueDate = 'Issue date is required';
    if (dueDate && dueDate < today) e.dueDate = 'Due date must be today or a future date';
    
    lineItems.forEach((l, i) => {
      if (!l.description.trim()) e[`desc_${i}`] = 'Required';
      if (!l.quantity || parseFloat(l.quantity) < 0.01) e[`qty_${i}`] = 'Min 0.01';
      if (parseFloat(l.tax_percent) > 99) e[`tax_${i}`] = 'Max 99%';
    });
    
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        issue_date: new Date(issueDate).toISOString(),
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        status,
        notes: notes.trim(),
        items: lineItems.map(l => ({
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          tax_percent: Number(l.tax_percent),
        })),
      };

      await invoicesService.update(id, payload as any);
      toast.success('Invoice updated successfully');
      router.push(`/invoices/${id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerForm.name.trim()) { toast.error('Name is required'); return; }
    setSavingCustomer(true);
    try {
      const created = await customersService.create(customerForm);
      setCustomers(prev => [created, ...prev]);
      setCustomerId(created._id);
      setShowCustomerModal(false);
      setCustomerForm({ name: '', email: '', phone: '', address: '', country: 'IN', gstin: '' });
      toast.success('Customer saved.');
    } catch {
      toast.error('Failed to create customer');
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemForm.name.trim() || !itemForm.unit_price) {
      toast.error('Name and price are required'); return;
    }
    setSavingItem(true);
    try {
      const created = await itemsService.create({
        name: itemForm.name,
        description: itemForm.description,
        unit_price: parseFloat(itemForm.unit_price),
        tax_percent: parseFloat(itemForm.tax_percent) || 0,
      });
      setItems(prev => [created, ...prev]);
      setShowItemModal(false);
      setItemForm({ name: '', description: '', unit_price: '', tax_percent: '0' });
      toast.success('Item saved.');
    } catch {
      toast.error('Failed to create item');
    } finally {
      setSavingItem(false);
    }
  }

  const inputClass = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all";
  const errorClass = "text-red-500 text-xs mt-0.5";

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-slate-500 text-sm animate-pulse">Loading invoice details...</p>
    </div>
  );

  if (!invoice) return (
    <div className="text-center py-20 text-slate-500">Invoice not found.</div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => router.push(`/invoices/${id}`)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Edit {invoice.invoice_number}
            </h1>
            <p className="text-slate-500 text-sm">Update the details for this invoice</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Top Section: Customer & Dates */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1">
              <label className="text-sm font-semibold text-slate-700">Customer *</label>
              <div className="flex gap-2 mt-1.5">
                <select 
                  value={customerId} 
                  onChange={e => setCustomerId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                <button 
                  type="button" 
                  onClick={() => setShowCustomerModal(true)}
                  className="shrink-0 p-2 border border-slate-200 rounded-md hover:bg-slate-50 text-blue-600"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {errors.customer && <p className={errorClass}>{errors.customer}</p>}
              {selectedCustomer && (
                <div className="mt-3 p-3 bg-blue-50/50 rounded-lg text-xs text-slate-600 space-y-1 border border-blue-100">
                  <p className="font-semibold text-blue-700">{selectedCustomer.name}</p>
                  <p>{selectedCustomer.email}</p>
                  <p className="pt-1 font-medium">Currency: {selectedCustomer.currency}</p>
                </div>
              )}
            </div>

            <div>
            <label className="text-sm font-medium text-slate-700">
            Issue Date <span className="text-red-500">*</span>
            </label>
            <input 
              type="date" 
              value={issueDate}
              readOnly
              className={`${inputClass} mt-1 bg-slate-50 cursor-not-allowed text-slate-500`} 
            />
          <p className="text-xs text-slate-400 mt-0.5">Issue date cannot be changed</p>
        </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Due Date</label>
              <input 
                type="date" 
                value={dueDate}
                min={today}
                onChange={e => setDueDate(e.target.value)}
                className={`${inputClass} mt-1`} 
              />
            {errors.dueDate && <p className={errorClass}>{errors.dueDate}</p>}
          </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Status</label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value as InvoiceStatus)}
                className={`${inputClass} mt-1.5 capitalize`}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-slate-800">Line Items</h2>
            <button 
              type="button" 
              onClick={() => setShowItemModal(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Add New to Catalogue
            </button>
          </div>

          <div className="space-y-4">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              <div className="col-span-2">Catalogue</div>
              <div className="col-span-4">Description</div>
              <div className="col-span-1">Qty</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-1">Tax %</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>

            {lineItems.map((line, i) => {
              const { total } = calcLine(line);
              return (
                <div key={i} className="grid grid-cols-12 gap-3 items-start p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="col-span-12 md:col-span-2">
                    <select 
                      onChange={e => fillFromItem(i, e.target.value)}
                      defaultValue=""
                      className={inputClass}
                    >
                      <option value="">Pick item...</option>
                      {items.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
                    </select>
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <input 
                      value={line.description}
                      onChange={e => updateLine(i, 'description', e.target.value)}
                      placeholder="Line item description"
                      className={inputClass} 
                    />
                    {errors[`desc_${i}`] && <p className={errorClass}>{errors[`desc_${i}`]}</p>}
                  </div>

                  <div className="col-span-4 md:col-span-1">
                    <input 
                      type="number" 
                      value={line.quantity} 
                      min="1" 
                      onChange={e => updateLine(i, 'quantity', e.target.value)}
                      className={inputClass} 
                    />
                  </div>

                  <div className="col-span-4 md:col-span-2">
                    <input 
                      type="number" 
                      value={line.unit_price} 
                      step="0.01"
                      onChange={e => updateLine(i, 'unit_price', e.target.value)}
                      className={inputClass} 
                    />
                  </div>

                  <div className="col-span-4 md:col-span-1">
                    <input 
                      type="number" 
                      value={line.tax_percent} 
                      onChange={e => updateLine(i, 'tax_percent', e.target.value)}
                      className={inputClass} 
                    />
                  </div>

                  <div className="col-span-10 md:col-span-1 flex items-center justify-end h-10">
                    <span className="text-sm font-bold text-slate-700">{fmt(total)}</span>
                  </div>

                  <div className="col-span-2 md:col-span-1 flex items-center justify-center h-10">
                    <button 
                      type="button" 
                      onClick={() => removeLine(i)}
                      disabled={lineItems.length === 1}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-0 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button 
            type="button" 
            onClick={addLine}
            className="mt-6 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-bold"
          >
            <Plus className="w-4 h-4" /> Add Another Line
          </button>

          {/* Totals Summary */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
            <div className="w-full max-w-xs space-y-3">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Tax Total</span>
                <span>{fmt(taxTotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-lg pt-3 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-blue-600">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <label className="font-bold text-slate-800 block mb-3">Invoice Notes</label>
          <textarea 
            value={notes} 
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional details (e.g. Bank Account details, T&C)..."
            rows={4}
            className={`${inputClass} resize-none`} 
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end items-center gap-4">
          <button 
            type="button" 
            onClick={() => router.push(`/invoices/${id}`)}
            className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={saving}
            className="bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>

      {/* Customer Modal Implementation (same UI as you had, but ensures state updates correctly) */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-slate-800">New Customer</h2>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Customer Name *</label>
                <input 
                  autoFocus
                  value={customerForm.name}
                  onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))}
                  className={`${inputClass} mt-1`} placeholder="e.g. Acme Corp" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                  <input 
                    value={customerForm.email}
                    onChange={e => setCustomerForm(p => ({ ...p, email: e.target.value }))}
                    className={`${inputClass} mt-1`} placeholder="contact@acme.com" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Country</label>
                  <select 
                    value={customerForm.country}
                    onChange={e => setCustomerForm(p => ({ ...p, country: e.target.value }))}
                    className={`${inputClass} mt-1`}
                  >
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowCustomerModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingCustomer}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingCustomer ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal Implementation */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Add to Catalogue</h2>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Item Name *</label>
                <input 
                  autoFocus
                  value={itemForm.name}
                  onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))}
                  className={`${inputClass} mt-1`} placeholder="e.g. Consulting Fee" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Unit Price *</label>
                  <input 
                    type="number"
                    value={itemForm.unit_price}
                    onChange={e => setItemForm(p => ({ ...p, unit_price: e.target.value }))}
                    className={`${inputClass} mt-1`} placeholder="0.00" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Default Tax %</label>
                  <input 
                    type="number"
                    value={itemForm.tax_percent}
                    onChange={e => setItemForm(p => ({ ...p, tax_percent: e.target.value }))}
                    className={`${inputClass} mt-1`} placeholder="0" 
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowItemModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingItem}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingItem ? 'Saving...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}