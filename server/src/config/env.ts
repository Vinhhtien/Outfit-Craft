import dotenv from 'dotenv';
dotenv.config();

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Thieu bien moi truong bat buoc: ${key}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  seedDemoAdmin: process.env.SEED_DEMO_ADMIN !== 'false',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/outfitcraft'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-doi-truoc-khi-deploy'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },
  openWeatherKey: process.env.OPENWEATHER_API_KEY ?? '',
  geminiKey: process.env.GEMINI_API_KEY ?? '',

  // ===== NEW: Forgot Password =====
  /** URL trang web (dung de tao link dat lai mat khau trong email). */
  frontendUrl: (process.env.FRONTEND_URL ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:3000').replace(/\/+$/, ''),
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    /** Dia chi nguoi gui; mac dinh dung SMTP_USER. */
    from: process.env.SMTP_FROM ?? '',
  },
  // ===== END NEW =====
};

// ===== NEW: Forgot Password =====
export const isSmtpConfigured = () => Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
// ===== END NEW =====

export const isCloudinaryConfigured = () =>
  Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
