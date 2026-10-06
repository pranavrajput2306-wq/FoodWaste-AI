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
  console.log('   PHASE 2A — COMPREHENSIVE VERIFICATION SUITE');
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

  // --- 1. EXISTING AUTH VERIFICATION ---
  console.log('1. Existing Authentication:');
  const userAEmail = 'userA_' + ts + '@test.com';
  const regA = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { name: 'Alice Chef', email: userAEmail, password: 'Password123!' }
  );
  assert(regA.status === 201 && regA.data.token, 'Register new user returns 201 & JWT');
  const tokenA = regA.data.token;

  const loginA = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: userAEmail, password: 'Password123!' }
  );
  assert(loginA.status === 200 && loginA.data.token, 'Login returns 200 & JWT');

  const meA = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + tokenA },
    }
  );
  assert(meA.status === 200 && meA.data.user?.email === userAEmail.toLowerCase(), 'Protected /api/auth/me returns authenticated profile');

  // --- 2. ORGANIZATION SETUP & AUTHORIZATION ---
  console.log('\n2. Organization Setup & Authorization:');
  // Access food items before org setup -> expect 403
  const blockedFood = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + tokenA },
    }
  );
  assert(blockedFood.status === 403, 'Access to food-items without organization rejected with 403');

  // Create Org A
  const createOrgA = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/organizations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { name: 'Gourmet Bistro ' + ts, organization_type: 'restaurant' }
  );
  assert(createOrgA.status === 201 && createOrgA.data.organization?.role === 'owner', 'Create organization links user as owner');
  const orgAId = createOrgA.data.organization?.id;

  // Get current Org A
  const getOrgA = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/organizations/current',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + tokenA },
    }
  );
  assert(getOrgA.status === 200 && getOrgA.data.organization?.id === orgAId, 'Get current organization returns active org details');

  // Update Org A
  const updateOrgA = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/organizations/current',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { name: 'Gourmet Bistro Updated ' + ts, organization_type: 'cafeteria' }
  );
  assert(updateOrgA.status === 200 && updateOrgA.data.organization?.organization_type === 'cafeteria', 'Update organization persists new values');

  // Register User B and Org B for tenant isolation tests
  const userBEmail = 'userB_' + ts + '@test.com';
  const regB = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { name: 'Bob Baker', email: userBEmail, password: 'Password123!' }
  );
  const tokenB = regB.data.token;
  const createOrgB = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/organizations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenB,
      },
    },
    { name: 'Artisan Bakery ' + ts, organization_type: 'restaurant' }
  );
  assert(createOrgB.status === 201, 'User B successfully sets up Org B');

  // --- 3. FOOD ITEMS CRUD & ISOLATION ---
  console.log('\n3. Food Items CRUD:');
  const createItem1 = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { name: 'Sourdough Loaf', category: 'Bakery', unit: 'pieces' }
  );
  assert(createItem1.status === 201 && createItem1.data.data?.name === 'Sourdough Loaf', 'Create food item in Org A');
  const item1Id = createItem1.data.data?.id;

  const dupItem = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { name: 'Sourdough Loaf', category: 'Bakery', unit: 'pieces' }
  );
  assert(dupItem.status === 409, 'Duplicate food item name prevented with 409');

  const createItem2 = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { name: 'Tomato Basil Soup', category: 'Soup', unit: 'bowls' }
  );
  assert(createItem2.status === 201, 'Create second food item in Org A');
  const item2Id = createItem2.data.data?.id;

  const listItemsA = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + tokenA },
    }
  );
  assert(listItemsA.status === 200 && listItemsA.data.total === 2, 'List food items for Org A returns 2 items');

  // Isolation check: User B in Org B sees 0 food items
  const listItemsB = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + tokenB },
    }
  );
  assert(listItemsB.status === 200 && listItemsB.data.total === 0, 'User B in Org B cannot see Org A food items (isolation PASS)');

  // Cross-tenant item access attempt
  const crossItem = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items/' + item1Id,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + tokenB },
    }
  );
  assert(crossItem.status === 404, 'User B querying Org A item ID returns 404');

  // Update item
  const updateItem1 = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items/' + item1Id,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { name: 'Artisan Sourdough Loaf', category: 'Bakery & Bread', unit: 'pieces' }
  );
  assert(updateItem1.status === 200 && updateItem1.data.data?.name === 'Artisan Sourdough Loaf', 'Update food item details');

  // --- 4. HISTORICAL DEMAND DATA & LOGICAL VALIDATION ---
  console.log('\n4. Historical Demand Records & Validation:');
  // Logical violation: sold (60) + wasted (50) = 110 > prepared (100) -> 422
  const invalidDemand1 = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { food_item_id: item1Id, record_date: '2026-10-01', quantity_prepared: 100, quantity_sold: 60, quantity_wasted: 50 }
  );
  assert(invalidDemand1.status === 422, 'Logical violation (sold + wasted > prepared) rejected with 422');

  // Logical violation: wasted (110) > prepared (100) -> 422
  const invalidDemand2 = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { food_item_id: item1Id, record_date: '2026-10-01', quantity_prepared: 100, quantity_sold: 0, quantity_wasted: 110 }
  );
  assert(invalidDemand2.status === 422, 'Logical violation (wasted > prepared) rejected with 422');

  // Valid demand record 1: 100 prepared, 80 sold, 15 wasted (waste rate 15%)
  const validDemand1 = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { food_item_id: item1Id, record_date: '2026-10-01', quantity_prepared: 100, quantity_sold: 80, quantity_wasted: 15 }
  );
  assert(validDemand1.status === 201 && validDemand1.data.data?.waste_percentage === 15, 'Valid demand record 1 created with correct 15% waste rate');
  const demand1Id = validDemand1.data.data?.id;

  // Duplicate date for same food item -> 409
  const dupDemand = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { food_item_id: item1Id, record_date: '2026-10-01', quantity_prepared: 120, quantity_sold: 90, quantity_wasted: 20 }
  );
  assert(dupDemand.status === 409, 'Duplicate demand record date for same item rejected with 409');

  // Valid demand record 2 for Item 2: 50 prepared, 40 sold, 5 wasted (waste rate 10%)
  const validDemand2 = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tokenA,
      },
    },
    { food_item_id: item2Id, record_date: '2026-10-01', quantity_prepared: 50, quantity_sold: 40, quantity_wasted: 5 }
  );
  assert(validDemand2.status === 201 && validDemand2.data.data?.waste_percentage === 10, 'Valid demand record 2 created with correct 10% waste rate');

  // Cross-tenant demand isolation
  const crossDemand = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand/' + demand1Id,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + tokenB },
    }
  );
  assert(crossDemand.status === 404, 'Cross-tenant demand record lookup returns 404');

  // List demand records for Org A
  const listDemandA = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + tokenA },
    }
  );
  assert(listDemandA.status === 200 && listDemandA.data.total === 2, 'List demand records returns 2 records with item metadata');

  // --- 5. DASHBOARD STATS REAL VALUES ---
  console.log('\n5. Real Database Dashboard Stats:');
  const dashA = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + tokenA },
    }
  );
  const stats = dashA.data.data?.stats;
  assert(dashA.status === 200, 'Dashboard stats API returns 200');
  assert(stats.total_food_items === 2, 'total_food_items = ' + stats.total_food_items + ' (expected 2)');
  assert(stats.total_prepared === 150, 'total_prepared = ' + stats.total_prepared + ' (expected 150)');
  assert(stats.total_sold === 120, 'total_sold = ' + stats.total_sold + ' (expected 120)');
  assert(stats.total_wasted === 20, 'total_wasted = ' + stats.total_wasted + ' (expected 20)');
  assert(stats.waste_rate === 13.33, 'waste_rate = ' + stats.waste_rate + '% (expected 13.33%)');

  // --- 6. CLEANUP TEST ENTITIES (DELETE CRUD TEST) ---
  console.log('\n6. Delete CRUD Operations:');
  const delDemand = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand/' + demand1Id,
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + tokenA },
    }
  );
  assert(delDemand.status === 200, 'Delete demand record returns 200');

  const delItem = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items/' + item1Id,
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + tokenA },
    }
  );
  assert(delItem.status === 200, 'Delete food item returns 200');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
})();
