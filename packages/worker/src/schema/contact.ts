import { z } from 'zod';

// Regular expression for basic XSS prevention
const noScriptTags = /^(?!.*<script).*$/i;

export const contactSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(noScriptTags, 'Invalid characters in name'),

  email: z
    .string()
    .min(1, 'Email is required')
    .max(100, 'Email must be less than 100 characters')
    .email('Invalid email format')
    .regex(noScriptTags, 'Invalid characters in email'),

  message: z
    .string()
    .min(1, 'Message is required')
    .max(1000, 'Message must be less than 1000 characters')
    .regex(noScriptTags, 'Invalid characters in message'),
});
