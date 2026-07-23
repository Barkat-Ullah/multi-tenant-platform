import httpStatus from 'http-status';
import {
  AuditAction,
  Prisma,
  User,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { Request } from 'express';
import AppError from '../../errors/AppError';
import ApiError from '../../errors/AppError';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import * as bcrypt from 'bcrypt';
import emailSender, { inviteClinicEmail } from '../../utils/sendMail';
import { fileUploader } from '../../utils/fileUploader';
import { invalidateUserCache } from '../../../lib/authRedis';
import { CacheInvalidator, cacheOr, CacheKeys, TTL } from '../../../lib/redis';

type IUserFilterRequest = {
  searchTerm?: string;
  status?: string;
  role?: UserRoleEnum;
};

const getAllUsersFromDB = async (
  req: Request,
  options: IPaginationOptions,
  filters: IUserFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.UserWhereInput[] = [];

  andConditions.push({ isDeleted: false });

  // Role filter: specific role if provided, otherwise all allowed roles
  andConditions.push({
    role: filterData.role
      ? filterData.role
      : {
          in: [
            UserRoleEnum.USER,
            UserRoleEnum.ADMIN,
            UserRoleEnum.CLINIC,
            UserRoleEnum.ORGINIZER,
          ],
        },
  });
  // Search by name or email
  if (searchTerm) {
    andConditions.push({
      OR: [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { equals: searchTerm, mode: 'insensitive' } },
        {
          location: {
            locationName: { contains: searchTerm, mode: 'insensitive' },
          },
        },
      ],
    });
  }

  if (filterData.status) {
    andConditions.push({
      status: filterData.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
    });
  }

  const whereConditions: Prisma.UserWhereInput =
    andConditions.length > 0
      ? { AND: andConditions }
      : {
          role: {
            in: [
              UserRoleEnum.USER,
              UserRoleEnum.ADMIN,
              UserRoleEnum.CLINIC,
              UserRoleEnum.ORGINIZER,
            ],
          },
        };

  const cacheKey = await CacheKeys.list('user', { page, limit, searchTerm, ...filterData, scope: 'all' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const users = await prisma.user.findMany({
      where: whereConditions,
      select: {
        id: true,
        fullName: true,
        email: true,
        image: true,
        status: true,
        role: true,
        phoneNumber: true,
        createdAt: true,
        describe: true,
        city: true,
        address: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.user.count({
      where: whereConditions,
    });

    const formattedData = users.map(user => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      image: user.image,
      status: user.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
      role: user.role,
      phoneNumber: user.phoneNumber,
      describe: user.describe,
      address: user.address,
      city: user.city,
      joinDate: user.createdAt,
    }));

    return {
      meta: {
        total,
        page,
        limit,
      },
      data: formattedData,
    };
  });

  return cached ?? { meta: { total: 0, page, limit }, data: [] };
};

const getMyimageFromDB = async (id: string) => {
  const cacheKey = await CacheKeys.single('user', id);
  const image = await cacheOr(cacheKey, TTL.MEDIUM, () =>
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
        describe: true,
        city: true,
        address: true,
        image: true,
        dob: true,
      },
    }),
  );

  return image;
};

