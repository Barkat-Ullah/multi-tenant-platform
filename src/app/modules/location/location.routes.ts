import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { locationController } from './location.controller';
import { locationValidation } from './location.validation';
import { fileUploader } from '../../utils/fileUploader';
import authOptional from '../../middlewares/authOptional';
import { cacheControl, cacheProfiles } from '../../middlewares/cacheControl';

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
  validateRequest(locationValidation.createSchema),
  locationController.createLocation,
);

router.get('/', authOptional(), cacheControl(cacheProfiles.static), locationController.getLocationList);

router.get('/council-nearest', authOptional(), cacheControl(cacheProfiles.static), locationController.councilNearestLocationServices);
router.get('/my', auth(), locationController.getMyLocation);

router.get('/:id', authOptional(), cacheControl(cacheProfiles.static), locationController.getLocationById);

router.put(
  '/:id',
  auth(),
  fileUpload,
  validateRequest(locationValidation.updateSchema),
  locationController.updateLocation,
);

router.patch(
  '/toggle-status/:id',
  auth(),
  locationController.toggleStatusLocation,
);

router.delete(
  '/soft-delete/:id',
  auth(),
  locationController.softDeleteLocation,
);

router.delete('/:id', auth(), locationController.deleteLocation);

export const locationRoutes = router;