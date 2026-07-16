import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ticketController } from './ticket.controller';
import { ticketValidation } from './ticket.validation';
import { UserRoleEnum } from '@prisma/client';
import { fileUploader } from '../../utils/fileUploader';

const router = express.Router();

// Multer upload for ticket attachments (messages)
const fileUpload = fileUploader.upload.fields([
  { name: 'image', maxCount: 10 },
  { name: 'video', maxCount: 10 },
  { name: 'pdf', maxCount: 10 },
  { name: 'files', maxCount: 10 },
]);
             
// POST   /tickets                    - create (any authenticated user)
router.post(
  '/',
  auth(
    UserRoleEnum.USER,
    UserRoleEnum.ORGINIZER,
    UserRoleEnum.CLINIC,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPERADMIN,
  ),
  fileUpload,
  validateRequest(ticketValidation.createSchema),
  ticketController.createTicket,
);

// GET    /tickets                    - list (filtered by role)
router.get(
  '/',
  auth(
    UserRoleEnum.USER,
    UserRoleEnum.ORGINIZER,
    UserRoleEnum.CLINIC,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPERADMIN,
  ),
  ticketController.getTicketList,
);

// GET    /tickets/analytics          - admin dashboard (MUST be before /:id)
router.get(
  '/analytics',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  ticketController.getTicketAnalytics,
);

// GET    /tickets/:id                - detail + messages
router.get(
  '/:id',
  auth(
    UserRoleEnum.USER,
    UserRoleEnum.ORGINIZER,
    UserRoleEnum.CLINIC,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPERADMIN,
  ),
  ticketController.getTicketById,
);

// PATCH  /tickets/:id/status         - admin or user (to reopen)
router.patch(
  '/:id/status',
  auth(
    UserRoleEnum.USER,
    UserRoleEnum.ORGINIZER,
    UserRoleEnum.CLINIC,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPERADMIN,
  ),
  validateRequest(ticketValidation.statusChangeSchema),
  ticketController.changeTicketStatus,
);

// POST   /tickets/:id/messages       - reply (supports file uploads)
router.post(
  '/:id/messages',
  auth(
    UserRoleEnum.USER,
    UserRoleEnum.ORGINIZER,
    UserRoleEnum.CLINIC,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPERADMIN,
  ),
  fileUpload,
  validateRequest(ticketValidation.createMessageSchema),
  ticketController.createTicketMessage,
);

// POST   /tickets/:id/rating         - user, once ticket is RESOLVED/CLOSED
router.post(
  '/:id/rating',
  auth(UserRoleEnum.USER, UserRoleEnum.ORGINIZER, UserRoleEnum.CLINIC),
  validateRequest(ticketValidation.satisfactionSchema),
  ticketController.addSatisfactionRating,
);

export const ticketRoutes = router;
