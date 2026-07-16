import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { clinicAvailabilityValidation } from './timeSlot.validation';
import { clinicAvailabilityController } from './timeSlot.controller';
import { UserRoleEnum } from '@prisma/client';
import authOptional from '../../middlewares/authOptional';


const router = express.Router();

// clinic creates availability + auto-generates 30min slots (admin can create on behalf of clinic)
router.post(
  '/',
  auth(UserRoleEnum.CLINIC, UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  validateRequest(clinicAvailabilityValidation.createAvailabilitySchema),
  clinicAvailabilityController.createAvailabilityWithSlots,
);

// clinic views their own availability list
router.get('/my', auth(), clinicAvailabilityController.getMyAvailability);

// clinic views their month calendar
router.get(
  '/month',
  auth(),
  clinicAvailabilityController.getAvailabilityByMonth,
);

// driver views slots for a clinic on a specific date
router.get('/slots', authOptional(), clinicAvailabilityController.getSlotsByDate);

// clinic adds a single custom slot
router.post(
  '/slot',
  auth(),
  validateRequest(clinicAvailabilityValidation.addSingleSlotSchema),
  clinicAvailabilityController.addSingleSlot,
);

// clinic updates their off days
router.patch(
  '/off-days',
  auth(UserRoleEnum.CLINIC),
  clinicAvailabilityController.updateOffDays,
);

// clinic/admin/superadmin toggles a slot active/inactive
router.patch(
  '/slot/toggle/:id',
  auth(UserRoleEnum.CLINIC, UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  clinicAvailabilityController.toggleSlotStatus,
);

// clinic/admin/superadmin toggles a full date availability active/inactive
router.patch(
  '/toggle-date',
  auth(UserRoleEnum.CLINIC, UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  clinicAvailabilityController.toggleAvailabilityDateStatus,
);

// clinic deletes full availability + all its slots
router.delete('/:id', auth(), clinicAvailabilityController.deleteAvailability);

export const clinicAvailabilityRoutes = router;
