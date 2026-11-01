// Central helpers for the backend's ApiResponse envelope (utils/ApiResponse.js).
//   success: { success: true,  message, data }
//   error:   { success: false, message, details? }   (utils/ApiError + middleware/errorHandler.js)
// Paginated lists put { items, pagination: { total, page, limit, totalPages } } inside `data`.
// Some list endpoints (orders/my, beds, emergency, records ...) return a plain array inside `data`.

export const unwrap = (axiosResponse) => axiosResponse?.data?.data;
export const unwrapMessage = (axiosResponse) => axiosResponse?.data?.message;

const EMPTY_PAGINATION = { total: 0, page: 1, limit: 20, totalPages: 1 };

/** Accepts either a paginated object or a bare array and always returns { items, pagination }. */
export function toPage(data) {
  if (Array.isArray(data)) {
    return { items: data, pagination: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 } };
  }
  if (data && Array.isArray(data.items)) {
    return { items: data.items, pagination: data.pagination || EMPTY_PAGINATION };
  }
  return { items: [], pagination: EMPTY_PAGINATION };
}

export const toList = (data) => toPage(data).items;

const STATUS_MESSAGES = {
  400: 'Some of the information provided is not valid. Please review and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'We could not find what you were looking for.',
  409: 'This conflicts with existing data — for example, the time slot may already be booked.',
  422: 'The information provided could not be processed. Please check the form.',
  429: 'AI assistance has temporarily reached its usage limit. Please try again later.',
  500: 'Something went wrong on our side. Please try again shortly.',
};

/** Normalised error thrown by every service call (see services/api.js). */
export class ApiClientError extends Error {
  constructor({ status = 0, message, details = null, isNetwork = false, raw = null }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
    this.isNetwork = isNetwork;
    this.raw = raw;
  }
}

export function normalizeError(err) {
  if (err instanceof ApiClientError) return err;
  const res = err?.response;
  if (!res) {
    const timeout = err?.code === 'ECONNABORTED';
    return new ApiClientError({
      isNetwork: true,
      message: timeout
        ? 'The request timed out. Please check your connection and try again.'
        : 'Unable to reach the server. Please check your internet connection and that the backend is running.',
      raw: err,
    });
  }
  const status = res.status;
  const body = res.data && typeof res.data === 'object' ? res.data : {};
  // 4xx messages from the backend are written to be user-facing; never surface 5xx internals.
  const message = status >= 500 ? STATUS_MESSAGES[500] : body.message || STATUS_MESSAGES[status] || 'Request failed.';
  return new ApiClientError({ status, message, details: body.details || null, raw: err });
}

export const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') =>
  (err && err.message) || fallback;

/**
 * Maps validation details to { fieldName: message }.
 * express-validator → [{ field, message }]  ·  mongoose ValidationError → string[] (no field mapping possible).
 */
export function getFieldErrors(err) {
  const out = {};
  const d = err?.details;
  if (Array.isArray(d)) {
    d.forEach((item) => {
      if (item && typeof item === 'object' && item.field && !out[item.field]) out[item.field] = item.message;
    });
  }
  return out;
}

/** Human-readable list of every validation problem (shown under form banners). */
export function getDetailMessages(err) {
  const d = err?.details;
  if (!Array.isArray(d)) return [];
  return d
    .map((x) => (typeof x === 'string' ? x : x && x.field ? `${x.field}: ${x.message}` : x && x.message))
    .filter(Boolean);
}
