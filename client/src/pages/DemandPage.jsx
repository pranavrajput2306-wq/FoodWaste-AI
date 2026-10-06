import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { demandApi, foodItemsApi } from '../api/axios';
import useSEO from '../hooks/useSEO';

// Helper to get local calendar date YYYY-MM-DD without UTC conversion
const getTodayCalendarDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DemandPage() {
  useSEO({ title: 'Demand Records — FoodWaste AI', noindex: true });
  const [records, setRecords] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterItemId, setFilterItemId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    food_item_id: '',
    record_date: getTodayCalendarDate(),
    quantity_prepared: '',
    quantity_sold: '',
    quantity_wasted: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    fetchFoodItems();
    fetchRecords();
  }, []);

  const fetchFoodItems = async () => {
    try {
      const res = await foodItemsApi.list();
      setFoodItems(res.data.data || []);
    } catch {}
  };

  const fetchRecords = async (itemId = filterItemId) => {
    try {
      setLoading(true);
      const params = {};
      if (itemId) params.food_item_id = itemId;
      const res = await demandApi.list(params);
      setRecords(res.data.data || []);
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to fetch demand records.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const val = e.target.value;
    setFilterItemId(val);
    fetchRecords(val);
  };

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormData({
      food_item_id: foodItems[0]?.id || '',
      record_date: getTodayCalendarDate(),
      quantity_prepared: '',
      quantity_sold: '',
      quantity_wasted: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (rec) => {
    setEditingRecord(rec);
    setFormData({
      food_item_id: rec.food_item_id,
      record_date: rec.record_date,
      quantity_prepared: rec.quantity_prepared,
      quantity_sold: rec.quantity_sold,
      quantity_wasted: rec.quantity_wasted,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    setFormError('');
  };

  // Client-side live calculation & validation
  const preparedNum = parseFloat(formData.quantity_prepared) || 0;
  const soldNum     = parseFloat(formData.quantity_sold) || 0;
  const wastedNum   = parseFloat(formData.quantity_wasted) || 0;
  const totalAccounted = soldNum + wastedNum;
  const hasLogicalViolation = (formData.quantity_prepared !== '' && formData.quantity_sold !== '' && formData.quantity_wasted !== '') &&
    (totalAccounted > preparedNum || wastedNum > preparedNum);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.food_item_id) {
      setFormError('Please select a food item.');
      return;
    }
    if (!formData.record_date) {
      setFormError('Record date is required.');
      return;
    }
    if (preparedNum < 0 || soldNum < 0 || wastedNum < 0) {
      setFormError('Quantities must be non-negative numbers.');
      return;
    }
    if (wastedNum > preparedNum) {
      setFormError('Quantity wasted cannot exceed quantity prepared.');
      return;
    }
    if (totalAccounted > preparedNum) {
      setFormError(`Sold (${soldNum}) + Wasted (${wastedNum}) = ${totalAccounted}, which exceeds Prepared (${preparedNum}).`);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        food_item_id: Number(formData.food_item_id),
        record_date: formData.record_date,
        quantity_prepared: preparedNum,
        quantity_sold: soldNum,
        quantity_wasted: wastedNum,
      };

      if (editingRecord) {
        await demandApi.update(editingRecord.id, payload);
        setAlert({ type: 'success', message: 'Demand record updated successfully.' });
      } else {
        await demandApi.create(payload);
        setAlert({ type: 'success', message: 'Demand record logged successfully.' });
      }
      handleCloseModal();
      fetchRecords();
    } catch (err) {
      setFormError(err.message || 'Failed to save demand record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rec) => {
    if (!window.confirm(`Delete demand record for ${rec.food_item_name} on ${rec.record_date}?`)) {
      return;
    }
    try {
      await demandApi.delete(rec.id);
      setAlert({ type: 'success', message: 'Record deleted.' });
      fetchRecords();
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to delete record.' });
    }
  };

  return (
    <AppLayout>
      {/* Header */}
      <header
        className="px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            📈 Historical Demand Data
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Log and review accurate preparation, consumption, and waste records
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          disabled={foodItems.length === 0}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#2F7D5A] hover:bg-[#263B32] disabled:opacity-50 text-white transition-all shadow-xs flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>Log Demand Record</span>
        </button>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 min-w-0">
        {/* Alert */}
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

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs text-[#66736C] font-medium">Filter by Food Item:</span>
            <select
              value={filterItemId}
              onChange={handleFilterChange}
              className="px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-white border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A] shadow-xs"
            >
              <option value="">All Food Items</option>
              {foodItems.map((fi) => (
                <option key={fi.id} value={fi.id}>
                  {fi.name} ({fi.unit})
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-[#66736C]">
            Total records: {records.length}
          </span>
        </div>

        {/* Warning if no food items */}
        {foodItems.length === 0 && !loading && (
          <div className="p-4 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#C89B3C] text-xs flex items-center justify-between">
            <span>You need at least one food item before logging demand records.</span>
            <a href="/food-items" className="underline font-semibold ml-2">Add Food Item →</a>
          </div>
        )}

        {/* Records Table */}
        <div className="glass rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-[#66736C]">Loading demand logs...</div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center text-[#66736C]">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm font-semibold text-[#17251F]">No demand records found</p>
              <p className="text-xs text-[#66736C] mt-1">
                {filterItemId ? 'No records match this food item filter.' : 'Record your first day of consumption data.'}
              </p>
              {foodItems.length > 0 && !filterItemId && (
                <button
                  onClick={handleOpenAdd}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#DCEDE4] text-[#2F7D5A] border border-[#2F7D5A]/30 hover:bg-[#2F7D5A] hover:text-white transition-all"
                >
                  + Log Demand Record
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th className="py-3.5 px-6 text-xs font-semibold">Date</th>
                    <th className="py-3.5 px-6 text-xs font-semibold">Food Item</th>
                    <th className="py-3.5 px-6 text-xs font-semibold">Prepared</th>
                    <th className="py-3.5 px-6 text-xs font-semibold">Sold</th>
                    <th className="py-3.5 px-6 text-xs font-semibold">Wasted</th>
                    <th className="py-3.5 px-6 text-xs font-semibold">Waste Rate</th>
                    <th className="py-3.5 px-6 text-xs font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8E4]">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#F7F8F4] transition-colors">
                      <td className="py-3.5 px-6 font-mono text-xs text-[#66736C]">{rec.record_date}</td>
                      <td className="py-3.5 px-6">
                        <p className="font-medium text-[#17251F]">{rec.food_item_name}</p>
                        <p className="text-[10px] text-[#66736C]">{rec.food_item_category}</p>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-xs text-[#17251F]">
                        {rec.quantity_prepared} {rec.unit}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-xs text-[#2F7D5A] font-semibold">
                        {rec.quantity_sold} {rec.unit}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-xs text-[#C45B52] font-semibold">
                        {rec.quantity_wasted} {rec.unit}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            rec.waste_percentage > 20
                              ? 'bg-[#C45B52]/10 text-[#C45B52] border-[#C45B52]/20'
                              : rec.waste_percentage > 10
                              ? 'bg-[#C89B3C]/10 text-[#C89B3C] border-[#C89B3C]/20'
                              : 'bg-[#DCEDE4] text-[#2F7D5A] border-[#2F7D5A]/20'
                          }`}
                        >
                          {rec.waste_percentage}%
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-[#263B32] bg-[#F7F8F4] border border-[#E3E8E4] hover:bg-[#DCEDE4] transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rec)}
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17251F]/50 backdrop-blur-xs">
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6 bg-white shadow-2xl space-y-5 border border-[#E3E8E4]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#17251F]">
                {editingRecord ? 'Edit Demand Record' : 'Log Demand Record'}
              </h3>
              <button onClick={handleCloseModal} className="text-[#66736C] hover:text-[#17251F] text-lg">✕</button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg text-xs bg-[#C45B52]/10 border border-[#C45B52]/20 text-[#C45B52]">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#17251F] mb-1">
                    Food Item <span className="text-[#2F7D5A]">*</span>
                  </label>
                  <select
                    value={formData.food_item_id}
                    onChange={(e) => setFormData({ ...formData, food_item_id: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A]"
                    required
                  >
                    <option value="" disabled>Select food item...</option>
                    {foodItems.map((fi) => (
                      <option key={fi.id} value={fi.id}>
                        {fi.name} ({fi.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#17251F] mb-1">
                    Record Date <span className="text-[#2F7D5A]">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.record_date}
                    onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#17251F] mb-1">
                    Quantity Prepared <span className="text-[#2F7D5A]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.quantity_prepared}
                    onChange={(e) => setFormData({ ...formData, quantity_prepared: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#17251F] mb-1">
                    Quantity Sold <span className="text-[#2F7D5A]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.quantity_sold}
                    onChange={(e) => setFormData({ ...formData, quantity_sold: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#17251F] mb-1">
                    Quantity Wasted <span className="text-[#2F7D5A]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.quantity_wasted}
                    onChange={(e) => setFormData({ ...formData, quantity_wasted: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A]"
                    required
                  />
                </div>
              </div>

              {/* Real-time Logical Validation Feedback */}
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                  hasLogicalViolation
                    ? 'bg-[#C45B52]/10 border border-[#C45B52]/30 text-[#C45B52]'
                    : 'bg-[#DCEDE4] border border-[#2F7D5A]/30 text-[#17251F]'
                }`}
              >
                <div>
                  <span className="font-semibold">Integrity Check:</span> Sold ({soldNum}) + Wasted ({wastedNum}) = {totalAccounted}
                  {preparedNum > 0 && ` of ${preparedNum} Prepared`}
                </div>
                {hasLogicalViolation ? (
                  <span className="text-[#C45B52] font-bold">⚠️ Exceeds Prepared!</span>
                ) : (
                  <span className="text-[#2F7D5A] font-semibold">✓ Valid</span>
                )}
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-[#66736C] hover:text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || hasLogicalViolation}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#2F7D5A] hover:bg-[#263B32] disabled:opacity-50 transition-all shadow-xs"
                >
                  {saving ? 'Saving...' : editingRecord ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
