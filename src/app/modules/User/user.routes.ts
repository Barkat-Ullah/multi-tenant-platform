import express from 'express';
import auth from '../../middlewares/auth';
import { UserControllers } from '../User/user.controller';
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
router.get(
  '/organizers',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  UserControllers.getAllOrganizers,
);
//
router.get('/org-driver', auth(), UserControllers.getAllOrgDriver);
router.get(
  '/org-driver-reports',
  auth(UserRoleEnum.ORGINIZER),
  UserControllers.getAllOrgDriverReports,
);
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
  '/create-admin',
  auth(UserRoleEnum.SUPERADMIN),
  UserControllers.createAdmin,
);
router.post(
  '/org-driver',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.ORGINIZER, UserRoleEnum.SUPERADMIN),
  UserControllers.createOrgDriver,
);
//clinic

router.post(
  '/create-clinic',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  UserControllers.createClinic,
);
router.put(
  '/update-clinic/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  UserControllers.updateClinic,
);

router.delete('/soft-delete/:id', auth('ANY'), UserControllers.softDeleteUser);
router.delete(
  '/hard-delete/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  UserControllers.hardDeleteUser,
);

router.put(
  '/user-role/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  // validateRequest.body(userValidation.updateUserRoleSchema),
  UserControllers.updateUserRoleStatus,
);

router.put(
  '/user-status/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  // validateRequest.body(userValidation.updateUserStatus),
  UserControllers.updateUserStatus,
);

router.put(
  '/approve-user',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  UserControllers.updateUserApproval,
);

router.put(
  '/update-user/:id',
  fileUploader.uploadSingle, // "image"
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  // validateRequest.body(userValidation.updateUser),
  UserControllers.updateUser,
);

router.put(
  '/update-profile',
  auth(
    UserRoleEnum.ADMIN,
    UserRoleEnum.USER,
    UserRoleEnum.CLINIC,
    UserRoleEnum.ORGINIZER,
    UserRoleEnum.SUPERADMIN,
  ),
  fileUploader.uploadSingle, // "image"
  UserControllers.updateMyimage,
);

// Admin/SuperAdmin: Update client basic profile fields
router.patch(
  '/update-client-info/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  UserControllers.updateClientInfo,
);

// Admin/SuperAdmin: Send manual email to a client
router.post(
  '/send-email/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  UserControllers.sendManualEmail,
);

export const UserRouters = router;
