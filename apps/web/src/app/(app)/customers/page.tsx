'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { customersService } from '@/services/customers';
import { Customer } from '@/types';
import { Loader2, Users, Plus, Pencil, Trash2 } from 'lucide-react';

const COUNTRIES = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' }, { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'UAE' },
  { code: 'BR', name: 'Brazil' }, { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' }, { code: 'KE', name: 'Kenya' },
];

const emptyForm = { name: '', email: '', phone: '', address: '', country: 'IN', gstin: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
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
      name: c.name, email: c.email ?? '', phone: c.phone ?? '',
      address: c.address ?? '', country: c.country, gstin: c.gstin ?? ''
    });
    setEditingId(c._id);
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
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
        toast.success('Customer saved.');
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
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  }

  const inputClass = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";
  const errorClass = "text-red-500 text-xs mt-1";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
            <p className="text-slate-500 text-sm">{customers.length} total</p>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Customer
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No customers yet.</p>
          <p className="text-slate-400 text-sm mb-4">Add your first customer to get started.</p>
          <button onClick={openCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
            Add Customer
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Name', 'Email', 'Phone', 'Country', 'Currency', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map(c => (
                <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.country}</td>
                  <td className="px-4 py-3 text-slate-500">{c.currency}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(c._id)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors">
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">
                {editingId ? 'Edit Customer' : 'New Customer'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
                <input name="name" value={form.name} onChange={handleChange}
                  placeholder="John Doe" className={`${inputClass} mt-1`} />
                {errors.name && <p className={errorClass}>{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input name="email" value={form.email} onChange={handleChange}
                    placeholder="john@example.com" className={`${inputClass} mt-1`} />
                  {errors.email && <p className={errorClass}>{errors.email}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange}
                    placeholder="+91 98765 43210" className={`${inputClass} mt-1`} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Address</label>
                <input name="address" value={form.address} onChange={handleChange}
                  placeholder="123 Main St, City" className={`${inputClass} mt-1`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Country <span className="text-red-500">*</span></label>
                  <select name="country" value={form.country} onChange={handleChange}
                    className={`${inputClass} mt-1`}>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                  {errors.country && <p className={errorClass}>{errors.country}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">GSTIN</label>
                  <input name="gstin" value={form.gstin} onChange={handleChange}
                    placeholder="22AAAAA0000A1Z5" className={`${inputClass} mt-1`} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-2">Delete Customer?</h2>
            <p className="text-slate-500 text-sm mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}