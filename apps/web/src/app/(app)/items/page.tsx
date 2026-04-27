'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { itemsService } from '@/services/items';
import { Item } from '@/types';
import { Loader2, Package, Plus, Pencil, Trash2 } from 'lucide-react';

const emptyForm = { name: '', description: '', unit_price: '', tax_percent: '0' };

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    try {
      const data = await itemsService.getAll();
      setItems(data);
    } catch {
      toast.error('Failed to load items');
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

  function openEdit(item: Item) {
    setForm({
      name: item.name,
      description: item.description ?? '',
      unit_price: String(item.unit_price),
      tax_percent: String(item.tax_percent),
    });
    setEditingId(item._id);
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.unit_price) e.unit_price = 'Unit price is required';
    else if (isNaN(Number(form.unit_price)) || Number(form.unit_price) < 0)
      e.unit_price = 'Must be a valid positive number';
    if (isNaN(Number(form.tax_percent)) || Number(form.tax_percent) < 0 || Number(form.tax_percent) > 99)
      e.tax_percent = 'Tax must be between 0 and 99';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) { toast.error('Please fix the errors before saving.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        unit_price: Number(form.unit_price),
        tax_percent: Number(form.tax_percent),
      };
      if (editingId) {
        const updated = await itemsService.update(editingId, payload);
        setItems(prev => prev.map(i => i._id === editingId ? updated : i));
      } else {
        const created = await itemsService.create(payload);
        setItems(prev => [created, ...prev]);
      }
      toast.success('Item saved.');
      setShowModal(false);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await itemsService.delete(id);
      setItems(prev => prev.filter(i => i._id !== id));
      toast.success('Item deleted.');
      setDeleteId(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
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
          <Package className="w-5 h-5 text-slate-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Items</h1>
            <p className="text-slate-500 text-sm">{items.length} in catalogue</p>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Item
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No items yet.</p>
          <p className="text-slate-400 text-sm mb-4">Add your first item to the catalogue.</p>
          <button onClick={openCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
            Add Item
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Name', 'Description', 'Unit Price', 'Tax %', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                  <td className="px-4 py-3 text-slate-500">{item.description || '—'}</td>
                  <td className="px-4 py-3 text-slate-700 font-mono">{item.unit_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-500">{item.tax_percent}%</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(item)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(item._id)}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">
                {editingId ? 'Edit Item' : 'New Item'}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input name="name" value={form.name} onChange={handleChange}
                  placeholder="Web Design Services" className={`${inputClass} mt-1`} />
                {errors.name && <p className={errorClass}>{errors.name}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <input name="description" value={form.description} onChange={handleChange}
                  placeholder="Brief description of the item" className={`${inputClass} mt-1`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Unit Price <span className="text-red-500">*</span>
                  </label>
                  <input name="unit_price" value={form.unit_price} onChange={handleChange}
                    type="number" min="0" step="0.01" placeholder="0.00"
                    className={`${inputClass} mt-1`} />
                  {errors.unit_price && <p className={errorClass}>{errors.unit_price}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Tax %</label>
                  <input name="tax_percent" value={form.tax_percent} onChange={handleChange}
                    type="number" min="0" max="99" step="0.01" placeholder="0"
                    className={`${inputClass} mt-1`} />
                  {errors.tax_percent && <p className={errorClass}>{errors.tax_percent}</p>}
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
            <h2 className="font-semibold text-slate-800 mb-2">Delete Item?</h2>
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