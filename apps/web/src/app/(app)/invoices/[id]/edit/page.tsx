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
  hsn_sac: string;
}

const today = new Date().toISOString().split('T')[0];

const emptyLine = (): LineItem => ({
  description: '',
  quantity: '1',
  unit_price: '0',
  tax_percent: '0',
  hsn_sac: '',
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
  const [differentShipping, setDifferentShipping] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [isInterstate, setIsInterstate] = useState(true);

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
        setCustomerId(inv.customer_id);
        setIssueDate(inv.issue_date.split('T')[0]);
        setDueDate(inv.due_date ? inv.due_date.split('T')[0] : '');
        setStatus(inv.status);
        setNotes(inv.notes ?? '');
        if (inv.shipping_address) {
          setDifferentShipping(true);
          setShippingAddress(inv.shipping_address);
        }
        setIsInterstate(inv.is_interstate ?? true);
        setLineItems(inv.items.map(l => ({
          description: l.description,
          quantity: String(l.quantity),
          unit_price: String(l.unit_price),
          tax_percent: String(l.tax_percent),
          hsn_sac: l.hsn_sac ?? '',
        })));
        const found = allCustomers.find(cu => cu._id === inv.customer_id);
        setSelectedCustomer(found ?? null);
      } catch {
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
      hsn_sac: item.hsn_sac ?? '',
    } : l));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!customerId) e.customer = 'Please select a customer';
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
    if (!validate()) { toast.error('Please fix validation errors'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        issue_date: new Date(issueDate).toISOString(),
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        status,
        shipping_address: differentShipping && shippingAddress.trim() ? shippingAddress.trim() : null,
        notes: notes.trim(),
        is_interstate: isInterstate,
        items: lineItems.map(l => ({
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          tax_percent: Number(l.tax_percent),
          hsn_sac: l.hsn_sac.trim() || undefined,
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

  const inputClass = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";
  const errorClass = "text-red-500 text-xs mt-0.5";

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-slate-500 text-sm">Loading invoice...</p>
    </div>
  );

  if (!invoice) return (
    <div className="text-center py-20 text-slate-500">Invoice not found.</div>
  );

  return (
    <div className="max-w-5xl pb-20">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button type="button" onClick={() => router.push(`/invoices/${id}`)}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
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

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Invoice Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            {/* Customer */}
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-700">
                Customer <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mt-1">
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className={inputClass}>
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowCustomerModal(true)}
                  className="shrink-0 p-2 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-500 cursor-pointer">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {errors.customer && <p className={errorClass}>{errors.customer}</p>}
              {selectedCustomer && (
                <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-500 space-y-0.5">
                  {selectedCustomer.email && <p>{selectedCustomer.email}</p>}
                  {selectedCustomer.address && <p>{selectedCustomer.address}</p>}
                  <p className="font-medium text-slate-600">
                    Currency: <span className="text-blue-600">{selectedCustomer.currency}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Issue Date */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input type="date" value={issueDate} readOnly
                className={`${inputClass} mt-1 bg-slate-50 cursor-not-allowed text-slate-400`} />
              <p className="text-xs text-slate-400 mt-0.5">Cannot be changed</p>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-sm font-medium text-slate-700">Due Date</label>
              <input type="date" value={dueDate} min={today}
                onChange={e => setDueDate(e.target.value)}
                className={`${inputClass} mt-1`} />
              {errors.dueDate && <p className={errorClass}>{errors.dueDate}</p>}
            </div>

            {/* Status */}
            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as InvoiceStatus)}
                className={`${inputClass} mt-1`}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700">Line Items</h2>
            <button type="button" onClick={() => setShowItemModal(true)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer">
              <Plus className="w-3 h-3" /> New Item
            </button>
          </div>

          {/* Currency warning */}
          {selectedCustomer && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-4">
              ⚠ Prices are in <strong>{selectedCustomer.currency}</strong>. Item catalogue prices will be treated as {selectedCustomer.currency}.
            </p>
          )}

          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-2">
            <div className="col-span-2">Catalogue</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2">HSN/SAC</div>
            <div className="col-span-1">Qty</div>
            <div className="col-span-1">Price</div>
            <div className="col-span-1">Tax %</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-3">
            {lineItems.map((line, i) => {
              const { total } = calcLine(line);
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">

                  {/* Catalogue */}
                  <div className="col-span-12 md:col-span-2">
                    <select onChange={e => fillFromItem(i, e.target.value)}
                      defaultValue="" className={inputClass}>
                      <option value="">Pick item...</option>
                      {items.map(item => (
                        <option key={item._id} value={item._id}>{item.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="col-span-12 md:col-span-3">
                    <input value={line.description}
                      onChange={e => updateLine(i, 'description', e.target.value)}
                      placeholder="Description" className={inputClass} />
                    {errors[`desc_${i}`] && <p className={errorClass}>{errors[`desc_${i}`]}</p>}
                  </div>

                  {/* HSN/SAC */}
                  <div className="col-span-12 md:col-span-2">
                    <input value={line.hsn_sac}
                      onChange={e => updateLine(i, 'hsn_sac', e.target.value)}
                      placeholder="HSN/SAC" className={inputClass} />
                  </div>

                  {/* Qty */}
                  <div className="col-span-4 md:col-span-1">
                    <input type="number" value={line.quantity} min="1"
                      onChange={e => updateLine(i, 'quantity', e.target.value)}
                      placeholder="1" className={inputClass} />
                    {errors[`qty_${i}`] && <p className={errorClass}>{errors[`qty_${i}`]}</p>}
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-4 md:col-span-1">
                    <input type="number" value={line.unit_price} step="0.01"
                      onChange={e => updateLine(i, 'unit_price', e.target.value)}
                      placeholder="0.00" className={inputClass} />
                  </div>

                  {/* Tax % */}
                  <div className="col-span-3 md:col-span-1">
                    <input type="number" value={line.tax_percent} min="0" max="99"
                      onChange={e => updateLine(i, 'tax_percent', e.target.value)}
                      placeholder="0" className={inputClass} />
                    {errors[`tax_${i}`] && <p className={errorClass}>{errors[`tax_${i}`]}</p>}
                  </div>

                  {/* Line Total */}
                  <div className="col-span-1 flex items-center justify-end">
                    <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                      {fmt(total)}
                    </span>
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex items-center justify-center">
                    <button type="button" onClick={() => removeLine(i)}
                      disabled={lineItems.length === 1}
                      className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

          <button type="button" onClick={addLine}
            className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
            <Plus className="w-4 h-4" /> Add Line
          </button>

          {/* Totals */}
          <div className="mt-6 border-t border-slate-200 pt-4 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax</span><span>{fmt(taxTotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-2">
                <span>Total</span><span>{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700">Shipping Address</h2>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={differentShipping}
                onChange={e => {
                  setDifferentShipping(e.target.checked);
                  if (!e.target.checked) setShippingAddress('');
                }}
                className="rounded border-slate-300 cursor-pointer" />
              Different from billing address
            </label>
          </div>
          {differentShipping ? (
            <input value={shippingAddress} onChange={e => setShippingAddress(e.target.value)}
              placeholder="Enter shipping address..."
              className={inputClass} />
          ) : (
            <p className="text-sm text-slate-400 italic">
              {selectedCustomer?.address || 'Same as billing address'}
            </p>
          )}
        </div>

        {/* Tax Type */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-3">Tax Type</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={isInterstate}
              onChange={e => setIsInterstate(e.target.checked)}
              className="rounded border-slate-300 cursor-pointer" />
            Interstate supply (IGST) — uncheck for intrastate (CGST + SGST)
          </label>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">Notes</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Payment terms, bank details, or any other notes..."
            rows={3}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push(`/invoices/${id}`)}
            className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>

      </form>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">New Customer</h2>
              <button onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Name *</label>
                <input value={customerForm.name}
                  onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))}
                  className={`${inputClass} mt-1`} placeholder="John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input value={customerForm.email}
                    onChange={e => setCustomerForm(p => ({ ...p, email: e.target.value }))}
                    className={`${inputClass} mt-1`} placeholder="john@example.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input value={customerForm.phone}
                    onChange={e => setCustomerForm(p => ({ ...p, phone: e.target.value }))}
                    className={`${inputClass} mt-1`} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Address</label>
                <input value={customerForm.address}
                  onChange={e => setCustomerForm(p => ({ ...p, address: e.target.value }))}
                  className={`${inputClass} mt-1`} placeholder="123 Main St, City" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Country *</label>
                  <select value={customerForm.country}
                    onChange={e => setCustomerForm(p => ({ ...p, country: e.target.value }))}
                    className={`${inputClass} mt-1`}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">GSTIN</label>
                  <input value={customerForm.gstin}
                    onChange={e => setCustomerForm(p => ({ ...p, gstin: e.target.value }))}
                    className={`${inputClass} mt-1`} placeholder="22AAAAA0000A1Z5" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={savingCustomer}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                  {savingCustomer && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">New Item</h2>
              <button onClick={() => setShowItemModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Name *</label>
                <input value={itemForm.name}
                  onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))}
                  className={`${inputClass} mt-1`} placeholder="Web Design" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <input value={itemForm.description}
                  onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))}
                  className={`${inputClass} mt-1`} placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Unit Price *</label>
                  <input type="number" value={itemForm.unit_price} min="0" step="0.01"
                    onChange={e => setItemForm(p => ({ ...p, unit_price: e.target.value }))}
                    className={`${inputClass} mt-1`} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Tax %</label>
                  <input type="number" value={itemForm.tax_percent} min="0" max="99"
                    onChange={e => setItemForm(p => ({ ...p, tax_percent: e.target.value }))}
                    className={`${inputClass} mt-1`} placeholder="0" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={savingItem}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                  {savingItem && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}