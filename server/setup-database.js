import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function setupDatabase() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4'
  };

  let connection;

  try {
    console.log('🔄 Conectando ao MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado ao MySQL');

    // Criar banco principal
    const dbName = process.env.DB_NAME || 'dinamica_saas';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database ${dbName} criado/verificado`);

    // Conectar ao banco criado
    await connection.changeUser({ database: dbName });

    // Criar tabelas principais
    console.log('🔄 Criando tabelas...');

    // Tabela de usuários
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user', 'barbearia') DEFAULT 'user',
        plan ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
        company VARCHAR(255),
        phone VARCHAR(20),
        avatar VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT true,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email),
        INDEX idx_users_role (role),
        INDEX idx_users_active (is_active)
      )
    `);

    // Tabela de agentes
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        objective TEXT,
        personality ENUM('formal', 'casual', 'friendly', 'professional') DEFAULT 'professional',
        ai_provider ENUM('chatgpt', 'gemini', 'huggingface') NOT NULL,
        model VARCHAR(100) NOT NULL,
        system_prompt TEXT,
        temperature DECIMAL(3,2) DEFAULT 0.7,
        max_tokens INT DEFAULT 1000,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_agents_user (user_id),
        INDEX idx_agents_active (is_active)
      )
    `);

    // Tabela de conversas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        agent_id INT,
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(20),
        channel_type ENUM('whatsapp', 'telegram', 'web', 'api', 'chat') DEFAULT 'chat',
        status ENUM('active', 'resolved', 'pending', 'closed') DEFAULT 'active',
        priority INT DEFAULT 1,
        satisfaction_rating DECIMAL(2,1),
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP NULL,
        resolution_time INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
        INDEX idx_conversations_user (user_id),
        INDEX idx_conversations_agent (agent_id),
        INDEX idx_conversations_status (status)
      )
    `);

    // Tabela de mensagens
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        content TEXT NOT NULL,
        sender ENUM('user', 'agent') NOT NULL,
        message_type ENUM('text', 'image', 'audio', 'document', 'video') DEFAULT 'text',
        media_url VARCHAR(500),
        status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
        response_time DECIMAL(8,2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        INDEX idx_messages_conversation (conversation_id),
        INDEX idx_messages_sender (sender),
        INDEX idx_messages_timestamp (timestamp)
      )
    `);

    // Tabela de agendamentos (barbearia)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        cliente VARCHAR(255) NOT NULL,
        telefone VARCHAR(20) NOT NULL,
        email VARCHAR(255),
        data DATE NOT NULL,
        horario TIME NOT NULL,
        servico ENUM('cabelo', 'barba', 'cabelo_barba') NOT NULL,
        valor DECIMAL(10,2) DEFAULT 0.00,
        pago BOOLEAN DEFAULT false,
        metodo_pagamento ENUM('dinheiro', 'pix', 'cartao', 'pendente') DEFAULT 'pendente',
        observacoes TEXT,
        status ENUM('confirmado', 'pendente', 'cancelado', 'concluido') DEFAULT 'pendente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_agendamentos_user (user_id),
        INDEX idx_agendamentos_data (data),
        INDEX idx_agendamentos_status (status)
      )
    `);

    // Tabela de serviços da barbearia
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS servicos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        preco DECIMAL(10,2) NOT NULL,
        duracao INT NOT NULL COMMENT 'Duração em minutos',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_servicos_user (user_id),
        INDEX idx_servicos_active (is_active)
      )
    `);

    // Tabela de clientes da barbearia
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        telefone VARCHAR(20),
        email VARCHAR(255),
        data_nascimento DATE,
        observacoes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_clientes_user (user_id),
        INDEX idx_clientes_telefone (telefone),
        INDEX idx_clientes_email (email)
      )
    `);

    // Tabela de horários de funcionamento
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS horarios_funcionamento (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        dia_semana ENUM('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo') NOT NULL,
        horario_inicio TIME NOT NULL,
        horario_fim TIME NOT NULL,
        intervalo_inicio TIME,
        intervalo_fim TIME,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_dia (user_id, dia_semana),
        INDEX idx_horarios_user (user_id)
      )
    `);

    // Tabela de configurações da barbearia
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS barbearia_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nome_barbearia VARCHAR(255) NOT NULL,
        endereco TEXT,
        telefone VARCHAR(20),
        email VARCHAR(255),
        whatsapp VARCHAR(20),
        instagram VARCHAR(255),
        intervalo_atendimento INT DEFAULT 30 COMMENT 'Intervalo em minutos',
        antecedencia_minima INT DEFAULT 60 COMMENT 'Antecedência mínima em minutos',
        gemini_api_key VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_config (user_id),
        INDEX idx_barbearia_config_user (user_id)
      )
    `);

    // Tabela de configurações
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        chave VARCHAR(100) NOT NULL,
        valor TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_config (user_id, chave),
        INDEX idx_config_user (user_id)
      )
    `);

    // Tabela de logs de agendamento
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agendamento_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agendamento_id INT NOT NULL,
        acao ENUM('criado', 'confirmado', 'cancelado', 'reagendado', 'concluido') NOT NULL,
        detalhes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE,
        INDEX idx_logs_agendamento (agendamento_id)
      )
    `);

    // Criar usuários padrão
    console.log('🔄 Criando usuários padrão...');

    // Admin
    const adminPassword = await bcrypt.hash('admin123', 12);
    await connection.execute(`
      INSERT INTO users (name, email, password, role, plan, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        role = 'admin',
        is_active = true
    `, ['Administrador', 'admin@dinamica.com', adminPassword, 'admin', 'enterprise', true, true]);

    // Usuário teste
    const testePassword = await bcrypt.hash('teste123', 12);
    await connection.execute(`
      INSERT INTO users (name, email, password, role, plan, company, phone, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        is_active = true
    `, ['Usuário Teste', 'teste@dinamica.com', testePassword, 'user', 'premium', 'Empresa Teste', '(11) 99999-9999', true, true]);

    // Barbearia teste
    const barbeariaPassword = await bcrypt.hash('barbearia123', 12);
    await connection.execute(`
      INSERT INTO users (name, email, password, role, plan, company, phone, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        role = 'barbearia',
        is_active = true
    `, ['Barbearia Teste', 'barbearia@dinamica.com', barbeariaPassword, 'barbearia', 'premium', 'Barbearia Dinâmica', '(11) 88888-8888', true, true]);

    console.log('✅ Usuários padrão criados/atualizados');

    // Inserir dados padrão para barbearia
    const barbeariaUserId = 3; // ID do usuário barbearia

    // Serviços padrão
    await connection.execute(`
      INSERT INTO servicos (user_id, nome, descricao, preco, duracao)
      VALUES 
        (?, 'Corte Masculino', 'Corte de cabelo masculino tradicional', 25.00, 30),
        (?, 'Barba', 'Aparar e modelar barba', 15.00, 20),
        (?, 'Cabelo + Barba', 'Corte completo com barba', 35.00, 45),
        (?, 'Sobrancelha', 'Design de sobrancelha masculina', 10.00, 15)
      ON DUPLICATE KEY UPDATE nome = VALUES(nome)
    `, [barbeariaUserId, barbeariaUserId, barbeariaUserId, barbeariaUserId]);

    // Horários de funcionamento padrão
    await connection.execute(`
      INSERT INTO horarios_funcionamento (user_id, dia_semana, horario_inicio, horario_fim)
      VALUES 
        (?, 'segunda', '08:00', '18:00'),
        (?, 'terca', '08:00', '18:00'),
        (?, 'quarta', '08:00', '18:00'),
        (?, 'quinta', '08:00', '18:00'),
        (?, 'sexta', '08:00', '18:00'),
        (?, 'sabado', '08:00', '16:00')
      ON DUPLICATE KEY UPDATE horario_inicio = VALUES(horario_inicio)
    `, [barbeariaUserId, barbeariaUserId, barbeariaUserId, barbeariaUserId, barbeariaUserId, barbeariaUserId]);

    // Configuração padrão da barbearia
    await connection.execute(`
      INSERT INTO barbearia_config (user_id, nome_barbearia, endereco, telefone, email, whatsapp, intervalo_atendimento, antecedencia_minima)
      VALUES (?, 'Barbearia Dinâmica', 'Rua das Flores, 123 - Centro', '(11) 88888-8888', 'contato@barbeariadinamica.com', '(11) 88888-8888', 30, 60)
      ON DUPLICATE KEY UPDATE nome_barbearia = VALUES(nome_barbearia)
    `, [barbeariaUserId]);

    console.log('✅ Dados padrão da barbearia inseridos');

    // Criar script de detecção automática de módulo
    const autoDetectScript = `
// Script de detecção automática de módulo baseado no role do usuário
// Este script será executado no login para redirecionar automaticamente
export const detectUserModule = (user) => {
  if (user.role === 'barbearia') return '/barbearia';
  if (user.role === 'admin') return '/admin';
  return '/dashboard';
};`;

    fs.writeFileSync('src/utils/moduleDetection.js', autoDetectScript);
    console.log('✅ Script de detecção automática criado');

    console.log('📧 Admin: admin@dinamica.com / admin123');
    console.log('📧 Teste: teste@dinamica.com / teste123');
    console.log('📧 Barbearia: barbearia@dinamica.com / barbearia123');

    console.log('\n🎉 Setup do banco de dados concluído com sucesso!');
    console.log('🚀 Execute: npm run server:dev (backend) e npm run dev (frontend)');

  } catch (error) {
    console.error('❌ Erro no setup:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();