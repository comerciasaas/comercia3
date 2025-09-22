/*
  # Sistema Dinâmica SaaS 2025 - Schema Completo
  
  1. Tabelas Principais
    - users: Usuários do sistema (admin, user, barbearia)
    - agents: Agentes de IA por usuário
    - conversations: Conversas dos agentes
    - messages: Mensagens das conversas
    - whatsapp_configs: Configurações WhatsApp por usuário
    - global_configs: Configurações globais (admin)
    
  2. Módulo Barbearia
    - agendamentos: Agendamentos da barbearia
    - servicos: Serviços oferecidos
    - clientes: Clientes da barbearia
    - configuracoes: Configurações do usuário
    
  3. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas de acesso por usuário
    - Índices para performance
    
  4. Dados Padrão
    - Usuários de teste
    - Configurações iniciais
    - Serviços padrão da barbearia
*/

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função para obter user_id do JWT
CREATE OR REPLACE FUNCTION uid() RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    (current_setting('request.jwt.claims', true)::json->>'user_id')
  )::uuid;
$$ LANGUAGE sql STABLE;

-- ==================== TABELA USERS ====================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(255) NOT NULL,
  email varchar(255) UNIQUE NOT NULL,
  password varchar(255) NOT NULL,
  role varchar(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'barbearia')),
  plan varchar(20) DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'premium', 'enterprise')),
  company varchar(255),
  phone varchar(20),
  avatar text,
  is_active boolean DEFAULT true,
  email_verified boolean DEFAULT true,
  last_login timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- RLS para users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO public
  USING (uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE TO public
  USING (uid() = id);

-- Trigger para updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== TABELA AGENTS ====================
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  description text,
  objective text,
  personality varchar(20) DEFAULT 'professional' CHECK (personality IN ('formal', 'casual', 'friendly', 'professional')),
  ai_provider varchar(20) NOT NULL CHECK (ai_provider IN ('chatgpt', 'gemini', 'huggingface')),
  model varchar(100) NOT NULL,
  system_prompt text,
  temperature numeric(3,2) DEFAULT 0.7,
  max_tokens integer DEFAULT 1000,
  is_active boolean DEFAULT true,
  whatsapp_connected boolean DEFAULT false,
  whatsapp_phone_id varchar(255),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para agents
CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active);

-- RLS para agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agents" ON agents
  FOR ALL TO public
  USING (user_id = uid());

-- Trigger para updated_at
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== TABELA CONVERSATIONS ====================
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  customer_name varchar(255),
  customer_email varchar(255),
  customer_phone varchar(20),
  whatsapp_chat_id varchar(255),
  channel_type varchar(20) DEFAULT 'chat' CHECK (channel_type IN ('whatsapp', 'telegram', 'web', 'api', 'chat')),
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'pending', 'closed')),
  priority integer DEFAULT 1,
  satisfaction_rating numeric(2,1),
  start_time timestamp DEFAULT now(),
  end_time timestamp,
  resolution_time integer,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp ON conversations(whatsapp_chat_id);

-- RLS para conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations" ON conversations
  FOR ALL TO public
  USING (user_id = uid());

-- Trigger para updated_at
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== TABELA MESSAGES ====================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content text NOT NULL,
  sender varchar(10) NOT NULL CHECK (sender IN ('user', 'agent')),
  message_type varchar(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'document', 'video')),
  media_url text,
  whatsapp_message_id varchar(255),
  status varchar(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  response_time numeric(8,2),
  timestamp timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);

-- RLS para messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access messages from own conversations" ON messages
  FOR ALL TO public
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE user_id = uid()
  ));

-- Trigger para updated_at
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== TABELA WHATSAPP_CONFIGS ====================
CREATE TABLE IF NOT EXISTS whatsapp_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  access_token text NOT NULL,
  phone_number_id varchar(255) NOT NULL,
  webhook_verify_token varchar(255),
  business_account_id varchar(255),
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para whatsapp_configs
CREATE INDEX IF NOT EXISTS idx_whatsapp_user ON whatsapp_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_configs(phone_number_id);

-- RLS para whatsapp_configs
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own whatsapp configs" ON whatsapp_configs
  FOR ALL TO public
  USING (user_id = uid());

-- ==================== TABELA GLOBAL_CONFIGS ====================
CREATE TABLE IF NOT EXISTS global_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key varchar(100) UNIQUE NOT NULL,
  config_value text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para global_configs
CREATE INDEX IF NOT EXISTS idx_global_configs_key ON global_configs(config_key);

-- RLS para global_configs
ALTER TABLE global_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage global configs" ON global_configs
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = uid() AND role = 'admin'
  ));

-- ==================== MÓDULO BARBEARIA ====================

-- Tabela de agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cliente varchar(255) NOT NULL,
  telefone varchar(20) NOT NULL,
  email varchar(255),
  data date NOT NULL,
  horario time NOT NULL,
  servico varchar(255) NOT NULL,
  valor numeric(10,2) DEFAULT 0.00,
  pago boolean DEFAULT false,
  metodo_pagamento varchar(20) DEFAULT 'pendente' CHECK (metodo_pagamento IN ('dinheiro', 'pix', 'cartao', 'pendente')),
  observacoes text,
  status varchar(20) DEFAULT 'pendente' CHECK (status IN ('confirmado', 'pendente', 'cancelado', 'concluido')),
  created_by_ai boolean DEFAULT false,
  whatsapp_message_id varchar(255),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para agendamentos
CREATE INDEX IF NOT EXISTS idx_agendamentos_user ON agendamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);

