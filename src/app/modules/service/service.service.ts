import httpStatus from 'http-status';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import ApiError from '../../errors/AppError';
import { Request } from 'express';
import { handleFileUploads } from '../../utils/handleFile';
import { serviceSelect } from './service.select';
import { buildFilterConditions } from './service.utils';

// -------------------------------------------------------
// create Service
// -------------------------------------------------------
const createService = async (req: Request) => {
  const userId = req.user.id;
  const data = req.body;
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  const uploadedFiles = await handleFileUploads(files);
  const addedData = { ...data, ...uploadedFiles, userId };
  const result = await prisma.service.create({
    data: addedData,
    select: serviceSelect,
  });
  return result;
};

// -------------------------------------------------------
// get all Service
// -------------------------------------------------------
type IServiceFilterRequest = {
  searchTerm?: string;
  id?: string;
  createdAt?: string;
  status?: string;
};

const serviceSearchAbleFields = ['title'];

const getServiceList = async (
  req: Request,
  options: IPaginationOptions,
  filters: IServiceFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.ServiceWhereInput[] = [{ isDeleted: false }];

  if (searchTerm) {
    andConditions.push({
      OR: serviceSearchAbleFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.ServiceWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [result, total] = await Promise.all([
    prisma.service.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      select: serviceSelect,
    }),
    prisma.service.count({ where: whereConditions }),
  ]);

  return { meta: { total, page, limit }, data: result };
};

// -------------------------------------------------------
// get Service by id
// -------------------------------------------------------
const getServiceById = async (req: Request) => {
  const { id } = req.params;

  const result = await prisma.service.findUnique({
    where: { id },
    select: {
      ...serviceSelect,
      clinicServices: {
        select: {
          clinicId: true,
          clinic: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              status: true,
              clinicGmcNumber: true,
              isParking: true,        // ← User field, accessed via clinic relation
              location: {
                select: {
                  id: true,
                  locationName: true,
                  lat: true,
                  lng: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
  }

  // flatten clinics out of the junction
  return {
    ...result,
    clinics: result.clinicServices.map(cs => cs.clinic),
    clinicServices: undefined,
  };
};
// -------------------------------------------------------
// get my Service
// -------------------------------------------------------
const getMyService = async (
  req: Request,
  options: IPaginationOptions,
  filters: IServiceFilterRequest,
) => {
  const userId = req.user.id;
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.ServiceWhereInput[] = [{ isDeleted: false }];
  // const andConditions: Prisma.ServiceWhereInput[] = [{ userId }];

  if (searchTerm) {
    andConditions.push({
      OR: serviceSearchAbleFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.ServiceWhereInput = { AND: andConditions };

  const [result, total] = await Promise.all([
    prisma.service.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      select: serviceSelect,
    }),
    prisma.service.count({ where: whereConditions }),
  ]);

  return { meta: { total, page, limit }, data: result };
};

// -------------------------------------------------------
// update Service
// -------------------------------------------------------
const updateService = async (req: Request) => {
  const { id } = req.params;
  const data = req.body;
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  const uploadedFiles = await handleFileUploads(files);

  const existingService = await prisma.service.findUnique({ where: { id } });
  if (!existingService) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
  }

  const result = await prisma.service.update({
    where: { id },
    data: {
      title: data.title ?? (existingService as any).title,
      description: data.description ?? (existingService as any).description,
      files: uploadedFiles.files ?? (existingService as any).files,
    },
    select: serviceSelect,
  });

  return result;
};

// -------------------------------------------------------
// toggle status Service
// -------------------------------------------------------
const toggleStatusService = async (id: string) => {};

// -------------------------------------------------------
// soft delete Service
// -------------------------------------------------------
const softDeleteService = async (id: string) => {
  const existingService = await prisma.service.findUnique({
    where: { id, isDeleted: false },
  });
  if (!existingService) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Service not found or Service is already deleted',
    );
  }

  const result = await prisma.service.update({
    where: { id },
    data: { isDeleted: true },
    select: serviceSelect,
  });
  return result;
};

// -------------------------------------------------------
// hard delete Service
// -------------------------------------------------------
const deleteService = async (id: string) => {
  const existingService = await prisma.service.findUnique({ where: { id } });
  if (!existingService) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
  }
  const result = await prisma.service.delete({ where: { id } });
  return result;
};

export const serviceService = {
  createService,
  getServiceList,
  getServiceById,
  getMyService,
  updateService,
  toggleStatusService,
  softDeleteService,
  deleteService,
};
