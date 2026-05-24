'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { invoicesService } from '@/services/invoices';
import { customersService } from '@/services/customers';
import { itemsService } from '@/services/items';
import { taxService } from '@/services/taxes';
import { Customer, Item, Invoice, InvoiceStatus, Tax } from '@/types';
import { formatCurrency } from '@/utils/currency';
import { Loader2, Plus, Trash2, X, ArrowLeft, GripVertical, UserPlus, Users }
from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface LineTax {
  tax_id?: string;
  name: string;
  percent: number;
  amount: number;
}
interface LineItem {
  description: string;
  sub_description: string;
  quantity: string;
  unit_price: string;
  taxes: LineTax[];
  taxSlots: number[];
  hsn_sac: string;
}
// ── Constants ────────────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];
const emptyLine = (): LineItem => ({
  description: '',
  sub_description: '',
  quantity: '1',
  unit_price: '0',
  taxes: [],
  taxSlots: [0],
  hsn_sac: '',
});
const COUNTRIES = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' }, { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'UAE' },
  { code: 'BR', name: 'Brazil' }, { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' }, { code: 'KE', name: 'Kenya' },
];
const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },

  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
];
const STATUS_OPTIONS: InvoiceStatus[] = ['draft', 'sent', 'paid'];
// ── Helpers ──────────────────────────────────────────────────────────────────
function calcLine(line: LineItem) {
  const qty = parseFloat(line.quantity) || 0;
  const price = parseFloat(line.unit_price) || 0;
  const base = qty * price;
  let taxTotal = 0;
  const updatedTaxes = line.taxes.map(t => {
    const amount = base * (t.percent / 100);
    taxTotal += amount;
    return { ...t, amount };
  });
  return { base, taxTotal, updatedTaxes };
}
// ── Page ─────────────────────────────────────────────────────────────────────
export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [globalTaxes, setGlobalTaxes] = useState<Tax[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer |
null>(null);

## `// Form fields` 

  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [discountAdded, setDiscountAdded] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [taxExempt, setTaxExempt] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [poSoNumber, setPoSoNumber] = useState('');

  // Customer modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalStep, setCustomerModalStep] = useState<'choice' | 'new' |
'existing'>('choice');
  const [existingCustomerId, setExistingCustomerId] = useState('');
  const [customerForm, setCustomerForm] = useState({
    customer_code: '', customer_type: 'business', customer_name: '',
company_name: '',
    email: '', phone: '', billing_address_1: '', billing_address_2: '', city:
'', state: '', postal_code: '',

    country: 'IN', currency: 'INR', gstin: '', pan: '', registration_number: '',
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  // Tax modal
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxForm, setTaxForm] = useState({ name: '', percent: '' });
  const [savingTax, setSavingTax] = useState(false);
  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [inv, allCustomers, allItems, allTaxes] = await Promise.all([
          invoicesService.getOne(id),
          customersService.getAll(),
          itemsService.getAll(),
          taxService.getAll().catch(() => []),
        ]);
        if (!mounted) return;
        setInvoice(inv);
        setCustomers(allCustomers);
        setItems(allItems);
        setGlobalTaxes(allTaxes);
        setCustomerId(inv.customer_id);
        setIssueDate(inv.issue_date.split('T')[0]);
        setDueDate(inv.due_date ? inv.due_date.split('T')[0] : '');
        setStatus(inv.status);
        setNotes(inv.notes ?? '');
        setPoSoNumber(inv.po_so_number ?? '');
        setPaymentTerms(inv.payment_terms ?? '');
        setTermsAndConditions(inv.terms_and_conditions ?? '');
        setTaxExempt(inv.tax_exempt ?? false);
        if (inv.discount_percent) {
          setDiscountAdded(true);
          setDiscountPercent(String(inv.discount_percent));
        }
        // Map saved items back to local LineItem shape.
        // description may be "ItemName\nsubtitle" — split so the catalogue <select> matches.
        setLineItems(inv.items.map(l => {
          const [mainDesc, ...rest] = l.description.split('\n');
          return {
            description: mainDesc,          // matches item.name in the catalogue
            sub_description: rest.join('\n'),
            quantity: String(l.quantity),
            unit_price: String(l.unit_price),
            taxes: l.taxes.map(t => ({ tax_id: t.tax_id, name: t.name, percent: t.percent, amount: t.tax_amount })),
            taxSlots: [],  // taxes already applied, no open slot needed
            hsn_sac: l.hsn_sac ?? '',
          };
        }));
        const found = allCustomers.find(c => c._id === inv.customer_id) ?? null;
        setSelectedCustomer(found);
      } catch {
        toast.error('Failed to load invoice');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id]);
  // selectedCustomer is set directly in the load effect and via customer modal.
  // We only re-sync if the user manually changes the dropdown (not on initial load).
  useEffect(() => {
    if (!customerId) return;
    const found = customers.find(c => c._id === customerId);
    if (found) setSelectedCustomer(found);
  }, [customerId, customers]);
  // ── Derived ───────────────────────────────────────────────────────────────

  const currency = selectedCustomer?.currency ??
