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

async function run() {
  console.log('================================================================');
  console.log('   MULTI-TENANT / ORGANIZATION DATA ISOLATION AUDIT SUITE       ');
  console.log('================================================================\n');

  const ts = Date.now();

  // 1. SETUP TWO SEPARATE TENANTS (ORG A & ORG B)
  console.log('1. Tenant Initialization & Scoping:');
  const userARes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { name: 'Tenant A Admin', email: `tenant_a_${ts}@test.com`, password: 'Password123!' }
  );
  assert(userARes.status === 201 && userARes.data.token, 'Tenant A user registered');
  const tokenA = userARes.data.token;

  const orgARes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/organizations', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
    { name: `Tenant A Organization ${ts}`, organization_type: 'restaurant' }
  );
  assert(orgARes.status === 201, 'Tenant A organization created');
  const orgAId = orgARes.data.organization.id;

  const userBRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { name: 'Tenant B Admin', email: `tenant_b_${ts}@test.com`, password: 'Password123!' }
  );
  assert(userBRes.status === 201 && userBRes.data.token, 'Tenant B user registered');
  const tokenB = userBRes.data.token;

  const orgBRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/organizations', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` } },
    { name: `Tenant B Organization ${ts}`, organization_type: 'cafeteria' }
  );
  assert(orgBRes.status === 201, 'Tenant B organization created');
  const orgBId = orgBRes.data.organization.id;

  // Unlinked User C (No organization)
  const userCRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { name: 'Tenant C Unlinked', email: `tenant_c_${ts}@test.com`, password: 'Password123!' }
  );
  assert(userCRes.status === 201 && userCRes.data.token, 'Tenant C user (unlinked) registered');
  const tokenC = userCRes.data.token;

  // 2. UNLINKED USER ISOLATION
  console.log('\n2. Unlinked Organization Guard (requireOrganization middleware):');
  const unlinkedFood = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'GET', headers: { Authorization: `Bearer ${tokenC}` } }
  );
  assert(unlinkedFood.status === 403, 'Unlinked user rejected from food items with 403');

  const unlinkedDemand = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'GET', headers: { Authorization: `Bearer ${tokenC}` } }
  );
  assert(unlinkedDemand.status === 403, 'Unlinked user rejected from demand data with 403');

  const unlinkedAnalytics = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/summary', method: 'GET', headers: { Authorization: `Bearer ${tokenC}` } }
  );
  assert(unlinkedAnalytics.status === 403, 'Unlinked user rejected from analytics with 403');

  // 3. SEED ISOLATED DATA IN ORG A & ORG B
  console.log('\n3. Create Food Items & Demand Records in Both Orgs:');
  // Org A Food Item & Demand Record
  const itemARes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
    { name: `Org A Dish ${ts}`, category: 'Entree', unit: 'portions' }
  );
  assert(itemARes.status === 201, 'Org A food item created');
  const itemAId = itemARes.data.data.id;

  const demandARes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` } },
    { food_item_id: itemAId, record_date: '2026-10-01', quantity_prepared: 100, quantity_sold: 80, quantity_wasted: 15 }
  );
  assert(demandARes.status === 201, 'Org A demand record created');
  const demandAId = demandARes.data.data.id;

  // Org B Food Item & Demand Record
  const itemBRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` } },
    { name: `Org B Dessert ${ts}`, category: 'Dessert', unit: 'slices' }
  );
  assert(itemBRes.status === 201, 'Org B food item created');
  const itemBId = itemBRes.data.data.id;

  const demandBRes = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` } },
    { food_item_id: itemBId, record_date: '2026-10-02', quantity_prepared: 40, quantity_sold: 35, quantity_wasted: 2 }
  );
  assert(demandBRes.status === 201, 'Org B demand record created');
  const demandBId = demandBRes.data.data.id;

  // 4. CROSS-ORGANIZATION FOOD ITEMS ATTACKS
  console.log('\n4. Cross-Organization Food Items Attacks:');
  // Attack 4.1: List items (Org B must NOT see Item A)
  const listItemsB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  const itemBIds = listItemsB.data.data.map((i) => i.id);
  assert(!itemBIds.includes(itemAId), 'Org B list food items excludes Org A item');
  assert(itemBIds.includes(itemBId), 'Org B list food items includes Org B item');

  // Attack 4.2: Direct GET Item A using Org B token
  const getItemB_A = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/food-items/${itemAId}`, method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(getItemB_A.status === 404, 'Org B querying Org A item ID returns 404');

  // Attack 4.3: Direct PUT Item A using Org B token
  const putItemB_A = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/food-items/${itemAId}`, method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` } },
    { name: 'Hacked Name', category: 'Hacked', unit: 'portions' }
  );
  assert(putItemB_A.status === 404, 'Org B attempting to update Org A item returns 404');

  // Attack 4.4: Direct DELETE Item A using Org B token
  const delItemB_A = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/food-items/${itemAId}`, method: 'DELETE', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(delItemB_A.status === 404, 'Org B attempting to delete Org A item returns 404');

  // 5. CROSS-ORGANIZATION DEMAND DATA ATTACKS
  console.log('\n5. Cross-Organization Demand Data Attacks:');
  // Attack 5.1: Create demand record in Org B using Org A food item ID
  const rogueDemandCreate = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` } },
    { food_item_id: itemAId, record_date: '2026-10-03', quantity_prepared: 50, quantity_sold: 40, quantity_wasted: 5 }
  );
  assert(rogueDemandCreate.status === 404, 'Org B creating demand record with Org A food item rejected with 404');

  // Attack 5.2: List demand records (Org B must NOT see Demand A)
  const listDemandB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/demand', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  const demandBIds = listDemandB.data.data.map((r) => r.id);
  assert(!demandBIds.includes(demandAId), 'Org B list demand records excludes Org A records');
  assert(demandBIds.includes(demandBId), 'Org B list demand records includes Org B records');

  // Attack 5.3: Direct GET Demand Record A using Org B token
  const getDemandB_A = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${demandAId}`, method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(getDemandB_A.status === 404, 'Org B querying Org A demand record ID returns 404');

  // Attack 5.4: Direct PUT Demand Record A using Org B token
  const putDemandB_A = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${demandAId}`, method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` } },
    { food_item_id: itemBId, record_date: '2026-10-01', quantity_prepared: 40, quantity_sold: 35, quantity_wasted: 2 }
  );
  assert(putDemandB_A.status === 404, 'Org B attempting to update Org A demand record returns 404');

  // Attack 5.5: Direct DELETE Demand Record A using Org B token
  const delDemandB_A = await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${demandAId}`, method: 'DELETE', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(delDemandB_A.status === 404, 'Org B attempting to delete Org A demand record returns 404');

  // 6. DASHBOARD METRICS ISOLATION
  console.log('\n6. Dashboard Metrics Isolation:');
  const dashA = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/dashboard/stats', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const dashB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/dashboard/stats', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(dashA.data.data.stats.total_prepared === 100, 'Org A dashboard total_prepared is 100');
  assert(dashB.data.data.stats.total_prepared === 40, 'Org B dashboard total_prepared is 40 (strictly isolated)');
  assert(dashA.data.data.recent_records[0].food_item_name === `Org A Dish ${ts}`, 'Org A recent records show only Org A items');
  assert(dashB.data.data.recent_records[0].food_item_name === `Org B Dessert ${ts}`, 'Org B recent records show only Org B items');

  // 7. ANALYTICS API ISOLATION
  console.log('\n7. Analytics API Isolation:');
  const anaA = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/summary', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const anaB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/summary', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(anaA.data.data.totals.total_wasted === 15, 'Org A analytics total_wasted is 15');
  assert(anaB.data.data.totals.total_wasted === 2, 'Org B analytics total_wasted is 2 (strictly isolated)');
  assert(anaA.data.data.coverage.first_record_date === '2026-10-01', 'Org A coverage date is 2026-10-01');
  assert(anaB.data.data.coverage.first_record_date === '2026-10-02', 'Org B coverage date is 2026-10-02');
  assert(anaA.data.data.item_breakdown[0].name === `Org A Dish ${ts}`, 'Org A item breakdown contains Org A dish');
  assert(anaB.data.data.item_breakdown[0].name === `Org B Dessert ${ts}`, 'Org B item breakdown contains Org B dessert');

  // 8. RECOMMENDATIONS ISOLATION
  console.log('\n8. Recommendations Isolation:');
  const recsA = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/recommendations', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const recsB = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/analytics/recommendations', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(recsA.data.data.recommendations[0].affected_item === `Org A Dish ${ts}`, 'Org A recommendation affects Org A dish');
  assert(recsB.data.data.recommendations[0].affected_item === `Org B Dessert ${ts}`, 'Org B recommendation affects Org B dessert');

  // 9. ML PREDICTION ATTACKS
  console.log('\n9. ML Prediction Tenant Isolation Attacks:');
  // Attack 9.1: Org B attempts demand prediction using Org A item ID
  const roguePredictDemand = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/demand', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` } },
    { food_item_id: itemAId, target_date: '2026-10-05', planned_quantity_prepared: 50 }
  );
  assert(roguePredictDemand.status === 404, 'Org B demand prediction with Org A food item rejected with 404');

  // Attack 9.2: Org B attempts waste risk prediction using Org A item ID
  const roguePredictWaste = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/ml/predict/waste-risk', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` } },
    { food_item_id: itemAId, target_date: '2026-10-05', planned_quantity_prepared: 50 }
  );
  assert(roguePredictWaste.status === 404, 'Org B waste-risk prediction with Org A food item rejected with 404');

  // 10. UNAUTHENTICATED & TAMPERED REQUESTS
  console.log('\n10. Unauthenticated & Tampered Token Attacks:');
  const noToken = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'GET' }
  );
  assert(noToken.status === 401, 'Request without token rejected with 401');

  const tamperedToken = await apiCall(
    { hostname: 'localhost', port: 5000, path: '/api/food-items', method: 'GET', headers: { Authorization: `Bearer ${tokenA}tampered` } }
  );
  assert(tamperedToken.status === 401, 'Request with tampered JWT rejected with 401');

  // 11. CLEANUP TEST ENTITIES
  console.log('\n11. Cleanup Test Entities:');
  await apiCall({ hostname: 'localhost', port: 5000, path: `/api/demand/${demandAId}`, method: 'DELETE', headers: { Authorization: `Bearer ${tokenA}` } });
  await apiCall({ hostname: 'localhost', port: 5000, path: `/api/demand/${demandBId}`, method: 'DELETE', headers: { Authorization: `Bearer ${tokenB}` } });
  await apiCall({ hostname: 'localhost', port: 5000, path: `/api/food-items/${itemAId}`, method: 'DELETE', headers: { Authorization: `Bearer ${tokenA}` } });
  await apiCall({ hostname: 'localhost', port: 5000, path: `/api/food-items/${itemBId}`, method: 'DELETE', headers: { Authorization: `Bearer ${tokenB}` } });
  console.log('  [PASS] Cleaned up test demand records and food items');

  console.log('\n================================================================');
  console.log(`   AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED `);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Audit run failed:', err);
  process.exit(1);
});
