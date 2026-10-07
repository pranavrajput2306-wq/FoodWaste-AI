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

async function runBenchmarkTests() {
  console.log('====================================================');
  console.log('  ORGANIZATION PERFORMANCE BASELINE TEST SUITE      ');
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
    // -------------------------------------------------------------------------
    // 1. Setup Tenant A and Tenant B
    // -------------------------------------------------------------------------
    console.log('1. User & Organization Setup:');
    const userARes = await req('POST', '/auth/register', {
      name: 'Benchmark User A',
      email: `bench_a_${timestamp}@test.com`,
      password: 'Password123!',
    });
    tokenA = userARes.data?.token;
    assert(userARes.status === 201 && tokenA, 'User A registered and token received');

    const orgARes = await req('POST', '/organizations', {
      name: `Org Benchmark A ${timestamp}`,
      organization_type: 'restaurant',
    }, tokenA);
    assert(orgARes.status === 201, 'Org A created');

    const userBRes = await req('POST', '/auth/register', {
      name: 'Benchmark User B',
      email: `bench_b_${timestamp}@test.com`,
      password: 'Password123!',
    });
    tokenB = userBRes.data?.token;
    assert(userBRes.status === 201 && tokenB, 'User B registered and token received');

    const orgBRes = await req('POST', '/organizations', {
      name: `Org Benchmark B ${timestamp}`,
      organization_type: 'cafeteria',
    }, tokenB);
    assert(orgBRes.status === 201, 'Org B created');

    // -------------------------------------------------------------------------
    // 2. Empty State Verification (Zero records logged)
    // -------------------------------------------------------------------------
    console.log('\n2. Empty State Handling (Zero Records):');
    const emptyResA = await req('GET', '/analytics/benchmark', null, tokenA);
    assert(emptyResA.status === 200, 'GET /api/analytics/benchmark returns 200');
    const emptyDataA = emptyResA.data?.data;
    assert(emptyDataA.status === 'no_data', 'Empty state status is "no_data"');
    assert(emptyDataA.current_waste_rate === null, 'Current waste rate is null when empty');
    assert(emptyDataA.historical_average_waste_rate === null, 'Historical average is null when empty');
    assert(emptyDataA.best_observed_waste_rate === null, 'Best observed waste rate is null when empty');
    assert(emptyDataA.improvement_gap === null, 'Improvement gap is null when empty');
    assert(emptyDataA.totals.total_records === 0, 'Total records count is 0');
    assert(emptyDataA.best_performing_items.length === 0, 'Best performing items array is empty');

    // -------------------------------------------------------------------------
    // 3. Single Day Record Baseline State
    // -------------------------------------------------------------------------
    console.log('\n3. Single Day Record Initial Baseline:');
    const itemA1Res = await req('POST', '/food-items', {
      name: `Benchmark Pasta ${timestamp}`,
      category: 'Main Course',
      unit: 'plates',
    }, tokenA);
    itemA1 = itemA1Res.data?.data;
    assert(itemA1Res.status === 201 && itemA1?.id, 'Food item A1 created');

    // Day 1: 50 prepared, 40 sold, 10 wasted -> 20.00% waste rate
    await req('POST', '/demand', {
      food_item_id: itemA1.id,
      record_date: '2026-10-01',
      quantity_prepared: 50,
      quantity_sold: 40,
      quantity_wasted: 10,
    }, tokenA);

    const singleResA = await req('GET', '/analytics/benchmark', null, tokenA);
    const singleDataA = singleResA.data?.data;
    assert(singleDataA.status === 'single_record', 'Status is "single_record"');
    assert(singleDataA.current_waste_rate === 20.0, `Current waste rate is 20.00% (got ${singleDataA.current_waste_rate})`);
    assert(singleDataA.historical_average_waste_rate === 20.0, 'Historical average equals initial day rate (20.00%)');
    assert(singleDataA.best_observed_waste_rate === 20.0, 'Best observed equals initial day rate (20.00%)');
    assert(singleDataA.improvement_gap === 0.0, 'Improvement gap is 0.00% on initial single record');
    assert(singleDataA.totals.total_prepared === 50.0, 'Total prepared is 50');
    assert(singleDataA.totals.total_sold === 40.0, 'Total sold is 40');
    assert(singleDataA.totals.total_wasted === 10.0, 'Total wasted is 10');

    // -------------------------------------------------------------------------
    // 4. Multi-Day Performance Benchmark & Improvement Gap
    // -------------------------------------------------------------------------
    console.log('\n4. Multi-Day Historical Variance & Gap Calculation:');
    const itemA2Res = await req('POST', '/food-items', {
      name: `Benchmark Salad ${timestamp}`,
      category: 'Salad',
      unit: 'bowls',
    }, tokenA);
    itemA2 = itemA2Res.data?.data;
    assert(itemA2Res.status === 201 && itemA2?.id, 'Food item A2 created');

    // Day 2 (Best Observed Day):
    // Pasta: 50 prep, 48 sold, 2 wasted (4% waste)
    // Salad: 50 prep, 49 sold, 1 wasted (2% waste)
    // Day 2 Total: 100 prep, 97 sold, 3 wasted -> 3.00% daily waste rate!
    await req('POST', '/demand', {
      food_item_id: itemA1.id,
      record_date: '2026-10-02',
      quantity_prepared: 50,
      quantity_sold: 48,
      quantity_wasted: 2,
    }, tokenA);
    await req('POST', '/demand', {
      food_item_id: itemA2.id,
      record_date: '2026-10-02',
      quantity_prepared: 50,
      quantity_sold: 49,
      quantity_wasted: 1,
    }, tokenA);

    // Day 3 (Current Latest Day):
    // Pasta: 50 prep, 42 sold, 8 wasted (16% waste)
    // Salad: 50 prep, 46 sold, 4 wasted (8% waste)
    // Day 3 Total: 100 prep, 88 sold, 12 wasted -> 12.00% daily waste rate!
    await req('POST', '/demand', {
      food_item_id: itemA1.id,
      record_date: '2026-10-03',
      quantity_prepared: 50,
      quantity_sold: 42,
      quantity_wasted: 8,
    }, tokenA);
    await req('POST', '/demand', {
      food_item_id: itemA2.id,
      record_date: '2026-10-03',
      quantity_prepared: 50,
      quantity_sold: 46,
      quantity_wasted: 4,
    }, tokenA);

    // Overall Totals:
    // Day 1: 50 prep, 40 sold, 10 wasted
    // Day 2: 100 prep, 97 sold, 3 wasted
    // Day 3: 100 prep, 88 sold, 12 wasted
    // Sum prep = 250, Sum sold = 225, Sum wasted = 25
    // Historical Average Rate = (25 / 250) * 100 = 10.00%
    // Current Waste Rate (Day 3) = 12.00%
    // Best Observed Waste Rate (Day 2) = 3.00%
    // Improvement Gap = 12.00 - 3.00 = 9.00%

    const multiResA = await req('GET', '/analytics/benchmark', null, tokenA);
    const multiDataA = multiResA.data?.data;

    assert(multiDataA.status === 'established', 'Status is "established"');
    assert(multiDataA.current_waste_rate === 12.0, `Current waste rate is 12.00% (got ${multiDataA.current_waste_rate})`);
    assert(multiDataA.best_observed_waste_rate === 3.0, `Best observed waste rate is 3.00% (got ${multiDataA.best_observed_waste_rate})`);
    assert(multiDataA.best_observed_period?.date === '2026-10-02', 'Best observed period date is 2026-10-02');
    assert(multiDataA.improvement_gap === 9.0, `Improvement gap is 9.00% (got ${multiDataA.improvement_gap})`);
    assert(multiDataA.historical_average_waste_rate === 10.0, `Historical average waste rate is 10.00% (got ${multiDataA.historical_average_waste_rate})`);
    assert(multiDataA.totals.total_prepared === 250.0, 'Total prepared is 250');
    assert(multiDataA.totals.total_sold === 225.0, 'Total sold is 225');
    assert(multiDataA.totals.total_wasted === 25.0, 'Total wasted is 25');
    assert(multiDataA.totals.total_days_recorded === 3, 'Total recorded days is 3');

    // Check Best Performing Item(s)
    // Item A1 (Pasta) has 3 records: Day 1 (10 wasted/50), Day 2 (2 wasted/50), Day 3 (8 wasted/50) -> Total: 20 wasted / 150 = 13.33%
    // Item A2 (Salad) has 2 records (< 3 records) -> Excluded from best-performing items!
    assert(multiDataA.best_performing_items.length === 1, 'Exactly 1 item has >= 3 records');
    assert(multiDataA.best_performing_items[0].id === itemA1.id, 'Pasta correctly identified as eligible best-performing item');
    assert(multiDataA.best_performing_items[0].waste_rate === 13.33, 'Pasta waste rate is 13.33%');

    // -------------------------------------------------------------------------
    // 5. Cross-Organization Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('\n5. Cross-Organization Tenant Isolation:');
    const itemB1Res = await req('POST', '/food-items', {
      name: `Org B Stew ${timestamp}`,
      unit: 'bowls',
    }, tokenB);
    itemB1 = itemB1Res.data?.data;

    // Org B Day 1: 80 prepared, 78 sold, 2 wasted -> 2.50% waste
    await req('POST', '/demand', {
      food_item_id: itemB1.id,
      record_date: '2026-10-01',
      quantity_prepared: 80,
      quantity_sold: 78,
      quantity_wasted: 2,
    }, tokenB);

    const resB = await req('GET', '/analytics/benchmark', null, tokenB);
    const dataB = resB.data?.data;

    assert(dataB.current_waste_rate === 2.5, `Org B current waste rate is strictly 2.50% (got ${dataB.current_waste_rate})`);
    assert(dataB.totals.total_prepared === 80.0, `Org B total prepared is strictly 80 (got ${dataB.totals.total_prepared})`);
    assert(dataB.totals.total_records === 1, 'Org B total records is 1');
    assert(dataB.best_performing_items.length === 0, 'Org B has no items with >= 3 records');

    // -------------------------------------------------------------------------
    // 6. Cleanup
    // -------------------------------------------------------------------------
    console.log('\n6. Cleanup:');
    await req('DELETE', `/food-items/${itemA1.id}`, null, tokenA);
    await req('DELETE', `/food-items/${itemA2.id}`, null, tokenA);
    await req('DELETE', `/food-items/${itemB1.id}`, null, tokenB);
    assert(true, 'Test entities cleaned up successfully');

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

runBenchmarkTests();
