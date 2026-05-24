'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { customersService } from '@/services/customers';
import { Customer } from '@/types';
import { Loader2, Users, Plus, Pencil, Trash2, X } from 'lucide-react';

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

const emptyForm: Omit<Customer, '_id' | 'createdAt'> = {
  customer_code: '',
  customer_type: 'business',
  customer_name: '',
  company_name: '',
  email: '',
  phone: '',
  address: '',
  billing_address_1: '',
  billing_address_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'IN',
  currency: 'INR',
  gstin: '',
  pan: '',
  registration_number: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Customer, '_id' | 'createdAt'>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    try {
      const data = await customersService.getAll();
      setCustomers(data);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(c: Customer) {
    setForm({
      customer_code: c.customer_code ?? '',
      customer_type: c.customer_type,
      customer_name: c.customer_name,
      company_name: c.company_name ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      billing_address_1: c.billing_address_1 ?? '',
      billing_address_2: c.billing_address_2 ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
      postal_code: c.postal_code ?? '',
      country: c.country,
      currency: c.currency,
      gstin: c.gstin ?? '',
      pan: c.pan ?? '',
      registration_number: c.registration_number ?? '',
    });
    setEditingId(c._id);
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.customer_name.trim()) e.customer_name = 'Contact name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Invalid email format';
    }
    if (!form.country) e.country = 'Country is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) { toast.error('Please fix the errors before saving.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await customersService.update(editingId, form);
        setCustomers(prev => prev.map(c => c._id === editingId ? updated : c));
        toast.success('Customer saved.');
      } else {
        const created = await customersService.create(form);
        setCustomers(prev => [created, ...prev]);
        toast.success('Customer created.');
      }
      setShowModal(false);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await customersService.delete(id);
      setCustomers(prev => prev.filter(c => c._id !== id));
      toast.success('Customer deleted.');
      setDeleteId(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }

  const inputClass = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";
  const errorClass = "text-red-500 text-xs mt-1";
  const labelClass = "text-xs font-bold text-slate-600 uppercase";

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-slate-400" />
            <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
            <span className="text-sm text-slate-400">{customers.length} total</span>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Customer
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No customers yet.</p>
            <p className="text-slate-400 text-sm mt-1">Add your first customer to get started.</p>
            <button onClick={openCreate} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 cursor-pointer">
              Add Customer
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Name', 'Company', 'Email', 'Phone', 'Country', 'Currency', 'GSTIN', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.customer_name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.company_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.country}</td>
                    <td className="px-4 py-3 text-slate-500">{c.currency}</td>
                    <td className="px-4 py-3 text-slate-500">{c.gstin || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(c._id)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Customer' : 'New Customer'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Customer Type</label>
                  <select name="customer_type" value={form.customer_type} onChange={handleChange} className={`${inputClass} mt-1`}>
                    <option value="business">Business</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Customer Code</label>
                  <input name="customer_code" value={form.customer_code ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} placeholder="e.g. CUST-001" />
                </div>
                <div>
                  <label className={labelClass}>Contact Name *</label>
                  <input name="customer_name" value={form.customer_name} onChange={handleChange} className={`${inputClass} mt-1`} required />
                  {errors.customer_name && <p className={errorClass}>{errors.customer_name}</p>}
                </div>
                <div>
                  <label className={labelClass}>Company Name</label>
                  <input name="company_name" value={form.company_name ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input name="email" type="email" value={form.email ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} />
                  {errors.email && <p className={errorClass}>{errors.email}</p>}
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input name="phone" value={form.phone ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} />
                </div>
                <div>
                  <label className={labelClass}>Currency</label>
                  <select name="currency" value={form.currency} onChange={handleChange} className={`${inputClass} mt-1`}>
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code} ({c.symbol}) — {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Billing Address */}
              <div className="border-t border-slate-100 pt-6">
                <h3 className="font-bold text-slate-700 mb-4">Billing Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input name="billing_address_1" value={form.billing_address_1 ?? ''} onChange={handleChange} placeholder="Address Line 1" className={inputClass} />
                  </div>
                  <div className="col-span-2">
                    <input name="billing_address_2" value={form.billing_address_2 ?? ''} onChange={handleChange} placeholder="Address Line 2" className={inputClass} />
                  </div>
                  <div>
                    <input name="city" value={form.city ?? ''} onChange={handleChange} placeholder="City" className={inputClass} />
                  </div>
                  <div>
                    <input name="state" value={form.state ?? ''} onChange={handleChange} placeholder="State / Province" className={inputClass} />
                  </div>
                  <div>
                    <input name="postal_code" value={form.postal_code ?? ''} onChange={handleChange} placeholder="Postal Code" className={inputClass} />
                  </div>
                  <div>
                    <select name="country" value={form.country} onChange={handleChange} className={inputClass}>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    {errors.country && <p className={errorClass}>{errors.country}</p>}
                  </div>
                </div>
              </div>

              {/* Tax Details */}
              <div className="border-t border-slate-100 pt-6">
                <h3 className="font-bold text-slate-700 mb-4">Tax Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>GSTIN / Tax ID</label>
                    <input name="gstin" value={form.gstin ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className={labelClass}>PAN</label>
                    <input name="pan" value={form.pan ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className={labelClass}>Registration No.</label>
                    <input name="registration_number" value={form.registration_number ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Customer?</h3>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}