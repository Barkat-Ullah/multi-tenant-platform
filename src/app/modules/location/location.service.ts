import httpStatus from 'http-status';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import ApiError from '../../errors/AppError';
import { Request } from 'express';
import { locationSelect } from './location.select';
import { buildFilterConditions } from './location.utils';
import { handleFileUploads } from '../../utils/handleFile';

// Haversine distance in KM (consistent with existing location listing logic)
const getDistanceFromLatLonInKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};


// -------------------------------------------------------
// create Location
// -------------------------------------------------------
const createLocation = async (req: Request) => {
  const userId = req.user.id;
  const data = req.body;
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  const uploadedFiles = await handleFileUploads(files);

  const addedData = { ...data, adminId: userId, image: uploadedFiles.image };
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

// const getLocationList = async (
//   options: IPaginationOptions,
//   filters: ILocationFilterRequest,
//   userLat?: number,
//   userLng?: number,
// ) => {
//   const { page, limit, skip } = paginationHelper.calculatePagination(options);
//   const { searchTerm, ...filterData } = filters;

//   const andConditions: Prisma.LocationWhereInput[] = [{ isDeleted: false }];

//   if (searchTerm) {
//     andConditions.push({
//       OR: locationSearchAbleFields.map(field => ({
//         [field]: { contains: searchTerm, mode: 'insensitive' },
//       })),
//     });
//   }

//   if (Object.keys(filterData).length) {
//     andConditions.push(...buildFilterConditions(filterData));
//   }

//   const whereConditions: Prisma.LocationWhereInput =
//     andConditions.length > 0 ? { AND: andConditions } : {};

//   const now = new Date();

//   const [locations, total] = await Promise.all([
//     prisma.location.findMany({
//       skip,
//       take: limit,
//       where: whereConditions,
//       orderBy: { createdAt: 'desc' },
//       select: {
//         id: true,
//         locationName: true,
//         lat: true,
//         lng: true,
//         totalBookings: true,
//         totalClinicsAdded: true,
//         createdAt: true,
//         clinic: {
//           where: { isDeleted: false },
//           select: {
//             id: true,
//             fullName: true,
//             isParking: true,
//             clinicServices: {
//               select: {
//                 service: { select: { id: true, title: true } },
//               },
//             },
//             clinicAvailabilities: {
//               where: {
//                 isActive: true,
//                 slotDate: { gte: now },
//               },
//               orderBy: { slotDate: 'asc' },
//               take: 1,
//               select: {
//                 slotDate: true,
//                 timeSlots: {
//                   where: { isBooked: false, status: 'Active' },
//                   orderBy: { startTime: 'asc' },
//                   take: 1,
//                   select: { startTime: true },
//                 },
//               },
//             },
//           },
//         },
//       },
//     }),
//     prisma.location.count({ where: whereConditions }),
//   ]);

//   const data = locations.map(location => ({
//     id: location.id,
//     locationName: location.locationName,
//     lat: location.lat,
//     lng: location.lng,
//     totalBookings: location.totalBookings,
//     totalClinicsAdded: location.totalClinicsAdded,
//     clinics: location.clinic.map(clinic => {
//       // get earliest available slot date
//       const earliestAvailability = clinic.clinicAvailabilities[0];
//       const earliestAppointment = earliestAvailability?.slotDate ?? null;
//       const earliestSlotTime = earliestAvailability?.timeSlots[0]?.startTime ?? null;

//       // calculate distance if user coords provided
//       const distance = userLat && userLng
//         ? calculateDistance(userLat, userLng, location.lat, location.lng)
//         : null;

//       return {
//         id: clinic.id,
//         fullName: clinic.fullName,
//         isParking: clinic.isParking,
//         // services: clinic.clinicServices.map(cs => cs.service),
//         earliestAppointment,               // "2026-06-06T00:00:00.000Z"
//         earliestSlotTime,                  // "09:00"
//         // distance: distance ? `${distance.toFixed(1)} mile` : null,
//       };
//     }),
//   }));

//   return { meta: { total, page, limit }, data };
// };

// -------------------------------------------------------
// helper — Haversine formula to calculate distance in miles
// -------------------------------------------------------

const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (value: number) => (value * Math.PI) / 180;

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
// get nearest Location for council
// -------------------------------------------------------

const councilNearestLocationServices = async (req: Request) => {
  const { councilLat, councilLng } = req.query;

  if (!councilLat || !councilLng) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'councilLat and councilLng are required');
  }

  const lat = parseFloat(councilLat as string);
  const lng = parseFloat(councilLng as string);

  if (isNaN(lat) || isNaN(lng)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'councilLat and councilLng must be valid numbers');
  }

  // 1. Get all non-deleted locations with their clinics
  const locations = await prisma.location.findMany({
    where: { isDeleted: false },
    include: {
      clinic: {
        select: { id: true },
      },
    },
  });

  if (!locations.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No locations found');
  }

  // 2. Find nearest location using Haversine
  let nearestLocation = locations[0];
  let minDistance = getDistanceFromLatLonInKm(lat, lng, locations[0].lat, locations[0].lng);

  for (const location of locations) {
    const distance = getDistanceFromLatLonInKm(lat, lng, location.lat, location.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestLocation = location;
    }
  }

  const clinicIds = nearestLocation.clinic.map((c) => c.id);

  if (!clinicIds.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No clinics found for the nearest location');
  }

  // 3. Get all services offered by these clinics via the junction model
  const clinicServices = await prisma.clinicService.findMany({
    where: {
      clinicId: { in: clinicIds },
    },
    include: {
      service: true,
    },
  });

  // 4. Dedupe services (a service can be linked to multiple clinics in the same location)
  const uniqueServicesMap = new Map();
  for (const cs of clinicServices) {
    if (cs.service && !cs.service.isDeleted) {
      uniqueServicesMap.set(cs.service.id, cs.service);
    }
  }

  const services = Array.from(uniqueServicesMap.values());

  return {
    location: nearestLocation,
    distanceInKm: minDistance,
    totalClinics: clinicIds.length,
    services,
  };
};

// -------------------------------------------------------
// update Location
// -------------------------------------------------------
const updateLocation = async (req: Request) => {
  const { id } = req.params;
  const data = req.body;
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  const uploadedFiles = await handleFileUploads(files);
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
      image: uploadedFiles.image ?? (existingLocation as any).image,
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
  councilNearestLocationServices,
  updateLocation,
  toggleStatusLocation,
  softDeleteLocation,
  deleteLocation,
};
