import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { foodItemsApi } from '../api/axios';
import useSEO from '../hooks/useSEO';

const DEFAULT_CATEGORIES = [
  'Main Course',
  'Salad',
  'Bakery & Bread',
  'Seafood',
  'Dessert',
  'Soup',
  'Side Dish',
  'Beverage',
  'Other',
];

const DEFAULT_UNITS = [
  'portions',
  'kg',
  'plates',
  'servings',
  'bowls',
  'liters',
  'pieces',
];

export default function FoodItemsPage() {
  useSEO({ title: 'Food Items Catalog — FoodWaste AI', noindex: true });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', category: 'Main Course', unit: 'portions', unit_cost: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await foodItemsApi.list();
      setItems(res.data.data || []);
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to load food items.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({ name: '', category: 'Main Course', unit: 'portions', unit_cost: '' });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      unit_cost: item.unit_cost !== null && item.unit_cost !== undefined ? item.unit_cost : '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Food item name is required.');
      return;
    }

    const cleanCost = formData.unit_cost !== '' ? Number(formData.unit_cost) : null;
    if (cleanCost !== null && (isNaN(cleanCost) || cleanCost < 0)) {
      setFormError('Unit cost must be a non-negative number.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        unit: formData.unit,
        unit_cost: cleanCost,
      };

      if (editingItem) {
        await foodItemsApi.update(editingItem.id, payload);
        setAlert({ type: 'success', message: `Updated "${formData.name.trim()}".` });
      } else {
        await foodItemsApi.create(payload);
        setAlert({ type: 'success', message: `Added "${formData.name.trim()}" to food catalog.` });
      }
      handleCloseModal();
      fetchItems();
    } catch (err) {
      setFormError(err.message || 'Failed to save food item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete food item "${item.name}"? This will also remove any associated demand records.`)) {
      return;
    }

    try {
      await foodItemsApi.delete(item.id);
      setAlert({ type: 'success', message: `Food item "${item.name}" deleted.` });
      fetchItems();
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to delete food item.' });
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      {/* Header */}
      <header
        className="px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            🍽️ Food Items Catalog
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Manage the food items, categories, and tracking units for your organization
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#2F7D5A] hover:bg-[#263B32] text-white transition-all shadow-xs flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>Add Food Item</span>
        </button>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 min-w-0">
        {/* Alert notification */}
        {alert && (
          <div
            className={`p-4 rounded-xl text-sm flex items-center justify-between ${
              alert.type === 'error'
                ? 'bg-[#C45B52]/10 border border-[#C45B52]/30 text-[#C45B52]'
                : 'bg-[#DCEDE4] border border-[#2F7D5A]/30 text-[#2F7D5A]'
            }`}
          >
            <span>{alert.message}</span>
            <button
              onClick={() => setAlert(null)}
              className="text-[#66736C] hover:text-[#17251F] text-base ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search & Statistics Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl text-sm text-[#17251F] bg-white border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A] shadow-xs"
            />
          </div>
          <span className="text-xs text-[#66736C]">
            Showing {filteredItems.length} of {items.length} food items
          </span>
        </div>

        {/* Food Items Table */}
        <div className="glass rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-[#66736C]">Loading catalog...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-[#66736C]">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="text-sm font-semibold text-[#17251F]">No food items found</p>
              <p className="text-xs text-[#66736C] mt-1">
                {search ? 'Try modifying your search term.' : 'Get started by creating your first food item.'}
              </p>
              {!search && (
                <button
                  onClick={handleOpenAdd}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#DCEDE4] text-[#2F7D5A] border border-[#2F7D5A]/30 hover:bg-[#2F7D5A] hover:text-white transition-all"
                >
                  + Add Food Item
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th className="py-3.5 px-6 text-xs font-semibold">Name</th>
                    <th className="py-3.5 px-6 text-xs font-semibold">Category</th>
                    <th className="py-3.5 px-6 text-xs font-semibold">Standard Unit</th>
                    <th className="py-3.5 px-6 text-xs font-semibold">Unit Cost</th>
                    <th className="py-3.5 px-6 text-xs font-semibold">Logged Demand Records</th>
                    <th className="py-3.5 px-6 text-xs font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8E4]">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F7F8F4] transition-colors">
                      <td className="py-3.5 px-6 font-medium text-[#17251F]">{item.name}</td>
                      <td className="py-3.5 px-6">
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F7F8F4] border border-[#E3E8E4] text-[#263B32]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-[#66736C] text-xs font-mono">{item.unit}</td>
                      <td className="py-3.5 px-6 text-xs font-medium">
                        {item.unit_cost !== null && item.unit_cost !== undefined ? (
                          <span className="font-mono text-[#17251F]">₹{Number(item.unit_cost).toFixed(2)}</span>
                        ) : (
                          <span className="text-[#66736C]/60 text-xs italic">Not set</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="text-xs font-semibold text-[#2F7D5A] bg-[#DCEDE4] px-2 py-0.5 rounded-full border border-[#2F7D5A]/25">
                          {item.demand_record_count || 0} records
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-[#263B32] bg-[#F7F8F4] border border-[#E3E8E4] hover:bg-[#DCEDE4] transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-[#C45B52] bg-[#C45B52]/10 border border-[#C45B52]/20 hover:bg-[#C45B52]/20 transition-all"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17251F]/50 backdrop-blur-xs">
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6 bg-white shadow-2xl space-y-5 border border-[#E3E8E4]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#17251F]">
                {editingItem ? 'Edit Food Item' : 'New Food Item'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-[#66736C] hover:text-[#17251F] text-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg text-xs bg-[#C45B52]/10 border border-[#C45B52]/20 text-[#C45B52]">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#17251F] mb-1">
                  Item Name <span className="text-[#2F7D5A]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Vegetable Lasagna"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#17251F] mb-1">Category</label>
                <div className="flex gap-2">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A]"
                  >
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#17251F] mb-1">Unit of Measurement</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A]"
                >
                  {DEFAULT_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#17251F] mb-1">
                  Unit Cost (₹) <span className="text-[#66736C] font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 15.50"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A]"
                />
                <p className="text-[11px] text-[#66736C] mt-1">
                  Cost per {formData.unit || 'unit'} used to calculate financial waste impact.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#66736C] hover:text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#2F7D5A] hover:bg-[#263B32] disabled:opacity-50 transition-all shadow-xs"
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
