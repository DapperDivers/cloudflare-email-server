import { z } from 'zod';

export const EmailRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(1).max(1000)
}); 