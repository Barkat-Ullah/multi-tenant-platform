// Ticket status and priority constants for performance
import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';
import { fileUploader } from '../../utils/fileUploader';
import ApiError from '../../errors/AppError';
import httpStatus from 'http-status';

export const handleTicketAttachmentUploads = async (
  files: { [fieldname: string]: Express.Multer.File[] } | undefined,
): Promise<string[]> => {
  const attachmentFiles = files?.attachments || [];

  if (attachmentFiles.length === 0) return [];

  try {
    const uploadedUrls = await Promise.all(
      attachmentFiles.map(async file => {
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        let fileType: 'image' | 'video' | 'pdf' = 'pdf';
        if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext || ''))
          fileType = 'image';
        else if (['mp4', 'mov', 'avi', 'webm'].includes(ext || ''))
          fileType = 'video';

        const upload = await fileUploader.uploadToCloudinaryWithType(
          file,
          fileType,
        );
        return upload.Location;
      }),
    );

    return uploadedUrls;
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to upload file', error);
  }
};

// Closed statuses for filtering - used in queries to avoid re-computation
export const CLOSED_STATUSES: TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];

// Terminal statuses that prevent further modifications
export const TERMINAL_STATUSES: TicketStatus[] = [
  TicketStatus.CLOSED,
];

// Statuses where customer can reply (reopen)
export const REPLYABLE_STATUSES: TicketStatus[] = [
  TicketStatus.PENDING_CUSTOMER,
  TicketStatus.RESOLVED,
];

// Role-based access mapping (const assertions for type safety)
export const CUSTOMER_ROLES = ['USER', 'ORGINIZER', 'CLINIC'] as const;
export const STAFF_ROLES = ['ADMIN', 'SUPERADMIN'] as const;

// Pagination defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

// Searchable fields for ticket search
// Note: Cross-entity search (createdBy.email, createdBy.fullName) uses
// Prisma relational syntax, which is handled in buildSearchConditions
export const ticketSearchableFields = [
  'subject',
  'description',
] as const;

// Analytics date range periods
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

// Default ticket number prefix
export const TICKET_NUMBER_PREFIX = 'TKT';