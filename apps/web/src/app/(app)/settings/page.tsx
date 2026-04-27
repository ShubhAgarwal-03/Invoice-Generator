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
    name: '', address: '', email: '', phone: '', logo_url: ''
  });

  useEffect(() => {
    companyService.get()
      .then(data => { if (data?.name) setForm(data); })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Building2 className="w-5 h-5 text-slate-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Company Settings</h1>
          <p className="text-slate-500 text-sm">These details appear on all your invoices and PDFs.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input name="name" value={form.name} onChange={handleChange}
              placeholder="Acme Inc." className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Address</label>
            <input name="address" value={form.address} onChange={handleChange}
              placeholder="123 Main St, City, Country" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input name="email" value={form.email} onChange={handleChange}
                placeholder="hello@acme.com" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                placeholder="+1 555 000 0000" className={inputClass} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Logo URL</label>
            <input name="logo_url" value={form.logo_url} onChange={handleChange}
              placeholder="https://acme.com/logo.png" className={inputClass} />
          </div>

          <div className="pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 
