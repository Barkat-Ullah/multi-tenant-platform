import httpStatus from 'http-status';
import { locationService } from './location.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../utils/pickValidFields';

// create Location
const createLocation = catchAsync(async (req: Request, res: Response) => {
  const result = await locationService.createLocation(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Location created successfully',
    data: result,
  });
});

// get all Location
const locationFilterableFields = [
  'searchTerm',
  'id',
  'createdAt',
  'status',
];
const getLocationList = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, locationFilterableFields);
  const result = await locationService.getLocationList(options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Location list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

// get Location by id
const getLocationById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await locationService.getLocationById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Location details retrieved successfully',
    data: result,
  });
});

// get my Location
const getMyLocation = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, locationFilterableFields);
  const result = await locationService.getMyLocation(req, options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My Location list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const councilNearestLocationServices = catchAsync(async (req: Request, res: Response) => {
  const result = await locationService.councilNearestLocationServices(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Nearest location and its services retrieved successfully',
    data: result,
  });
});

// update Location
const updateLocation = catchAsync(async (req: Request, res: Response) => {
  const result = await locationService.updateLocation(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Location updated successfully',
    data: result,
  });
});

// toggle status Location
const toggleStatusLocation = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await locationService.toggleStatusLocation(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Location status toggled successfully',
    data: result,
  });
});

// soft delete Location
const softDeleteLocation = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await locationService.softDeleteLocation(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Location soft deleted successfully',
    data: result,
  });
});

// hard delete Location
const deleteLocation = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await locationService.deleteLocation(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Location deleted successfully',
    data: result,
  });
});

export const locationController = {
  createLocation,
  getLocationList,
  getLocationById,
  getMyLocation,
  updateLocation,
  toggleStatusLocation,
  softDeleteLocation,
  deleteLocation,
  councilNearestLocationServices,
};