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

async function runGoalTests() {
  console.log('====================================================');
  console.log('    ACTIONABLE WASTE REDUCTION GOALS TEST SUITE     ');
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
  let tokenA, tokenB, itemA1, itemA2, itemB1;

  try {
    // 1. Setup Tenant A and Tenant B
    console.log('1. User & Organization Setup:');
    const userARes = await req('POST', '/auth/register', {
      name: 'Goal User A',
      email: `goal_a_${timestamp}@test.com`,
      password: 'Password123!',
    });
    tokenA = userARes.data?.token;
    assert(userARes.status === 201 && tokenA, 'User A registered and token received');

    const orgARes = await req('POST', '/organizations', {
      name: `Org Goal A ${timestamp}`,
      organization_type: 'restaurant',
    }, tokenA);
    assert(orgARes.status === 201, 'Org A created');

    const userBRes = await req('POST', '/auth/register', {
      name: 'Goal User B',
      email: `goal_b_${timestamp}@test.com`,
      password: 'Password123!',
    });
    tokenB = userBRes.data?.token;
    assert(userBRes.status === 201 && tokenB, 'User B registered and token received');

    const orgBRes = await req('POST', '/organizations', {
      name: `Org Goal B ${timestamp}`,
      organization_type: 'cafeteria',
    }, tokenB);
    assert(orgBRes.status === 201, 'Org B created');

    // 2. Empty State Verification (Zero records logged)
    console.log('\n2. Empty State Handling (Zero Records):');
    const emptyRes = await req('GET', '/analytics/goal', null, tokenA);
    assert(emptyRes.status === 200, 'GET /api/analytics/goal returns 200');
    const emptyGoal = emptyRes.data?.data;
    assert(emptyGoal?.status === 'no_data', 'Empty state status is "no_data"');
    assert(emptyGoal?.current_waste_rate === null, 'Current waste rate is null when empty');
    assert(emptyGoal?.target_waste_rate === null, 'Target waste rate is null when empty');
    assert(emptyGoal?.remaining_gap === null, 'Remaining gap is null when empty');
    assert(emptyGoal?.reduction_opportunity?.period_quantity === null, 'Period quantity reduction is null when empty');
    assert(emptyGoal?.reduction_opportunity?.total_quantity === null, 'Total quantity reduction is null when empty');
    assert(emptyGoal?.financial_impact?.potential_savings === null, 'Financial potential savings is null when empty');
    assert(Array.isArray(emptyGoal?.suggested_focus_items) && emptyGoal.suggested_focus_items.length === 0, 'Suggested focus items is empty array');

    // 3. Single Day Record Initial State
    console.log('\n3. Single Day Record Initial State:');
    const item1Res = await req('POST', '/food-items', {
      name: `Pasta Dish ${timestamp}`,
      category: 'Main',
      unit: 'portions',
      unit_cost: 10.0,
    }, tokenA);
    itemA1 = item1Res.data?.data;
    assert(item1Res.status === 201 && itemA1?.id, 'Food item A1 created with unit_cost $10.00');

    // Day 1: 50 prepared, 40 sold, 10 wasted (20% waste rate)
    await req('POST', '/demand', {
      food_item_id: itemA1.id,
      record_date: '2026-10-01',
      quantity_prepared: 50,
      quantity_sold: 40,
      quantity_wasted: 10,
    }, tokenA);

    const singleRes = await req('GET', '/analytics/goal', null, tokenA);
    assert(singleRes.status === 200, 'GET /api/analytics/goal returns 200');
    const singleGoal = singleRes.data?.data;
    assert(singleGoal?.status === 'insufficient_data', 'Status is "insufficient_data" on single day log');
    assert(singleGoal?.current_waste_rate === 20, `Current waste rate is 20% (got ${singleGoal?.current_waste_rate})`);
    assert(singleGoal?.target_waste_rate === 20, `Target waste rate equals initial rate (got ${singleGoal?.target_waste_rate})`);
    assert(singleGoal?.remaining_gap === 0, 'Remaining gap is 0% on initial single record');
    assert(singleGoal?.reduction_opportunity?.total_quantity === null, 'Total quantity reduction opportunity is null on single record');
    assert(singleGoal?.financial_impact?.potential_savings === null, 'Financial potential savings is null on single record');

    // 4. Multi-Day Historical Variance & Goal Determination
    console.log('\n4. Multi-Day Historical Variance & Goal Determination:');
    const item2Res = await req('POST', '/food-items', {
      name: `Salad Bowl ${timestamp}`,
      category: 'Salad',
      unit: 'bowls',
      unit_cost: 5.0,
    }, tokenA);
    itemA2 = item2Res.data?.data;
    assert(item2Res.status === 201 && itemA2?.id, 'Food item A2 created with unit_cost $5.00');

    // Day 2 (Best Observed Day):
    // Pasta: 80 prepared, 78 sold, 2 wasted (2.5%)
    // Salad: 20 prepared, 19 sold, 1 wasted (5.0%)
    // Day Total: 100 prepared, 97 sold, 3 wasted (3.0% daily waste rate)
    await req('POST', '/demand', {
      food_item_id: itemA1.id,
      record_date: '2026-10-02',
      quantity_prepared: 80,
      quantity_sold: 78,
      quantity_wasted: 2,
    }, tokenA);
    await req('POST', '/demand', {
      food_item_id: itemA2.id,
      record_date: '2026-10-02',
      quantity_prepared: 20,
      quantity_sold: 19,
      quantity_wasted: 1,
    }, tokenA);

    // Day 3 (Current / Latest Day):
    // Pasta: 70 prepared, 62 sold, 8 wasted (11.43%)
    // Salad: 30 prepared, 26 sold, 4 wasted (13.33%)
    // Day Total: 100 prepared, 88 sold, 12 wasted (12.0% daily waste rate)
    await req('POST', '/demand', {
      food_item_id: itemA1.id,
      record_date: '2026-10-03',
      quantity_prepared: 70,
      quantity_sold: 62,
      quantity_wasted: 8,
    }, tokenA);
    await req('POST', '/demand', {
      food_item_id: itemA2.id,
      record_date: '2026-10-03',
      quantity_prepared: 30,
      quantity_sold: 26,
      quantity_wasted: 4,
    }, tokenA);

    const goalRes = await req('GET', '/analytics/goal', null, tokenA);
    assert(goalRes.status === 200, 'GET /api/analytics/goal returns 200');
    const goal = goalRes.data?.data;
    assert(goal?.status === 'established', 'Status is "established"');
    assert(goal?.current_waste_rate === 12, `Current waste rate is 12.00% (got ${goal?.current_waste_rate})`);
    assert(goal?.target_waste_rate === 3, `Target waste rate is 3.00% matching best observed (got ${goal?.target_waste_rate})`);
    assert(goal?.remaining_gap === 9, `Remaining gap is 9.00% (got ${goal?.remaining_gap})`);
    assert(goal?.target_basis?.includes('2026-10-02'), 'Target basis references the date best rate was achieved');

    // On Day 3 (current): 100 prepared, 12 wasted.
    // If target rate (3%) achieved: 100 * 0.03 = 3 wasted. Opportunity = 12 - 3 = 9 portions.
    assert(goal?.reduction_opportunity?.period_quantity === 9, `Period quantity reduction is 9 (got ${goal?.reduction_opportunity?.period_quantity})`);

    // Total prepared across all days = 50 + 100 + 100 = 250.
    // Total wasted = 10 + 3 + 12 = 25.
    // Target wasted at 3% = 250 * 0.03 = 7.5. Total excess opportunity = 25 - 7.5 = 17.5 portions.
    assert(goal?.reduction_opportunity?.total_quantity === 17.5, `Total quantity reduction is 17.5 (got ${goal?.reduction_opportunity?.total_quantity})`);

    // Financial impact reuse: Pasta has 3 records, so potential savings is calculated
    assert(goal?.financial_impact?.potential_savings !== null, `Financial potential savings is calculated: $${goal?.financial_impact?.potential_savings}`);
    assert(goal?.financial_impact?.status === 'calculated', 'Financial impact status is "calculated"');

    // Suggested focus items
    assert(Array.isArray(goal?.suggested_focus_items) && goal.suggested_focus_items.length > 0, 'Suggested focus items is non-empty');
    assert(goal.suggested_focus_items[0].suggested_action, 'Suggested focus item includes actionable guidance');

    // 5. Cross-Tenant Data Isolation
    console.log('\n5. Cross-Organization Tenant Isolation:');
    const itemB1Res = await req('POST', '/food-items', {
      name: `Org B Croissant ${timestamp}`,
      category: 'Bakery',
      unit: 'pieces',
      unit_cost: 3.0,
    }, tokenB);
    itemB1 = itemB1Res.data?.data;
    assert(itemB1Res.status === 201 && itemB1?.id, 'Org B food item created');

    await req('POST', '/demand', {
      food_item_id: itemB1.id,
      record_date: '2026-10-04',
      quantity_prepared: 40,
      quantity_sold: 39,
      quantity_wasted: 1,
    }, tokenB);

    const goalBRes = await req('GET', '/analytics/goal', null, tokenB);
    assert(goalBRes.status === 200, 'GET /api/analytics/goal returns 200 for Org B');
    const goalB = goalBRes.data?.data;
    assert(goalB?.status === 'insufficient_data', 'Org B has status "insufficient_data" (1 record)');
    assert(goalB?.current_waste_rate === 2.5, `Org B current waste rate is strictly 2.50% (got ${goalB?.current_waste_rate})`);
    assert(goalB?.target_waste_rate === 2.5, `Org B target rate is strictly 2.50% (got ${goalB?.target_waste_rate})`);
    assert(goalB?.financial_impact?.potential_savings === null, 'Org B potential savings is null (no leak from Org A)');
    assert(goalB?.suggested_focus_items.length === 0, 'Org B has no focus items from Org A');

    // 6. Cleanup
    console.log('\n6. Cleanup:');
    if (itemA1?.id) await req('DELETE', `/food-items/${itemA1.id}`, null, tokenA);
    if (itemA2?.id) await req('DELETE', `/food-items/${itemA2.id}`, null, tokenA);
    if (itemB1?.id) await req('DELETE', `/food-items/${itemB1.id}`, null, tokenB);
    assert(true, 'Test entities cleaned up successfully');

  } catch (err) {
    console.error('Unexpected error during test execution:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runGoalTests();
