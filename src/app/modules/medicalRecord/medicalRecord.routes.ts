import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { medicalRecordController } from './medicalRecord.controller';
import { medicalRecordValidation } from './medicalRecord.validation';
import { fileUploader } from '../../utils/fileUploader';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();
const fileUpload = fileUploader.upload.fields([
  { name: 'files', maxCount: 1 },
]);

// CLINIC creates a record after appointment
router.post(
  '/',
  auth(UserRoleEnum.CLINIC),
  fileUpload,
  validateRequest(medicalRecordValidation.createSchema),
  medicalRecordController.createMedicalRecord,
);

// ADMIN sees all records
router.get(
  '/',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  medicalRecordController.getMedicalRecordList,
);

// driver / clinic / organizer sees their own
router.get(
  '/my',
  auth(UserRoleEnum.USER, UserRoleEnum.CLINIC, UserRoleEnum.ORGINIZER),
  medicalRecordController.getMyMedicalRecord,
);

// single record — access controlled inside service
router.get('/:id', auth(), medicalRecordController.getMedicalRecordById);

// CLINIC updates their own record
router.put(
  '/:id',
  auth(UserRoleEnum.CLINIC, UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  fileUpload,
  validateRequest(medicalRecordValidation.updateSchema),
  medicalRecordController.updateMedicalRecord,
);

// ADMIN hard deletes
router.delete(
  '/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  medicalRecordController.deleteMedicalRecord,
);

export const medicalRecordRoutes = router;