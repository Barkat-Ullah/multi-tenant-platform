import { z } from 'zod';


const createSchema = z.object({
  title: z.string({ required_error: 'title is required', invalid_type_error: 'Invalid title' }),
  description: z.string({ required_error: 'description is required', invalid_type_error: 'Invalid description' }).optional(),
});

const updateSchema = z.object({
  title: z.string({ required_error: 'title is required', invalid_type_error: 'Invalid title' }).optional(),
  description: z.string({ required_error: 'description is required', invalid_type_error: 'Invalid description' }).optional(),
});

export const serviceValidation = {
  createSchema,
  updateSchema,
};