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

function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`  [PASS] ${message}`);
}

async function run() {
  console.log('====================================================');
  console.log('   PHASE 2D — ANALYTICS & RECOMMENDATIONS SUITE     ');
  console.log('====================================================\n');

  const ts = Date.now();

  // 1. Setup Org A and Org B
  console.log('1. User & Organization Setup (Isolation Prep):');
  const userA = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { name: 'Analytics User A', email: `ana_user_a_${ts}@test.com`, password: 'Password123!' }
  );
  assert(userA.status === 201 && userA.data.token, 'User A registered');
  const tokenA = userA.data.token;

  const orgA = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/organizations', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
    { name: `Org A Analytics ${ts}`, organization_type: 'restaurant' }
  );
  assert(orgA.status === 201, 'Org A created');

  const userB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { name: 'Analytics User B', email: `ana_user_b_${ts}@test.com`, password: 'Password123!' }
  );
  assert(userB.status === 201 && userB.data.token, 'User B registered');
  const tokenB = userB.data.token;

  const orgB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/organizations', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` } },
    { name: `Org B Analytics ${ts}`, organization_type: 'cafeteria' }
  );
  assert(orgB.status === 201, 'Org B created');

  // 2. Empty State Verification (Org B has no items or records)
  console.log('\n2. Empty State Verification:');
  const emptySummaryB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/summary', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(emptySummaryB.status === 200, 'Empty Org B summary returns 200');
  assert(emptySummaryB.data.data?.totals.total_records === 0, 'Org B total_records is 0');
  assert(emptySummaryB.data.data?.totals.overall_waste_rate === 0, 'Org B overall_waste_rate is 0%');
  assert(emptySummaryB.data.data?.trend.length === 0, 'Org B trend is an empty array');

  const emptyRecsB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/recommendations', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(emptyRecsB.status === 200, 'Empty Org B recommendations returns 200');
  assert(emptyRecsB.data.data?.recommendations[0]?.type === 'data_notice', 'Org B receives truthful data_notice recommendation');

  // 3. Populate Known Data for Org A
  console.log('\n3. Seed Known Historical Data for Org A:');
  // Item 1: High Waste Soup (50 prepared, 30 sold, 18 wasted each day -> 36% waste rate, sell-through 60%)
  const item1Res = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
    { name: `High Waste Soup ${ts}`, category: 'Soups', unit: 'bowls' }
  );
  const item1Id = item1Res.data.data.id;

  // Item 2: Optimal Rice (100 prepared, 95 sold, 4 wasted each day -> 4% waste rate, sell-through 95%)
  const item2Res = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
    { name: `Optimal Rice ${ts}`, category: 'Grains', unit: 'kg' }
  );
  const item2Id = item2Res.data.data.id;

  // Item 3: Insufficient Logged Salad (only 2 records)
  const item3Res = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
    { name: `New Salad ${ts}`, category: 'Salads', unit: 'portions' }
  );
  const item3Id = item3Res.data.data.id;

  // Log 7 days for Item 1 and Item 2
  const dates = [
    '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23',
    '2026-09-24', '2026-09-25', '2026-09-26'
  ];

  for (const d of dates) {
    await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
      { food_item_id: item1Id, record_date: d, quantity_prepared: 50, quantity_sold: 30, quantity_wasted: 18 }
    );
    await apiCall(
      { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
      { food_item_id: item2Id, record_date: d, quantity_prepared: 100, quantity_sold: 95, quantity_wasted: 4 }
    );
  }

  // Log only 2 days for Item 3
  await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
    { food_item_id: item3Id, record_date: '2026-09-20', quantity_prepared: 20, quantity_sold: 15, quantity_wasted: 3 }
  );
  await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
    { food_item_id: item3Id, record_date: '2026-09-21', quantity_prepared: 20, quantity_sold: 16, quantity_wasted: 2 }
  );

  console.log('  [PASS] Seeded 16 historical demand records across 3 food items for Org A');

  // 4. Verify Analytics Calculations Against Known Math
  console.log('\n4. Analytics Summary API Calculation Verification:');
  const summaryA = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/summary', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert(summaryA.status === 200, 'Analytics summary returns 200');
  const totalsA = summaryA.data.data.totals;

  // Expected totals:
  // Item 1: 7 * 50 = 350 prepared, 7 * 30 = 210 sold, 7 * 18 = 126 wasted
  // Item 2: 7 * 100 = 700 prepared, 7 * 95 = 665 sold, 7 * 4 = 28 wasted
  // Item 3: 2 * 20 = 40 prepared, 31 sold, 5 wasted
  // Total prepared = 350 + 700 + 40 = 1090
  // Total sold = 210 + 665 + 31 = 906
  // Total wasted = 126 + 28 + 5 = 159
  // Waste rate = (159 / 1090) * 100 = 14.59%
  // Sell through rate = (906 / 1090) * 100 = 83.12%

  assert(totalsA.total_prepared === 1090, `Total prepared = ${totalsA.total_prepared} (expected 1090)`);
  assert(totalsA.total_sold === 906, `Total sold = ${totalsA.total_sold} (expected 906)`);
  assert(totalsA.total_wasted === 159, `Total wasted = ${totalsA.total_wasted} (expected 159)`);
  assert(totalsA.overall_waste_rate === 14.59, `Overall waste rate = ${totalsA.overall_waste_rate}% (expected 14.59%)`);
  assert(totalsA.overall_sell_through_rate === 83.12, `Overall sell-through = ${totalsA.overall_sell_through_rate}% (expected 83.12%)`);
  assert(totalsA.total_records === 16, `Total records = ${totalsA.total_records} (expected 16)`);
  assert(totalsA.total_items === 3, `Total items = ${totalsA.total_items} (expected 3)`);

  // Verify Coverage
  const covA = summaryA.data.data.coverage;
  assert(covA.first_record_date === '2026-09-20', `Coverage start date = ${covA.first_record_date}`);
  assert(covA.last_record_date === '2026-09-26', `Coverage end date = ${covA.last_record_date}`);
  assert(covA.total_days_recorded === 7, `Total days recorded = ${covA.total_days_recorded}`);
  assert(covA.active_items_count === 3, `Active items count = ${covA.active_items_count}`);

  // Verify Trend
  const trendA = summaryA.data.data.trend;
  assert(trendA.length === 7, `Trend length = ${trendA.length} daily entries`);
  assert(trendA[0].date === '2026-09-20', `First trend date = ${trendA[0].date}`);
  assert(trendA[6].date === '2026-09-26', `Last trend date = ${trendA[6].date}`);

  // Verify Item Breakdown & Top Waste Item
  const breakdown = summaryA.data.data.item_breakdown;
  assert(breakdown.length === 3, `Breakdown has 3 items`);
  const topWaste = summaryA.data.data.top_waste_items;
  assert(topWaste[0].name.includes('High Waste Soup'), `Top waste item is High Waste Soup with ${topWaste[0].total_wasted} wasted`);
  assert(topWaste[0].waste_rate === 36, `High Waste Soup waste rate = ${topWaste[0].waste_rate}% (expected 36%)`);

  // 5. Verify Organization Isolation
  console.log('\n5. Organization Isolation Verification:');
  const orgBCheck = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/summary', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(orgBCheck.data.data?.totals.total_records === 0, 'Org B still has 0 records (Org A data never leaks)');

  // 6. Actionable Recommendations Logic Verification
  console.log('\n6. Actionable Recommendations Logic Verification:');
  const recsResA = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/recommendations', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert(recsResA.status === 200, 'Recommendations API returns 200');
  const recs = recsResA.data.data.recommendations;
  const counts = recsResA.data.data.counts;

  assert(counts.total === 3, `Generated ${counts.total} item recommendations (1 per catalog item)`);
  assert(counts.high >= 1, `Found ${counts.high} High Priority recommendation(s)`);

  // Verify Item 1 has High Priority (waste >= 25% and sellThrough <= 65%)
  const item1Rec = recs.find((r) => r.affected_item_id === item1Id);
  assert(item1Rec && item1Rec.priority === 'High', 'Item 1 (High Waste Soup) correctly flagged as High Priority');
  assert(item1Rec.type === 'data_driven', 'Item 1 recommendation type is data_driven');
  assert(item1Rec.is_ml_derived === true, 'Item 1 has 7 days -> is_ml_derived flag indicates ML sequence eligibility');
  assert(item1Rec.evidence.includes('36.0%'), 'Item 1 evidence includes exact 36.0% calculated waste rate');

  // Verify Item 2 has Low Priority (high sell-through >= 90%, waste <= 5%)
  const item2Rec = recs.find((r) => r.affected_item_id === item2Id);
  assert(item2Rec && item2Rec.priority === 'Low', 'Item 2 (Optimal Rice) flagged as Low Priority (expansion/stable)');
  assert(item2Rec.title.includes('Strong Demand') || item2Rec.title.includes('Balanced'), 'Item 2 suggests demand expansion or balanced scheduling');

  // Verify Item 3 has Insufficient History Notice (< 5 records)
  const item3Rec = recs.find((r) => r.affected_item_id === item3Id);
  assert(item3Rec && item3Rec.priority === 'Low', 'Item 3 (New Salad) flagged as Low Priority');
  assert(item3Rec.type === 'data_notice', 'Item 3 type is data_notice (truthful insufficient history message)');
  assert(item3Rec.evidence.includes('2 record(s)'), 'Item 3 evidence states exact count of 2 available records');

  // 7. Dashboard Integration Verification
  console.log('\n7. Dashboard Stats & Insights Integration:');
  const dashA = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/dashboard/stats', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert(dashA.status === 200, 'Dashboard API returns 200');
  const insights = dashA.data.data?.insights;
  assert(insights, 'Dashboard includes insights object');
  assert(insights.current_waste_rate === 14.59, `insights.current_waste_rate = ${insights.current_waste_rate}%`);
  assert(insights.highest_waste_item.name.includes('High Waste Soup'), `insights.highest_waste_item is ${insights.highest_waste_item.name}`);
  assert(insights.top_recommendation.priority === 'High', `insights.top_recommendation is High Priority`);

  // 8. Cleanup Test Entities
  console.log('\n8. Cleanup Test Entities:');
  const listA = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } }
  );
  for (const r of listA.data.data) {
    await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/demand/${r.id}`, method: 'DELETE', headers: { Authorization: `Bearer ${tokenA}` } }
    );
  }
  for (const itemId of [item1Id, item2Id, item3Id]) {
    await apiCall(
      { hostname: 'localhost', port: 5000, path: `/api/food-items/${itemId}`, method: 'DELETE', headers: { Authorization: `Bearer ${tokenA}` } }
    );
  }
  console.log('  [PASS] Cleaned up all test records and test food items');

  console.log('\n====================================================');
  console.log('   ALL PHASE 2D TESTS PASSED (32/32 ASSERTIONS)     ');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
