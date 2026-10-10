/**
 * Demand Validation Regression Test Suite
 * Verifies non-negative quantity validation and business rules on both CREATE and UPDATE:
 *   - prepared = -5 -> rejected with 422 & 'Quantity prepared cannot be negative.'
 *   - sold = -1     -> rejected with 422 & 'Quantity sold cannot be negative.'
 *   - wasted = -1   -> rejected with 422 & 'Quantity wasted cannot be negative.'
 *   - valid zero quantities -> accepted (201 / 200)
 *   - valid positive quantities -> accepted (201 / 200)
 *   - sold + wasted > prepared -> rejected with 422
 *   - wasted > prepared -> rejected with 422
 */

const http = require('http');

function apiCall(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

(async () => {
  console.log('========================================================');
  console.log('   DEMAND DATA VALIDATION REGRESSION TEST SUITE');
  console.log('========================================================\n');

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

  const ts = Date.now();

  // 1. Setup authenticated user and organization
  console.log('1. User and Organization Setup:');
  const regRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { name: 'Validation Tester', email: `val_${ts}@test.com`, password: 'Password123!' }
  );
  assert(regRes.status === 201 && regRes.data.token, 'User registered successfully');
  const token = regRes.data.token;

  await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/organizations', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { name: `Validation Kitchen ${ts}`, organization_type: 'restaurant' }
  );

  const itemRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { name: `Test Item ${ts}`, category: 'Bakery', unit: 'portions' }
  );
  assert(itemRes.status === 201, 'Food item created');
  const foodItemId = itemRes.data.data.id;

  // 2. CREATE Demand Record - Negative Quantity Rejections
  console.log('\n2. CREATE Demand Record — Negative Quantity Rejections:');

  // prepared = -5
  const negPrep = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-01', quantity_prepared: -5, quantity_sold: 0, quantity_wasted: 0 }
  );
  assert(negPrep.status === 422, 'prepared = -5 is rejected with HTTP 422');
  const prepErrMsg = negPrep.data.errors?.find(e => e.field === 'quantity_prepared')?.message;
  assert(prepErrMsg === 'Quantity prepared cannot be negative.', `Returns error message: "${prepErrMsg}"`);

  // sold = -1
  const negSold = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-02', quantity_prepared: 10, quantity_sold: -1, quantity_wasted: 0 }
  );
  assert(negSold.status === 422, 'sold = -1 is rejected with HTTP 422');
  const soldErrMsg = negSold.data.errors?.find(e => e.field === 'quantity_sold')?.message;
  assert(soldErrMsg === 'Quantity sold cannot be negative.', `Returns error message: "${soldErrMsg}"`);

  // wasted = -1
  const negWasted = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-03', quantity_prepared: 10, quantity_sold: 5, quantity_wasted: -1 }
  );
  assert(negWasted.status === 422, 'wasted = -1 is rejected with HTTP 422');
  const wastedErrMsg = negWasted.data.errors?.find(e => e.field === 'quantity_wasted')?.message;
  assert(wastedErrMsg === 'Quantity wasted cannot be negative.', `Returns error message: "${wastedErrMsg}"`);

  // 3. CREATE Demand Record — Logical Bound Violations
  console.log('\n3. CREATE Demand Record — Logical Bound Violations:');

  // sold + wasted > prepared (e.g. 50 + 60 = 110 > 100)
  const exceedTotal = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-04', quantity_prepared: 100, quantity_sold: 60, quantity_wasted: 50 }
  );
  assert(exceedTotal.status === 422, 'sold (60) + wasted (50) > prepared (100) rejected with HTTP 422');
  const totalErrMsg = exceedTotal.data.errors?.find(e => e.message.includes('cannot exceed quantity prepared'))?.message;
  assert(totalErrMsg === 'Quantity sold plus quantity wasted cannot exceed quantity prepared.', `Returns message: "${totalErrMsg}"`);

  // wasted > prepared (e.g. wasted 105 > prepared 100)
  const exceedWasted = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-04', quantity_prepared: 100, quantity_sold: 0, quantity_wasted: 105 }
  );
  assert(exceedWasted.status === 422, 'wasted (105) > prepared (100) rejected with HTTP 422');

  // 4. CREATE Demand Record — Valid Quantities
  console.log('\n4. CREATE Demand Record — Valid Zero and Positive Quantities:');

  // valid zero quantities: prepared = 0, sold = 0, wasted = 0
  const validZero = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-05', quantity_prepared: 0, quantity_sold: 0, quantity_wasted: 0 }
  );
  assert(validZero.status === 201, 'prepared = 0, sold = 0, wasted = 0 accepted with HTTP 201');

  // valid positive quantities: prepared = 50, sold = 40, wasted = 5
  const validPos = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-06', quantity_prepared: 50, quantity_sold: 40, quantity_wasted: 5 }
  );
  assert(validPos.status === 201, 'prepared = 50, sold = 40, wasted = 5 accepted with HTTP 201');
  const createdRecordId = validPos.data.data?.id;

  // 5. UPDATE Demand Record — Validation Enforcement
  console.log('\n5. UPDATE Demand Record — Validation Enforcement:');

  // Update with prepared = -5
  const updateNegPrep = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${createdRecordId}`, method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-06', quantity_prepared: -5, quantity_sold: 0, quantity_wasted: 0 }
  );
  assert(updateNegPrep.status === 422, 'UPDATE with prepared = -5 rejected with HTTP 422');
  const upPrepMsg = updateNegPrep.data.errors?.find(e => e.field === 'quantity_prepared')?.message;
  assert(upPrepMsg === 'Quantity prepared cannot be negative.', `UPDATE error message: "${upPrepMsg}"`);

  // Update with sold = -1
  const updateNegSold = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${createdRecordId}`, method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-06', quantity_prepared: 50, quantity_sold: -1, quantity_wasted: 0 }
  );
  assert(updateNegSold.status === 422, 'UPDATE with sold = -1 rejected with HTTP 422');

  // Update with wasted = -1
  const updateNegWasted = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${createdRecordId}`, method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-06', quantity_prepared: 50, quantity_sold: 40, quantity_wasted: -1 }
  );
  assert(updateNegWasted.status === 422, 'UPDATE with wasted = -1 rejected with HTTP 422');

  // Update with sold + wasted > prepared
  const updateExceed = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${createdRecordId}`, method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-06', quantity_prepared: 50, quantity_sold: 45, quantity_wasted: 10 }
  );
  assert(updateExceed.status === 422, 'UPDATE with sold + wasted > prepared rejected with HTTP 422');

  // Update with valid positive values: 60 prepared, 50 sold, 8 wasted
  const updateValid = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${createdRecordId}`, method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
    { food_item_id: foodItemId, record_date: '2026-10-06', quantity_prepared: 60, quantity_sold: 50, quantity_wasted: 8 }
  );
  assert(updateValid.status === 200, 'UPDATE with valid quantities (60/50/8) accepted with HTTP 200');

  console.log('\n========================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) process.exit(1);
})();
