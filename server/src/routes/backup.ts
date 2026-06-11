// Backup routes — manual database SQL dump export with history tracking

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { systemSettings } from '../db/schema.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import mysql from 'mysql2/promise';

const router = Router();

router.use(authMiddleware);

// GET /api/backup/status — check last backup date & overdue status
router.get('/status', requireRole('admin'), async (req, res) => {
  try {
    let lastBackupSetting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'last_backup_date'),
    });

    if (!lastBackupSetting) {
      // Create default last backup date as 10 days ago to trigger first backup alert
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const defaultDate = tenDaysAgo.toISOString().split('T')[0];

      await db.insert(systemSettings).values({
        key: 'last_backup_date',
        value: defaultDate,
        description: 'Data do último backup efetuado',
      });

      lastBackupSetting = { key: 'last_backup_date', value: defaultDate } as any;
    }

    const lastDate = new Date(lastBackupSetting!.value);
    const today = new Date();

    // Calculate difference in days
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Backup is required every 7 days
    const isOverdue = diffDays > 7;

    res.json({
      lastBackupDate: lastBackupSetting!.value,
      daysSinceLastBackup: diffDays,
      isOverdue,
    });
  } catch (error: any) {
    logger.error('Get backup status error', { module: 'backup', error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/backup/download — generate and stream database backup SQL file
router.get('/download', requireRole('admin'), async (req, res) => {
  try {
    logger.info('Generating database SQL dump...', { module: 'backup' });

    // Get raw mysql connection to run SHOW and DESCRIBE queries
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'katondo_queue',
    });

    const [tablesList]: any = await conn.query('SHOW TABLES');
    const dbName = process.env.DB_NAME || 'katondo_queue';
    const dbKey = `Tables_in_${dbName}`;

    let sqlDump = `-- ──────────────────────────────────────────────────────────────\n`;
    sqlDump += `--  Katondo Queue System Database Backup\n`;
    sqlDump += `--  Date: ${new Date().toISOString()}\n`;
    sqlDump += `-- ──────────────────────────────────────────────────────────────\n\n`;
    sqlDump += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

    for (const tableRow of tablesList) {
      const tableName = tableRow[dbKey];
      if (tableName === '__drizzle_migrations') continue; // Skip migrations tracking table

      // 1. Get Create Table statement
      const [createTableResult]: any = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createTableSql = createTableResult[0]['Create Table'];

      sqlDump += `-- ──────────────────────────────────────────────────────────────\n`;
      sqlDump += `--  Table structure for table \`${tableName}\`\n`;
      sqlDump += `-- ──────────────────────────────────────────────────────────────\n`;
      sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sqlDump += `${createTableSql};\n\n`;

      // 2. Get rows data
      const [rowsList]: any = await conn.query(`SELECT * FROM \`${tableName}\``);
      if (rowsList.length > 0) {
        sqlDump += `--  Dumping data for table \`${tableName}\`\n`;
        for (const row of rowsList) {
          const keys = Object.keys(row).map(k => `\`${k}\``).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (v instanceof Date) {
              return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
            }
            if (typeof v === 'string') {
              // Escape single quotes for SQL safety
              return `'${v.replace(/'/g, "''")}'`;
            }
            if (typeof v === 'boolean') {
              return v ? '1' : '0';
            }
            return `'${v}'`;
          }).join(', ');

          sqlDump += `INSERT INTO \`${tableName}\` (${keys}) VALUES (${values});\n`;
        }
        sqlDump += `\n`;
      }
    }

    sqlDump += `SET FOREIGN_KEY_CHECKS=1;\n`;
    await conn.end();

    // 3. Update last backup date in settings
    const todayStr = new Date().toISOString().split('T')[0];
    await db.update(systemSettings)
      .set({ value: todayStr })
      .where(eq(systemSettings.key, 'last_backup_date'));

    logger.info('Database SQL dump generated successfully, streaming to client', { module: 'backup' });

    // 4. Stream file
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="katondo_queue_backup_${todayStr}.sql"`);
    res.send(sqlDump);

  } catch (error: any) {
    logger.error('Generate backup error', { module: 'backup', error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