-- RLS para agendamentos
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agendamentos" ON agendamentos
  FOR ALL TO public
  USING (user_id = uid());

-- Trigger para updated_at
CREATE TRIGGER update_agendamentos_updated_at
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tabela de serviços
CREATE TABLE IF NOT EXISTS servicos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome varchar(255) NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL,
  duracao integer NOT NULL, -- em minutos
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para servicos
CREATE INDEX IF NOT EXISTS idx_servicos_user ON servicos(user_id);
CREATE INDEX IF NOT EXISTS idx_servicos_active ON servicos(is_active);

-- RLS para servicos
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own servicos" ON servicos
  FOR ALL TO public
  USING (user_id = uid());

-- Trigger para updated_at
CREATE TRIGGER update_servicos_updated_at
  BEFORE UPDATE ON servicos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome varchar(255) NOT NULL,
  telefone varchar(20),
  email varchar(255),
  data_nascimento date,
  observacoes text,
  whatsapp_id varchar(255),
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_user ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone);
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp ON clientes(whatsapp_id);

-- RLS para clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own clientes" ON clientes
  FOR ALL TO public
  USING (user_id = uid());

-- Trigger para updated_at
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tabela de configurações do usuário
CREATE TABLE IF NOT EXISTS configuracoes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chave varchar(100) NOT NULL,
  valor text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id, chave)
);

-- Índices para configuracoes
CREATE INDEX IF NOT EXISTS idx_config_user ON configuracoes(user_id);

-- RLS para configuracoes
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own configs" ON configuracoes
  FOR ALL TO public
  USING (user_id = uid());

-- Trigger para updated_at
CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== DADOS PADRÃO ====================

-- Usuários de teste
INSERT INTO users (id, name, email, password, role, plan, company, phone, is_active) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Administrador', 'admin@dinamica.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..e', 'admin', 'enterprise', 'Dinâmica SaaS', '(11) 99999-0001', true),
  ('550e8400-e29b-41d4-a716-446655440002', 'Usuário Teste', 'teste@dinamica.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..e', 'user', 'free', 'Empresa Teste', '(11) 99999-0002', true),
  ('550e8400-e29b-41d4-a716-446655440003', 'Barbearia Teste', 'barbearia@dinamica.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..e', 'barbearia', 'basic', 'Barbearia do João', '(11) 99999-0003', true)
ON CONFLICT (email) DO NOTHING;

-- Configurações globais padrão
INSERT INTO global_configs (config_key, config_value, description) VALUES
  ('openai_api_key', '', 'Chave da API OpenAI para todos os usuários'),
  ('gemini_api_key', '', 'Chave da API Google Gemini para todos os usuários'),
  ('huggingface_api_key', '', 'Chave da API Hugging Face para todos os usuários'),
  ('system_name', 'Dinâmica SaaS', 'Nome do sistema'),
  ('max_agents_per_user', '10', 'Máximo de agentes por usuário'),
  ('max_whatsapp_per_user', '3', 'Máximo de WhatsApps por usuário')
ON CONFLICT (config_key) DO NOTHING;

-- Serviços padrão para barbearias
INSERT INTO servicos (user_id, nome, descricao, preco, duracao) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', 'Corte Masculino', 'Corte de cabelo masculino tradicional', 25.00, 30),
  ('550e8400-e29b-41d4-a716-446655440003', 'Barba', 'Aparar e modelar barba', 15.00, 20),
  ('550e8400-e29b-41d4-a716-446655440003', 'Cabelo + Barba', 'Corte completo com barba', 35.00, 45),
  ('550e8400-e29b-41d4-a716-446655440003', 'Sobrancelha', 'Aparar sobrancelha masculina', 10.00, 15)
ON CONFLICT DO NOTHING;

-- Agente padrão para barbearia
INSERT INTO agents (user_id, name, description, objective, personality, ai_provider, model, system_prompt, temperature, max_tokens) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', 'Assistente da Barbearia', 'Agente especializado em agendamentos de barbearia', 'Agendar horários e gerenciar clientes da barbearia', 'friendly', 'gemini', 'gemini-1.5-flash', 
   'Você é um assistente virtual especializado em agendamentos de barbearia.

REGRAS IMPORTANTES:
1. Sempre confirme dados antes de agendar
2. Verifique disponibilidade de horário
3. Seja cordial e profissional
4. Colete: nome, telefone, serviço, data, horário

SERVIÇOS DISPONÍVEIS:
- Corte Masculino: R$ 25,00 (30 min)
- Barba: R$ 15,00 (20 min)
- Cabelo + Barba: R$ 35,00 (45 min)
- Sobrancelha: R$ 10,00 (15 min)

Para confirmar agendamento, responda no formato JSON:
{
  "acao": "agendar",
  "dados": {
    "cliente": "Nome do Cliente",
    "telefone": "(11) 99999-9999",
    "servico": "Corte Masculino",
    "data": "2025-01-16",
    "horario": "14:30"
  }
}', 0.7, 1000)
ON CONFLICT DO NOTHING;

-- Configuração padrão da barbearia
INSERT INTO configuracoes (user_id, chave, valor) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', 'horario_funcionamento_inicio', '08:00'),
  ('550e8400-e29b-41d4-a716-446655440003', 'horario_funcionamento_fim', '18:00'),
  ('550e8400-e29b-41d4-a716-446655440003', 'intervalo_atendimento', '15'),
  ('550e8400-e29b-41d4-a716-446655440003', 'dias_funcionamento', 'segunda,terca,quarta,quinta,sexta,sabado')
ON CONFLICT (user_id, chave) DO NOTHING;