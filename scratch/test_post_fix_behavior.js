const http = require('http');

function apiCall(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('1. Checking FastAPI /health:');
  const mlHealth = await apiCall({ hostname: '127.0.0.1', port: 8000, path: '/health', method: 'GET' });
  console.log(JSON.stringify(mlHealth, null, 2));

  console.log('\n2. Logging in to Express as admin user:');
  const loginRes = await apiCall(
    { hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { email: 'admin@restaurant.com', password: 'password123' }
  );
  const token = loginRes.data?.data?.token || loginRes.data?.token;
  if (!token) {
    console.error('Failed to log in:', loginRes);
    process.exit(1);
  }
  console.log('Login OK. User org:', loginRes.data?.data?.user?.organization_id);

  console.log('\n3. Testing Demand Prediction for Dal (#265) on 2026-10-31:');
  const demandRes = await apiCall(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/ml/predict/demand',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    },
    { food_item_id: 265, target_date: '2026-10-31', planned_quantity_prepared: 50 }
  );
  console.log('Demand Response:');
  console.log(JSON.stringify(demandRes, null, 2));

  console.log('\n4. Testing Waste Risk Prediction for Dal (#265) on 2026-10-31:');
  const wasteRes = await apiCall(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/ml/predict/waste-risk',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    },
    { food_item_id: 265, target_date: '2026-10-31', planned_quantity_prepared: 50 }
  );
  console.log('Waste Risk Response:');
  console.log(JSON.stringify(wasteRes, null, 2));
}

main().catch(console.error);
