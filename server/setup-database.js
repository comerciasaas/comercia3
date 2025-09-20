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
        whatsapp_connected BOOLEAN DEFAULT false,
        whatsapp_phone_id VARCHAR(255),
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
        whatsapp_chat_id VARCHAR(255),
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
        INDEX idx_conversations_status (status),
        INDEX idx_conversations_whatsapp (whatsapp_chat_id)
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
        whatsapp_message_id VARCHAR(255),
        status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
        response_time DECIMAL(8,2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        INDEX idx_messages_conversation (conversation_id),
        INDEX idx_messages_sender (sender),
        INDEX idx_messages_timestamp (timestamp),
        INDEX idx_messages_whatsapp (whatsapp_message_id)
      )
    `);

    // Tabela de configurações WhatsApp
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS whatsapp_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        phone_number_id VARCHAR(255) NOT NULL,
        webhook_verify_token VARCHAR(255),
        business_account_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_whatsapp_user (user_id),
        INDEX idx_whatsapp_phone (phone_number_id)
      )
    `);

    // Tabela de configurações globais (admin)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS global_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL UNIQUE,
        config_value TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_global_configs_key (config_key)
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
        servico ENUM('cabelo', 'barba', 'cabelo_barba', 'sobrancelha') NOT NULL,
        valor DECIMAL(10,2) DEFAULT 0.00,
        pago BOOLEAN DEFAULT false,
        metodo_pagamento ENUM('dinheiro', 'pix', 'cartao', 'pendente') DEFAULT 'pendente',
        observacoes TEXT,
        status ENUM('confirmado', 'pendente', 'cancelado', 'concluido') DEFAULT 'pendente',
        created_by_ai BOOLEAN DEFAULT false,
        whatsapp_message_id VARCHAR(255),
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
        whatsapp_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_clientes_user (user_id),
        INDEX idx_clientes_telefone (telefone),
        INDEX idx_clientes_email (email),
        INDEX idx_clientes_whatsapp (whatsapp_id)
      )
    `);

    // Tabela de configurações do usuário
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

    // Inserir configurações globais padrão
    await connection.execute(`
      INSERT INTO global_configs (config_key, config_value, description)
      VALUES 
        ('openai_api_key', '', 'Chave da API OpenAI para todos os usuários'),
        ('gemini_api_key', '', 'Chave da API Google Gemini para todos os usuários'),
        ('huggingface_api_key', '', 'Chave da API Hugging Face para todos os usuários'),
        ('system_name', 'Dinâmica SaaS', 'Nome do sistema'),
        ('max_agents_per_user', '10', 'Máximo de agentes por usuário'),
        ('max_whatsapp_per_user', '3', 'Máximo de WhatsApps por usuário')
      ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)
    `);

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

    console.log('\n🎉 Setup do banco de dados concluído com sucesso!');
    console.log('📧 Admin: admin@dinamica.com / admin123');
    console.log('📧 Teste: teste@dinamica.com / teste123');
    console.log('📧 Barbearia: barbearia@dinamica.com / barbearia123');
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