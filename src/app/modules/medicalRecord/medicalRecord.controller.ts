import httpStatus from 'http-status';
import { medicalRecordService } from './medicalRecord.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../utils/pickValidFields';

// create MedicalRecord
const createMedicalRecord = catchAsync(async (req: Request, res: Response) => {
  const result = await medicalRecordService.createMedicalRecord(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'MedicalRecord created successfully',
    data: result,
  });
});

// get all MedicalRecord
const medicalRecordFilterableFields = [
  'searchTerm',
  'id',
  'createdAt',
  'status',
];
const getMedicalRecordList = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, medicalRecordFilterableFields);
  const result = await medicalRecordService.getMedicalRecordList(
    options,
    filters,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'MedicalRecord list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

// get MedicalRecord by id
// get MedicalRecord by id — pass full req now
const getMedicalRecordById = catchAsync(async (req: Request, res: Response) => {
  const result = await medicalRecordService.getMedicalRecordById(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'MedicalRecord details retrieved successfully',
    data: result,
  });
});

// get my MedicalRecord
const getMyMedicalRecord = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, medicalRecordFilterableFields);
  const result = await medicalRecordService.getMyMedicalRecord(
    req,
    options,
    filters,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My MedicalRecord list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

// update MedicalRecord
const updateMedicalRecord = catchAsync(async (req: Request, res: Response) => {
  const result = await medicalRecordService.updateMedicalRecord(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'MedicalRecord updated successfully',
    data: result,
  });
});

// toggle status MedicalRecord
const toggleStatusMedicalRecord = catchAsync(
  async (req: Request, res: Response) => {},
);

// soft delete MedicalRecord
const softDeleteMedicalRecord = catchAsync(
  async (req: Request, res: Response) => {},
);

// hard delete MedicalRecord
const deleteMedicalRecord = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await medicalRecordService.deleteMedicalRecord(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'MedicalRecord deleted successfully',
    data: result,
  });
});

export const medicalRecordController = {
  createMedicalRecord,
  getMedicalRecordList,
  getMedicalRecordById,
  getMyMedicalRecord,
  updateMedicalRecord,
  toggleStatusMedicalRecord,
  softDeleteMedicalRecord,
  deleteMedicalRecord,
};
