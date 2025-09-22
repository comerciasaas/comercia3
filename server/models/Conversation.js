import { db } from '../config/supabase.js';

class Conversation {
  static async create(userId, conversationData) {
    try {
      const newConversation = {
        user_id: userId,
        agent_id: conversationData.agent_id || null,
        customer_name: conversationData.customer_name || 'Cliente',
        customer_email: conversationData.customer_email || null,
        customer_phone: conversationData.customer_phone || null,
        whatsapp_chat_id: conversationData.whatsapp_chat_id || null,
        channel_type: conversationData.channel_type || 'chat',
        status: 'active',
        priority: conversationData.priority || 1
      };
      
      return await db.conversations.create(newConversation);
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      throw error;
    }
  }

  static async findAll(userId, limit = 50, offset = 0, filters = {}) {
    try {
      return await db.conversations.findByUserId(userId, filters);
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      return [];
    }
  }

  static async findById(userId, id) {
    try {
      const conversations = await db.conversations.findByUserId(userId);
      return conversations.find(conv => conv.id === id) || null;
    } catch (error) {
      console.error('Erro ao buscar conversa:', error);
      return null;
    }
  }

  static async update(userId, id, updates) {
    try {
      // Verificar se a conversa pertence ao usuário
      const conversation = await this.findById(userId, id);
      if (!conversation) {
        throw new Error('Conversa não encontrada');
      }
      
      return await db.conversations.update(id, updates);
    } catch (error) {
      console.error('Erro ao atualizar conversa:', error);
      throw error;
    }
  }

  static async delete(userId, id) {
    try {
      // Verificar se a conversa pertence ao usuário
      const conversation = await this.findById(userId, id);
      if (!conversation) {
        throw new Error('Conversa não encontrada');
      }
      
      return await db.conversations.delete(id);
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
      throw error;
    }
  }

  static async getStats(userId) {
    try {
      const conversations = await this.findAll(userId);
      
      const stats = {
        total: conversations.length,
        active: conversations.filter(c => c.status === 'active').length,
        resolved: conversations.filter(c => c.status === 'resolved').length,
        pending: conversations.filter(c => c.status === 'pending').length,
        closed: conversations.filter(c => c.status === 'closed').length,
        byChannel: {
          chat: conversations.filter(c => c.channel_type === 'chat').length,
          whatsapp: conversations.filter(c => c.channel_type === 'whatsapp').length,
          web: conversations.filter(c => c.channel_type === 'web').length
        }
      };
      
      return stats;
    } catch (error) {
      console.error('Erro ao obter estatísticas de conversas:', error);
      return {
        total: 0,
        active: 0,
        resolved: 0,
        pending: 0,
        closed: 0,
        byChannel: { chat: 0, whatsapp: 0, web: 0 }
      };
    }
  }
}

export default Conversation;