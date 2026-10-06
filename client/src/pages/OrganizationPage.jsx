import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { organizationApi } from '../api/axios';
import useSEO from '../hooks/useSEO';

const ORG_TYPES = [
  { value: 'restaurant',    label: 'Restaurant' },
  { value: 'cafeteria',     label: 'Cafeteria' },
  { value: 'canteen',       label: 'College / Institutional Canteen' },
  { value: 'institutional', label: 'Institutional (Hospital, School, Enterprise)' },
  { value: 'other',         label: 'Other Food Service' },
];

export default function OrganizationPage() {
  useSEO({ title: 'Organization Profile — FoodWaste AI', noindex: true });
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', organization_type: 'restaurant' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      const res = await organizationApi.getCurrent();
      const currentOrg = res.data.organization;
      if (currentOrg) {
        setOrg(currentOrg);
        setFormData({
          name: currentOrg.name,
          organization_type: currentOrg.organization_type,
        });
      } else {
        setOrg(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load organization settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Organization name is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (org) {
        // Update
        const res = await organizationApi.update(formData);
        setOrg(res.data.organization);
        setSuccess('Organization details updated successfully.');
      } else {
        // Create
        const res = await organizationApi.create(formData);
        setOrg(res.data.organization);
        setSuccess('Organization created successfully! You are assigned as Owner.');
      }
    } catch (err) {
      setError(err.message || 'Failed to save organization settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <header
        className="px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            🏢 Organization Profile
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Manage your food facility profile, type, and system access
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl space-y-6 flex-1 min-w-0">
        {success && (
          <div className="p-4 rounded-xl text-sm bg-[#DCEDE4] border border-[#2F7D5A]/30 text-[#2F7D5A] font-medium">
            {success}
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl text-sm bg-[#C45B52]/10 border border-[#C45B52]/20 text-[#C45B52]">
            {error}
          </div>
        )}

        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E3E8E4] shadow-xs p-5 sm:p-8 space-y-6">
          <div className="flex items-center gap-4 pb-6 border-b border-[#E3E8E4]">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-[#DCEDE4] border border-[#2F7D5A]/20 shadow-xs"
            >
              🏢
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#17251F]">
                {org ? org.name : 'Create Your Organization'}
              </h2>
              <p className="text-xs text-[#66736C] mt-0.5">
                {org
                  ? `Active facility linked to your account (${org.role})`
                  : 'Get started by naming your food service operation'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#17251F] mb-1.5">
                Organization / Facility Name <span className="text-[#2F7D5A]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Campus Central Cafeteria"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A] focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#17251F] mb-1.5">
                Facility Type
              </label>
              <select
                value={formData.organization_type}
                onChange={(e) => setFormData({ ...formData, organization_type: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A] focus:bg-white"
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {org && (
              <div className="p-4 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] space-y-2 text-xs text-[#66736C]">
                <div className="flex justify-between">
                  <span>Your Role:</span>
                  <span className="font-semibold text-[#17251F] capitalize">{org.role}</span>
                </div>
                {org.created_at && (
                  <div className="flex justify-between">
                    <span>Registered Since:</span>
                    <span className="font-mono text-[#17251F]">
                      {new Date(org.created_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || loading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#2F7D5A] hover:bg-[#263B32] disabled:opacity-50 transition-all shadow-xs"
              >
                {saving
                  ? 'Saving...'
                  : loading
                  ? 'Loading settings...'
                  : org
                  ? 'Update Organization Settings'
                  : 'Create & Link Organization'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
