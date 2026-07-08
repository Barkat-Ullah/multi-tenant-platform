import httpStatus from 'http-status';
import { Prisma, UserRoleEnum, UserStatus } from '@prisma/client';
import prisma from '../../utils/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import ApiError from '../../errors/AppError';
import { Request } from 'express';
import { buildFilterConditions } from './organizerRequest.utils';
import emailSender, {
  clinicAssignedEmail,
  newOrganizerRequestAdminEmail,
  organizerRequestConfirmedEmail,
} from '../../utils/sendMail';
import { getAdminAndSuperAdminEmails } from '../booking/booking.helper';

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

  const organizerRequest = await prisma.organizerRequest.create({
    data: { ...data, userId },
    include: baseOrganizerRequestInclude,
  });

  // ----------------------------------------------------------
  // Fetch organizer + service + admins for notifications
  // ----------------------------------------------------------
  const [organizer, admins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true },
    }),
    getAdminAndSuperAdminEmails(),
  ]);

  const serviceName = organizerRequest.service?.title ?? 'N/A';
  const companyName = organizerRequest.companyName;

  // ----------------------------------------------------------
  // Email + Notification → all admins & super admins
  // ----------------------------------------------------------
  for (const admin of admins) {
    // email
    emailSender(
      admin.email,
      newOrganizerRequestAdminEmail(
        admin.fullName,
        organizer?.fullName ?? 'Organizer',
        companyName,
        organizerRequest.id,
        serviceName,
        organizerRequest.totalDriver,
        organizerRequest.location,
      ),
      'New Organizer Request Submitted',
    ).catch(err => console.error('Admin organizer request mail failed:', err));

    // notification
    prisma.notification
      .create({
        data: {
          receiverId: admin.id,
          title: 'New Organizer Request',
          body: `${organizer?.fullName ?? 'An organizer'} submitted a new request for ${companyName} (${serviceName}).`,
          type: 'OrganizerRequest',
          referenceId: organizerRequest.id,
        },
      })
      .catch(err => console.error('Admin notification failed:', err));
  }

  return organizerRequest;
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

  const [
    result,
    total,
    corporateClients,
    activeCorporate,
    monthlyBookings,
    reqCorporates,
  ] = await Promise.all([
    prisma.organizerRequest.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      include: baseOrganizerRequestInclude,
    }),
    prisma.organizerRequest.count({ where: whereConditions }),
    prisma.user.count({
      where: { role: UserRoleEnum.ORGINIZER, isDeleted: false },
    }),
    prisma.user.count({
      where: {
        role: UserRoleEnum.ORGINIZER,
        status: UserStatus.ACTIVE,
        isDeleted: false,
      },
    }),
    prisma.organizerRequest.count({
      where: {
        isDeleted: false,
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        },
      },
    }),
    prisma.organizerRequest.count({
      where: { isDeleted: false, status: 'Pending' },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      corporateClients,
      activeCorporate,
      monthlyBookings,
      reqCorporates,
    },
    data: result,
  };
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
      include: {
        ...baseOrganizerRequestInclude,
        _count: { select: { drivers: true } },
      },
    }),
    prisma.organizerRequest.count({ where: whereConditions }),
  ]);

  const data = result.map(item => {
    const expectedCount = Number(item.totalDriver?.trim());
    const addedCount = item._count.drivers;

    const rosterStatus =
      !Number.isNaN(expectedCount) && expectedCount === addedCount
        ? 'Block'
        : 'Open';

    return { ...item, rosterStatus };
  });

  return { meta: { total, page, limit }, data };
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
  const existing = await prisma.organizerRequest.findUnique({
    where: { id },
    include: {
      organizer: { select: { fullName: true, email: true } },
      service: { select: { title: true } },
    },
  });

  if (!existing || existing.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organizer Request not found');
  }

  const updated = await prisma.organizerRequest.update({
    where: { id },
    data: {
      clinicId: clinicId ?? null,
      status,
    },
    include: baseOrganizerRequestInclude,
  });

  // only send mails when status is being set to Confirmed with a clinic
  if (status === 'Confirmed' && clinicId) {
    const clinic = await prisma.user.findUnique({
      where: { id: clinicId },
      select: { fullName: true, email: true },
    });

    // email → clinic
    if (clinic?.email) {
      emailSender(
        clinic.email,
        clinicAssignedEmail(
          clinic.fullName,
          existing.companyName,
          id,
          existing.service.title,
          existing.totalDriver,
        ),
        'New Organizer Request Assigned to Your Clinic',
      ).catch(err => console.error('Clinic assign mail failed:', err));
    }

    // email → organizer
    if (existing.organizer.email) {
      emailSender(
        existing.organizer.email,
        organizerRequestConfirmedEmail(
          existing.organizer.fullName,
          existing.companyName,
          id,
          clinic?.fullName ?? 'Assigned Clinic',
          existing.service.title,
        ),
        'Your Request Has Been Confirmed – Add Your Drivers',
      ).catch(err => console.error('Organizer confirm mail failed:', err));
    }

    // notification → organizer
    await prisma.notification.create({
      data: {
        receiverId: existing.userId,
        title: 'Request Confirmed',
        body: `Your request for ${existing.companyName} has been confirmed. Please add your drivers now.`,
        type: 'OrganizerRequest',
        referenceId: id,
      },
    });

    // notification → clinic
    if (clinicId) {
      await prisma.notification.create({
        data: {
          receiverId: clinicId,
          title: 'New Request Assigned',
          body: `A new organizer request from ${existing.companyName} has been assigned to your clinic.`,
          type: 'OrganizerRequest',
          referenceId: id,
        },
      });
    }
  }

  return updated;
};

// Organizer driver push step
const addDriversToRequest = async (
  id: string,
  organizerId: string,
  driverIds: string[],
) => {
  const request = await prisma.organizerRequest.findUnique({
    where: { id },
    select: { totalDriver: true, isDeleted: true, userId: true, status: true },
  });

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

  const expectedCount = Number(request.totalDriver?.trim());

  if (Number.isNaN(expectedCount) || driverIds.length > expectedCount) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Driver count exceeds expected: Expected max ${request.totalDriver}, but got ${driverIds.length}`,
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

  const updatedRequest = await prisma.organizerRequest.findUnique({
    where: { id },
    include: baseOrganizerRequestInclude,
  });

  return {
    ...updatedRequest,
    totalDriversAdded: driverIds.length,
    expectedDriverCount: expectedCount,
  };
};

const softDeleteOrganizerRequest = async (id: string) => {
  const existing = await prisma.organizerRequest.findUnique({
    where: { id, isDeleted: false },
    select: { isDeleted: true },
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
