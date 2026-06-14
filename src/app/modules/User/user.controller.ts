import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from './user.service';
import pick from '../../utils/pickValidFields';

const getFilterableFields = ['searchTerm', 'status'];
const getAllUsers = catchAsync(async (req, res) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, getFilterableFields);
  const result = await UserServices.getAllUsersFromDB(options, filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Users retrieved successfully',
    ...result,
  });
});
const getAllClinics = catchAsync(async (req, res) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, getFilterableFields);
  const result = await UserServices.getAllClinicsFromDB(req,options, filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Clinics retrieved successfully',
    ...result,
  });
});
const getMyimage = catchAsync(async (req, res) => {
  const id = req.user.id;
  const result = await UserServices.getMyimageFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'image retrieved successfully',
    data: result,
  });
});

const getUserDetails = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await UserServices.getUserDetailsFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User details retrieved successfully',
    data: result,
  });
});

//clinic
const createClinic = catchAsync(async (req, res) => {
  const result = await UserServices.createClinicIntoDB(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Clinic created successfully',
    data: result,
  });
});

const updateClinic = catchAsync(async (req, res) => {
  const result = await UserServices.updateClinicIntoDB(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Clinic updated successfully',
    data: result,
  });
});

const updateUserRoleStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const role = req.body.role;
  const result = await UserServices.updateUserRoleStatusIntoDB(id, role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User role updated successfully',
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await UserServices.updateUserStatus(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User status updated successfully',
    data: result,
  });
});
const updateUserApproval = catchAsync(async (req, res) => {
  const { userId } = req.body;
  const result = await UserServices.updateUserApproval(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User approved successfully',
    data: result,
  });
});

const softDeleteUser = catchAsync(async (req, res) => {
  const id = req.user.id;
  const result = await UserServices.softDeleteUserIntoDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User soft deleted successfully',
    data: result,
  });
});
const hardDeleteUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const result = await UserServices.hardDeleteUserIntoDB(id, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User soft deleted successfully',
    data: result,
  });
});

const updateUser = catchAsync(async (req, res) => {
  const id = req.params.id;
  const result = await UserServices.updateUserIntoDb(req, id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User updated successfully!',
    data: result,
  });
});

const updateMyimage = catchAsync(async (req, res) => {
  const id = req.user.id;
  const file = req.file;
  const payload = JSON.parse(req.body.data);
  const result = await UserServices.updateMyimageIntoDB(id, file, payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'image updated successfully',
    data: result,
  });
});

export const UserControllers = {
  getAllUsers,
  getMyimage,
  getUserDetails,
  updateUserRoleStatus,
  updateUserStatus,
  updateUserApproval,
  softDeleteUser,
  hardDeleteUser,
  updateUser,
  updateMyimage,
  //clinic
  createClinic,
  getAllClinics,
  updateClinic
};
