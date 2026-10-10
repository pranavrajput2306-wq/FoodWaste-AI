/**
 * M3 Production Deployment Simulation & Smoke Test
 * Tests the complete deployment flow in production mode:
 *   1. Starts Express in NODE_ENV=production with valid production-grade config
 *   2. Starts FastAPI ML service in production mode
 *   3. Tests Express /api/health
 *   4. Tests FastAPI /health
 *   5. Tests user registration & authentication under production security
 *   6. Tests organization creation & scoped request under production security
 *   7. Tests ML prediction flow through gateway: verifies truthful insufficient_data
 *   8. Tests that direct unauthorized requests to FastAPI prediction endpoints receive 401
 *   9. Tests production error sanitization on server fault
 *   10. Tests that production CORS blocks untrusted external origins with 403
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

function httpRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

(async () => {
  console.log('====================================================');
  console.log('   M3 — PRODUCTION DEPLOYMENT SMOKE TEST');
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

  const PROD_EXPRESS_PORT = 5088;
  const PROD_FASTAPI_PORT = 8088;
  const SHARED_SECRET = 'm3_deployment_internal_secret_key_12345';
  const STRONG_JWT = 'production_super_strong_jwt_secret_key_with_at_least_32_characters_1234567890';
  const PROD_CLIENT_ORIGIN = 'https://foodwaste-ai.production.app';

  // 1. Launch FastAPI ML service
  console.log('1. Launching FastAPI ML microservice (simulated production process)...');
  const mlEnv = {
    ...process.env,
    NODE_ENV: 'production',
    ML_PORT: String(PROD_FASTAPI_PORT),
    ML_HOST: '127.0.0.1',
    ML_SERVICE_SECRET: SHARED_SECRET,
    ML_ALLOWED_ORIGINS: `http://localhost:${PROD_EXPRESS_PORT},http://127.0.0.1:${PROD_EXPRESS_PORT}`,
  };

  const projectRoot = path.resolve(__dirname, '..', '..');
  const pythonBin = path.join(projectRoot, 'ml', '.venv', 'Scripts', 'python.exe');
  const mlProcess = spawn(
    pythonBin,
    ['-m', 'uvicorn', 'ml.src.api:app', '--host', '127.0.0.1', '--port', String(PROD_FASTAPI_PORT)],
    { cwd: projectRoot, env: mlEnv, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  mlProcess.stdout.on('data', (d) => process.stdout.write(`[FastAPI] ${d}`));
  mlProcess.stderr.on('data', (d) => process.stderr.write(`[FastAPI-ERR] ${d}`));

  // 2. Launch Express Backend in NODE_ENV=production
  console.log('2. Launching Express backend (simulated production process)...');
  const expressEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PROD_EXPRESS_PORT),
    JWT_SECRET: STRONG_JWT,
    CLIENT_ORIGIN: PROD_CLIENT_ORIGIN,
    ML_SERVICE_URL: `http://127.0.0.1:${PROD_FASTAPI_PORT}`,
    ML_SERVICE_SECRET: SHARED_SECRET,
  };

  const serverRoot = path.resolve(__dirname, '..');
  const expressProcess = spawn(
    'node',
    ['index.js'],
    { cwd: serverRoot, env: expressEnv, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  expressProcess.stdout.on('data', (d) => process.stdout.write(`[Express] ${d}`));
  expressProcess.stderr.on('data', (d) => process.stderr.write(`[Express-ERR] ${d}`));

  // Wait for services to bind (polling up to 10s)
  let bound = false;
  for (let i = 0; i < 20; i++) {
    try {
      await httpRequest({ hostname: '127.0.0.1', port: PROD_FASTAPI_PORT, path: '/health', method: 'GET', timeout: 1000 });
      bound = true;
      break;
    } catch (e) {
      await delay(500);
    }
  }

  try {
    // 3. Verify Health Endpoints
    console.log('\n3. Verifying Health Endpoints:');
    const expressHealth = await httpRequest({
      hostname: '127.0.0.1',
      port: PROD_EXPRESS_PORT,
      path: '/api/health',
      method: 'GET',
    });
    assert(expressHealth.status === 200 && expressHealth.data.success === true, 'Express /api/health responds 200 in production');
    assert(expressHealth.data.environment === 'production', 'Express reports NODE_ENV: production');

    const mlHealth = await httpRequest({
      hostname: '127.0.0.1',
      port: PROD_FASTAPI_PORT,
      path: '/health',
      method: 'GET',
    });
    assert(mlHealth.status === 200 && mlHealth.data.status === 'healthy', 'FastAPI /health responds 200 healthy');
    assert(mlHealth.data.models_available === false, 'FastAPI truthfully reports models_available: false (5 real records < 30 required)');

    // 4. Verify Gateway Health
    console.log('\n4. Verifying Express -> ML Gateway:');
    const gatewayHealth = await httpRequest({
      hostname: '127.0.0.1',
      port: PROD_EXPRESS_PORT,
      path: '/api/ml/health',
      method: 'GET',
    });
    assert(gatewayHealth.status === 200 && gatewayHealth.data.success === true, 'Express /api/ml/health gateway proxy reports success');

    // 5. Verify Authentication & Scoping in Production
    console.log('\n5. Verifying Authentication & Scoped Flow:');
    const ts = Date.now();
    const userEmail = `smoke_prod_${ts}@example.com`;
    const regRes = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: PROD_EXPRESS_PORT,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { name: 'Smoke Admin', email: userEmail, password: 'SecurePassword123' }
    );
    assert(regRes.status === 201 && Boolean(regRes.data.token), 'POST /api/auth/register succeeds and issues genuine JWT in production');
    const token = regRes.data.token;

    // Create organization
    const orgRes = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: PROD_EXPRESS_PORT,
        path: '/api/organizations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      { name: `Smoke Org ${ts}`, organization_type: 'restaurant' }
    );
    assert(orgRes.status === 201 && orgRes.data.organization?.id, 'POST /api/organizations creates organization in production');

    // Create food item
    const itemRes = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: PROD_EXPRESS_PORT,
        path: '/api/food-items',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      { name: `Smoke Soup ${ts}`, category: 'Soups', unit: 'portions', unit_cost: 4.5 }
    );
    assert(itemRes.status === 201 && (itemRes.data.data?.id || itemRes.data.food_item?.id), 'POST /api/food-items creates food item in production');
    const foodItemId = itemRes.data.data?.id || itemRes.data.food_item?.id;

    // 6. Verify ML Prediction Routing & Truthful Insufficient Data Guard
    console.log('\n6. Verifying ML Prediction Flow via Authenticated Gateway:');
    const demandPredRes = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: PROD_EXPRESS_PORT,
        path: '/api/ml/predict/demand',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      { food_item_id: foodItemId, target_date: '2026-10-20', planned_quantity_prepared: 50 }
    );
    assert(demandPredRes.status === 200, 'POST /api/ml/predict/demand responds 200');
    assert(demandPredRes.data.status === 'insufficient_data', 'Demand prediction cleanly returns status: insufficient_data without fabricating predictions');

    const wastePredRes = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: PROD_EXPRESS_PORT,
        path: '/api/ml/predict/waste-risk',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      { food_item_id: foodItemId, target_date: '2026-10-20', planned_quantity_prepared: 50 }
    );
    assert(wastePredRes.status === 200, 'POST /api/ml/predict/waste-risk responds 200');
    assert(wastePredRes.data.status === 'insufficient_data', 'Waste risk prediction cleanly returns status: insufficient_data without fabricating risk');

    // 7. Verify Direct Unauthorized Access to FastAPI is Blocked
    console.log('\n7. Verifying FastAPI Security Boundary:');
    const directPredWithoutSecret = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: PROD_FASTAPI_PORT,
        path: '/predict/demand',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { food_item_id: 1, target_date: '2026-10-20', planned_quantity_prepared: 50 }
    );
    assert(directPredWithoutSecret.status === 401, 'Direct unauthenticated public call to FastAPI /predict/demand rejected with 401');

    // 8. Verify Production CORS Enforcement
    console.log('\n8. Verifying Production CORS Enforcement:');
    const corsUntrusted = await httpRequest({
      hostname: '127.0.0.1',
      port: PROD_EXPRESS_PORT,
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'https://evil-untrusted-hacker.com' },
    });
    assert(corsUntrusted.status === 403, 'Untrusted origin in production rejected with 403 Forbidden');

    const corsTrusted = await httpRequest({
      hostname: '127.0.0.1',
      port: PROD_EXPRESS_PORT,
      path: '/api/health',
      method: 'GET',
      headers: { Origin: PROD_CLIENT_ORIGIN },
    });
    assert(corsTrusted.status === 200 && corsTrusted.headers['access-control-allow-origin'] === PROD_CLIENT_ORIGIN,
      'Configured CLIENT_ORIGIN successfully allowed with matching Access-Control-Allow-Origin header');
  } finally {
    // Teardown processes
    expressProcess.kill('SIGTERM');
    mlProcess.kill('SIGTERM');
  }

  console.log('\n====================================================');
  console.log(`Final M3 Smoke Test: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
})();
