import { Pool } from 'pg';
const pool = new Pool({
  host: 'postgres',
  user: 'postgres',
  password: 'postgres',
  database: 'chatapp',
  port: 5432,
})

export default pool;