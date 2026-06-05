// Database connection using Drizzle ORM + MySQL2

import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema.js';
import { env } from '../config/env.js';

const connection = await mysql.createConnection({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
});

export const db = drizzle(connection, { schema, mode: 'default' });

export type Database = typeof db;