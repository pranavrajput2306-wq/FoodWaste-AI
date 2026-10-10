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

/**
 * Perform a safe JSON fetch against the ML service.
 */
async function callMLService(endpoint, options = {}) {
  const url = `${ML_SERVICE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const sanitizedMsg = data?.message || 'ML prediction service returned an error.';
      throw new MLServiceError(sanitizedMsg, response.status, data);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof MLServiceError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new MLServiceError('Machine learning service request timed out.', 504);
    }

    if (err.cause?.code === 'ECONNREFUSED' || err.code === 'ECONNREFUSED') {
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
