import httpStatus from 'http-status';
import {
  AuditAction,
  Prisma,
  User,
  UserRoleEnum,
} from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { Request } from 'express';
import AppError from '../../errors/AppError';
import ApiError from '../../errors/AppError';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import * as bcrypt from 'bcrypt';
import emailSender, { inviteClinicEmail } from '../../utils/sendMail';

type IUserFilterRequest = {
  searchTerm?: string;
  status?: string;
};

const getAllUsersFromDB = async (
  options: IPaginationOptions,
  filters: IUserFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.UserWhereInput[] = [];

  andConditions.push({
    role: UserRoleEnum.USER,
    isDeleted: false,
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
      : { role: UserRoleEnum.USER };

  const users = await prisma.user.findMany({
    where: whereConditions,
    select: {
      id: true,
      fullName: true,
      email: true,
      image: true,
      status: true,
      createdAt: true,
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
  }));

  return {
    meta: {
      total,
      page,
      limit,
    },
    data: formattedData,
  };
};

const getMyimageFromDB = async (id: string) => {
  const image = await prisma.user.findUnique({
    where: {
      id: id,
    },
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
    },
  });

  return image;
};

const getUserDetailsFromDB = async (id: string) => {
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
    },
  });
  return user;
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
    // const location = await fileUploader.uploadToCloudinaryWithType(file );
    // imageUrl = location.Location;
    // updateData.image = imageUrl;
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

  return result;
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
};
