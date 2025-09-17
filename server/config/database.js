import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dinamica_saas',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

// Pool de conexões
const pool = mysql.createPool(dbConfig);

// Testar conexão
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Conectado com Sucesso');
    
    const [rows] = await connection.execute('SELECT NOW() as now');
    console.log('📅 Horário do banco:', rows[0].now);
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erro de Conexão MySQL:', error.message);
    return false;
  }
};

// Executar query
const executeQuery = async (query, params = []) => {
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('Erro na query:', error);
    throw error;
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Fechando conexões do banco...');
  await pool.end();
  process.exit(0);
});

export { 
  pool, 
  testConnection, 
  executeQuery
};