invoice?.customer_snapshot.currency ?? 'INR';
  const country = selectedCustomer?.country ??
invoice?.customer_snapshot.country ?? 'IN';
  const fmt = (n: number) => formatCurrency(n, currency, country);
  const inputClass = 'w-full border border-slate-200 rounded-md px-3 py-2 text-
sm outline-none focus:ring-2 focus:ring-blue-500';
  let itemsBase = 0;
  let totalTax = 0;
  const globalTaxBreakdown: Record<string, { name: string; percent: number;
amount: number }> = {};
  lineItems.forEach(line => {
    const { base, taxTotal, updatedTaxes } = calcLine(line);
    itemsBase += base;
    totalTax += taxTotal;
    updatedTaxes.forEach(t => {
      const key = t.tax_id ?? t.name;
      if (!globalTaxBreakdown[key]) globalTaxBreakdown[key] = { name: t.name,
percent: t.percent, amount: 0 };
      globalTaxBreakdown[key].amount += t.amount;
    });
  });
  const subtotal = itemsBase + totalTax;
  const discP = parseFloat(discountPercent) || 0;
  const computedDiscountAmt = subtotal * (discP / 100);
  const grandTotal = subtotal - computedDiscountAmt;
  // ── Line item helpers ─────────────────────────────────────────────────────
  function updateLine(i: number, field: keyof LineItem, value: string) {
    setLineItems(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value
} : l));
  }
  function addLine() { setLineItems(prev => [...prev, emptyLine()]); }
  function removeLine(i: number) {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, idx) => idx !== i));
  }
  function addTaxToLine(lineIdx: number, tax: Tax) {
    setLineItems(prev => prev.map((l, i) => {
      if (i !== lineIdx) return l;
      if (l.taxes.find(t => t.tax_id === tax.tax_id)) return l;
      return { ...l, taxes: [...l.taxes, { tax_id: tax.tax_id, name: tax.name,
percent: tax.percent, amount: 0 }] };
    }));
  }
  function removeTaxFromLine(lineIdx: number, taxIdx: number) {
    setLineItems(prev => prev.map((l, i) => {
      if (i !== lineIdx) return l;
      return { ...l, taxes: l.taxes.filter((_, ti) => ti !== taxIdx) };
    }));
  }

  // ── Validate & Submit ─────────────────────────────────────────────────────

  function validate() {
    const e: Record<string, string> = {};
    if (!customerId) e.customer = 'Please select a customer';
    if (dueDate && dueDate < today) e.dueDate = 'Due date must be today or a
future date';
    lineItems.forEach((l, i) => {
      if (!l.description.trim()) e[`desc_${i}`] = 'Required';
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
        issue_date: issueDate,
        due_date: dueDate || undefined,
        status,
        po_so_number: poSoNumber,
        payment_terms: paymentTerms,
        terms_and_conditions: termsAndConditions,
        notes: notes.trim(),
        tax_exempt: taxExempt,
        discount_percent: discP,
        items: lineItems.map(l => ({
          description: l.description + (l.sub_description ? `\n$
{l.sub_description}` : ''),
          quantity: parseFloat(l.quantity) || 0,
          unit_price: parseFloat(l.unit_price) || 0,
          taxes: l.taxes.map(t => ({ tax_id: t.tax_id, name: t.name, percent:
t.percent })),
          hsn_sac: l.hsn_sac.trim() || undefined,
        })),
      };
      await invoicesService.update(id, payload as any);
      toast.success('Invoice updated.');
      router.push(`/invoices/${id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  }
  // ── Customer modal ────────────────────────────────────────────────────────
  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerForm.customer_name.trim()) { toast.error('Contact name is
required'); return; }
    setSavingCustomer(true);
    try {
      const created = await customersService.create(customerForm);
      setCustomers(prev => [created, ...prev]);
      setCustomerId(created._id);
      setSelectedCustomer(created);
      setShowCustomerModal(false);

      toast.success('Customer created.');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSavingCustomer(false);
    }
  }
  // ── Tax modal ─────────────────────────────────────────────────────────────
  async function handleCreateTax(e: React.FormEvent) {
    e.preventDefault();
    if (!taxForm.name.trim() || !taxForm.percent) { toast.error('Name and
percent are required'); return; }
    setSavingTax(true);
    try {
      const created = await taxService.create({ name: taxForm.name, percent:
parseFloat(taxForm.percent) });
      setGlobalTaxes(prev => [...prev, created]);
      setShowTaxModal(false);
      setTaxForm({ name: '', percent: '' });
      toast.success('Tax created.');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSavingTax(false);
    }
  }
  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );
  if (!invoice) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-500">Invoice not found.</p>
    </div>
  );
  return (
    <div className="min-h-screen bg-slate-50">
      <form onSubmit={handleSubmit}>
        {/* Top Bar */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-
center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => router.push(`/invoices/${id}`)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Edit Invoice</h1>
              <p className="text-sm text-slate-400">{invoice.invoice_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push(`/invoices/${id}`)}
              className="px-4 py-2 text-sm rounded-md border border-slate-200
hover:bg-slate-50 cursor-pointer">

              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6
py-2 rounded-md text-sm font-bold hover:bg-blue-700 disabled:opacity-50 cursor-
pointer">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
          {/* Meta row */}
          <div className="grid grid-cols-12 gap-6">
            {/* Customer */}
            <div className="col-span-6 bg-white rounded-xl border border-
slate-200 p-6">
              <h2 className="text-xs font-bold text-slate-500 uppercase
tracking-wide mb-4">Customer</h2>
              {selectedCustomer ? (
                <div className="relative">
                  <div className="p-4 bg-slate-50 rounded-lg border border-
slate-200">
                    <p className="font-semibold text-
slate-800">{selectedCustomer.customer_name}</p>
                    {selectedCustomer.company_name && <p className="text-sm
text-slate-500">{selectedCustomer.company_name}</p>}
                    {selectedCustomer.email && <p className="text-sm text-
slate-500">{selectedCustomer.email}</p>}
                    {selectedCustomer.billing_address_1 && <p className="text-sm
text-slate-500">{selectedCustomer.billing_address_1}</p>}
                    <p className="text-xs text-slate-400
mt-1">{selectedCustomer.currency} · {selectedCustomer.country}</p>
                  </div>
                  <button type="button" onClick={() =>
setSelectedCustomer(null)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-
slate-600 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <select value={customerId} onChange={e =>
setCustomerId(e.target.value)} className={inputClass}>
                    <option value="">Select a customer</option>
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.customer_name}{c.company_name ? ` — ${c.company_name}
` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.customer && <p className="text-red-500 text-
xs">{errors.customer}</p>}
                  <button type="button"
                    onClick={() => { setCustomerModalStep('choice');
setExistingCustomerId(''); setShowCustomerModal(true); }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-
medium flex items-center gap-1 cursor-pointer">
                    <Plus className="w-4 h-4" /> Add a customer
                  </button>

                </div>
              )}
            </div>
            {/* Invoice Details */}
            <div className="col-span-6 bg-white rounded-xl border border-
slate-200 p-6 space-y-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase
tracking-wide">Invoice Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600
uppercase">Invoice Date</label>
                  <input type="date" value={issueDate} readOnly
                    className={`${inputClass} mt-1 bg-slate-50 text-slate-500
cursor-not-allowed`} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600
uppercase">Due Date</label>
                  <input type="date" value={dueDate} min={today} onChange={e =>
setDueDate(e.target.value)}
                    className={`${inputClass} mt-1`} />
                  {errors.dueDate && <p className="text-red-500 text-xs
mt-1">{errors.dueDate}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600
uppercase">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value
as InvoiceStatus)} className={`${inputClass} mt-1`}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}
>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600
uppercase">PO / SO Number</label>
                  <input value={poSoNumber} onChange={e =>
setPoSoNumber(e.target.value)} className={`${inputClass} mt-1`} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600
uppercase">Payment Terms</label>
                  <input value={paymentTerms} onChange={e =>
setPaymentTerms(e.target.value)} className={`${inputClass} mt-1`}
placeholder="e.g. Net 30" />
                </div>
              </div>
            </div>
          </div>
          {/* Line Items */}
          <div className="bg-slate-50 border-y border-slate-200 rounded-xl
overflow-hidden">
            <div className="max-w-full">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 px-8 py-3 text-xs font-
bold text-slate-600 uppercase border-b border-slate-200">
                <div className="col-span-6">Items</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>

              {/* Rows */}
              <div className="bg-white">
                {lineItems.map((line, i) => {
                  const { base, updatedTaxes } = calcLine(line);
                  return (
                    <div key={i} className="group border-b border-slate-100
relative">
                      <div className="absolute left-2 top-4 opacity-0 group-
hover:opacity-100 cursor-move text-slate-300">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      {/* Main row */}
                      <div className="grid grid-cols-12 gap-4 px-8 pt-4 pb-2
items-center">
                        <div className="col-span-6">
                          <select
                            value={line.description}
                            onChange={e => {
                              const val = e.target.value;
                              const item = items.find(it => it.name === val);
                              if (item) {
                                setLineItems(prev => prev.map((l, idx) => idx
=== i
                                  ? { ...l, description: item.name, unit_price:
String(item.unit_price) }
                                  : l));
                              } else {
                                updateLine(i, 'description', val);
                              }
                            }}
                            className="w-full text-slate-800 font-medium bg-
transparent border-0 border-b border-transparent hover:border-slate-300
focus:border-blue-500 focus:ring-0 px-0 py-1 outline-none cursor-pointer
transition-colors"
                          >

                            <option value="">Select an item</option>
                            {items.map(item => <option key={item._id}
value={item.name}>{item.name}</option>)}
                          </select>
                          {errors[`desc_${i}`] && <p className="text-red-500
text-xs mt-1">{errors[`desc_${i}`]}</p>}
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="1" step="1"
value={line.quantity}
                            onChange={e => updateLine(i, 'quantity',
e.target.value)} className={inputClass} />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="0" step="0.01"
value={line.unit_price}
                            onChange={e => updateLine(i, 'unit_price',
e.target.value)} className={inputClass} />
                        </div>
                        <div className="col-span-2 flex items-center justify-end
gap-3">
                          <span className="font-medium text-
slate-800">{fmt(base)}</span>
                          <button type="button" onClick={() => removeLine(i)}
                            className="text-blue-500 hover:text-red-500 cursor-
pointer">
                            <Trash2 className="w-4 h-4" />

                          </button>
                        </div>
                      </div>
                      {/* Applied taxes */}
                      {updatedTaxes.map((tax, tIndex) => (
                        <div key={tIndex} className="grid grid-cols-12 gap-4
px-8 py-1 items-center">
                          <div className="col-span-6" />
                          <div className="col-span-2 flex items-center gap-1">
                            <span className="text-xs text-slate-500">{tax.name}
({tax.percent}%)</span>
                            <button type="button" onClick={() =>
removeTaxFromLine(i, tIndex)}
                              className="text-slate-300 hover:text-red-400
cursor-pointer">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="col-span-2" />
                          <div className="col-span-2 text-right pr-7">
                            <span className="text-sm text-
slate-500">{fmt(tax.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {/* Tax selector */}
                      <div className="grid grid-cols-12 gap-4 px-8 pb-3 items-
start">
                        <div className="col-span-6" />
                        <div className="col-span-2 flex items-center pt-0.5">
                          <span className="text-xs font-semibold text-slate-400
uppercase tracking-wide">Tax</span>
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          {(line.taxSlots ?? []).map((_, slotIdx) => (
                            <select
                              key={slotIdx}
                              className="w-full text-xs border border-slate-200
rounded px-2 py-1.5 outline-none focus:border-blue-500 bg-white cursor-pointer"
                              value=""
                              onChange={e => {
                                if (e.target.value === 'custom')
setShowTaxModal(true);
                                else if (e.target.value) {
                                  addTaxToLine(i, globalTaxes.find(t => t.tax_id
=== e.target.value)!);
                                  setLineItems(prev => prev.map((l, idx) => {
                                    if (idx !== i) return l;
                                    const slots = [...(l.taxSlots ?? [])];
                                    slots.splice(slotIdx, 1);
                                    return { ...l, taxSlots: slots };
                                  }));
                                }
                              }}
                            >
                              <option value="">Select a tax</option>
                              {globalTaxes
                                .filter(t => !line.taxes.find(lt => lt.tax_id
=== t.tax_id))
                                .map(t => <option key={t.tax_id}
value={t.tax_id}>{t.name} ({t.percent}%)</option>)}
                              <option value="custom">+ Add custom tax</option>

                            </select>
                          ))}
                          <button type="button"
                            onClick={() => setLineItems(prev => prev.map((l,
idx) => {
                              if (idx !== i) return l;
                              return { ...l, taxSlots: [...(l.taxSlots ?? []),
(l.taxSlots ?? []).length] };
                            }))}
                            className="text-xs text-blue-500 hover:text-blue-700
font-medium flex items-center gap-0.5 cursor-pointer">
                            <Plus className="w-3 h-3" /> add a tax
                          </button>
                        </div>
                        <div className="col-span-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Add item */}
              <div className="px-8 py-4 bg-white border-b border-slate-200">
                <button type="button" onClick={addLine}
                  className="text-sm font-bold text-blue-600 flex items-center
gap-1 hover:text-blue-800 cursor-pointer">
                  <Plus className="w-4 h-4" /> Add an item
                </button>
              </div>
            </div>
          </div>
          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-80 space-y-3 pt-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Items</span>
                <span>{fmt(itemsBase)}</span>
              </div>
              {Object.values(globalTaxBreakdown).map((tax, i) => (
                <div key={i} className="flex justify-between text-sm text-
slate-600">
                  <span className="text-slate-500">{tax.name} ({tax.percent}
%)</span>
                  <span>{fmt(tax.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold text-
slate-700 pt-2 border-t border-slate-100">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {discountAdded ? (
                <div className="flex justify-between items-center text-sm text-
slate-600">
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="100"
value={discountPercent}
                      onChange={e => setDiscountPercent(e.target.value)}
                      className="w-16 border border-slate-200 rounded px-2 py-1
text-right outline-none focus:border-blue-500" />
                    <span className="text-slate-500">% discount</span>
                    <button type="button" onClick={() =>
{ setDiscountAdded(false); setDiscountPercent('0'); }}

                      className="text-slate-300 hover:text-red-400 cursor-
pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-slate-500">-{fmt(computedDiscountAmt)}
</span>
                </div>
              ) : (
                <button type="button" onClick={() => setDiscountAdded(true)}
                  className="text-left text-sm text-blue-600 font-medium
hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Add a discount
                </button>
              )}
              <div className="flex justify-between items-center font-bold text-
slate-800 pt-3 border-t border-slate-200">
                <span>Total</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm px-3 py-1 bg-slate-100 text-slate-500
rounded border border-slate-200 font-normal">
                    {CURRENCIES.find(c => c.code === currency)
                      ? `${currency} (${CURRENCIES.find(c => c.code ===
currency)!.symbol}) — ${CURRENCIES.find(c => c.code === currency)!.name}`
                      : currency}
                  </span>
                  <span className="text-lg">{fmt(grandTotal)}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-slate-800 pt-4
border-t border-slate-200">
                <span>Amount Due</span>
                <span className="text-lg">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Notes / Terms */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 grid
grid-cols-2 gap-6">

            <div>
              <label className="text-xs font-bold text-slate-600
uppercase">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
rows={3}
                placeholder="Any notes for the customer…"
                className="mt-1 w-full border border-slate-200 rounded-md px-3
py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600
uppercase">Terms & Conditions</label>
              <textarea value={termsAndConditions} onChange={e =>
setTermsAndConditions(e.target.value)} rows={3}
                className="mt-1 w-full border border-slate-200 rounded-md px-3
py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>

        </div>
      </form>

      {/* ── Customer Modal ── */}
      {showCustomerModal && (

        <div className="fixed inset-0 bg-black/50 z-50 flex items-center
justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b
border-slate-100">
              <div className="flex items-center gap-3">
                {customerModalStep !== 'choice' && (
                  <button type="button" onClick={() =>
setCustomerModalStep('choice')}
                    className="text-slate-400 hover:text-slate-600 cursor-
pointer">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor"
viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2 className="text-xl font-bold text-slate-800">
                  {customerModalStep === 'choice' && 'Add a customer'}
                  {customerModalStep === 'new' && 'New customer'}
                  {customerModalStep === 'existing' && 'Choose existing
customer'}
                </h2>
              </div>
              <button onClick={() => setShowCustomerModal(false)}
className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Choice */}
            {customerModalStep === 'choice' && (
              <div className="p-8 grid grid-cols-2 gap-5">
                <button type="button"
                  onClick={() => {
                    setCustomerForm({ customer_code: '', customer_type:
'business', customer_name: '', company_name: '', email: '', phone: '',
billing_address_1: '', billing_address_2: '', city: '', state: '', postal_code:
'', country: 'IN', currency: 'INR', gstin: '', pan: '', registration_number:
'' });
                    setCustomerModalStep('new');
                  }}
                  className="group flex flex-col items-center justify-center
gap-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-
blue-50/40 p-10 transition-all cursor-pointer text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-100 group-
hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <UserPlus className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-base">New
customer</p>
                    <p className="text-sm text-slate-500 mt-1">Create and add a
brand new customer</p>
                  </div>
                </button>
                <button type="button"
                  onClick={() => { setExistingCustomerId('');
setCustomerModalStep('existing'); }}
                  className="group flex flex-col items-center justify-center
gap-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-
blue-50/40 p-10 transition-all cursor-pointer text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-100 group-

hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <Users className="w-7 h-7 text-slate-500 group-hover:text-
blue-600 transition-colors" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-base">Existing
customer</p>
                    <p className="text-sm text-slate-500 mt-1">Pick from your
saved customers</p>
                  </div>
                </button>
              </div>
            )}
            {/* Existing */}
            {customerModalStep === 'existing' && (
              <div className="p-6 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-600
uppercase">Select customer</label>
                  <select value={existingCustomerId} onChange={e =>
setExistingCustomerId(e.target.value)} className={`${inputClass} mt-2`}>
                    <option value="">— choose a customer —</option>
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.customer_name}{c.company_name ? ` — ${c.company_name}
` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {existingCustomerId && (() => {
                  const c = customers.find(x => x._id === existingCustomerId);
                  if (!c) return null;
                  return (
                    <div className="bg-slate-50 rounded-lg border border-
slate-200 p-4 space-y-1 text-sm text-slate-600">
                      {c.company_name && <p className="font-semibold text-
slate-800">{c.company_name}</p>}
                      {c.email && <p>{c.email}</p>}
                      {c.phone && <p>{c.phone}</p>}
                      {c.billing_address_1 && <p>{c.billing_address_1}{c.city ?
`, ${c.city}` : ''}</p>}
                      <p className="text-xs text-slate-400 pt-1">{c.currency} ·
{c.country}{c.gstin ? ` · GSTIN: ${c.gstin}` : ''}</p>
                    </div>
                  );
                })()}
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() =>
setShowCustomerModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600
hover:bg-slate-50 rounded-md border border-slate-200
cursor-pointer">Cancel</button>
                  <button type="button" disabled={!existingCustomerId}
                    onClick={() => {
                      const c = customers.find(x => x._id ===
existingCustomerId);
                      if (c) { setSelectedCustomer(c); setCustomerId(c._id);
setShowCustomerModal(false); }
                    }}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-
bold rounded-md hover:bg-blue-700 cursor-pointer disabled:opacity-40
disabled:cursor-not-allowed">

                    Select customer
                  </button>
                </div>
              </div>
            )}
            {/* New customer form */}
            {customerModalStep === 'new' && (
              <form onSubmit={handleCreateCustomer} className="p-6 space-y-6
max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600
uppercase">Customer Type</label>
                    <select value={customerForm.customer_type} onChange={e =>
setCustomerForm(p => ({...p, customer_type: e.target.value}))} className={`$
{inputClass} mt-1`}>
                      <option value="business">Business</option>
                      <option value="individual">Individual</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600
uppercase">Customer Code</label>
                    <input value={customerForm.customer_code} onChange={e =>
setCustomerForm(p => ({...p, customer_code: e.target.value}))} placeholder="e.g.
CUST-001" className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600
uppercase">Contact Name *</label>
                    <input value={customerForm.customer_name} onChange={e =>
setCustomerForm(p => ({...p, customer_name: e.target.value}))} className={`$
{inputClass} mt-1`} required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600
uppercase">Company Name</label>
                    <input value={customerForm.company_name} onChange={e =>
setCustomerForm(p => ({...p, company_name: e.target.value}))} className={`$
{inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600
uppercase">Email</label>
                    <input type="email" value={customerForm.email} onChange={e
=> setCustomerForm(p => ({...p, email: e.target.value}))} className={`$
{inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600
uppercase">Phone</label>
                    <input value={customerForm.phone} onChange={e =>
setCustomerForm(p => ({...p, phone: e.target.value}))} className={`${inputClass}
mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600
uppercase">Currency</label>
                    <select value={customerForm.currency} onChange={e =>
setCustomerForm(p => ({...p, currency: e.target.value}))} className={`$
{inputClass} mt-1`}>
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}
>{c.code} ({c.symbol}) — {c.name}</option>)}

                    </select>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-700 mb-4">Billing
Address</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><input
value={customerForm.billing_address_1} onChange={e => setCustomerForm(p =>
({...p, billing_address_1: e.target.value}))} placeholder="Address Line 1"
className={inputClass} /></div>
                    <div className="col-span-2"><input
value={customerForm.billing_address_2} onChange={e => setCustomerForm(p =>
({...p, billing_address_2: e.target.value}))} placeholder="Address Line 2"
className={inputClass} /></div>
                    <div><input value={customerForm.city} onChange={e =>
setCustomerForm(p => ({...p, city: e.target.value}))} placeholder="City"
className={inputClass} /></div>
                    <div><input value={customerForm.state} onChange={e =>
setCustomerForm(p => ({...p, state: e.target.value}))} placeholder="State /
Province" className={inputClass} /></div>
                    <div><input value={customerForm.postal_code} onChange={e =>
setCustomerForm(p => ({...p, postal_code: e.target.value}))} placeholder="Postal
Code" className={inputClass} /></div>
                    <div>
                      <select value={customerForm.country} onChange={e =>
setCustomerForm(p => ({...p, country: e.target.value}))} className={inputClass}>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}
>{c.name}</option>)}

                      </select>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-700 mb-4">Tax Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600
