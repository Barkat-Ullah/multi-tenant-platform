import { Prisma } from '@prisma/client';
import {
  toUTCEndOfDay,
  toUTCEndOfMonth,
  toUTCStartOfDay,
  toUTCStartOfMonth,
} from '../../utils/utcDate';

export const buildFilterConditions = (
  filterData: Record<string, any>,
): Prisma.BookingWhereInput[] => {
  const conditions: Prisma.BookingWhereInput[] = [];

  Object.keys(filterData).forEach(key => {
    const value = filterData[key];
    if (value === '' || value === null || value === undefined) return;

    if (key === 'createdAt') {
      const parts = (value as string).split('-');

      if (parts.length === 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        conditions.push({
          createdAt: {
            gte: toUTCStartOfMonth(year, month),
            lte: toUTCEndOfMonth(year, month),
          },
        });
      } else if (parts.length === 3) {
        conditions.push({
          createdAt: {
            gte: toUTCStartOfDay(value),
            lte: toUTCEndOfDay(value),
          },
        });
      }
      return;
    }

    if (['status'].includes(key)) {
      conditions.push({
        status: { in: Array.isArray(value) ? value : [value] },
      });
      return;
    }

    if (key === 'clinicId') {
      conditions.push({ clinicId: value });
      return;
    }

    if (key === 'driverId') {
      conditions.push({ driverId: value });
      return;
    }

    if (key === 'locationId') {
      conditions.push({
        clinic: { locationId: value },
      });
      return;
    }

    conditions.push({ [key]: value });
  });

  return conditions;
};