const getUserDetailsFromDB = async (req: Request) => {
  const { id } = req.params;

  const cacheKey = await CacheKeys.single('user', id);
  const result = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      role: true,
      status: true,
      describe: true,
      city: true,
      address: true,
      image: true,
      dob: true,
      createdAt: true,
      // Driver-specific fields
      licenseNo: true,
      dateOfBirth: true,
      medicalStatus: true,
      medicalExpiry: true,
      // Clinic-specific fields
      clinicGmcNumber: true,
      isParking: true,
      offDays: true,
      locationId: true,
      // Organizer-specific
      companyLocation: true,
      organizerId: true,
      // Admin who created this user
      createdById: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const { role } = user;

  // ─── ROLE-BASED DATA FETCH ─────────────────────────────────
  let roleSpecificData: Record<string, any> = {};

  if (role === UserRoleEnum.USER) {
    // ── Driver: bookings, medical records, organizer info ──
    const [bookings, medicalRecords, tickets] = await Promise.all([
      prisma.booking.findMany({
        where: { driverId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          createdAt: true,
          clinic: { select: { id: true, fullName: true } },
          service: { select: { id: true, title: true } },
          timeSlot: { select: { date: true, startTime: true, endTime: true } },
        },
      }),
      prisma.medicalRecord.findMany({
        where: { driverId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          result: true,
          files: true,
          notes: true,
          expiryDate: true,
          createdAt: true,
          clinic: { select: { id: true, fullName: true } },
          booking: { select: { id: true, scheduledAt: true } },
        },
      }),
      prisma.supportTicket.findMany({
        where: { createdById: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      }),
    ]);

    roleSpecificData = {
      bookings,
      medicalRecords,
      tickets,
      bookingCount: await prisma.booking.count({ where: { driverId: id } }),
      medicalRecordCount: await prisma.medicalRecord.count({
        where: { driverId: id },
      }),
      ticketCount: await prisma.supportTicket.count({
        where: { createdById: id },
      }),
    };

    // If driver belongs to an organizer, include organizer info
    if (user.organizerId) {
      const organizer = await prisma.user.findUnique({
        where: { id: user.organizerId },
        select: { id: true, fullName: true, email: true, companyLocation: true },
      });
      roleSpecificData.organizer = organizer;
    }
  } else if (role === UserRoleEnum.CLINIC) {
    // ── Clinic: bookings, time slots, services, location ──
    const [location, clinicServices, bookings, timeSlots, medicalRecords, organizerRequests] =
      await Promise.all([
        prisma.location.findUnique({
          where: { id: user.locationId ?? undefined },
          select: { id: true, locationName: true, totalBookings: true },
        }),
        prisma.clinicService.findMany({
          where: { clinicId: id },
          select: {
            service: { select: { id: true, title: true } },
          },
        }),
        prisma.booking.findMany({
          where: { clinicId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            createdAt: true,
            driver: { select: { id: true, fullName: true, email: true } },
            service: { select: { id: true, title: true } },
            timeSlot: { select: { date: true, startTime: true, endTime: true } },
          },
        }),
        prisma.timeSlot.findMany({
          where: { clinicId: id, date: { gte: new Date() } },
          orderBy: { date: 'asc' },
          take: 20,
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            capacity: true,
            booked: true,
            isBooked: true,
            status: true,
          },
        }),
        prisma.medicalRecord.findMany({
          where: { clinicId: id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            result: true,
            expiryDate: true,
            createdAt: true,
            driver: { select: { id: true, fullName: true } },
          },
        }),
        prisma.organizerRequest.findMany({
          where: { clinicId: id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            companyName: true,
            totalDriver: true,
            createdAt: true,
          },
        }),
      ]);

    roleSpecificData = {
      location: location ?? null,
      services: clinicServices.map(cs => cs.service),
      bookings,
      timeSlots,
      medicalRecords,
      organizerRequests,
      bookingCount: await prisma.booking.count({ where: { clinicId: id } }),
      timeSlotCount: await prisma.timeSlot.count({ where: { clinicId: id } }),
      medicalRecordCount: await prisma.medicalRecord.count({
        where: { clinicId: id },
      }),
    };
  } else if (role === UserRoleEnum.ORGINIZER) {
    // ── Organizer: drivers, organizer requests ──
    const [drivers, organizerRequests] = await Promise.all([
      prisma.user.findMany({
        where: { organizerId: id, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          image: true,
          status: true,
          medicalStatus: true,
          medicalExpiry: true,
          createdAt: true,
        },
      }),
      prisma.organizerRequest.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          companyName: true,
          status: true,
          totalDriver: true,
          createdAt: true,
          service: { select: { id: true, title: true } },
          clinic: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    roleSpecificData = {
      drivers,
      organizerRequests,
      driverCount: drivers.length,
      organizerRequestCount: await prisma.organizerRequest.count({
        where: { userId: id },
      }),
    };
  } else if (role === UserRoleEnum.ADMIN || role === UserRoleEnum.SUPERADMIN) {
    // ── Admin/SuperAdmin: created users, activity log ──
    const [createdUsers, recentAuditLogs] = await Promise.all([
      prisma.user.findMany({
        where: { createdById: id, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { actorId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          action: true,
          targetModel: true,
          targetId: true,
          createdAt: true,
        },
      }),
    ]);

    roleSpecificData = {
      createdUsers,
      recentActivity: recentAuditLogs,
      totalUsersCreated: await prisma.user.count({
        where: { createdById: id, isDeleted: false },
      }),
    };
  }

  return {
    ...user,
    roleSpecificData,
  };
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return result;
};

//
const createOrgDriverIntoDB = async (req: Request) => {
  const organizerId = req.user.id;
  const { fullName, email, phoneNumber, password = '123456' } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already in use');
  }

  const result = await prisma.user.create({
    data: {
      organizerId,
      fullName,
      email,
      phoneNumber,
      password,
    },
  });

  await CacheInvalidator.onRecordCreate('user');
  return result;
};

const getAllOrgDriverFromDB = async (
  req: Request,
  options: IPaginationOptions,
  filters: { searchTerm?: string; status?: UserStatus },
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, status } = filters;

  const andConditions: Prisma.UserWhereInput[] = [
    { organizerId: req.user.id },
    { isDeleted: false },
    { role: UserRoleEnum.USER },
  ];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (status) {
    andConditions.push({ status });
  }

  const whereConditions: Prisma.UserWhereInput = { AND: andConditions };

  const cacheKey = await CacheKeys.myList('user', req.user.id, { page, limit, searchTerm, status, scope: 'orgDrivers' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const [drivers, total] = await Promise.all([
      prisma.user.findMany({
        where: whereConditions,
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          status: true,
          phoneNumber: true,
          medicalRecords: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              result: true,
              expiryDate: true,
              createdAt: true,
              organizerRequest: {
                select: {
                  service: {
                    select: { title: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: whereConditions }),
    ]);

    const data = drivers.map(driver => {
      const latestRecord = driver.medicalRecords?.[0] ?? null;

      return {
        id: driver.id,
        fullName: driver.fullName,
        email: driver.email,
        image: driver.image,
        lastMedical: latestRecord?.createdAt ?? null,
        expiryDate: latestRecord?.expiryDate ?? null,
        service: latestRecord?.organizerRequest?.service?.title ?? null,
        medicalResult: latestRecord?.result ?? 'Pending',
      };
    });

    return {
      meta: { total, page, limit },
      data,
    };
  });

  return cached ?? { meta: { total: 0, page, limit }, data: [] };
};

const getAllOrgDriverReportsFromDB = async (
  req: Request,
  options: IPaginationOptions,
  filters: { searchTerm?: string },
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm } = filters;

  // Get all driver ids belonging to this organizer
  const driverIds = await prisma.user.findMany({
    where: { organizerId: req.user.id, isDeleted: false },
    select: { id: true },
  });
  const driverIdList = driverIds.map(d => d.id);

  const andConditions: Prisma.MedicalRecordWhereInput[] = [
    { driverId: { in: driverIdList } },
  ];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { driver: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
        { clinic: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
        {
          organizerRequest: {
            service: { title: { contains: searchTerm, mode: 'insensitive' } },
          },
        },
      ],
    });
  }

  const whereConditions: Prisma.MedicalRecordWhereInput = {
    AND: andConditions,
  };

  const cacheKey = await CacheKeys.myList('medicalRecord', req.user.id, { page, limit, searchTerm, scope: 'orgReports' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const [records, total] = await Promise.all([
      prisma.medicalRecord.findMany({
        where: whereConditions,
        select: {
          id: true,
          files: true,
          createdAt: true,
          driver: {
            select: { id: true, fullName: true, image: true, phoneNumber: true },
          },
          clinic: {
            select: { id: true, fullName: true },
          },
          organizerRequest: {
            select: {
              service: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.medicalRecord.count({ where: whereConditions }),
    ]);

    const data = records.map(record => ({
      id: record.id,
      title: record.organizerRequest?.service?.title ?? 'N/A',
      driverName: record.driver?.fullName ?? 'N/A',
      generatedDate: record.createdAt,
      hospitalName: record.clinic?.fullName ?? 'N/A',
      fileUrl: record.files ?? null,
    }));

    return {
      meta: { total, page, limit },
      data,
    };
  });

  return cached ?? { meta: { total: 0, page, limit }, data: [] };
};
//clinic

const createClinicIntoDB = async (req: Request) => {
  const createdById = req.user.id;
  const {
    fullName,
    email,
    phoneNumber,
    clinicGmcNumber,
    locationId,
    serviceId, // String[]
    password,
    isParking,
  } = req.body;

  // check email
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    throw new Error('Email already in use');
  }

  // validate location
  const location = await prisma.location.findFirst({
    where: { id: locationId, isDeleted: false },
  });
  if (!location) {
    throw new Error('Location not found');
  }

  // validate services
  const services = await prisma.service.findMany({
    where: { id: { in: serviceId }, isDeleted: false },
  });
  if (services.length !== serviceId.length) {
    throw new Error('One or more services not found');
  }

  const defaultPassword = password ?? '12345678';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const clinic = await prisma.$transaction(async tx => {
    // create clinic user
    const newClinic = await tx.user.create({
      data: {
        fullName,
        email,
        phoneNumber,
        password: hashedPassword,
        role: UserRoleEnum.CLINIC,
        isAgreeWithTerms: true,
        clinicGmcNumber,
        locationId,
        isParking: isParking ?? false,
        isEmailVerified: true,
        createdById,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
        clinicGmcNumber: true,
        isParking: true,
        locationId: true,
        createdAt: true,
        location: {
          select: { id: true, locationName: true },
        },
      },
    });

    // create junction rows for each service
    await tx.clinicService.createMany({
      data: serviceId.map((id: string) => ({
        clinicId: newClinic.id,
        serviceId: id,
      })),
    });

    // increment location clinic count
    await tx.location.update({
      where: { id: locationId },
      data: { totalClinicsAdded: { increment: 1 } },
    });

    // audit log
    await tx.auditLog.create({
      data: {
        actorId: createdById,
        action: AuditAction.USER_CREATED,
        targetModel: 'User',
        targetId: newClinic.id,
        metadata: {
          role: 'CLINIC',
          email,
          locationId,
          serviceCount: serviceId.length,
        },
      },
    });

    // in-app notification
    await tx.notification.create({
      data: {
        receiverId: newClinic.id,
        senderId: createdById,
        title: 'Clinic Account Created',
        body: `Welcome ${fullName}! Your clinic account has been created successfully.`,
        type: 'Registration',
      },
    });

    // fetch services to return in response
    const clinicServices = await tx.clinicService.findMany({
      where: { clinicId: newClinic.id },
      select: {
        service: { select: { id: true, title: true } },
      },
    });

    return {
      ...newClinic,
      services: clinicServices.map(cs => cs.service),
    };
  });

  // Invalidate user + location caches
  await Promise.all([
    CacheInvalidator.onRecordCreate('user'),
    CacheInvalidator.onRelatedChange('location'),
  ]);

  // send invite email in background — don't block response
  emailSender(
    email,
    inviteClinicEmail(fullName, email, defaultPassword),
    'Your Clinic Account Has Been Created',
  ).catch(err => {
    console.error(`Email failed for ${email}:`, err);
  });

  return clinic;
};

const getAllClinicsFromDB = async (
  req: Request,
  options: IPaginationOptions,
  filters: IUserFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.UserWhereInput[] = [];

  andConditions.push({
    role: UserRoleEnum.CLINIC,
    isDeleted: false,
  });

  if (searchTerm) {
    andConditions.push({
      OR: [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        {
          location: {
            locationName: { contains: searchTerm, mode: 'insensitive' },
          },
        },
        {
          clinicServices: {
            some: {
              service: {
                title: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          },
        },
      ],
    });
  }

  if (filterData.status) {
    andConditions.push({
      status: filterData.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
    });
  }

  const whereConditions: Prisma.UserWhereInput =
    andConditions.length > 0
      ? { AND: andConditions }
      : { role: UserRoleEnum.CLINIC };

  const cacheKey = await CacheKeys.list('user', { page, limit, searchTerm, ...filterData, scope: 'clinics' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: whereConditions,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          status: true,
          clinicGmcNumber: true,
          isParking: true,
          createdAt: true,
          location: {
            select: {
              id: true,
              locationName: true,
            },
          },
          clinicServices: {
            where: {
              service: { isDeleted: false },
            },
            select: {
              service: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where: whereConditions }),
    ]);

    const data = users.map(({ clinicServices, ...user }) => ({
      ...user,
      services: clinicServices.map(cs => cs.service),
    }));

    return {
      meta: {
        total,
        page,
        limit,
      },
      data,
    };
  });

  return cached ?? { meta: { total: 0, page, limit }, data: [] };
};

const updateClinicIntoDB = async (req: Request) => {
  const { id } = req.params;
  const {
    fullName,
    email,
    phoneNumber,
    clinicGmcNumber,
    locationId,
    serviceId, // String[] | undefined
    isParking,
  } = req.body;

  // check clinic exists
  const existingClinic = await prisma.user.findFirst({
    where: { id, role: UserRoleEnum.CLINIC, isDeleted: false },
  });
  if (!existingClinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Clinic not found');
  }

  // check email taken by another user
  if (email && email !== existingClinic.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      throw new ApiError(httpStatus.CONFLICT, 'Email already in use');
    }
  }

  // validate location if provided
  if (locationId) {
    const location = await prisma.location.findFirst({
      where: { id: locationId, isDeleted: false },
    });
    if (!location) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Location not found');
    }
  }

  // validate services if provided
  if (serviceId?.length) {
    const services = await prisma.service.findMany({
      where: { id: { in: serviceId }, isDeleted: false },
    });
    if (services.length !== serviceId.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'One or more services not found',
      );
    }
  }

  const clinic = await prisma.$transaction(async tx => {
    // update user fields
    const updatedClinic = await tx.user.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(email && { email }),
        ...(phoneNumber && { phoneNumber }),
        ...(clinicGmcNumber && { clinicGmcNumber }),
        ...(locationId && { locationId }),
        ...(isParking !== undefined && { isParking }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
        clinicGmcNumber: true,
        isParking: true,
        locationId: true,
        createdAt: true,
        updatedAt: true,
        location: {
          select: { id: true, locationName: true },
        },
      },
    });

    // replace services if serviceId provided
    if (serviceId?.length) {
      // delete old junction rows
      await tx.clinicService.deleteMany({
        where: { clinicId: id },
      });

      // insert new junction rows
      await tx.clinicService.createMany({
        data: serviceId.map((sid: string) => ({
          clinicId: id,
          serviceId: sid,
        })),
      });
    }

    // audit log
    await tx.auditLog.create({
      data: {
        actorId: req.user.id,
        action: AuditAction.USER_UPDATED,
        targetModel: 'User',
        targetId: id,
        metadata: {
          updatedFields: Object.keys(req.body),
          serviceCount: serviceId?.length ?? 0,
        },
      },
    });

    // fetch updated services for response
    const clinicServices = await tx.clinicService.findMany({
      where: { clinicId: id },
      select: {
        service: { select: { id: true, title: true } },
      },
    });

    return {
      ...updatedClinic,
      services: clinicServices.map(cs => cs.service),
    };
  });

  // Invalidate user + service caches (clinic services may have changed)
  await CacheInvalidator.onRecordUpdate('user', id);

  return clinic;
};

const updateUserRoleStatusIntoDB = async (id: string, role: UserRoleEnum) => {
  const result = await prisma.user.update({
    where: {
      id: id,
    },
    data: {
      role: role,
    },
  });
  // Invalidate user cache on role change
  await invalidateUserCache(id).catch(() => {});
  await CacheInvalidator.onRecordUpdate('user', id).catch(() => {});
  return result;
};

const updateUserStatus = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { status: true, role: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  const result = await prisma.user.update({
    where: { id },
    data: { status: newStatus },
    select: {
      id: true,
      fullName: true,
      email: true,
      status: true,
      role: true,
      image: true,
    },
  });

  // Invalidate user cache on status change (affects auth middleware)
  await invalidateUserCache(id).catch(() => {});
  await CacheInvalidator.onRecordUpdate('user', id).catch(() => {});

  return result;
};

const updateUserApproval = async (userId: string) => {
  console.log(userId);
  // const user = await prisma.user.findUnique({
  //   where: { id: userId },
  //   select: {
  //     id: true,
  //     fullName: true,
  //     email: true,
  //     isApproved: true,
  //   },
  // });

  // if (!user) {
  //   throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  // }
  // const result = await prisma.user.update({
  //   where: { id: userId },
  //   data: {
  //     isApproved: true,
  //   },
  // });
  // return result;
};

const softDeleteUserIntoDB = async (id: string) => {
  const result = await prisma.user.update({
    where: { id },
    data: { isDeleted: true },
    select: {
      id: true,
      isDeleted: true,
    },
  });
  // Invalidate user cache on soft delete (affects auth middleware)
  await invalidateUserCache(id).catch(() => {});
  await CacheInvalidator.onRecordUpdate('user', id).catch(() => {});
  return result;
};

const hardDeleteUserIntoDB = async (id: string, adminId: string) => {
  // const adminUser = await prisma.user.findUnique({
  //   where: {
  //     id: adminId,
  //     role: UserRoleEnum.ADMIN,
  //   },
  // });
  // if (!adminUser) {
  //   throw new AppError(httpStatus.UNAUTHORIZED, 'You are not a admin');
  // }
  // return await prisma.$transaction(
  //   async tx => {
  //     // related tables delete
  //     await tx.goal.deleteMany({ where: { userId: id } });
  //     await tx.message.deleteMany({ where: { senderId: id } });
  //     await tx.message.deleteMany({ where: { receiverId: id } });
  //     await tx.payment.deleteMany({ where: { userId: id } });
  //     await tx.motivation.deleteMany({ where: { userId: id } });
  //     await tx.notificationUser.deleteMany({ where: { userId: id } });
  //     await tx.vision.deleteMany({ where: { userId: id } });
  //     await tx.community.deleteMany({ where: { userId: id } });
  //     await tx.communityMembers.deleteMany({ where: { userId: id } });
  //     await tx.follow.deleteMany({
  //       where: {
  //         OR: [{ followerId: id }, { followingId: id }],
  //       },
  //     });
  //     const deletedUser = await tx.user.delete({
  //       where: { id },
  //       select: { id: true, email: true },
  //     });
  //     return deletedUser;
  //   },
  //   {
  //     timeout: 20000,
  //     maxWait: 5000,
  //   },
  // );
};

const updateUserIntoDb = async (req: Request, id: string) => {
  // Step 1️⃣: Check if user exists
  const userInfo = await prisma.user.findUnique({
    where: { id },
  });

  if (!userInfo) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found with id: ' + id);
  }

  // Step 2️⃣: Parse incoming data
  const { fullName, describe, city, address, phoneNumber } = JSON.parse(
    req.body.data,
  );

  // Step 3️⃣: Handle file upload (optional)
  const file = req.file as Express.Multer.File | undefined;

  let imageUrl: string | null = userInfo.image;

  if (file) {
    // const location = await fileUploader.uploadToDigitalOcean(file);
    // imageUrl = location.Location;
  }

  // Step 4️⃣: Update user in DB
  const result = await prisma.user.update({
    where: { id },
    data: {
      fullName,
      // businessType,
      describe,
      city,
      address,
      phoneNumber,
      image: imageUrl,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      image: true,
      role: true,
      // businessType: true,
      describe: true,
      city: true,
      address: true,
      status: true,
    },
  });

  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update user image',
    );
  }

  // Invalidate user cache on profile update
  await invalidateUserCache(id).catch(() => {});
  await CacheInvalidator.onRecordUpdate('user', id).catch(() => {});

  return result;
};

