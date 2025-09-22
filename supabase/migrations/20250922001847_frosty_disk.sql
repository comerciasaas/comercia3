-- ==================== RLS USERS ====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO public
  USING (uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE TO public
  USING (uid() = id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS AGENTS ====================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own agents" ON agents;
CREATE POLICY "Users can manage own agents" ON agents
  FOR ALL TO public
  USING (user_id = uid());

DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS CONVERSATIONS ====================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
CREATE POLICY "Users can manage own conversations" ON conversations
  FOR ALL TO public
  USING (user_id = uid());

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS MESSAGES ====================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access messages from own conversations" ON messages;
CREATE POLICY "Users can access messages from own conversations" ON messages
  FOR ALL TO public
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE user_id = uid()
  ));

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS WHATSAPP_CONFIGS ====================
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own whatsapp configs" ON whatsapp_configs;
CREATE POLICY "Users can manage own whatsapp configs" ON whatsapp_configs
  FOR ALL TO public
  USING (user_id = uid());

DROP TRIGGER IF EXISTS update_whatsapp_configs_updated_at ON whatsapp_configs;
CREATE TRIGGER update_whatsapp_configs_updated_at
  BEFORE UPDATE ON whatsapp_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS GLOBAL_CONFIGS ====================
ALTER TABLE global_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can manage global configs" ON global_configs;
CREATE POLICY "Only admins can manage global configs" ON global_configs
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = uid() AND role = 'admin'
  ));

DROP TRIGGER IF EXISTS update_global_configs_updated_at ON global_configs;
CREATE TRIGGER update_global_configs_updated_at
  BEFORE UPDATE ON global_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS AGENDAMENTOS ====================
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own agendamentos" ON agendamentos;
CREATE POLICY "Users can manage own agendamentos" ON agendamentos
  FOR ALL TO public
  USING (user_id = uid());

DROP TRIGGER IF EXISTS update_agendamentos_updated_at ON agendamentos;
CREATE TRIGGER update_agendamentos_updated_at
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS SERVICOS ====================
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own servicos" ON servicos;
CREATE POLICY "Users can manage own servicos" ON servicos
  FOR ALL TO public
  USING (user_id = uid());

DROP TRIGGER IF EXISTS update_servicos_updated_at ON servicos;
CREATE TRIGGER update_servicos_updated_at
  BEFORE UPDATE ON servicos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS CLIENTES ====================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own clientes" ON clientes;
CREATE POLICY "Users can manage own clientes" ON clientes
  FOR ALL TO public
  USING (user_id = uid());

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS CONFIGURACOES ====================
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own configs" ON configuracoes;
CREATE POLICY "Users can manage own configs" ON configuracoes
  FOR ALL TO public
  USING (user_id = uid());

DROP TRIGGER IF EXISTS update_configuracoes_updated_at ON configuracoes;
CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
