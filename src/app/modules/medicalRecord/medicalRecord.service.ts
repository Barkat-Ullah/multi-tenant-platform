import httpStatus from 'http-status';
import { BookingStatus, Prisma, UserRoleEnum } from '@prisma/client';
import prisma from '../../utils/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import ApiError from '../../errors/AppError';
import { Request } from 'express';
import { handleFileUploads } from '../../utils/handleFile';
import { medicalRecordSelect } from './medicalRecord.select';
import { buildFilterConditions } from './medicalRecord.utils';
import emailSender, {
  medicalRecordUploadedDriverEmail,
  medicalRecordUploadedOrganizerEmail,
} from '../../utils/sendMail';

type IMedicalRecordFilterRequest = {
  searchTerm?: string;
  id?: string;
  createdAt?: string;
  result?: string;
  driverId?: string;
};

const medicalRecordSearchAbleFields = ['notes'];

// -------------------------------------------------------
// create MedicalRecord — CLINIC ONLY
//
// Flow:
// 1. Admin assigns clinic to OrganizerRequest
// 2. Organizer adds their drivers to the request
// 3. Clinic creates medical record per driver
//    using organizerRequestId + driverId (no booking needed)
// -------------------------------------------------------
const createMedicalRecord = async (req: Request) => {
  const clinicId = req.user.id;
  const userRole = req.user.role;
  const data = req.body;

  // ----------------------------------------------------------
  // STEP 1: Role check first
  // ----------------------------------------------------------
  if (userRole !== UserRoleEnum.CLINIC) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Only clinics can create medical records',
    );
  }

  // ----------------------------------------------------------
  // STEP 2: Exactly one source must be provided
  // ----------------------------------------------------------
  if (!data.bookingId && !data.organizerRequestId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Either bookingId or organizerRequestId is required',
    );
  }

  if (data.bookingId && data.organizerRequestId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Provide either bookingId or organizerRequestId, not both',
    );
  }

  // ----------------------------------------------------------
  // STEP 3: Resolve driverId + validate based on flow
  // ----------------------------------------------------------
  let driverId: string;
  let organizerId: string | null = null;

  if (data.bookingId) {
    // ── Normal driver flow ────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      select: { clinicId: true, driverId: true, status: true },
    });

    if (!booking) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
    }
    if (booking.clinicId !== clinicId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'This booking does not belong to your clinic',
      );
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot upload record — booking is not confirmed yet',
      );
    }

    // duplicate check
    const existingRecord = await prisma.medicalRecord.findFirst({
      where: { bookingId: data.bookingId },
    });
    if (existingRecord) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'A medical record already exists for this booking',
      );
    }

    driverId = booking.driverId;
  } else {
    // ── Organizer flow ────────────────────────────────────
    const organizerRequest = await prisma.organizerRequest.findUnique({
      where: { id: data.organizerRequestId },
      select: {
        clinicId: true,
        status: true,
        userId: true,
        drivers: { select: { driverId: true } },
      },
    });

    if (!organizerRequest) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organizer request not found');
    }
    if (organizerRequest.clinicId !== clinicId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'This request was not assigned to your clinic',
      );
    }
    if (organizerRequest.status !== 'Confirmed') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot upload record — organizer request is not confirmed yet',
      );
    }
    if (!data.driverId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'driverId is required for organizer flow',
      );
    }

    const isDriverInRequest = organizerRequest.drivers.some(
      d => d.driverId === data.driverId,
    );
    if (!isDriverInRequest) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'This driver is not part of the organizer request',
      );
    }

    // duplicate check
    const existingRecord = await prisma.medicalRecord.findFirst({
      where: {
        organizerRequestId: data.organizerRequestId,
        driverId: data.driverId,
      },
    });
    if (existingRecord) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'A medical record already exists for this driver in this request',
      );
    }

    driverId = data.driverId;
    organizerId = organizerRequest.userId;
  }

  // ----------------------------------------------------------
  // STEP 4: Handle file uploads
  // ----------------------------------------------------------
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  const uploadedFiles = await handleFileUploads(files);

  // ----------------------------------------------------------
  // STEP 5: Create medical record — explicit fields only (no ...data spread)
  // ----------------------------------------------------------
  const medicalRecord = await prisma.medicalRecord.create({
    data: {
      clinicId,
      driverId,
      bookingId: data.bookingId ?? null,
      organizerRequestId: data.organizerRequestId ?? null,
      result: data.result ?? 'Pending',
      notes: data.notes ?? null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      files: uploadedFiles.files ?? null,
    },
    select: medicalRecordSelect,
  });

  // ----------------------------------------------------------
  // STEP 6: Fetch users for notifications (parallel)
  // ----------------------------------------------------------
  const [driver, clinic, organizer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: driverId },
      select: { fullName: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: clinicId },
      select: { fullName: true },
    }),
    organizerId
      ? prisma.user.findUnique({
          where: { id: organizerId },
          select: { fullName: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  const expiryDateStr = data.expiryDate
    ? new Date(data.expiryDate).toDateString()
    : undefined;

  const recordResult = data.result ?? 'Pending';
  const clinicName = clinic?.fullName ?? 'Clinic';

  // ----------------------------------------------------------
  // STEP 7: Notification + Email → driver
  // ----------------------------------------------------------
  await prisma.notification.create({
    data: {
      receiverId: driverId,
      senderId: clinicId,
      title: 'Medical Record Uploaded',
      body: `Your medical record has been uploaded by ${clinicName}.`,
      type: 'MedicalRecord',
      referenceId: medicalRecord.id,
    },
  });

  if (driver?.email) {
    emailSender(
      driver.email,
      medicalRecordUploadedDriverEmail(
        driver.fullName,
        clinicName,
        medicalRecord.id,
        recordResult,
        expiryDateStr,
      ),
      'Your Medical Record Has Been Uploaded',
    ).catch(err => console.error('Driver medical record mail failed:', err));
  }

  // ----------------------------------------------------------
  // STEP 8: Notification + Email → organizer (only if organizer flow)
  // ----------------------------------------------------------
  if (organizerId && organizer) {
    await prisma.notification.create({
      data: {
        receiverId: organizerId,
        senderId: clinicId,
        title: 'Driver Medical Record Uploaded',
        body: `Medical record for driver ${driver?.fullName ?? 'your driver'} has been uploaded by ${clinicName}.`,
        type: 'MedicalRecord',
        referenceId: medicalRecord.id,
      },
    });

    if (organizer.email) {
      emailSender(
        organizer.email,
        medicalRecordUploadedOrganizerEmail(
          organizer.fullName,
          driver?.fullName ?? 'Driver',
          clinicName,
          medicalRecord.id,
          recordResult,
          expiryDateStr,
        ),
        'Driver Medical Record Uploaded',
      ).catch(err =>
        console.error('Organizer medical record mail failed:', err),
      );
    }
  }

  return medicalRecord;
};

// -------------------------------------------------------
// get all MedicalRecord — ADMIN / SUPERADMIN
// -------------------------------------------------------
const getMedicalRecordList = async (
  options: IPaginationOptions,
  filters: IMedicalRecordFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.MedicalRecordWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: medicalRecordSearchAbleFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.MedicalRecordWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [result, total] = await Promise.all([
    prisma.medicalRecord.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      select: medicalRecordSelect,
    }),
    prisma.medicalRecord.count({ where: whereConditions }),
  ]);

  return { meta: { total, page, limit }, data: result };
};

