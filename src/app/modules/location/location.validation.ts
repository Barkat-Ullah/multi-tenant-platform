import { z } from 'zod';


const createSchema = z.object({
  locationName: z.string({ required_error: 'locationName is required', invalid_type_error: 'Invalid locationName' }),
  lat: z.number({ required_error: 'lat is required', invalid_type_error: 'Invalid lat' }).optional(),
  lng: z.number({ required_error: 'lng is required', invalid_type_error: 'Invalid lng' }).optional(),
});

const updateSchema = z.object({
  locationName: z.string({ required_error: 'locationName is required', invalid_type_error: 'Invalid locationName' }).optional(),
  lat: z.number({ required_error: 'lat is required', invalid_type_error: 'Invalid lat' }).optional(),
  lng: z.number({ required_error: 'lng is required', invalid_type_error: 'Invalid lng' }).optional(),
});

export const locationValidation = {
  createSchema,
  updateSchema,
};