const updateMyimageIntoDB = async (
  id: string,
  file: Express.Multer.File | undefined,
  payload: Partial<User>,
) => {
  // Prevent updating sensitive fields
  const { email, role, ...updateData } = payload;

  let imageUrl: string | null = null;
  if (file) {
    const location = await fileUploader.uploadToCloudinaryWithType(
      file,
      'image',
    );
    imageUrl = location.Location;
    updateData.image = imageUrl;
  }

  // Always update (with or without file)
  const result = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      image: true,
      role: true,
      status: true,
      describe: true,
      city: true,
      address: true,
    },
  });

  // Invalidate user cache on profile update
  await invalidateUserCache(id).catch(() => {});
  await CacheInvalidator.onRecordUpdate('user', id).catch(() => {});

  return result;
};
// Admin/SuperAdmin: Update client basic profile fields
// -------------------------------------------------------
const updateClientInfoIntoDB = async (
  clientId: string,
  payload: {
    fullName?: string;
    phoneNumber?: string;
    describe?: string;
    city?: string;
    address?: string;
    image?: string;
  },
) => {
  const userInfo = await prisma.user.findUnique({
    where: { id: clientId },
  });

  if (!userInfo) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found with id: ' + clientId,
    );
  }

  const result = await prisma.user.update({
    where: { id: clientId },
    data: {
      ...(payload.fullName !== undefined && { fullName: payload.fullName }),
      ...(payload.phoneNumber !== undefined && {
        phoneNumber: payload.phoneNumber,
      }),
      ...(payload.describe !== undefined && { describe: payload.describe }),
      ...(payload.city !== undefined && { city: payload.city }),
      ...(payload.address !== undefined && { address: payload.address }),
      ...(payload.image !== undefined && { image: payload.image }),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      image: true,
      role: true,
      describe: true,
      city: true,
      address: true,
      phoneNumber: true,
      status: true,
    },
  });

  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update user info',
    );
  }

  // Invalidate user cache (profile fields changed)
  await invalidateUserCache(clientId).catch(() => {});
  await CacheInvalidator.onRecordUpdate('user', clientId);

  return result;
};

