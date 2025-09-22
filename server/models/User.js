import bcrypt from 'bcryptjs';
import { db } from '../config/supabase.js';

class User {
  static async create(userData) {
    try {
      // Hash da senha
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const newUser = {
        name: userData.name,
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        role: userData.role || 'user',
        plan: userData.plan || 'free',
        company: userData.company || null,
        phone: userData.phone || null,
        is_active: true,
        email_verified: true // Simplificado para desenvolvimento
      };
      
      const user = await db.users.create(newUser);
      
      // Remover senha do retorno
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      return await db.users.findByEmail(email.toLowerCase());
    } catch (error) {
      console.error('Erro ao buscar usuário por email:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const user = await db.users.findById(id);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar usuário por ID:', error);
      throw error;
    }
  }

  static async validatePassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Erro ao validar senha:', error);
      return false;
    }
  }

  static async update(id, updates) {
    try {
      // Se está atualizando senha, fazer hash
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 12);
      }
      
      const user = await db.users.update(id, updates);
      
      if (user) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
      return null;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  static async updateLastLogin(id) {
    try {
      return await db.users.update(id, { last_login: new Date() });
    } catch (error) {
      console.error('Erro ao atualizar último login:', error);
      throw error;
    }
  }

  static async findAll(limit = 50, offset = 0, filters = {}) {
    try {
      const users = await db.users.getAll(limit, offset, filters);
      return users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      // Verificar se não é admin
      const user = await db.users.findById(id);
      if (user && user.role === 'admin') {
        throw new Error('Não é possível excluir usuário administrador');
      }
      
      return await db.users.delete(id);
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      throw error;
    }
  }
}

export default User;