import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Neon PostgreSQL Connection Strings
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Neon pooled connection)'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required (Neon direct connection)'),

  // Authentication & Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters long'),
  DEVICE_SECRET: z
    .string()
    .min(16, 'DEVICE_SECRET must be at least 16 characters long (x-device-secret header)'),

  // Google Gemini AI Vision (Multimodal Receipt OCR)
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required for receipt OCR extraction'),

  // Cloudinary (Image CDN for Receipt Screenshots & Product Images)
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),

  // Public Application URL
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  // During build without environment or in test, safe-parse with readable error
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `  ❌ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(
      `\n[FATAL] Invalid or missing environment variables:\n${formattedErrors}\n` +
        `Check your .env file or copy from .env.example\n`
    );

    throw new Error(
      `Invalid or missing environment variables:\n${formattedErrors}`
    );
  }

  return result.data;
}

export const env = validateEnv();
export default env;
