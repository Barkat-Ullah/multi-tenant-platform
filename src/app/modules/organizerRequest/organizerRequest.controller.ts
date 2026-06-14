import httpStatus from 'http-status';
import { organizerRequestService } from './organizerRequest.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../utils/pickValidFields';

const organizerRequestFilterableFields = ['searchTerm', 'id', 'createdAt', 'status', 'clinicId'];

const createOrganizerRequest = catchAsync(async (req: Request, res: Response) => {
  const result = await organizerRequestService.createOrganizerRequest(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Organizer Request created successfully',
    data: result,
  });
});

const getOrganizerRequestList = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, organizerRequestFilterableFields);
  
  const result = await organizerRequestService.getOrganizerRequestList(req, options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Organizer Request list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getOrganizerRequestById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await organizerRequestService.getOrganizerRequestById(id, req.user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Organizer Request details retrieved successfully',
    data: result,
  });
});

const getMyOrganizerRequest = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, organizerRequestFilterableFields);
  const result = await organizerRequestService.getMyOrganizerRequest(req, options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My Organizer Requests retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const updateOrganizerRequest = catchAsync(async (req: Request, res: Response) => {
  const result = await organizerRequestService.updateOrganizerRequest(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Organizer Request updated successfully',
    data: result,
  });
});

const assignClinicAndStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { clinicId, status } = req.body;
  const result = await organizerRequestService.assignClinicAndStatus(id, clinicId, status);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Clinic assigned and status updated successfully',
    data: result,
  });
});

const addDriversToRequest = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { driverIds } = req.body;
  const result = await organizerRequestService.addDriversToRequest(id, req.user.id, driverIds);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Drivers roster pushed successfully',
    data: result,
  });
});

const softDeleteOrganizerRequest = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await organizerRequestService.softDeleteOrganizerRequest(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Organizer Request soft deleted successfully',
    data: result,
  });
});

const deleteOrganizerRequest = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await organizerRequestService.deleteOrganizerRequest(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Organizer Request permanently deleted',
    data: result,
  });
});

export const organizerRequestController = {
  createOrganizerRequest,
  getOrganizerRequestList,
  getOrganizerRequestById,
  getMyOrganizerRequest,
  updateOrganizerRequest,
  assignClinicAndStatus,
  addDriversToRequest,
  softDeleteOrganizerRequest,
  deleteOrganizerRequest,
};