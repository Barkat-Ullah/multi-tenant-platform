import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { serviceController } from './service.controller';
import { serviceValidation } from './service.validation';
import { fileUploader } from '../../utils/fileUploader';
import authOptional from '../../middlewares/authOptional';

const router = express.Router();
const fileUpload = fileUploader.upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'pdf', maxCount: 1 },
  { name: 'files', maxCount: 1 },
]);

router.post(
  '/',
  auth(),
  fileUpload,
  validateRequest(serviceValidation.createSchema),
  serviceController.createService,
);

router.get('/', authOptional(), serviceController.getServiceList);

router.get('/my', auth(), serviceController.getMyService);

router.get('/:id', authOptional(), serviceController.getServiceById);

router.put(
  '/:id',
  auth(),
  fileUpload,
  validateRequest(serviceValidation.updateSchema),
  serviceController.updateService,
);

router.patch(
  '/toggle-status/:id',
  auth(),
  serviceController.toggleStatusService,
);

router.delete('/soft-delete/:id', auth(), serviceController.softDeleteService);

router.delete('/:id', auth(), serviceController.deleteService);

export const serviceRoutes = router;
