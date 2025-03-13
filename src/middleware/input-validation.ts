import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const EmailRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  message: z.string().min(1, 'Message is required')
});

export const validateEmailRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await EmailRequestSchema.parseAsync(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid request data'
      });
    }
  }
}; 