// -------------------------------------------------------
// get MedicalRecord by id
// driver / clinic / organizer / admin
// -------------------------------------------------------
const getMedicalRecordById = async (req: Request) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { id } = req.params;

  const result = await prisma.medicalRecord.findUnique({
    where: { id },
    select: medicalRecordSelect,
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'MedicalRecord not found');
  }

  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );
  const isOwnerDriver = result.driverId === userId;
  const isOwnerClinic = result.clinicId === userId;

  let isOrganizer = false;
  if (userRole === UserRoleEnum.ORGINIZER) {
    const driver = await prisma.user.findUnique({
      where: { id: result.driverId },
      select: { organizerId: true },
    });
    isOrganizer = driver?.organizerId === userId;
  }

  if (!isAdmin && !isOwnerDriver && !isOwnerClinic && !isOrganizer) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot access this record');
  }

  return result;
};

// -------------------------------------------------------
// get my MedicalRecord — scoped by role
// -------------------------------------------------------
const getMyMedicalRecord = async (
  req: Request,
  options: IPaginationOptions,
  filters: IMedicalRecordFilterRequest,
) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.MedicalRecordWhereInput[] = [];

  if (userRole === UserRoleEnum.USER) {
    // driver — own records only
    andConditions.push({ driverId: userId });
  } else if (userRole === UserRoleEnum.CLINIC) {
    // clinic — records they uploaded
    andConditions.push({ clinicId: userId });
  } else if (userRole === UserRoleEnum.ORGINIZER) {
    // organizer — all records for their drivers
    const myDrivers = await prisma.user.findMany({
      where: { organizerId: userId, isDeleted: false },
      select: { id: true },
    });
    const driverIds = myDrivers.map(d => d.id);

    if (driverIds.length === 0) {
      return { meta: { total: 0, page, limit }, data: [] };
    }

    andConditions.push({ driverId: { in: driverIds } });
  } else {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  }

  if (searchTerm) {
    andConditions.push({
      OR: medicalRecordSearchAbleFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.MedicalRecordWhereInput = {
    AND: andConditions,
  };

  const [result, total] = await Promise.all([
    prisma.medicalRecord.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      select: medicalRecordSelect,
    }),
    prisma.medicalRecord.count({ where: whereConditions }),
  ]);

  return { meta: { total, page, limit }, data: result };
};

// -------------------------------------------------------
// update MedicalRecord — CLINIC or ADMIN
// -------------------------------------------------------
const updateMedicalRecord = async (req: Request) => {
  const { id } = req.params;
  const clinicId = req.user.id;
  const userRole = req.user.role;
  const data = req.body;

  const existingRecord = await prisma.medicalRecord.findUnique({
    where: { id },
  });
  if (!existingRecord) {
    throw new ApiError(httpStatus.NOT_FOUND, 'MedicalRecord not found');
  }

  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );
  if (!isAdmin && existingRecord.clinicId !== clinicId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot update this record');
  }

  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  const uploadedFiles = await handleFileUploads(files);

  const result = await prisma.medicalRecord.update({
    where: { id },
    data: {
      result: data.result ?? existingRecord.result,
      files: uploadedFiles.files ?? existingRecord.files,
      notes: data.notes ?? existingRecord.notes,
      expiryDate: data.expiryDate ?? existingRecord.expiryDate,
    },
    select: medicalRecordSelect,
  });

  return result;
};

// -------------------------------------------------------
// hard delete — ADMIN ONLY
// -------------------------------------------------------
const deleteMedicalRecord = async (id: string) => {
  const existingRecord = await prisma.medicalRecord.findUnique({
    where: { id },
  });
  if (!existingRecord) {
    throw new ApiError(httpStatus.NOT_FOUND, 'MedicalRecord not found');
  }
  return await prisma.medicalRecord.delete({ where: { id } });
};

export const medicalRecordService = {
  createMedicalRecord,
  getMedicalRecordList,
  getMedicalRecordById,
  getMyMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
};
