// Server environment configuration

import 'dotenv/config';

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: parseInt(process.env.DB_PORT || '3306', 10),
  dbUser: process.env.DB_USER || 'root',
  dbPassword: process.env.DB_PASSWORD || 'root',
  dbName: process.env.DB_NAME || 'katondo_queue',
  jwtSecret: process.env.JWT_SECRET || 'change-this-to-a-random-secret-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
} as const;

export function validateEnv() {
  if (env.nodeEnv === 'production' && env.jwtSecret === 'change-this-to-a-random-secret-in-production') {
    throw new Error('JWT_SECRET must be changed in production');
  }
}