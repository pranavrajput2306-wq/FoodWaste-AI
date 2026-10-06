import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { foodItemsApi, mlApi } from '../api/axios';
import useSEO from '../hooks/useSEO';

export default function PredictionsPage() {
  useSEO({ title: 'AI Predictions — FoodWaste AI', noindex: true });
  const [foodItems, setFoodItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [formData, setFormData] = useState({
    food_item_id: '',
    target_date: getTomorrowDate(),
    planned_quantity_prepared: '',
  });

  const [demandLoading, setDemandLoading] = useState(false);
  const [riskLoading, setRiskLoading] = useState(false);
  const [demandResult, setDemandResult] = useState(null);
  const [riskResult, setRiskResult] = useState(null);
  const [errorAlert, setErrorAlert] = useState('');

  function getTomorrowDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    fetchFoodItems();
  }, []);

  const fetchFoodItems = async () => {
    try {
      setLoadingItems(true);
      const res = await foodItemsApi.list();
      const items = res.data.data || [];
      setFoodItems(items);
      if (items.length > 0) {
        setFormData((prev) => ({
          ...prev,
          food_item_id: items[0].id,
          planned_quantity_prepared: prev.planned_quantity_prepared || '50',
        }));
      }
    } catch {
      setErrorAlert('Failed to load food items catalog.');
    } finally {
      setLoadingItems(false);
    }
  };

  const selectedItem = foodItems.find((f) => String(f.id) === String(formData.food_item_id));

  const validateInputs = () => {
    if (!formData.food_item_id) {
      setErrorAlert('Please select a food item.');
      return false;
    }
    if (!formData.target_date) {
      setErrorAlert('Target date is required.');
      return false;
    }
    const prep = parseFloat(formData.planned_quantity_prepared);
    if (isNaN(prep) || prep < 0) {
      setErrorAlert('Planned quantity must be a non-negative number.');
      return false;
    }
    setErrorAlert('');
    return true;
  };

  const handlePredictDemand = async () => {
    if (!validateInputs()) return;
    setDemandLoading(true);
    try {
      const res = await mlApi.predictDemand({
        food_item_id: Number(formData.food_item_id),
        target_date: formData.target_date,
        planned_quantity_prepared: parseFloat(formData.planned_quantity_prepared),
      });
      setDemandResult(res.data);
    } catch (err) {
      setErrorAlert(err.message || 'Demand forecast request failed.');
    } finally {
      setDemandLoading(false);
    }
  };

  const handlePredictWasteRisk = async () => {
    if (!validateInputs()) return;
    setRiskLoading(true);
    try {
      const res = await mlApi.predictWasteRisk({
        food_item_id: Number(formData.food_item_id),
        target_date: formData.target_date,
        planned_quantity_prepared: parseFloat(formData.planned_quantity_prepared),
      });
      setRiskResult(res.data);
    } catch (err) {
      setErrorAlert(err.message || 'Waste-risk prediction request failed.');
    } finally {
      setRiskLoading(false);
    }
  };

  const handleRunAll = async () => {
    if (!validateInputs()) return;
    handlePredictDemand();
    handlePredictWasteRisk();
  };

  return (
    <AppLayout>
      {/* Header */}
      <header
        className="px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            🤖 AI Predictions
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Data-driven demand forecasts and waste-risk intelligence powered by machine learning
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 flex-1 max-w-6xl min-w-0">
        {/* Error Notification */}
        {errorAlert && (
          <div className="p-4 rounded-xl text-sm bg-[#C45B52]/10 border border-[#C45B52]/20 text-[#C45B52] flex items-center justify-between">
            <span>{errorAlert}</span>
            <button onClick={() => setErrorAlert('')} className="text-[#66736C] hover:text-[#17251F]">✕</button>
          </div>
        )}

        {/* Prediction Input Form */}
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E3E8E4] shadow-xs p-5 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E3E8E4]">
            <span className="text-2xl">🎯</span>
            <div>
              <h2 className="text-base font-bold text-[#17251F]">Prediction Parameters</h2>
              <p className="text-xs text-[#66736C]">
                Select a food item and planned production volume to evaluate expected consumption and risk.
              </p>
            </div>
          </div>

          {loadingItems ? (
            <div className="py-6 text-center text-[#66736C]">Loading catalog items...</div>
          ) : foodItems.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/20 text-center text-[#17251F] space-y-2">
              <p className="text-sm font-semibold">No food items found in your organization</p>
              <p className="text-xs text-[#66736C]">Add food items first to forecast demand or waste risk.</p>
              <Link
                to="/food-items"
                className="inline-block mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#2F7D5A] hover:bg-[#263B32] text-white shadow-xs transition-all"
              >
                + Add Food Item
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Food Item Select */}
                <div>
                  <label className="block text-xs font-semibold text-[#17251F] mb-1.5">
                    Food Item <span className="text-[#2F7D5A]">*</span>
                  </label>
                  <select
                    value={formData.food_item_id}
                    onChange={(e) => setFormData({ ...formData, food_item_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A] focus:bg-white"
                  >
                    {foodItems.map((fi) => (
                      <option key={fi.id} value={fi.id}>
                        {fi.name} ({fi.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-xs font-semibold text-[#17251F] mb-1.5">
                    Target Service Date <span className="text-[#2F7D5A]">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A] focus:bg-white"
                  />
                </div>

                {/* Planned Quantity Prepared */}
                <div>
                  <label className="block text-xs font-semibold text-[#17251F] mb-1.5">
                    Planned Prepared ({selectedItem?.unit || 'units'}) <span className="text-[#2F7D5A]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 100"
                    value={formData.planned_quantity_prepared}
                    onChange={(e) => setFormData({ ...formData, planned_quantity_prepared: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A] focus:bg-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePredictDemand}
                  disabled={demandLoading}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#17251F] hover:bg-[#263B32] disabled:opacity-50 transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <span>📈</span>
                  <span>{demandLoading ? 'Forecasting...' : 'Forecast Demand'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePredictWasteRisk}
                  disabled={riskLoading}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#2F7D5A] hover:bg-[#263B32] disabled:opacity-50 transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <span>♻️</span>
                  <span>{riskLoading ? 'Evaluating...' : 'Evaluate Waste Risk'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunAll}
                  disabled={demandLoading || riskLoading}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#263B32] hover:bg-[#17251F] disabled:opacity-50 transition-all shadow-xs flex items-center justify-center gap-2 sm:ml-auto"
                >
                  <span>⚡</span>
                  <span>Run Both Models</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Prediction Outputs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 1. Demand Forecast Output */}
          <div className="bg-[#FFFFFF] rounded-2xl border border-[#E3E8E4] shadow-xs p-5 sm:p-8 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3E8E4]">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📈</span>
                  <h3 className="text-base font-bold text-[#17251F]">Demand Forecast</h3>
                </div>
                {demandResult?.status === 'success' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#DCEDE4] text-[#2F7D5A] border border-[#2F7D5A]/30 font-medium">
                    Regression Model
                  </span>
                )}
              </div>

              {demandLoading ? (
                <div className="py-12 text-center text-[#66736C]">Computing lag features & running regression model...</div>
              ) : !demandResult ? (
                <div className="py-12 text-center text-[#66736C] text-xs">
                  Click <span className="text-[#2F7D5A] font-semibold">Forecast Demand</span> above to predict customer demand volume.
                </div>
              ) : demandResult.status === 'insufficient_data' ? (
                <div className="p-5 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#17251F] space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#C89B3C]">
                    <span>⚠️</span>
                    <span>Insufficient Historical Data</span>
                  </div>
                  <p className="text-xs text-[#17251F] leading-relaxed">
                    {demandResult.message}
                  </p>
                  <p className="text-[11px] text-[#66736C]">
                    Only authentic data is accepted. Zero synthetic or fake predictions are generated.
                  </p>
                  <Link
                    to="/demand"
                    className="inline-block text-xs font-semibold text-[#C89B3C] underline hover:text-[#17251F]"
                  >
                    Log Historical Demand Records →
                  </Link>
                </div>
              ) : demandResult.status === 'model_unavailable' ? (
                <div className="p-5 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] text-[#17251F] space-y-2 text-xs">
                  <p className="font-semibold text-[#17251F]">⚙️ Model Unavailable</p>
                  <p className="text-[#66736C]">{demandResult.message}</p>
                </div>
              ) : demandResult.status === 'success' ? (
                <div className="space-y-4">
                  <div className="p-5 rounded-xl bg-[#DCEDE4]/50 border border-[#2F7D5A]/30">
                    <p className="text-xs text-[#2F7D5A] font-medium">Expected Demand</p>
                    <p className="text-3xl font-extrabold text-[#17251F] mt-1">
                      {demandResult.predicted_demand_units} <span className="text-sm font-normal text-[#66736C]">{demandResult.unit}</span>
                    </p>
                    <p className="text-xs text-[#66736C] mt-2">
                      Planned Prepared: {demandResult.planned_quantity_prepared} {demandResult.unit} | Expected Variance:{' '}
                      <span className={demandResult.planned_quantity_prepared >= demandResult.predicted_demand_units ? 'text-[#2F7D5A] font-semibold' : 'text-[#C45B52] font-semibold'}>
                        {(demandResult.planned_quantity_prepared - demandResult.predicted_demand_units).toFixed(2)} {demandResult.unit}
                      </span>
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] text-xs space-y-1.5 text-[#66736C]">
                    <div className="flex justify-between">
                      <span>Model Architecture:</span>
                      <span className="font-medium text-[#17251F]">{demandResult.model_used}</span>
                    </div>
                    {demandResult.model_metrics?.RMSE && (
                      <div className="flex justify-between">
                        <span>Test Validation RMSE:</span>
                        <span className="font-mono text-[#17251F]">{demandResult.model_metrics.RMSE}</span>
                      </div>
                    )}
                    {demandResult.model_metrics?.R2 && (
                      <div className="flex justify-between">
                        <span>Test R² Score:</span>
                        <span className="font-mono text-[#17251F]">{demandResult.model_metrics.R2}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#C45B52]/10 text-[#C45B52] text-xs">
                  {demandResult.message || 'Forecast calculation failed.'}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E3E8E4] text-[11px] text-[#66736C]">
              Demand forecast uses strictly historical consumption lags (1, 3, 7 days) and calendar temporal signals.
            </div>
          </div>

          {/* 2. Waste Risk Output */}
          <div className="bg-[#FFFFFF] rounded-2xl border border-[#E3E8E4] shadow-xs p-5 sm:p-8 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3E8E4]">
                <div className="flex items-center gap-3">
                  <span className="text-xl">♻️</span>
                  <h3 className="text-base font-bold text-[#17251F]">Food Waste Risk</h3>
                </div>
                {riskResult?.status === 'success' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#DCEDE4] text-[#2F7D5A] border border-[#2F7D5A]/30 font-medium">
                    Classification Model
                  </span>
                )}
              </div>

              {riskLoading ? (
                <div className="py-12 text-center text-[#66736C]">Evaluating waste probabilities & risk level...</div>
              ) : !riskResult ? (
                <div className="py-12 text-center text-[#66736C] text-xs">
                  Click <span className="text-[#2F7D5A] font-semibold">Evaluate Waste Risk</span> above to assess surplus risk.
                </div>
              ) : riskResult.status === 'insufficient_data' ? (
                <div className="p-5 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#17251F] space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#C89B3C]">
                    <span>⚠️</span>
                    <span>Insufficient Historical Data</span>
                  </div>
                  <p className="text-xs text-[#17251F] leading-relaxed">
                    {riskResult.message}
                  </p>
                  <p className="text-[11px] text-[#66736C]">
                    Predictions require genuine operational logs to prevent speculative waste advice.
                  </p>
                  <Link
                    to="/demand"
                    className="inline-block text-xs font-semibold text-[#C89B3C] underline hover:text-[#17251F]"
                  >
                    Log Historical Demand Records →
                  </Link>
                </div>
              ) : riskResult.status === 'model_unavailable' ? (
                <div className="p-5 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] text-[#17251F] space-y-2 text-xs">
                  <p className="font-semibold text-[#17251F]">⚙️ Model Unavailable</p>
                  <p className="text-[#66736C]">{riskResult.message}</p>
                </div>
              ) : riskResult.status === 'success' ? (
                <div className="space-y-4">
                  <div
                    className={`p-5 rounded-xl border ${
                      riskResult.predicted_risk_level === 0
                        ? 'bg-[#DCEDE4]/60 border-[#2F7D5A]/30'
                        : riskResult.predicted_risk_level === 1
                        ? 'bg-[#C89B3C]/10 border-[#C89B3C]/30'
                        : 'bg-[#C45B52]/10 border-[#C45B52]/30'
                    }`}
                  >
                    <p className="text-xs font-medium text-[#66736C]">Predicted Risk Tier</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-3xl">
                        {riskResult.predicted_risk_level === 0 ? '🟢' : riskResult.predicted_risk_level === 1 ? '🟡' : '🔴'}
                      </span>
                      <div>
                        <p
                          className={`text-2xl font-bold ${
                            riskResult.predicted_risk_level === 0
                              ? 'text-[#2F7D5A]'
                              : riskResult.predicted_risk_level === 1
                              ? 'text-[#C89B3C]'
                              : 'text-[#C45B52]'
                          }`}
                        >
                          {riskResult.predicted_risk_label} Risk
                        </p>
                        <p className="text-xs text-[#66736C]">
                          {riskResult.predicted_risk_level === 0
                            ? 'Expected surplus < 10% of prepared batch'
                            : riskResult.predicted_risk_level === 1
                            ? 'Expected surplus between 10% – 25%'
                            : 'High surplus expected (>= 25% waste risk)'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {riskResult.class_probabilities && Object.keys(riskResult.class_probabilities).length > 0 && (
                    <div className="p-4 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] text-xs space-y-2">
                      <p className="font-medium text-[#17251F] mb-1">Class Probabilities:</p>
                      {Object.entries(riskResult.class_probabilities).map(([tier, prob]) => (
                        <div key={tier} className="space-y-1">
                          <div className="flex justify-between text-[#66736C]">
                            <span>{tier} Risk</span>
                            <span className="font-mono">{(prob * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#E3E8E4] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                tier === 'Low' ? 'bg-[#2F7D5A]' : tier === 'Medium' ? 'bg-[#C89B3C]' : 'bg-[#C45B52]'
                              }`}
                              style={{ width: `${Math.max(4, prob * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] text-xs space-y-1.5 text-[#66736C]">
                    <div className="flex justify-between">
                      <span>Model Architecture:</span>
                      <span className="font-medium text-[#17251F]">{riskResult.model_used}</span>
                    </div>
                    {riskResult.model_metrics?.F1 && (
                      <div className="flex justify-between">
                        <span>Test F1 Score:</span>
                        <span className="font-mono text-[#17251F]">{riskResult.model_metrics.F1}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#C45B52]/10 text-[#C45B52] text-xs">
                  {riskResult.message || 'Risk evaluation failed.'}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E3E8E4] text-[11px] text-[#66736C]">
              Waste-risk classification guards against target leakage by using purely pre-service signals.
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
