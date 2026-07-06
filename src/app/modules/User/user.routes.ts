import express from 'express';
import auth from '../../middlewares/auth';
import { UserControllers } from '../User/user.controller';
// import validateRequest from '../../middlewares/validateRequest';
// import { userValidation } from './user.validation';
import { UserRoleEnum } from '@prisma/client';
import { fileUploader } from '../../utils/fileUploader';
import authOptional from '../../middlewares/authOptional';

const router = express.Router();

router.get(
  '/',
  auth(
    UserRoleEnum.ADMIN,
    UserRoleEnum.USER,
    UserRoleEnum.CLINIC,
    UserRoleEnum.ORGINIZER,
    UserRoleEnum.SUPERADMIN,
  ),
  UserControllers.getAllUsers,
);
router.get('/clinics', authOptional(), UserControllers.getAllClinics);
//
router.get('/org-driver', auth(), UserControllers.getAllOrgDriver);
router.get('/org-driver-reports', auth(UserRoleEnum.ORGINIZER), UserControllers.getAllOrgDriverReports);
//
router.get(
  '/me',
  auth(
    UserRoleEnum.ADMIN,
    UserRoleEnum.USER,
    UserRoleEnum.CLINIC,
    UserRoleEnum.ORGINIZER,
    UserRoleEnum.SUPERADMIN,
  ),
  UserControllers.getMyimage,
);
router.get('/:id', authOptional(), UserControllers.getUserDetails);

router.post(
  '/org-driver',
  auth(UserRoleEnum.ADMIN,UserRoleEnum.ORGINIZER),
  UserControllers.createOrgDriver,
);
//clinic

router.post(
  '/create-clinic',
  auth(UserRoleEnum.ADMIN),
  UserControllers.createClinic,
);
router.put(
  '/update-clinic/:id',
  auth(UserRoleEnum.ADMIN),
  UserControllers.updateClinic,
);

router.delete('/soft-delete/:id', auth('ANY'), UserControllers.softDeleteUser);
router.delete(
  '/hard-delete/:id',
  auth(UserRoleEnum.ADMIN),
  UserControllers.hardDeleteUser,
);

router.put(
  '/user-role/:id',
  auth(UserRoleEnum.ADMIN),
  // validateRequest.body(userValidation.updateUserRoleSchema),
  UserControllers.updateUserRoleStatus,
);

router.put(
  '/user-status/:id',
  auth(UserRoleEnum.ADMIN),
  // validateRequest.body(userValidation.updateUserStatus),
  UserControllers.updateUserStatus,
);
router.put(
  '/approve-user',
  auth(UserRoleEnum.ADMIN),
  UserControllers.updateUserApproval,
);

router.put(
  '/update-user/:id',
  fileUploader.uploadSingle, // "image"
  auth(UserRoleEnum.ADMIN),
  // validateRequest.body(userValidation.updateUser),
  UserControllers.updateUser,
);

router.put(
  '/update-profile',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.USER, UserRoleEnum.CLINIC, UserRoleEnum.ORGINIZER, UserRoleEnum.SUPERADMIN),
  fileUploader.uploadSingle, // "image"
  UserControllers.updateMyimage,
);

export const UserRouters = router;