// -------------------------------------------------------
// get all Organizers — ADMIN / SUPERADMIN
// -------------------------------------------------------
const getAllOrganizersFromDB = async (
  req: Request,
  options: IPaginationOptions,
  filters: IUserFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.UserWhereInput[] = [];

  andConditions.push({
    role: UserRoleEnum.ORGINIZER,
    isDeleted: false,
  });

  if (searchTerm) {
    andConditions.push({
      OR: [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        {
          location: {
            locationName: { contains: searchTerm, mode: 'insensitive' },
          },
        },
      ],
    });
  }

  if (filterData.status) {
    andConditions.push({
      status: filterData.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
    });
  }

  const whereConditions: Prisma.UserWhereInput =
    andConditions.length > 0
      ? { AND: andConditions }
      : { role: UserRoleEnum.ORGINIZER };

  const cacheKey = await CacheKeys.list('user', { page, limit, searchTerm, ...filterData, scope: 'organizers' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const [users, total, driverCounts, requestCounts] = await Promise.all([
      prisma.user.findMany({
        where: whereConditions,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          status: true,
          companyLocation: true,
          createdAt: true,
          location: {
            select: {
              id: true,
              locationName: true,
            },
          },
        },
      }),
      prisma.user.count({ where: whereConditions }),
      prisma.user.groupBy({
        by: ['organizerId'],
        where: {
          organizerId: { not: null },
          isDeleted: false,
        },
        _count: { id: true },
      }),
      prisma.organizerRequest.groupBy({
        by: ['userId'],
        where: {
          isDeleted: false,
        },
        _count: { id: true },
      }),
    ]);

    const driverCountMap = Object.fromEntries(
      driverCounts.map(d => [d.organizerId, d._count.id]),
    );
    const requestCountMap = Object.fromEntries(
      requestCounts.map(r => [r.userId, r._count.id]),
    );

    const data = users.map(user => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      status: user.status,
      companyLocation: user.companyLocation,
      joinDate: user.createdAt,
      location: user.location?.locationName ?? null,
      driverCount: driverCountMap[user.id] ?? 0,
      requestCount: requestCountMap[user.id] ?? 0,
    }));

    return {
      meta: {
        total,
        page,
        limit,
      },
      data,
    };
  });

  return cached ?? { meta: { total: 0, page, limit }, data: [] };
};

