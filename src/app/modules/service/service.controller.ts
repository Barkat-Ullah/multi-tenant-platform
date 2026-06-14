import httpStatus from 'http-status';
import { serviceService } from './service.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../utils/pickValidFields';

// create Service
const createService = catchAsync(async (req: Request, res: Response) => {
  const result = await serviceService.createService(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Service created successfully',
    data: result,
  });
});

// get all Service
const serviceFilterableFields = [
  'searchTerm',
  'id',
  'createdAt',
];
const getServiceList = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, serviceFilterableFields);
  const result = await serviceService.getServiceList(req,options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

// get Service by id
const getServiceById = catchAsync(async (req: Request, res: Response) => {

  const result = await serviceService.getServiceById(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service details retrieved successfully',
    data: result,
  });
});

// get my Service
const getMyService = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, serviceFilterableFields);
  const result = await serviceService.getMyService(req, options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My Service list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

// update Service
const updateService = catchAsync(async (req: Request, res: Response) => {
  const result = await serviceService.updateService(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service updated successfully',
    data: result,
  });
});

// toggle status Service
const toggleStatusService = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await serviceService.toggleStatusService(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service status toggled successfully',
    data: result,
  });
});

// soft delete Service
const softDeleteService = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await serviceService.softDeleteService(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service soft deleted successfully',
    data: result,
  });
});

// hard delete Service
const deleteService = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await serviceService.deleteService(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Service deleted successfully',
    data: result,
  });
});

export const serviceController = {
  createService,
  getServiceList,
  getServiceById,
  getMyService,
  updateService,
  toggleStatusService,
  softDeleteService,
  deleteService,
};