import { z } from 'zod';

const createSchema = z.object({
  serviceId: z.string({ required_error: 'serviceId is required' }),
  companyName: z.string({ required_error: 'companyName is required' }),
  email: z
    .string({ required_error: 'email is required' })
    .email('Invalid email address'),
  phone: z.string({ required_error: 'phone is required' }),
  location: z.string({ required_error: 'location is required' }),
  totalDriver: z.string({ required_error: 'totalDriver is required' }),
  siteContact: z.string().optional(),
  siteContactPhone: z.string().optional(),
  siteAddress: z.string().optional(),
  siteCity: z.string().optional(),
  dataOfService: z.string().optional(),
  startTime: z.string().optional(),
  isSizeRequired: z.boolean().optional(),
  isOnsiteParking: z.boolean().optional(),
  specialText: z.string().optional(),
});

const updateSchema = z.object({
  serviceId: z.string().optional(),
  clinicId: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  totalDriver: z.string().optional(),
  siteContact: z.string().optional(),
  siteContactPhone: z.string().optional(),
  siteAddress: z.string().optional(),
  siteCity: z.string().optional(),
  dataOfService: z.string().optional(),
  startTime: z.string().optional(),
  isSizeRequired: z.boolean().optional(),
  isOnsiteParking: z.boolean().optional(),
  specialText: z.string().optional(),
});

// Admin/SuperAdmin Assignment Validation
const assignClinicAndStatusSchema = z.object({
  clinicId: z
    .string({ required_error: 'clinicId is required to assign a clinic' })
    .optional(),
  status: z.enum(['Pending', 'Confirmed', 'Canceled']).optional(),
});

// Organizer Roster Push Validation
const addDriversSchema = z.object({
  driverIds: z
    .array(z.string(), { required_error: 'driverIds array is required' })
    .min(1, 'Please provide at least one driver ID'),
});

export const organizerRequestValidation = {
  createSchema,
  updateSchema,
  assignClinicAndStatusSchema,
  addDriversSchema,
};