uppercase">GSTIN / Tax ID</label>
                      <input value={customerForm.gstin} onChange={e =>
setCustomerForm(p => ({...p, gstin: e.target.value}))} className={`${inputClass}
mt-1`} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600
uppercase">PAN</label>
                      <input value={customerForm.pan} onChange={e =>
setCustomerForm(p => ({...p, pan: e.target.value}))} className={`${inputClass}
mt-1`} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600
uppercase">Registration No.</label>
                      <input value={customerForm.registration_number}
onChange={e => setCustomerForm(p => ({...p, registration_number:
e.target.value}))} className={`${inputClass} mt-1`} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() =>
setShowCustomerModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600
hover:bg-slate-50 rounded-md border border-slate-200

cursor-pointer">Cancel</button>
                  <button type="submit" disabled={savingCustomer}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-
bold rounded-md hover:bg-blue-700 flex items-center gap-2 cursor-pointer
disabled:opacity-60">

                    {savingCustomer && <Loader2 className="w-4 h-4 animate-spin"
/>} Save

                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* ── Tax Modal ── */}
      {showTaxModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center
justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b
border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Add Custom
Tax</h2>
              <button type="button" onClick={() => setShowTaxModal(false)}
className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTax} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600
uppercase">Tax Name</label>
                <input value={taxForm.name} onChange={e => setTaxForm(p =>
({...p, name: e.target.value}))}
                  placeholder="e.g. GST" className={`${inputClass} mt-1`}
required />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600
uppercase">Percentage (%)</label>
                <input type="number" min="0" max="99" step="0.01"
value={taxForm.percent}
                  onChange={e => setTaxForm(p => ({...p, percent:
e.target.value}))}
                  placeholder="e.g. 18" className={`${inputClass} mt-1`}
required />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTaxModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 border border-
slate-200 rounded-md hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingTax}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-bold
rounded-md hover:bg-blue-700 flex items-center gap-2 cursor-pointer
disabled:opacity-60">
                  {savingTax && <Loader2 className="w-4 h-4 animate-spin" />}
Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}