import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Configurações do Supabase não encontradas no .env');
  console.log('📝 Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Cliente Supabase com service role para operações administrativas
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Testar conexão
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      console.error('❌ Erro de conexão Supabase:', error.message);
      return false;
    }
    
    console.log('✅ Supabase conectado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Falha na conexão Supabase:', error.message);
    return false;
  }
};

// Executar query com tratamento de erro
export const executeQuery = async (query, params = []) => {
  try {
    // Para queries SQL diretas, usar rpc ou sql
    const { data, error } = await supabase.rpc('execute_sql', { 
      query_text: query, 
      query_params: params 
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro na query:', error);
    throw error;
  }
};

// Operações específicas por tabela
export const db = {
  // Usuários
  users: {
    async create(userData) {
      const { data, error } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async findByEmail(email) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    
    async findById(id) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async update(id, updates) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async delete(id) {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    }
  },
  
  // Agentes
  agents: {
    async create(userId, agentData) {
      const { data, error } = await supabase
        .from('agents')
        .insert({ ...agentData, user_id: userId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async findByUserId(userId) {
      const { data, error } = await supabase
        .from('agents')
        .select(`
          *,
          conversations(count),
          conversations!inner(
            satisfaction_rating,
            messages(response_time)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    
    async update(id, updates) {
      const { data, error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async delete(id) {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    }
  },
  
  // Conversas
  conversations: {
    async create(conversationData) {
      const { data, error } = await supabase
        .from('conversations')
        .insert(conversationData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async findByUserId(userId, filters = {}) {
      let query = supabase
        .from('conversations')
        .select(`
          *,
          agents(name),
          messages(count)
        `)
        .eq('user_id', userId);
      
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.agent_id) query = query.eq('agent_id', filters.agent_id);
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  },
  
  // Mensagens
  messages: {
    async create(messageData) {
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async findByConversationId(conversationId) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  },
  
  // Agendamentos (Barbearia)
  agendamentos: {
    async create(userId, agendamentoData) {
      const { data, error } = await supabase
        .from('agendamentos')
        .insert({ ...agendamentoData, user_id: userId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async findByUserId(userId, filters = {}) {
      let query = supabase
        .from('agendamentos')
        .select(`
          *,
          servicos(nome, preco, duracao),
          clientes(nome, email)
        `)
        .eq('user_id', userId);
      
      if (filters.data) query = query.eq('data', filters.data);
      if (filters.status) query = query.eq('status', filters.status);
      
      const { data, error } = await query.order('data', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    
    async update(id, updates) {
      const { data, error } = await supabase
        .from('agendamentos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },
  
  // Configurações
  configs: {
    async get(userId, configKey) {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('user_id', userId)
        .eq('chave', configKey)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.valor;
    },
    
    async set(userId, configKey, configValue) {
      const { data, error } = await supabase
        .from('configuracoes')
        .upsert({ 
          user_id: userId, 
          chave: configKey, 
          valor: configValue 
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  }
};