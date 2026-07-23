import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';

const validateRequest =
  (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Handle JSON-stringified body (for form data)
      req.body = req.body.data ? JSON.parse(req.body.data) : req.body;

      // If schema wraps in { body: {...} }, extract the inner body schema
      // This handles both flat and wrapped validation schemas
      const shape = schema.shape;
      if (shape.body) {
        await shape.body.parseAsync(req.body);
      } else {
        await schema.parseAsync(req.body);
      }
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new AppError(
            httpStatus.BAD_REQUEST,
            err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
          ),
        );
      } else {
        next(err);
      }
    }
  };

export default validateRequest;
