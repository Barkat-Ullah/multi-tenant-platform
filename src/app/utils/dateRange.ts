import httpStatus from 'http-status';
import ApiError from '../errors/AppError';

export type CalendarPeriod = 'daily' | 'weekly' | 'monthly';

/**
 * Returns UTC start/end Date for daily/weekly/monthly periods.
 * Used by analytics, booking, and ticket modules.
 */
export const getDateRangeByPeriod = (period: CalendarPeriod) => {
  const now = new Date();

  if (period === 'daily') {
    return {
      rangeStart: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
      ),
      rangeEnd: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
      ),
    };
  }

  if (period === 'weekly') {
    const utcDay = now.getUTCDay();
    const diffToMonday = utcDay === 0 ? 6 : utcDay - 1;

    const rangeStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 0, 0, 0, 0),
    );

    return {
      rangeStart,
      rangeEnd: new Date(
        Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate() + 6, 23, 59, 59, 999),
      ),
    };
  }

  // monthly (default)
  return {
    rangeStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)),
    rangeEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
  };
};

/**
 * Parse custom date range from query params, validate as full UTC days.
 */
export const getCustomDateRange = (rangeStartDay: string, rangeEndDay: string) => {
  const start = new Date(rangeStartDay);
  const end = new Date(rangeEndDay);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid rangeStartDay or rangeEndDay format. Use YYYY-MM-DD.',
    );
  }

  if (start > end) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'rangeStartDay cannot be after rangeEndDay',
    );
  }

  const rangeStart = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0),
  );

  const rangeEnd = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999),
  );

  return { rangeStart, rangeEnd };
};

/**
 * Normalize a period string to CalendarPeriod, defaulting to 'weekly'.
 */
export const normalizeCalendarPeriod = (period?: string): CalendarPeriod => {
  const normalized = period?.toLowerCase();

  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'monthly') {
    return normalized;
  }

  return 'weekly';
};
