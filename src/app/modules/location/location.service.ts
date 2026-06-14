import httpStatus from 'http-status';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import ApiError from '../../errors/AppError';
import { Request } from 'express';
import { handleFileUploads } from '../../utils/handleFile';
import { locationSelect } from './location.select';
import { buildFilterConditions } from './location.utils';

// -------------------------------------------------------
// create Location
// -------------------------------------------------------
const createLocation = async (req: Request) => {
  const userId = req.user.id;
  const data = req.body;

  const addedData = { ...data, adminId: userId };
  const result = await prisma.location.create({
    data: addedData,
    select: locationSelect,
  });
  return result;
};

// -------------------------------------------------------
// get all Location
// -------------------------------------------------------
type ILocationFilterRequest = {
  searchTerm?: string;
  id?: string;
  createdAt?: string;
  status?: string;
};

const locationSearchAbleFields = ['locationName'];

const getLocationList = async (
  options: IPaginationOptions,
  filters: ILocationFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.LocationWhereInput[] = [{ isDeleted: false }];

  if (searchTerm) {
    andConditions.push({
      OR: locationSearchAbleFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.LocationWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [result, total] = await Promise.all([
    prisma.location.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      select: locationSelect,
    }),
    prisma.location.count({ where: whereConditions }),
  ]);

  return { meta: { total, page, limit }, data: result };
};

// -------------------------------------------------------
// get Location by id
// -------------------------------------------------------
const getLocationById = async (id: string) => {
  const result = await prisma.location.findUnique({
    where: { id },
    select: locationSelect,
  });
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Location not found');
  }
  return result;
};

// -------------------------------------------------------
// get my Location
// -------------------------------------------------------
const getMyLocation = async (
  req: Request,
  options: IPaginationOptions,
  filters: ILocationFilterRequest,
) => {
  const userId = req.user.id;
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.LocationWhereInput[] = [{ isDeleted: false }];
  // const andConditions: Prisma.LocationWhereInput[] = [{ userId }];

  if (searchTerm) {
    andConditions.push({
      OR: locationSearchAbleFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.LocationWhereInput = { AND: andConditions };

  const [result, total] = await Promise.all([
    prisma.location.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      select: locationSelect,
    }),
    prisma.location.count({ where: whereConditions }),
  ]);

  return { meta: { total, page, limit }, data: result };
};

// -------------------------------------------------------
// update Location
// -------------------------------------------------------
const updateLocation = async (req: Request) => {
  const { id } = req.params;
  const data = req.body;
  const existingLocation = await prisma.location.findUnique({ where: { id } });
  if (!existingLocation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Location not found');
  }

  const result = await prisma.location.update({
    where: { id },
    data: {
      locationName: data.locationName ?? (existingLocation as any).locationName,
      lat: data.lat ?? (existingLocation as any).lat,
      lng: data.lng ?? (existingLocation as any).lng,
    },
    select: locationSelect,
  });

  return result;
};

// -------------------------------------------------------
// toggle status Location
// -------------------------------------------------------
const toggleStatusLocation = async (id: string) => {};

// -------------------------------------------------------
// soft delete Location
// -------------------------------------------------------
const softDeleteLocation = async (id: string) => {
  const existingLocation = await prisma.location.findUnique({
    where: { id, isDeleted: false },
  });
  if (!existingLocation) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Location not found or Location is already deleted',
    );
  }

  const result = await prisma.location.update({
    where: { id },
    data: { isDeleted: true },
    select: locationSelect,
  });
  return result;
};

// -------------------------------------------------------
// hard delete Location
// -------------------------------------------------------
const deleteLocation = async (id: string) => {
  const existingLocation = await prisma.location.findUnique({ where: { id } });
  if (!existingLocation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Location not found');
  }
  const result = await prisma.location.delete({ where: { id } });
  return result;
};

export const locationService = {
  createLocation,
  getLocationList,
  getLocationById,
  getMyLocation,
  updateLocation,
  toggleStatusLocation,
  softDeleteLocation,
  deleteLocation,
};
