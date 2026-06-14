import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { organizerRequestController } from './organizerRequest.controller';
import { organizerRequestValidation } from './organizerRequest.validation';

const router = express.Router();

// Base Requests creation (Only for organizers)
router.post(
  '/',
  auth('ORGINIZER'), 
  validateRequest(organizerRequestValidation.createSchema),
  organizerRequestController.createOrganizerRequest,
);

// Read Queries with pooled access controls
router.get('/', auth('ADMIN', 'SUPERADMIN', 'CLINIC'), organizerRequestController.getOrganizerRequestList);
router.get('/my', auth('ORGINIZER'), organizerRequestController.getMyOrganizerRequest);
router.get('/:id', auth('ADMIN', 'SUPERADMIN', 'CLINIC', 'ORGINIZER'), organizerRequestController.getOrganizerRequestById);

router.put(
  '/:id',
  auth('ADMIN', 'SUPERADMIN', 'ORGINIZER'),
  validateRequest(organizerRequestValidation.updateSchema),
  organizerRequestController.updateOrganizerRequest,
);

// 1. Admin/SuperAdmin assigns a clinic and updates status
router.patch(
  '/assign-clinic/:id',
  auth('ADMIN', 'SUPERADMIN'),
  validateRequest(organizerRequestValidation.assignClinicAndStatusSchema),
  organizerRequestController.assignClinicAndStatus,
);

// 2. Organizer pushes their driver roster after confirmation
router.post(
  '/:id/drivers',
  auth('ORGINIZER'),
  validateRequest(organizerRequestValidation.addDriversSchema),
  organizerRequestController.addDriversToRequest,
);

// Deletions
router.delete('/soft-delete/:id', auth('ADMIN', 'SUPERADMIN', 'ORGINIZER'), organizerRequestController.softDeleteOrganizerRequest);
router.delete('/:id', auth('ADMIN', 'SUPERADMIN'), organizerRequestController.deleteOrganizerRequest);

export const organizerRequestRoutes = router;