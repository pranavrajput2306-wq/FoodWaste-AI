const http = require('http');

function apiCall(options, data) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    r.on('error', reject);
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

(async () => {
  const ts = Date.now();
  console.log('====================================================');
  console.log('   PHASE 2C — ML PREDICTION INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  [PASS]', message);
      passed++;
    } else {
      console.error('  [FAIL]', message);
      failed++;
    }
  }

  // 1. FASTAPI DIRECT HEALTH CHECK
  console.log('1. FastAPI Direct Health Check:');
  const directHealth = await apiCall({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/health',
    method: 'GET',
  });
  assert(directHealth.status === 200 && directHealth.data.status === 'healthy', 'FastAPI direct GET /health returns 200 and healthy');
  assert(directHealth.data.models_available === true, 'FastAPI reports models_available: true');

  // 2. EXPRESS -> ML GATEWAY HEALTH CHECK
  console.log('\n2. Express -> ML Gateway Health Check:');
  const gatewayHealth = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ml/health',
    method: 'GET',
  });
  assert(gatewayHealth.status === 200 && gatewayHealth.data.success === true, 'Express GET /api/ml/health returns 200 and success: true');
  assert(gatewayHealth.data.ml_service?.status === 'healthy', 'Express gateway connected to ML microservice');

  // 3. AUTHENTICATION & ORGANIZATION SETUP
  console.log('\n3. Auth & Organization Setup:');
  const userEmail = 'ml_user_' + ts + '@test.com';
  const regRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { name: 'ML Tester', email: userEmail, password: 'Password123!' }
  );
  const token = regRes.data.token;

  // Predict without org -> expect 403
  const blockedPred = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
    { food_item_id: 1, target_date: '2026-10-10', planned_quantity_prepared: 50 }
  );
  assert(blockedPred.status === 403, 'Prediction request without organization link rejected with 403');

  // Create Org A
  const orgRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/organizations', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
    { name: 'ML Test Kitchen ' + ts, organization_type: 'restaurant' }
  );
  assert(orgRes.status === 201, 'User created organization');

  // Create Food Item in Org A
  const itemRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
    { name: 'Braised Beef ' + ts, category: 'Main Course', unit: 'portions' }
  );
  assert(itemRes.status === 201, 'Food item created in organization');
  const itemId = itemRes.data.data.id;

  // 4. INPUT VALIDATION TESTS
  console.log('\n4. Input Validation:');
  const invalidDate = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
    { food_item_id: itemId, target_date: 'invalid-date-format', planned_quantity_prepared: 50 }
  );
  assert(invalidDate.status === 422, 'Invalid date format rejected with 422');

  const negativeQuantity = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
    { food_item_id: itemId, target_date: '2026-10-10', planned_quantity_prepared: -10 }
  );
  assert(negativeQuantity.status === 422, 'Negative planned quantity rejected with 422');

  // 5. TENANT ISOLATION CHECK
  console.log('\n5. Tenant Isolation:');
  const userBEmail = 'ml_userB_' + ts + '@test.com';
  const regB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { name: 'User B', email: userBEmail, password: 'Password123!' }
  );
  const tokenB = regB.data.token;
  await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/organizations', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenB } },
    { name: 'User B Org ' + ts, organization_type: 'cafeteria' }
  );

  const crossOrgPred = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenB } },
    { food_item_id: itemId, target_date: '2026-10-10', planned_quantity_prepared: 50 }
  );
  assert(crossOrgPred.status === 404, 'User B predicting for Org A item rejected with 404 (tenant isolation PASS)');

  // 6. INSUFFICIENT DATA HANDLING (Zero fake predictions)
  console.log('\n6. Insufficient Data Handling:');
  const insufDemand = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
    { food_item_id: itemId, target_date: '2026-10-10', planned_quantity_prepared: 50 }
  );
  assert(insufDemand.status === 200, 'Endpoint responds with 200 on clean refusal');
  assert(insufDemand.data.success === false && insufDemand.data.status === 'insufficient_data',
    'Returns status: "insufficient_data" without fabricating fake predictions');
  assert(insufDemand.data.message.includes('Insufficient historical records'), 'Returns informative diagnostic message');

  const insufWaste = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/waste-risk', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
    { food_item_id: itemId, target_date: '2026-10-10', planned_quantity_prepared: 50 }
  );
  assert(insufWaste.data.success === false && insufWaste.data.status === 'insufficient_data',
    'Waste-risk returns status: "insufficient_data" without fabricating fake risk scores');

  // 7. GENUINE PREDICTIONS WITH RECORDED HISTORICAL DATA
  console.log('\n7. Genuine Predictions with Recorded Historical Sequences:');
  // Seed 11 sequential historical days (2026-09-01 to 2026-09-11) for this item in Org A
  const baseDate = new Date('2026-09-01');
  for (let i = 0; i < 11; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
      { food_item_id: itemId, record_date: dateStr, quantity_prepared: 60, quantity_sold: 50, quantity_wasted: 7 }
    );
  }

  // Predict Demand on 2026-09-12 (after 11 consecutive days of history)
  const validDemandPred = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
    { food_item_id: itemId, target_date: '2026-09-12', planned_quantity_prepared: 60 }
  );
  assert(validDemandPred.status === 200 && validDemandPred.data.success === true, 'Demand prediction returns 200 & success: true');
  assert(typeof validDemandPred.data.predicted_demand_units === 'number' && validDemandPred.data.predicted_demand_units >= 0,
    `Demand predicted: ${validDemandPred.data.predicted_demand_units} ${validDemandPred.data.unit}`);
  assert(validDemandPred.data.model_used === 'LinearRegression', 'Metadata confirms LinearRegression model used');

  // Predict Waste Risk on 2026-09-12
  const validWastePred = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/waste-risk', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } },
    { food_item_id: itemId, target_date: '2026-09-12', planned_quantity_prepared: 60 }
  );
  assert(validWastePred.status === 200 && validWastePred.data.success === true, 'Waste risk prediction returns 200 & success: true');
  assert([0, 1, 2].includes(validWastePred.data.predicted_risk_level), `Waste risk level predicted: ${validWastePred.data.predicted_risk_level}`);
  assert(['Low', 'Medium', 'High'].includes(validWastePred.data.predicted_risk_label), `Waste risk label: ${validWastePred.data.predicted_risk_label}`);
  assert(validWastePred.data.model_used === 'LogisticRegression', 'Metadata confirms LogisticRegression model used');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
})();
