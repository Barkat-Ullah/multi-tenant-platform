import httpStatus from 'http-status';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import ApiError from '../../errors/AppError';
import { Request } from 'express';
import { buildFilterConditions } from './organizerRequest.utils';

const baseOrganizerRequestInclude: Prisma.OrganizerRequestInclude = {
  service: true,
  clinic: { select: { id: true, fullName: true, email: true } },
  organizer: { select: { id: true, fullName: true } },
  drivers: {
    include: {
      driver: {
        select: { id: true, fullName: true, email: true, phoneNumber: true },
      },
    },
  },
};

const createOrganizerRequest = async (req: Request) => {
  const userId = req.user.id;
  const data = req.body;
  return await prisma.organizerRequest.create({
    data: { ...data, userId },
    include: baseOrganizerRequestInclude,
  });
};

const getOrganizerRequestList = async (
  req: Request,
  options: IPaginationOptions,
  filters: any,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions: Prisma.OrganizerRequestWhereInput[] = [
    { isDeleted: false },
  ];

  // Role Base Visibility (ADMIN and SUPERADMIN see everything unfiltered)
  if (req.user.role === 'CLINIC') {
    andConditions.push({ clinicId: req.user.id });
  }

  if (searchTerm) {
    andConditions.push({
      OR: ['companyName', 'email', 'phone', 'location'].map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.OrganizerRequestWhereInput = {
    AND: andConditions,
  };

  const [result, total] = await Promise.all([
    prisma.organizerRequest.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      include: baseOrganizerRequestInclude,
    }),
    prisma.organizerRequest.count({ where: whereConditions }),
  ]);

  return { meta: { total, page, limit }, data: result };
};

const getOrganizerRequestById = async (id: string, user: any) => {
  const result = await prisma.organizerRequest.findUnique({
    where: { id },
    include: baseOrganizerRequestInclude,
  });

  if (!result || result.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organizer Request not found');
  }

  // Security checks for segmented data leakage
  if (user.role === 'CLINIC' && result.clinicId !== user.id) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Access Denied: Not your assigned request',
    );
  }
  if (user.role === 'ORGINIZER' && result.userId !== user.id) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Access Denied: This request does not belong to you',
    );
  }

  return result;
};

const getMyOrganizerRequest = async (
  req: Request,
  options: IPaginationOptions,
  filters: any,
) => {
  const userId = req.user.id;
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.OrganizerRequestWhereInput[] = [
    { userId, isDeleted: false },
  ];

  if (searchTerm) {
    andConditions.push({
      OR: ['companyName', 'email', 'location'].map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.OrganizerRequestWhereInput = {
    AND: andConditions,
  };

  const [result, total] = await Promise.all([
    prisma.organizerRequest.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      include: baseOrganizerRequestInclude,
    }),
    prisma.organizerRequest.count({ where: whereConditions }),
  ]);

  return { meta: { total, page, limit }, data: result };
};

const updateOrganizerRequest = async (req: Request) => {
  const { id } = req.params;
  const data = req.body;

  const existing = await prisma.organizerRequest.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organizer Request not found');
  }

  return await prisma.organizerRequest.update({
    where: { id },
    data,
    include: baseOrganizerRequestInclude,
  });
};

// Admin and SuperAdmin workflow step
const assignClinicAndStatus = async (
  id: string,
  clinicId?: string,
  status: any = 'Confirmed',
) => {
  const existing = await prisma.organizerRequest.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organizer Request not found');
  }

  return await prisma.organizerRequest.update({
    where: { id },
    data: {
      clinicId: clinicId ?? null,
      status: status,
    },
    include: baseOrganizerRequestInclude,
  });
};

// Organizer driver push step
const addDriversToRequest = async (
  id: string,
  organizerId: string,
  driverIds: string[],
) => {
  const request = await prisma.organizerRequest.findUnique({ where: { id } });

  if (!request || request.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organizer Request not found');
  }
  if (request.userId !== organizerId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'You do not own this request record',
    );
  }
  if (request.status !== 'Confirmed') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Roster blocked: Request status must be Confirmed by an Administrator',
    );
  }

  const createManyPayload = driverIds.map(driverId => ({
    driverId,
    organizerRequestId: id,
  }));

  await prisma.$transaction([
    prisma.organizerRequestDriver.deleteMany({
      where: { organizerRequestId: id },
    }),
    prisma.organizerRequestDriver.createMany({
      data: createManyPayload,
    }),
  ]);

  return await prisma.organizerRequest.findUnique({
    where: { id },
    include: baseOrganizerRequestInclude,
  });
};

const softDeleteOrganizerRequest = async (id: string) => {
  const existing = await prisma.organizerRequest.findUnique({
    where: { id, isDeleted: false },
  });
  if (!existing) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Organizer Request not found or already deleted',
    );
  }

  return await prisma.organizerRequest.update({
    where: { id },
    data: { isDeleted: true },
    include: baseOrganizerRequestInclude,
  });
};

const deleteOrganizerRequest = async (id: string) => {
  const existing = await prisma.organizerRequest.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organizer Request not found');
  }
  return await prisma.organizerRequest.delete({ where: { id } });
};

export const organizerRequestService = {
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
