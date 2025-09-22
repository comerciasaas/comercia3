import { db } from '../config/supabase.js';

class Agent {
  static async create(userId, agentData) {
    try {
      const newAgent = {
        user_id: userId,
        name: agentData.name,
        description: agentData.description || null,
        objective: agentData.objective || null,
        personality: agentData.personality || 'professional',
        ai_provider: agentData.ai_provider,
        model: agentData.model,
        system_prompt: agentData.system_prompt || null,
        temperature: agentData.temperature || 0.7,
        max_tokens: agentData.max_tokens || 1000,
        is_active: true,
        whatsapp_connected: false
      };
      
      return await db.agents.create(newAgent);
    } catch (error) {
      console.error('Erro ao criar agente:', error);
      throw error;
    }
  }

  static async findByUserId(userId, limit = 50, offset = 0) {
    try {
      return await db.agents.findByUserId(userId);
    } catch (error) {
      console.error('Erro ao buscar agentes:', error);
      return [];
    }
  }

  static async findById(userId, id) {
    try {
      const agents = await db.agents.findByUserId(userId);
      return agents.find(agent => agent.id === id) || null;
    } catch (error) {
      console.error('Erro ao buscar agente:', error);
      return null;
    }
  }

  static async update(userId, id, updates) {
    try {
      // Verificar se o agente pertence ao usuário
      const agent = await this.findById(userId, id);
      if (!agent) {
        throw new Error('Agente não encontrado');
      }
      
      return await db.agents.update(id, updates);
    } catch (error) {
      console.error('Erro ao atualizar agente:', error);
      throw error;
    }
  }

  static async delete(userId, id) {
    try {
      // Verificar se o agente pertence ao usuário
      const agent = await this.findById(userId, id);
      if (!agent) {
        throw new Error('Agente não encontrado');
      }
      
      return await db.agents.delete(id);
    } catch (error) {
      console.error('Erro ao excluir agente:', error);
      throw error;
    }
  }

  static async getStats(userId) {
    try {
      const agents = await this.findByUserId(userId);
      
      const stats = {
        total: agents.length,
        active: agents.filter(a => a.is_active).length,
        inactive: agents.filter(a => !a.is_active).length,
        byProvider: {
          chatgpt: agents.filter(a => a.ai_provider === 'chatgpt').length,
          gemini: agents.filter(a => a.ai_provider === 'gemini').length,
          huggingface: agents.filter(a => a.ai_provider === 'huggingface').length
        }
      };
      
      return stats;
    } catch (error) {
      console.error('Erro ao obter estatísticas de agentes:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        byProvider: { chatgpt: 0, gemini: 0, huggingface: 0 }
      };
    }
  }
}

export default Agent;