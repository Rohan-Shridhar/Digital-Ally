import { z } from 'zod';

export const serverPromptSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .max(5000, 'Prompt exceeds maximum length of 5000 characters'),
  outputFormat: z.enum(['html', 'react', 'zip']).optional().default('html'),
});

export const serverNewsletterSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .max(8000, 'Prompt exceeds maximum length of 8000 characters'),
});

export const serverAnalysisSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .max(15000, 'Prompt exceeds maximum length of 15000 characters'),
});
