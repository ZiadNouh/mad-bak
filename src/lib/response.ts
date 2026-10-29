import { NextResponse } from 'next/server';
import {
  ApiResponseSuccess,
  ApiResponseError,
  ErrorCode,
  ERROR_CODES,
} from '@/types';

/**
 * Standardized API success response wrapper (PRD NFR-10).
 * Produces { success: true, data: T }
 */
export function success<T>(
  data: T,
  status = 200,
  init?: ResponseInit
): NextResponse<ApiResponseSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
      ...init,
    }
  );
}

/**
 * Standardized API error response wrapper (PRD NFR-10, §11).
 * Automatically resolves default HTTP status code and message for known PRD error codes.
 * Produces { success: false, error: { code, message } }
 */
export function error(
  code: ErrorCode | string,
  message?: string,
  status?: number,
  init?: ResponseInit
): NextResponse<ApiResponseError> {
  const isKnownCode = code in ERROR_CODES;
  const errorMeta = isKnownCode
    ? ERROR_CODES[code as ErrorCode]
    : undefined;

  const resolvedStatus = status ?? errorMeta?.status ?? 400;
  const resolvedMessage = message ?? errorMeta?.message ?? 'An error occurred';

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message: resolvedMessage,
      },
    },
    {
      status: resolvedStatus,
      ...init,
    }
  );
}

/**
 * Centralized exception handler for Route Handlers.
 * Catches unhandled errors and converts them to standard API error envelopes.
 */
export function handleRouteError(err: unknown): NextResponse<ApiResponseError> {
  console.error('[API_ROUTE_ERROR]', err);

  if (err instanceof Error) {
    return error('INTERNAL_SERVER_ERROR', err.message, 500);
  }

  return error('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', 500);
}

const responseHelpers = {
  success,
  error,
  handleRouteError,
};

export default responseHelpers;