// -------------------------------------------------------
// Admin/SuperAdmin: Send manual email to a client
// -------------------------------------------------------
const sendManualEmailIntoDB = async (
  clientId: string,
  subject: string,
  message: string,
) => {
  const user = await prisma.user.findUnique({
    where: { id: clientId },
    select: { email: true, fullName: true },
  });

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found with id: ' + clientId,
    );
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background-color:#0f172a;padding:28px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Admin Message</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${user.fullName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">${message}</p>
              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message from the platform. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await emailSender(user.email, html, subject);

  return { message: 'Email sent successfully', email: user.email };
};

export const UserServices = {
  getAllUsersFromDB,
  getMyimageFromDB,
  getUserDetailsFromDB,
  updateUserRoleStatusIntoDB,
  updateUserStatus,
  updateUserApproval,
  softDeleteUserIntoDB,
  hardDeleteUserIntoDB,
  updateUserIntoDb,
  updateMyimageIntoDB,
  //clinic
  createClinicIntoDB,
  getAllClinicsFromDB,
  updateClinicIntoDB,
  //organizer
  getAllOrganizersFromDB,
  createOrgDriverIntoDB,
  getAllOrgDriverFromDB,
  getAllOrgDriverReportsFromDB,
  //admin
  updateClientInfoIntoDB,
  sendManualEmailIntoDB,
};
