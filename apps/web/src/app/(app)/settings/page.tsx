'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { companyService } from '@/services/company';
import { Loader2, Building2 } from 'lucide-react';

const inputClass = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', address: '', email: '', phone: '', logo_url: '',
    gstin: '', pan: '', bank_name: '', account_number: '', ifsc_code: '', branch: ''
  });

  useEffect(() => {
    companyService.get()
      .then(data => { if (data?.name) setForm(f => ({ ...f, ...data })); })
      .catch(() => toast.error('Failed to load company settings'))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      await companyService.save(form);
      toast.success('Company settings saved.');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Building2 className="w-5 h-5 text-slate-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Company Settings</h1>
          <p className="text-slate-500 text-sm">These details appear on all invoices and PDFs.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-700">Basic Information</h2>
          <div>
            <label className="text-sm font-medium text-slate-700">Company Name <span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Acme Inc." className={`${inputClass} mt-1`} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Address</label>
            <input name="address" value={form.address} onChange={handleChange} placeholder="123 Main St, City, State, PIN" className={`${inputClass} mt-1`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input name="email" value={form.email} onChange={handleChange} placeholder="hello@acme.com" className={`${inputClass} mt-1`} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" className={`${inputClass} mt-1`} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Logo URL</label>
            <input name="logo_url" value={form.logo_url} onChange={handleChange} placeholder="https://acme.com/logo.png" className={`${inputClass} mt-1`} />
          </div>
        </div>

        {/* Tax Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-700">Tax Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">GSTIN</label>
              <input name="gstin" value={form.gstin} onChange={handleChange} placeholder="22AAAAA0000A1Z5" className={`${inputClass} mt-1`} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">PAN</label>
              <input name="pan" value={form.pan} onChange={handleChange} placeholder="AAAAA0000A" className={`${inputClass} mt-1`} />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-700">Bank Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Bank Name</label>
              <input name="bank_name" value={form.bank_name} onChange={handleChange} placeholder="State Bank of India" className={`${inputClass} mt-1`} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Account Number</label>
              <input name="account_number" value={form.account_number} onChange={handleChange} placeholder="1234567890" className={`${inputClass} mt-1`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">IFSC Code</label>
              <input name="ifsc_code" value={form.ifsc_code} onChange={handleChange} placeholder="SBIN0001234" className={`${inputClass} mt-1`} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Branch</label>
              <input name="branch" value={form.branch} onChange={handleChange} placeholder="MG Road, Bengaluru" className={`${inputClass} mt-1`} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}