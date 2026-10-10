/**
 * ML Microservice Client Layer
 * Handles communication between Express backend and the FastAPI ML service.
 * Implements timeouts, connection error handling, and sensitive path redaction.
 */

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 10000;

class MLServiceError extends Error {
  constructor(message, statusCode = 503, details = null) {
    super(message);
    this.name = 'MLServiceError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function isConnectionRefused(err) {
  if (!err) return false;
  if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') return true;
  if (Array.isArray(err.cause?.errors) && err.cause.errors.some((e) => e.code === 'ECONNREFUSED')) return true;
  const msg = (err.message || '').toLowerCase();
  const causeMsg = (err.cause?.message || '').toLowerCase();
  return msg.includes('econnrefused') || msg.includes('fetch failed') || causeMsg.includes('econnrefused');
}

async function executeFetch(baseUrl, endpoint, options, timeoutMs) {
  const url = `${baseUrl}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const internalSecret = process.env.ML_SERVICE_SECRET;
  const headers = {
    'Content-Type': 'application/json',
    ...(internalSecret ? { 'X-Internal-Service-Key': internalSecret } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Perform a safe JSON fetch against the ML service.
 */
async function callMLService(endpoint, options = {}) {
  let response;

  try {
    response = await executeFetch(ML_SERVICE_URL, endpoint, options, REQUEST_TIMEOUT_MS);
  } catch (err) {
    // If localhost connection fails, attempt 127.0.0.1 fallback for local dev IPv4/IPv6 resilience
    if (isConnectionRefused(err) && ML_SERVICE_URL.includes('localhost')) {
      const fallbackUrl = ML_SERVICE_URL.replace('localhost', '127.0.0.1');
      try {
        response = await executeFetch(fallbackUrl, endpoint, options, REQUEST_TIMEOUT_MS);
      } catch (fallbackErr) {
        if (fallbackErr.name === 'AbortError') {
          throw new MLServiceError('Machine learning service request timed out.', 504);
        }
        throw new MLServiceError(
          'Machine learning prediction service is currently offline or unreachable.',
          503
        );
      }
    } else {
      if (err.name === 'AbortError') {
        throw new MLServiceError('Machine learning service request timed out.', 504);
      }
      if (isConnectionRefused(err)) {
        throw new MLServiceError(
          'Machine learning prediction service is currently offline or unreachable.',
          503
        );
      }
      throw new MLServiceError(
        'An unexpected error occurred while communicating with the ML prediction service.',
        503
      );
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const sanitizedMsg = data?.message || 'ML prediction service returned an error.';
    throw new MLServiceError(sanitizedMsg, response.status, data);
  }

  return data;
}

/**
 * Check ML service health.
 */
async function getHealth() {
  return callMLService('/health', { method: 'GET' });
}

/**
 * Predict demand for a specific food item.
 */
async function predictDemand(payload) {
  return callMLService('/predict/demand', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Predict waste risk level for a specific food item.
 */
async function predictWasteRisk(payload) {
  return callMLService('/predict/waste-risk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

module.exports = {
  getHealth,
  predictDemand,
  predictWasteRisk,
  MLServiceError,
};
