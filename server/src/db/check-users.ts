import mysql from 'mysql2/promise';
import 'dotenv/config';

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'katondo_queue',
  });

  try {
    const [users]: any = await connection.query('SELECT id, username, role, area_id FROM `users`');
    console.log('--- ALL USERS ---');
    console.log(JSON.stringify(users, null, 2));

    const [areas]: any = await connection.query('SELECT id, name FROM `areas`');
    console.log('--- ALL AREAS ---');
    console.log(JSON.stringify(areas, null, 2));

    const [displays]: any = await connection.query('SELECT * FROM `display_configs`');
    console.log('--- ALL DISPLAYS ---');
    console.log(JSON.stringify(displays, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

run();
