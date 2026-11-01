const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const ApiError = require('../utils/ApiError');
const { errorHandler } = require('../middleware/errorHandler');
const {
  isDailyQuotaError,
  isTransientRateLimitError,
  parseRetryAfter,
  checkDailyQuotaExhausted,
  markDailyQuotaExhausted,
  resetQuotaCache,
  dailyQuotaState,
  callGeminiWithRetry,
  AI_QUOTA_ERROR_MESSAGE,
} = require('../services/aiService');

describe('CareConnect AI - Gemini API Quota & Rate Limit Handling Test Suite', () => {

  beforeEach(() => {
    resetQuotaCache();
  });

  // ==========================================
  // SECTION 1: QUOTA & RATE LIMIT ERROR DETECTION
  // ==========================================
  describe('1. Error Detection & Categorization', () => {
    it('should detect Google Gemini Free Tier daily quota exhaustion from metric name', () => {
      const errorBody = {
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota).',
          status: 'RESOURCE_EXHAUSTED',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              reason: 'RATE_LIMIT_EXCEEDED',
              metadata: {
                quota_metric: 'generate_content_free_tier_requests',
                quota_limit: 'generate_content_free_tier_requests_per_day',
              },
            },
          ],
        },
      };

      const isDaily = isDailyQuotaError(429, errorBody, errorBody.error.message);
      assert.equal(isDaily, true, 'Should detect generate_content_free_tier_requests as daily quota');

      const isTransient = isTransientRateLimitError(429, errorBody, errorBody.error.message);
      assert.equal(isTransient, false, 'Daily quota must NOT be classified as transient');
    });

    it('should detect daily quota from "Daily request limit exceeded" message', () => {
      const errorBody = {
        error: {
          code: 429,
          message: 'Daily request limit exceeded.',
          status: 'RESOURCE_EXHAUSTED',
        },
      };

      const isDaily = isDailyQuotaError(429, errorBody, 'Daily request limit exceeded.');
      assert.equal(isDaily, true, 'Should detect daily request limit exceeded');
    });

    it('should detect daily quota from QuotaFailure violation descriptions', () => {
      const errorBody = {
        error: {
          code: 429,
          message: 'Quota exceeded',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
              violations: [
                {
                  subject: 'user:default',
                  description: 'Free tier requests per day limit reached',
                },
              ],
            },
          ],
        },
      };

      const isDaily = isDailyQuotaError(429, errorBody, 'Quota exceeded');
      assert.equal(isDaily, true, 'Should detect daily quota from violations description');
    });

    it('should classify short-term per-minute RPM rate limits as transient', () => {
      const errorBody = {
        error: {
          code: 429,
          message: 'Too Many Requests: rate limit exceeded for minute window',
          status: 'RESOURCE_EXHAUSTED',
        },
      };

      const isDaily = isDailyQuotaError(429, errorBody, 'Too Many Requests');
      assert.equal(isDaily, false, 'Per-minute limits must not be flagged as daily quota');

      const isTransient = isTransientRateLimitError(429, errorBody, 'Too Many Requests');
      assert.equal(isTransient, true, 'Per-minute limits must be flagged as transient');
    });

    it('should classify 503 and 504 server overload as transient', () => {
      assert.equal(isTransientRateLimitError(503, null, 'Service Unavailable'), true);
      assert.equal(isTransientRateLimitError(504, null, 'Gateway Timeout'), true);
      assert.equal(isTransientRateLimitError(500, null, 'Internal Server Error'), false);
    });
  });

  // ==========================================
  // SECTION 2: RETRY-AFTER HEADER PARSING
  // ==========================================
  describe('2. Retry-After Header Parsing', () => {
    it('should parse integer seconds from Retry-After header', () => {
      assert.equal(parseRetryAfter('5'), 5);
      assert.equal(parseRetryAfter('120'), 120);
      assert.equal(parseRetryAfter('0'), null);
      assert.equal(parseRetryAfter(null), null);
      assert.equal(parseRetryAfter(''), null);
    });

    it('should parse HTTP-date from Retry-After header', () => {
      const futureDate = new Date(Date.now() + 15000).toUTCString();
      const parsed = parseRetryAfter(futureDate);
      assert.ok(parsed >= 13 && parsed <= 16, `Parsed diff should be ~15s, got ${parsed}`);
    });
  });

  // ==========================================
  // SECTION 3: DAILY QUOTA TRACKER & ZERO REPEAT CALLS
  // ==========================================
  describe('3. Daily Quota Caching & Short-Circuiting', () => {
    it('should correctly mark daily quota exhausted with future reset time', () => {
      assert.equal(checkDailyQuotaExhausted(), false);
      markDailyQuotaExhausted('generate_content_free_tier_requests daily limit');

      assert.equal(checkDailyQuotaExhausted(), true);
      assert.equal(dailyQuotaState.isExhausted, true);
      assert.ok(dailyQuotaState.resetAt instanceof Date);
      assert.ok(dailyQuotaState.resetAt.getTime() > Date.now(), 'Reset time must be in future');
    });

    it('should immediately short-circuit without network call when daily quota is cached as exhausted', async () => {
      markDailyQuotaExhausted('Daily request limit exceeded');

      try {
        await callGeminiWithRetry('Test prompt');
        assert.fail('Should have thrown 429 ApiError');
      } catch (err) {
        assert.equal(err.statusCode, 429, 'Must return HTTP 429');
        assert.equal(err.message, AI_QUOTA_ERROR_MESSAGE);
        assert.ok(err.retryAfter > 0, 'Must include retryAfter seconds until reset');
      }
    });

    it('should clear daily quota cache on resetQuotaCache()', () => {
      markDailyQuotaExhausted('Daily limit');
      assert.equal(checkDailyQuotaExhausted(), true);

      resetQuotaCache();
      assert.equal(checkDailyQuotaExhausted(), false);
      assert.equal(dailyQuotaState.isExhausted, false);
    });
  });

  // ==========================================
  // SECTION 4: API ERROR & HTTP RESPONSE CODES
  // ==========================================
  describe('4. ApiError & HTTP 429 Response Delivery', () => {
    it('should instantiate ApiError.tooManyRequests with status 429 and friendly message', () => {
      const err = ApiError.tooManyRequests();
      assert.equal(err.statusCode, 429);
      assert.equal(err.isOperational, true);
      assert.equal(err.message, AI_QUOTA_ERROR_MESSAGE);
    });

    it('should include retryAfter in ApiError.tooManyRequests when provided', () => {
      const err = ApiError.tooManyRequests(undefined, null, 60);
      assert.equal(err.statusCode, 429);
      assert.equal(err.retryAfter, 60);
    });

    it('should return HTTP 429 instead of HTTP 500 in centralized errorHandler', () => {
      const apiErr = ApiError.tooManyRequests(AI_QUOTA_ERROR_MESSAGE, null, 120);

      let sentStatus = null;
      let sentBody = null;
      const headers = {};

      const mockRes = {
        setHeader(name, value) {
          headers[name] = value;
          return this;
        },
        status(code) {
          sentStatus = code;
          return this;
        },
        json(body) {
          sentBody = body;
          return this;
        },
      };

      errorHandler(apiErr, {}, mockRes, () => {});

      assert.equal(sentStatus, 429, 'Response status must strictly be 429 (not 500)');
      assert.equal(headers['Retry-After'], '120', 'Must attach Retry-After header');
      assert.equal(sentBody.success, false);
      assert.equal(sentBody.message, AI_QUOTA_ERROR_MESSAGE);
      assert.equal(sentBody.stack, undefined, 'Must not leak stack traces or internals');
    });
  });

  // ==========================================
  // SECTION 5: CREDENTIAL PROTECTION & SECRECY
  // ==========================================
  describe('5. Credential & Secret Protection', () => {
    it('should never expose Gemini API key in client error payload', () => {
       const testSecretKey = 'TEST_GEMINI_API_KEY_NOT_REAL_123456';
      const rawErrorWithSecret = new Error(`Failed to call https://generativelanguage.googleapis.com?key=${testSecretKey}`);
      rawErrorWithSecret.statusCode = 429;

      let sentStatus = null;
      let sentBody = null;
      const mockRes = {
        setHeader() {},
        status(code) { sentStatus = code; return this; },
        json(body) { sentBody = body; return this; },
      };

      const userFacingErr = ApiError.tooManyRequests();
      errorHandler(userFacingErr, {}, mockRes, () => {});

      assert.equal(sentStatus, 429);
      assert.ok(!JSON.stringify(sentBody).includes(testSecretKey), 'API key must never be in client response');
      assert.equal(sentBody.message, AI_QUOTA_ERROR_MESSAGE);
    });
  });
});
