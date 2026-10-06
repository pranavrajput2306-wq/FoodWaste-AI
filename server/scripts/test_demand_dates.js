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
    console.error(`  FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  PASS: ${message}`);
}

async function run() {
  console.log('=== DEMAND RECORD DATE INTEGRITY TEST SUITE ===\n');

  const ts = Date.now();
  // 1. Register & login test user
  const email = `date_tester_${ts}@example.com`;
  const password = 'Password123!';

  console.log('1. User & Organization Setup:');
  const regRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { name: 'Date Tester', email, password }
  );
  assert(regRes.status === 201 && regRes.data.token, 'User registered');
  const token = regRes.data.token;

  const orgRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/organizations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    },
    { name: `Date Test Org ${ts}`, organization_type: 'restaurant' }
  );
  assert(orgRes.status === 201, 'Organization created');

  // 2. Create two test food items
  console.log('\n2. Food Items Creation:');
  const item1Res = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    },
    { name: `Item 1 ${ts}`, category: 'Main', unit: 'kg' }
  );
  assert(item1Res.status === 201, 'Food Item 1 created');
  const item1Id = item1Res.data.data.id;

  const item2Res = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/food-items',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    },
    { name: `Item 2 ${ts}`, category: 'Side', unit: 'portions' }
  );
  assert(item2Res.status === 201, 'Food Item 2 created');
  const item2Id = item2Res.data.data.id;

  // 3. Test exact calendar dates creation
  console.log('\n3. Exact Calendar Dates Creation:');
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
  const createdRecordIds = {};

  for (const d of dates) {
    const res = await apiCall(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/demand',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
      },
      {
        food_item_id: item1Id,
        record_date: d,
        quantity_prepared: 50,
        quantity_sold: 40,
        quantity_wasted: 5,
      }
    );
    assert(
      res.status === 201 && res.data.data?.record_date === d,
      `Create ${d} -> returned exact date ${res.data.data?.record_date}`
    );
    createdRecordIds[d] = res.data.data?.id;
  }

  // 4. Reload / List records -> all dates unchanged
  console.log('\n4. Reload / List Verification:');
  const listRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    }
  );
  assert(listRes.status === 200, 'List demand records returned 200');
  const records = listRes.data.data;
  assert(records.length === 4, `Found ${records.length} records (expected 4)`);

  const fetchedDates = records.map((r) => r.record_date);
  for (const d of dates) {
    assert(fetchedDates.includes(d), `Reload -> date ${d} is present and completely unchanged`);
  }

  // Check single GET endpoint as well
  for (const d of dates) {
    const singleRes = await apiCall(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/demand/${createdRecordIds[d]}`,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
      }
    );
    assert(
      singleRes.status === 200 && singleRes.data.data?.record_date === d,
      `GET /api/demand/${createdRecordIds[d]} -> exact date ${d}`
    );
  }

  // 5. Delete 2026-10-04
  console.log('\n5. Delete and Recreate Flow:');
  const idToDel = createdRecordIds['2026-10-04'];
  const delRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/demand/${idToDel}`,
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    }
  );
  assert(delRes.status === 200, 'Delete 2026-10-04 returned 200');

  // Verify it disappeared from list
  const listAfterDel = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    }
  );
  const datesAfterDel = listAfterDel.data.data.map((r) => r.record_date);
  assert(!datesAfterDel.includes('2026-10-04'), 'Delete 2026-10-04 -> it disappeared from list');

  // 6. Recreate 2026-10-04 for Item 1 -> allowed
  const recreateRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    },
    {
      food_item_id: item1Id,
      record_date: '2026-10-04',
      quantity_prepared: 60,
      quantity_sold: 50,
      quantity_wasted: 8,
    }
  );
  assert(
    recreateRes.status === 201 && recreateRes.data.data?.record_date === '2026-10-04',
    'Recreate 2026-10-04 -> allowed and successfully created'
  );
  const recreatedId = recreateRes.data.data?.id;

  // 7. Try duplicate 2026-10-04 for Item 1 -> correctly rejected with 409
  const dupRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    },
    {
      food_item_id: item1Id,
      record_date: '2026-10-04',
      quantity_prepared: 55,
      quantity_sold: 45,
      quantity_wasted: 5,
    }
  );
  assert(dupRes.status === 409, 'Try duplicate 2026-10-04 again -> correctly rejected with 409 Conflict');

  // 8. Create 2026-10-04 for Item 2 (different food item) -> allowed
  const diffItemRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/demand',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    },
    {
      food_item_id: item2Id,
      record_date: '2026-10-04',
      quantity_prepared: 30,
      quantity_sold: 25,
      quantity_wasted: 3,
    }
  );
  assert(
    diffItemRes.status === 201 && diffItemRes.data.data?.record_date === '2026-10-04',
    'Create 2026-10-04 for another food item -> allowed'
  );
  const diffItemId = diffItemRes.data.data?.id;

  // 9. Edit record -> exact date remains correct
  console.log('\n6. Edit Record Date Integrity:');
  const editRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/demand/${recreatedId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    },
    {
      food_item_id: item1Id,
      record_date: '2026-10-04',
      quantity_prepared: 70,
      quantity_sold: 55,
      quantity_wasted: 10,
    }
  );
  assert(
    editRes.status === 200 && editRes.data.data?.record_date === '2026-10-04',
    'Edit record (quantities changed, date kept 2026-10-04) -> exact date remains 2026-10-04'
  );

  // Edit date intentionally to an available date (e.g. 2026-10-05)
  const editDateRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/demand/${recreatedId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    },
    {
      food_item_id: item1Id,
      record_date: '2026-10-05',
      quantity_prepared: 70,
      quantity_sold: 55,
      quantity_wasted: 10,
    }
  );
  assert(
    editDateRes.status === 200 && editDateRes.data.data?.record_date === '2026-10-05',
    'Intentionally editing date to 2026-10-05 -> updates to 2026-10-05'
  );

  // Verify single GET after edit
  const verifyEditGet = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/demand/${recreatedId}`,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    }
  );
  assert(
    verifyEditGet.data.data?.record_date === '2026-10-05',
    'GET /api/demand/:id after edit confirms record_date is 2026-10-05'
  );

  // 10. Dashboard recent records date test
  console.log('\n7. Dashboard Recent Records Date Format:');
  const dashRes = await apiCall(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    }
  );
  assert(dashRes.status === 200, 'Dashboard stats API returns 200');
  const recent = dashRes.data.data?.recent_records || [];
  assert(recent.length > 0, `Recent records found: ${recent.length}`);
  for (const r of recent) {
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(r.record_date),
      `Dashboard recent record ${r.food_item_name} has pure calendar date: ${r.record_date}`
    );
  }

  // 11. Cleanup test entities
  console.log('\n8. Cleanup Test Entities:');
  await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${recreatedId}`, method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }
  );
  await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/demand/${diffItemId}`, method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }
  );
  for (const d of ['2026-10-01', '2026-10-02', '2026-10-03']) {
    if (createdRecordIds[d]) {
      await apiCall(
        { hostname: 'localhost', port: 5000, path: `/api/demand/${createdRecordIds[d]}`, method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }
      );
    }
  }
  await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/food-items/${item1Id}`, method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }
  );
  await apiCall(
    { hostname: 'localhost', port: 5000, path: `/api/food-items/${item2Id}`, method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }
  );
  console.log('  PASS: Test records and food items cleaned up successfully');

  console.log('\nALL DEMAND DATE TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
