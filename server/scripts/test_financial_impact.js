const http = require('http');

function apiCall(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function req(method, path, data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api${path}`,
    method,
    headers,
  }, data);
}

async function runFinancialImpactTests() {
  console.log('====================================================');
  console.log('   FINANCIAL IMPACT & COST ANALYSIS TEST SUITE      ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const timestamp = Date.now();
  let tokenA, itemA1, itemA2, itemA3;
  let tokenB, itemB1;

  try {
    // -------------------------------------------------------------------------
    // 1. User & Organization Setup
    // -------------------------------------------------------------------------
    console.log('1. User & Organization Setup:');
    const userARes = await req('POST', '/auth/register', {
      name: 'Finance User A',
      email: `fin_a_${timestamp}@test.com`,
      password: 'Password123!',
    });
    tokenA = userARes.data?.token;
    assert(userARes.status === 201 && tokenA, 'User A registered and token received');

    const orgARes = await req('POST', '/organizations', {
      name: `Org Finance A ${timestamp}`,
      organization_type: 'restaurant',
    }, tokenA);
    assert(orgARes.status === 201, 'Org A created');

    const userBRes = await req('POST', '/auth/register', {
      name: 'Finance User B',
      email: `fin_b_${timestamp}@test.com`,
      password: 'Password123!',
    });
    tokenB = userBRes.data?.token;
    assert(userBRes.status === 201 && tokenB, 'User B registered and token received');

    const orgBRes = await req('POST', '/organizations', {
      name: `Org Finance B ${timestamp}`,
      organization_type: 'cafeteria',
    }, tokenB);
    assert(orgBRes.status === 201, 'Org B created');

    // -------------------------------------------------------------------------
    // 2. Unit Cost Validation Rules
    // -------------------------------------------------------------------------
    console.log('\n2. Unit Cost Input Validation:');

    // 2a. Negative unit cost should be rejected with 422
    const negCostRes = await req('POST', '/food-items', {
      name: `Negative Cost Dish ${timestamp}`,
      unit_cost: -5.5,
    }, tokenA);
    assert(negCostRes.status === 422, 'Negative unit cost correctly rejected with 422');

    // 2b. Zero unit cost should be valid
    const zeroCostRes = await req('POST', '/food-items', {
      name: `Complimentary Bread ${timestamp}`,
      unit: 'baskets',
      unit_cost: 0,
    }, tokenA);
    assert(zeroCostRes.status === 201 && Number(zeroCostRes.data?.data?.unit_cost) === 0, 'Zero unit cost accepted as valid');

    // 2c. Valid decimal unit cost (e.g. 15.50)
    const validCostRes = await req('POST', '/food-items', {
      name: `Grilled Salmon ${timestamp}`,
      category: 'Seafood',
      unit: 'portions',
      unit_cost: 15.5,
    }, tokenA);
    itemA1 = validCostRes.data?.data;
    assert(
      validCostRes.status === 201 && Number(itemA1.unit_cost) === 15.5,
      'Valid decimal unit cost ($15.50) saved correctly'
    );

    // 2d. Missing / NULL unit cost handled safely
    const nullCostRes = await req('POST', '/food-items', {
      name: `Seasonal Stew ${timestamp}`,
      category: 'Soup',
      unit: 'bowls',
    }, tokenA);
    itemA2 = nullCostRes.data?.data;
    assert(
      nullCostRes.status === 201 && itemA2.unit_cost === null,
      'Missing unit cost defaults safely to null'
    );

    // 2e. Update item: adding unit cost to previously null item
    const updateCostRes = await req('PUT', `/food-items/${itemA2.id}`, {
      name: itemA2.name,
      category: itemA2.category,
      unit: itemA2.unit,
      unit_cost: 8.0,
    }, tokenA);
    assert(
      updateCostRes.status === 200 && Number(updateCostRes.data?.data?.unit_cost) === 8.0,
      'Updated unit cost from null to 8.00 successfully'
    );

    // 2f. Create item without cost to test missing-cost exclusion
    const uncostedRes = await req('POST', '/food-items', {
      name: `Uncosted Salad ${timestamp}`,
      category: 'Salad',
      unit: 'plates',
    }, tokenA);
    itemA3 = uncostedRes.data?.data;
    assert(itemA3.unit_cost === null, 'Third item created with null unit cost');

    // -------------------------------------------------------------------------
    // 3. Organization Isolation on Cost Data
    // -------------------------------------------------------------------------
    console.log('\n3. Organization Cost Data Isolation:');

    // Create item in Org B with different cost
    const itemBRes = await req('POST', '/food-items', {
      name: `Org B Special ${timestamp}`,
      unit_cost: 45.0,
    }, tokenB);
    itemB1 = itemBRes.data?.data;

    // Org B listing items must not see Org A items or their costs
    const listBRes = await req('GET', '/food-items', null, tokenB);
    const orgBItemIds = (listBRes.data?.data || []).map((i) => i.id);
    assert(
      !orgBItemIds.includes(itemA1.id) && orgBItemIds.includes(itemB1.id),
      'Org B item listing excludes Org A items'
    );

    // Org B direct query to Org A item ID returns 404
    const directQueryB = await req('GET', `/food-items/${itemA1.id}`, null, tokenB);
    assert(directQueryB.status === 404, 'Org B querying Org A item returns 404 (isolation PASS)');

    // -------------------------------------------------------------------------
    // 4. Financial Impact Calculations with Demand Records
    // -------------------------------------------------------------------------
    console.log('\n4. Real Demand & Waste Cost Calculations:');

    // Seed demand records for Org A
    // Item A1 (cost $15.50):
    // Day 1: 50 prepared, 40 sold, 10 wasted -> waste cost = 10 * 15.50 = $155.00
    // Day 2: 60 prepared, 55 sold, 5 wasted  -> waste cost = 5 * 15.50  = $77.50
    // Day 3: 50 prepared, 48 sold, 2 wasted  -> waste cost = 2 * 15.50  = $31.00
    // Total wasted A1 = 17 portions. Total waste cost A1 = 17 * 15.50 = $263.50
    // Best observed waste rate = Day 3 (2 / 50 = 4.0%).
    // Expected waste at best rate = 160 * 0.04 = 6.4 portions.
    // Excess waste = 17 - 6.4 = 10.6 portions.
    // Potential savings A1 = 10.6 * 15.50 = $164.30.

    await req('POST', '/demand', {
      food_item_id: itemA1.id,
      record_date: '2026-10-01',
      quantity_prepared: 50,
      quantity_sold: 40,
      quantity_wasted: 10,
    }, tokenA);
    await req('POST', '/demand', {
      food_item_id: itemA1.id,
      record_date: '2026-10-02',
      quantity_prepared: 60,
      quantity_sold: 55,
      quantity_wasted: 5,
    }, tokenA);
    await req('POST', '/demand', {
      food_item_id: itemA1.id,
      record_date: '2026-10-03',
      quantity_prepared: 50,
      quantity_sold: 48,
      quantity_wasted: 2,
    }, tokenA);

    // Item A2 (cost $8.00):
    // Day 1: 30 prepared, 30 sold, 0 wasted -> waste cost = $0.00
    await req('POST', '/demand', {
      food_item_id: itemA2.id,
      record_date: '2026-10-01',
      quantity_prepared: 30,
      quantity_sold: 30,
      quantity_wasted: 0,
    }, tokenA);

    // Item A3 (unit_cost NULL):
    // Day 1: 20 prepared, 12 sold, 8 wasted -> MUST BE EXCLUDED from monetary totals!
    await req('POST', '/demand', {
      food_item_id: itemA3.id,
      record_date: '2026-10-01',
      quantity_prepared: 20,
      quantity_sold: 12,
      quantity_wasted: 8,
    }, tokenA);

    // Call GET /api/analytics/financial-impact
    const finResA = await req('GET', '/analytics/financial-impact', null, tokenA);

    assert(finResA.status === 200, 'GET /api/analytics/financial-impact returns 200');
    const finDataA = finResA.data?.data;

    // Verify Total Waste Cost
    // A1 waste cost = 263.50
    // A2 waste cost = 0.00
    // A3 uncosted = excluded!
    // Org total waste cost = 263.50
    assert(finDataA.totals.total_waste_cost === 263.5, `total_waste_cost is 263.50 (got ${finDataA.totals.total_waste_cost})`);

    // Verify Uncosted items list & exclusion
    assert(finDataA.cost_coverage.items_without_cost_count === 1, 'items_without_cost_count is 1');
    assert(finDataA.items_without_cost.some((i) => i.id === itemA3.id), 'Item A3 is correctly listed in items_without_cost');

    const itemA3Breakdown = finDataA.item_breakdown.find((i) => i.id === itemA3.id);
    assert(itemA3Breakdown && itemA3Breakdown.total_waste_cost === null, 'Item A3 total_waste_cost is null (not 0, not fabricated)');

    // Verify Zero Waste calculation for Item A2
    const itemA2Breakdown = finDataA.item_breakdown.find((i) => i.id === itemA2.id);
    assert(itemA2Breakdown && itemA2Breakdown.total_waste_cost === 0, 'Item A2 zero waste results in $0.00 waste cost');

    // Verify Defensible Potential Savings
    assert(finDataA.totals.total_potential_savings === 164.3, `total_potential_savings is 164.30 (got ${finDataA.totals.total_potential_savings})`);
    assert(finDataA.totals.potential_savings_status === 'calculated', 'potential_savings_status is "calculated"');

    // Verify Highest Waste Cost Item
    assert(
      finDataA.highest_waste_cost_item && finDataA.highest_waste_cost_item.id === itemA1.id,
      'highest_waste_cost_item correctly identifies Grilled Salmon'
    );

    // Verify Periods
    assert(finDataA.totals.current_period_waste_cost !== null, 'current_period_waste_cost is calculated');
    assert(finDataA.totals.previous_period_waste_cost !== null, 'previous_period_waste_cost is calculated');

    // -------------------------------------------------------------------------
    // 5. Organization B Financial Analytics Isolation
    // -------------------------------------------------------------------------
    console.log('\n5. Cross-Tenant Financial Analytics Isolation:');

    // Seed 1 record for Org B
    // Item B1 ($45.00): 10 prepared, 8 sold, 2 wasted -> waste cost = $90.00
    await req('POST', '/demand', {
      food_item_id: itemB1.id,
      record_date: '2026-10-01',
      quantity_prepared: 10,
      quantity_sold: 8,
      quantity_wasted: 2,
    }, tokenB);

    const finResB = await req('GET', '/analytics/financial-impact', null, tokenB);
    const finDataB = finResB.data?.data;

    assert(finDataB.totals.total_waste_cost === 90.0, `Org B total_waste_cost is strictly 90.00 (got ${finDataB.totals.total_waste_cost})`);
    assert(finDataB.item_breakdown.length === 1, 'Org B financial breakdown contains only Org B items');
    assert(!finDataB.item_breakdown.some((i) => i.id === itemA1.id), 'Org B financial breakdown excludes Org A items completely');

    // -------------------------------------------------------------------------
    // 6. Insufficient Historical Data State (No Fake Savings)
    // -------------------------------------------------------------------------
    console.log('\n6. Insufficient Data & Refusal State:');
    // Org B only has 1 record for item B1 (< 3 records)
    assert(
      finDataB.totals.total_potential_savings === null &&
      finDataB.totals.potential_savings_status === 'insufficient_data',
      'Org B potential savings returns null with status "insufficient_data" (< 3 records)'
    );

    // -------------------------------------------------------------------------
    // 7. Cleanup
    // -------------------------------------------------------------------------
    console.log('\n7. Cleanup:');
    await req('DELETE', `/food-items/${itemA1.id}`, null, tokenA);
    await req('DELETE', `/food-items/${itemA2.id}`, null, tokenA);
    await req('DELETE', `/food-items/${itemA3.id}`, null, tokenA);
    await req('DELETE', `/food-items/${itemB1.id}`, null, tokenB);
    assert(true, 'Test items cleaned up');

  } catch (error) {
    console.error('Unexpected test error:', error);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFinancialImpactTests();
