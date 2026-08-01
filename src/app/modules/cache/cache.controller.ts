import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { invalidateAllCache } from '../../../lib/redis';

// ============================================================
// CLEAR ALL CACHE (global Redis cache flush)
// ============================================================
const clearAllCache = catchAsync(async (_req: Request, res: Response) => {
  const deletedCount = await invalidateAllCache();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All Redis cache cleared successfully',
    data: { deletedCount },
  });
});

// ============================================================
// EXPORT
// ============================================================
export const cacheController = {
  clearAllCache,
};
