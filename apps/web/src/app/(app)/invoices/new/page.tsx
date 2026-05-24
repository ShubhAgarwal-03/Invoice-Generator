'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { invoicesService } from '@/services/invoices';
import { customersService } from '@/services/customers';
import { itemsService } from '@/services/items';
import { Customer, Item, Tax } from '@/types';
import { formatCurrency } from '@/utils/currency';
import { Loader2, Plus, Trash2, X, GripVertical, UserPlus, Users } from 'lucide-react';

const emptyLine = () => ({
  description: '', 
  sub_description: '',
  quantity: '1', 
  unit_price: '0', 
  taxes: [] as { tax_id?: string, name: string, percent: number, amount: number }[],
  hsn_sac: '',
  taxSlots: [0] as number[],  // one dropdown slot by default
});

const today = new Date().toISOString().split('T')[0];

const COUNTRIES = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'UAE' },
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
];

export default function NewInvoicePage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [globalTaxes, setGlobalTaxes] = useState<Tax[]>([]);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerId, setCustomerId] = useState('');
  
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [poSoNumber, setPoSoNumber] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  
  const [lineItems, setLineItems] = useState([emptyLine()]);
  
  const [discountPercent, setDiscountPercent] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountAdded, setDiscountAdded] = useState(false);
  
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [taxExempt, setTaxExempt] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalStep, setCustomerModalStep] = useState<'choice' | 'new' | 'existing'>('choice');
  const [existingCustomerId, setExistingCustomerId] = useState('');
  const [customerForm, setCustomerForm] = useState({
    customer_code: '', customer_type: 'business', customer_name: '', company_name: '',
    email: '', phone: '', billing_address_1: '', billing_address_2: '', city: '', state: '', postal_code: '',
    country: 'IN', currency: 'INR', gstin: '', pan: '', registration_number: ''
  });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxForm, setTaxForm] = useState({ name: '', percent: '0', tax_id: '' });
  const [savingTax, setSavingTax] = useState(false);

  useEffect(() => {
    Promise.all([
      customersService.getAll(), 
      itemsService.getAll(),
      fetch(process.env.NEXT_PUBLIC_API_URL + '/api/taxes').then(r => r.json()).catch(() => [])
    ])
      .then(([c, i, t]) => { setCustomers(c); setItems(i); setGlobalTaxes(Array.isArray(t) ? t : []); })
      .catch(() => toast.error('Failed to load data'));
  }, []);

  useEffect(() => {
    const c = customers.find(c => c._id === customerId) ?? null;
    setSelectedCustomer(c);
  }, [customerId, customers]);

  function calcLine(line: any) {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.unit_price) || 0;
    const base = qty * price;
    
    let taxTotal = 0;
    const updatedTaxes = line.taxes.map((t: any) => {
      const amt = base * (t.percent / 100);
      taxTotal += amt;
      return { ...t, amount: amt };
    });

    return { base, taxTotal, total: base + taxTotal, updatedTaxes };
  }

  // Recalculate totals
  let itemsBase = 0;   // sum of qty * price across all lines
  let totalTax = 0;
  let globalTaxBreakdown: Record<string, { name: string, percent: number, amount: number }> = {};

  lineItems.forEach(line => {
    const { base, taxTotal, updatedTaxes } = calcLine(line);
    itemsBase += base;
    totalTax += taxTotal;
    
    updatedTaxes.forEach((t: any) => {
      const key = t.tax_id || t.name;
      if (!globalTaxBreakdown[key]) {
        globalTaxBreakdown[key] = { name: t.name, percent: t.percent, amount: 0 };
      }
      globalTaxBreakdown[key].amount += t.amount;
    });
  });

  // subtotal = all items + all their taxes combined
  const subtotal = itemsBase + totalTax;
  const discP = parseFloat(discountPercent) || 0;
  const computedDiscountAmt = subtotal * (discP / 100);
  const grandTotal = subtotal - computedDiscountAmt;

  const currency = selectedCustomer?.currency ?? 'INR';
  const country = selectedCustomer?.country ?? 'IN';
  const fmt = (n: number) => formatCurrency(n, currency, country);

  function updateLine(index: number, field: string, value: any) {
    setLineItems(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }
  
  function addTaxToLine(lineIndex: number, tax: Tax) {
    setLineItems(prev => prev.map((l, i) => {
      if (i === lineIndex) {
        const exists = l.taxes.find(t => t.tax_id === tax.tax_id);
        if (exists) return l;
        return { ...l, taxes: [...l.taxes, { tax_id: tax.tax_id, name: tax.name, percent: tax.percent, amount: 0 }] };
      }
      return l;
    }));
  }

  function removeTaxFromLine(lineIndex: number, taxIndex: number) {
    setLineItems(prev => prev.map((l, i) => {
      if (i === lineIndex) {
        const newTaxes = [...l.taxes];
        newTaxes.splice(taxIndex, 1);
        return { ...l, taxes: newTaxes };
      }
      return l;
    }));
  }

  function addLine() { setLineItems(prev => [...prev, emptyLine()]); }
  function removeLine(index: number) {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { toast.error('Please select a customer'); return; }
    
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        invoice_number: invoiceNumber || undefined,
        po_so_number: poSoNumber,
        issue_date: issueDate,
        due_date: dueDate || undefined,
        discount_percent: discP,
        tax_exempt: taxExempt,
        payment_terms: paymentTerms,
        terms_and_conditions: termsAndConditions,
        notes,
        items: lineItems.map(l => ({
          description: l.description + (l.sub_description ? `\n${l.sub_description}` : ''),
          quantity: parseFloat(l.quantity) || 0,
          unit_price: parseFloat(l.unit_price) || 0,
          taxes: l.taxes.map(t => ({ tax_id: t.tax_id, name: t.name, percent: t.percent })),
          hsn_sac: l.hsn_sac,
        })),
      };
      const inv = await invoicesService.create(payload as any);
      toast.success(`Invoice created.`);
      router.push(`/invoices/${inv._id}`);
    } catch {
      toast.error('Failed to create invoice');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerForm.customer_name) { toast.error('Customer name is required'); return; }
    setSavingCustomer(true);
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm)
      });
      if (!res.ok) throw new Error('Failed');
      const created = await res.json();
      setCustomers(prev => [created, ...prev]);
      setCustomerId(created._id);
      setShowCustomerModal(false);
      toast.success('Customer created.');
    } catch {
      toast.error('Failed to create customer');
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleCreateTax(e: React.FormEvent) {
    e.preventDefault();
    if (!taxForm.name || !taxForm.percent || !taxForm.tax_id) { toast.error('All fields required'); return; }
    setSavingTax(true);
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/taxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: taxForm.name, percent: parseFloat(taxForm.percent), tax_id: taxForm.tax_id })
      });
      if (!res.ok) throw new Error('Failed');
      const created = await res.json();
      setGlobalTaxes(prev => [...prev, created]);
      setShowTaxModal(false);
      setTaxForm({ name: '', percent: '0', tax_id: '' });
      toast.success('Tax created.');
    } catch {
      toast.error('Failed to create tax');
    } finally {
      setSavingTax(false);
    }
  }

  const inputClass = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all";

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <form onSubmit={handleSubmit}>
        {/* TOP SECTION */}
        <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
          {/* Customer Card */}
          <div className="w-72">
            {!selectedCustomer ? (
              <div 
                onClick={() => { setCustomerModalStep('choice'); setExistingCustomerId(''); setShowCustomerModal(true); }}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-blue-600 hover:bg-blue-50/50 cursor-pointer h-48 transition-colors"
              >
                <div className="relative mb-2">
                  <div className="w-12 h-12 rounded-full border-2 border-blue-600 flex items-center justify-center">
                    <UserPlus className="w-6 h-6" />
                  </div>
                </div>
                <span className="font-semibold">Add a customer</span>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-6 h-48 relative shadow-sm bg-white">
                <button type="button" onClick={() => setSelectedCustomer(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
                <h3 className="font-bold text-lg text-slate-800">{selectedCustomer.company_name || selectedCustomer.customer_name}</h3>
                <p className="text-slate-500 text-sm mt-1">{selectedCustomer.email}</p>
                <p className="text-slate-500 text-sm">{selectedCustomer.billing_address_1}</p>
                <p className="text-slate-500 text-sm">{selectedCustomer.city}, {selectedCustomer.country}</p>
                <p className="mt-4 text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded inline-block">Currency: {selectedCustomer.currency}</p>
              </div>
            )}
            
          </div>

          {/* Invoice Details */}
          <div className="w-full md:w-80 space-y-4">
            <div className="flex items-center justify-end gap-3">
              <label className="text-sm font-medium text-slate-600 w-32 text-right">Invoice number</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Auto-generated" className={`${inputClass} w-48`} />
            </div>
            <div className="flex items-center justify-end gap-3">
              <label className="text-sm font-medium text-slate-600 w-32 text-right">P.O./S.O. number</label>
              <input value={poSoNumber} onChange={e => setPoSoNumber(e.target.value)} className={`${inputClass} w-48`} />
            </div>
            <div className="flex items-center justify-end gap-3">
              <label className="text-sm font-medium text-slate-600 w-32 text-right">Invoice date</label>
              <input type="date" value={issueDate} readOnly className={`${inputClass} w-48 bg-slate-50 text-slate-500 cursor-not-allowed`} />
            </div>
            <div className="flex items-start justify-end gap-3">
              <label className="text-sm font-medium text-slate-600 w-32 text-right pt-2">Payment due</label>
              <div className="w-48">
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
                <p className="text-xs text-slate-500 mt-1">On Receipt</p>
              </div>
            </div>
          </div>
        </div>

        {/* LINE ITEMS */}
        <div className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-8 py-3 text-sm font-bold text-slate-800 border-b border-slate-200">
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
                  <div key={i} className="group border-b border-slate-100 relative">
                    <div className="absolute left-2 top-4 opacity-0 group-hover:opacity-100 cursor-move text-slate-400">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Main item row */}
                    <div className="grid grid-cols-12 gap-4 px-8 pt-4 pb-2 items-center">
                      {/* Item name */}
                      <div className="col-span-6">
                        <select
                          value={line.description}
                          onChange={e => {
                            const val = e.target.value;
                            const item = items.find(it => it.name === val);
                            if (item) {
                              setLineItems(prev => prev.map((l, idx) => idx === i ? { ...l, description: item.name, unit_price: String(item.unit_price) } : l));
                            } else {
                              updateLine(i, 'description', val);
                            }
                          }}
                          className="w-full text-slate-800 font-medium bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-0 px-0 py-1 transition-colors outline-none cursor-pointer"
                        >
                          <option value="">Select an item</option>
                          {items.map(item => (
                            <option key={item._id} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <input type="number" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} className={inputClass} />
                      </div>

                      {/* Price */}
                      <div className="col-span-2">
                        <input type="number" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} className={inputClass} />
                      </div>

                      {/* Item amount + delete */}
                      <div className="col-span-2 flex items-center justify-end gap-3">
                        <span className="font-medium text-slate-800">{fmt(base)}</span>
                        <button type="button" onClick={() => removeLine(i)} className="text-blue-500 hover:text-red-500 cursor-pointer"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>

                    {/* Applied taxes — one row each, aligned under Price / Amount */}
                    {updatedTaxes.map((tax: any, tIndex: number) => (
                      <div key={tIndex} className="grid grid-cols-12 gap-4 px-8 py-1 items-center">
                        <div className="col-span-6"></div>
                        <div className="col-span-2 flex items-center gap-1">
                          <span className="text-xs text-slate-500">{tax.name} ({tax.percent}%)</span>
                          <button type="button" onClick={() => removeTaxFromLine(i, tIndex)} className="text-slate-300 hover:text-red-400 cursor-pointer"><X className="w-3 h-3"/></button>
                        </div>
                        <div className="col-span-2"></div>
                        <div className="col-span-2 text-right pr-7">
                          <span className="text-sm text-slate-500">{fmt(tax.amount)}</span>
                        </div>
                      </div>
                    ))}

                    {/* Tax selection area — sits under Price column */}
                    <div className="grid grid-cols-12 gap-4 px-8 pb-3 items-start">
                      {/* "Tax" label under Quantity column */}
                      <div className="col-span-6"></div>
                      <div className="col-span-2 flex items-center pt-0.5">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tax</span>
                      </div>
                      {/* Dropdowns under Price column */}
                      <div className="col-span-2 space-y-1.5">
                        {(line.taxSlots ?? [0]).map((_: any, slotIdx: number) => (
                          <select
                            key={slotIdx}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-500 bg-white cursor-pointer"
                            value=""
                            onChange={(e) => {
                              if (e.target.value === 'custom') setShowTaxModal(true);
                              else if (e.target.value) {
                                addTaxToLine(i, globalTaxes.find(t => t.tax_id === e.target.value)!);
                                setLineItems(prev => prev.map((l, idx) => {
                                  if (idx !== i) return l;
                                  const slots = [...(l.taxSlots ?? [0])];
                                  slots.splice(slotIdx, 1);
                                  return { ...l, taxSlots: slots };
                                }));
                              }
                            }}
                          >
                            <option value="">Select a tax</option>
                            {globalTaxes
                              .filter(t => !line.taxes.find((lt: any) => lt.tax_id === t.tax_id))
                              .map(t => <option key={t.tax_id} value={t.tax_id}>{t.name} ({t.percent}%)</option>)}
                            <option value="custom">+ Add custom tax</option>
                          </select>
                        ))}
                        <button
                          type="button"
                          onClick={() => setLineItems(prev => prev.map((l, idx) => {
                            if (idx !== i) return l;
                            return { ...l, taxSlots: [...(l.taxSlots ?? [0]), (l.taxSlots ?? [0]).length] };
                          }))}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> add a tax
                        </button>
                      </div>
                      <div className="col-span-2"></div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Add Line */}
            <div className="px-8 py-4 bg-white border-b border-slate-200">
              <button type="button" onClick={addLine} className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800 cursor-pointer">
                <Plus className="w-4 h-4" /> Add an item
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="flex justify-end mt-8">
          {/* Totals */}
          <div className="w-full md:w-80 space-y-3 pt-4">
            {/* Items base */}
            <div className="flex justify-between items-center text-sm text-slate-700">
              <div className="w-[88px]"></div>
              <span>Items</span>
              <span>{fmt(itemsBase)}</span>
            </div>

            {/* Global Tax Breakdown */}
            {Object.values(globalTaxBreakdown).map((tax, idx) => (
              <div key={idx} className="flex justify-between text-sm text-slate-700">
                <span className="text-slate-500">{tax.name} ({tax.percent}%)</span>
                <span>{fmt(tax.amount)}</span>
              </div>
            ))}

            {/* Subtotal = items + taxes */}
            <div className="flex justify-between items-center text-sm font-semibold text-slate-700 pt-2 border-t border-slate-100">
              <div className="w-[88px]"></div>
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>

            {/* Discount row */}
            {discountAdded ? (
              <div className="flex justify-between items-center text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={e => {
                      setDiscountPercent(e.target.value);
                      setDiscountAmount((subtotal * (parseFloat(e.target.value || '0') / 100)).toFixed(2));
                    }}
                    className="w-16 border border-slate-200 rounded px-2 py-1 text-right outline-none focus:border-blue-500"
                  />
                  <span className="text-slate-500">% discount</span>
                  <button
                    type="button"
                    onClick={() => { setDiscountAdded(false); setDiscountPercent('0'); setDiscountAmount('0'); }}
                    className="text-slate-300 hover:text-red-400 ml-1"
                  ><X className="w-3.5 h-3.5"/></button>
                </div>
                <span className="text-slate-500">-{fmt(computedDiscountAmt)}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDiscountAdded(true)}
                className="text-left text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add a discount
              </button>
            )}

            <div className="flex justify-between items-center font-bold text-slate-800 pt-3 border-t border-slate-200">
              <span>Total</span>
              <div className="flex items-center gap-4">
                <span className="text-sm px-3 py-1 bg-slate-100 text-slate-500 rounded border border-slate-200 font-normal">
                  {CURRENCIES.find(c => c.code === currency)
                    ? `${currency} (${CURRENCIES.find(c => c.code === currency)!.symbol}) — ${CURRENCIES.find(c => c.code === currency)!.name}`
                    : currency}
                </span>
                <span className="text-lg">{fmt(grandTotal)}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center font-bold text-slate-800 pt-4 mt-4 border-t border-slate-200">
              <span>Amount Due</span>
              <span className="text-lg">{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
        
        {/* Notes & Terms */}
        <div className="w-full md:w-1/2 space-y-6 mt-8">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Notes / Terms</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Enter notes or terms of service..." className={`${inputClass} mt-2 h-24 resize-none`} />
          </div>
        </div>
        
        {/* Actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-4 z-40">
           <button type="button" onClick={() => router.push('/invoices')} className="px-6 py-2 rounded-md font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
           <button type="submit" disabled={saving} className="px-8 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition-colors flex items-center gap-2">
             {saving && <Loader2 className="w-4 h-4 animate-spin"/>} Save Invoice
           </button>
        </div>
      </form>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {customerModalStep !== 'choice' && (
                  <button
                    type="button"
                    onClick={() => setCustomerModalStep('choice')}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2 className="text-xl font-bold text-slate-800">
                  {customerModalStep === 'choice' && 'Add a customer'}
                  {customerModalStep === 'new' && 'New customer'}
                  {customerModalStep === 'existing' && 'Choose existing customer'}
                </h2>
              </div>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5"/></button>
            </div>

            {/* Step: Choice */}
            {customerModalStep === 'choice' && (
              <div className="p-8 grid grid-cols-2 gap-5">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerForm({ customer_code: '', customer_type: 'business', customer_name: '', company_name: '', email: '', phone: '', billing_address_1: '', billing_address_2: '', city: '', state: '', postal_code: '', country: 'IN', currency: 'INR', gstin: '', pan: '', registration_number: '' });
                    setCustomerModalStep('new');
                  }}
                  className="group flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 p-10 transition-all cursor-pointer text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <UserPlus className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-base">New customer</p>
                    <p className="text-sm text-slate-500 mt-1">Create and add a brand new customer</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setExistingCustomerId(''); setCustomerModalStep('existing'); }}
                  className="group flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 p-10 transition-all cursor-pointer text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-slate-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <Users className="w-7 h-7 text-slate-500 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-base">Existing customer</p>
                    <p className="text-sm text-slate-500 mt-1">Pick from your saved customers</p>
                  </div>
                </button>
              </div>
            )}

            {/* Step: Choose existing */}
            {customerModalStep === 'existing' && (
              <div className="p-6 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase">Select customer</label>
                  <select
                    value={existingCustomerId}
                    onChange={e => setExistingCustomerId(e.target.value)}
                    className={`${inputClass} mt-2`}
                  >
                    <option value="">— choose a customer —</option>
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.customer_name}{c.company_name ? ` — ${c.company_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preview selected customer details */}
                {existingCustomerId && (() => {
                  const c = customers.find(x => x._id === existingCustomerId);
                  if (!c) return null;
                  return (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-1 text-sm text-slate-600">
                      {c.company_name && <p className="font-semibold text-slate-800">{c.company_name}</p>}
                      {c.email && <p>{c.email}</p>}
                      {c.phone && <p>{c.phone}</p>}
                      {c.billing_address_1 && <p>{c.billing_address_1}{c.city ? `, ${c.city}` : ''}</p>}
                      <p className="text-xs text-slate-400 pt-1">{c.currency} · {c.country}{c.gstin ? ` · GSTIN: ${c.gstin}` : ''}</p>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowCustomerModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md border border-slate-200 cursor-pointer">Cancel</button>
                  <button
                    type="button"
                    disabled={!existingCustomerId}
                    onClick={() => {
                      const c = customers.find(x => x._id === existingCustomerId);
                      if (c) {
                        setSelectedCustomer(c);
                        setCustomerId(c._id);
                        setShowCustomerModal(false);
                      }
                    }}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Select customer
                  </button>
                </div>
              </div>
            )}

            {/* Step: New customer form */}
            {customerModalStep === 'new' && (
              <form onSubmit={handleCreateCustomer} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Customer Type</label>
                    <select value={customerForm.customer_type} onChange={e => setCustomerForm(p => ({...p, customer_type: e.target.value}))} className={`${inputClass} mt-1`}>
                      <option value="business">Business</option>
                      <option value="individual">Individual</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Customer Code</label>
                    <input value={customerForm.customer_code} onChange={e => setCustomerForm(p => ({...p, customer_code: e.target.value}))} placeholder="e.g. CUST-001" className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Contact Name *</label>
                    <input value={customerForm.customer_name} onChange={e => setCustomerForm(p => ({...p, customer_name: e.target.value}))} className={`${inputClass} mt-1`} required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Company Name</label>
                    <input value={customerForm.company_name} onChange={e => setCustomerForm(p => ({...p, company_name: e.target.value}))} className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Email</label>
                    <input type="email" value={customerForm.email} onChange={e => setCustomerForm(p => ({...p, email: e.target.value}))} className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Phone</label>
                    <input value={customerForm.phone} onChange={e => setCustomerForm(p => ({...p, phone: e.target.value}))} className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Currency</label>
                    <select value={customerForm.currency} onChange={e => setCustomerForm(p => ({...p, currency: e.target.value}))} className={`${inputClass} mt-1`}>
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol}) — {c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-700 mb-4">Billing Address</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <input value={customerForm.billing_address_1} onChange={e => setCustomerForm(p => ({...p, billing_address_1: e.target.value}))} placeholder="Address Line 1" className={inputClass} />
                    </div>
                    <div className="col-span-2">
                      <input value={customerForm.billing_address_2} onChange={e => setCustomerForm(p => ({...p, billing_address_2: e.target.value}))} placeholder="Address Line 2" className={inputClass} />
                    </div>
                    <div>
                      <input value={customerForm.city} onChange={e => setCustomerForm(p => ({...p, city: e.target.value}))} placeholder="City" className={inputClass} />
                    </div>
                    <div>
                      <input value={customerForm.state} onChange={e => setCustomerForm(p => ({...p, state: e.target.value}))} placeholder="State / Province" className={inputClass} />
                    </div>
                    <div>
                      <input value={customerForm.postal_code} onChange={e => setCustomerForm(p => ({...p, postal_code: e.target.value}))} placeholder="Postal Code" className={inputClass} />
                    </div>
                    <div>
                      <select value={customerForm.country} onChange={e => setCustomerForm(p => ({...p, country: e.target.value}))} className={inputClass}>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-700 mb-4">Tax Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">GSTIN / Tax ID</label>
                      <input value={customerForm.gstin} onChange={e => setCustomerForm(p => ({...p, gstin: e.target.value}))} className={`${inputClass} mt-1`} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">PAN</label>
                      <input value={customerForm.pan} onChange={e => setCustomerForm(p => ({...p, pan: e.target.value}))} className={`${inputClass} mt-1`} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Registration No.</label>
                      <input value={customerForm.registration_number} onChange={e => setCustomerForm(p => ({...p, registration_number: e.target.value}))} className={`${inputClass} mt-1`} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowCustomerModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md border border-slate-200 cursor-pointer">Cancel</button>
                  <button type="submit" disabled={savingCustomer} className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 flex items-center gap-2 cursor-pointer disabled:opacity-60">
                    {savingCustomer && <Loader2 className="w-4 h-4 animate-spin"/>} Save
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* Tax Modal */}
      {showTaxModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Add Custom Tax</h2>
              <button onClick={() => setShowTaxModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreateTax} className="p-6 space-y-4">
               <div>
                 <label className="text-xs font-bold text-slate-600 uppercase">Tax ID *</label>
                 <input value={taxForm.tax_id} onChange={e => setTaxForm(p => ({...p, tax_id: e.target.value}))} placeholder="e.g. GST_18" className={`${inputClass} mt-1`} required />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-600 uppercase">Tax Name *</label>
                 <input value={taxForm.name} onChange={e => setTaxForm(p => ({...p, name: e.target.value}))} placeholder="e.g. GST 18%" className={`${inputClass} mt-1`} required />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-600 uppercase">Tax Percent *</label>
                 <input type="number" step="0.01" value={taxForm.percent} onChange={e => setTaxForm(p => ({...p, percent: e.target.value}))} className={`${inputClass} mt-1`} required />
               </div>
               <div className="flex justify-end gap-3 pt-4">
                 <button type="button" onClick={() => setShowTaxModal(false)} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 rounded">Cancel</button>
                 <button type="submit" disabled={savingTax} className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 flex items-center gap-2">
                   {savingTax && <Loader2 className="w-4 h-4 animate-spin"/>} Save Tax
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}