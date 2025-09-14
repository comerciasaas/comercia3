import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const authController = {
  async register(req, res, next) {
    try {
      const { name, email, password, company, phone, role } = req.body;

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Email já está em uso'
        });
      }

      const user = await User.create({ name, email, password, company, phone, role });
      const token = generateToken(user.id);

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        user,
        token
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await User.findByEmail(email);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Credenciais inválidas'
        });
      }

      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          error: 'Conta desativada'
        });
      }

      const isValidPassword = await User.validatePassword(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Credenciais inválidas'
        });
      }

      await User.updateLastLogin(user.id);

      const token = generateToken(user.id);

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async getProfile(req, res, next) {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      const { password: _, ...userWithoutPassword } = user;

      res.json({ 
        success: true,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async updateProfile(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword, ...profileUpdates } = req.body;
      const userId = req.userId;

      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            error: 'Senha atual é obrigatória para alterar a senha'
          });
        }

        if (newPassword !== confirmPassword) {
          return res.status(400).json({
            success: false,
            error: 'Nova senha e confirmação não coincidem'
          });
        }

        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'Usuário não encontrado'
          });
        }

        const isValidPassword = await User.validatePassword(currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(400).json({
            success: false,
            error: 'Senha atual incorreta'
          });
        }

        profileUpdates.password = newPassword;
      }

      const updatedUser = await User.update(userId, profileUpdates);
      
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      const { password: _, ...userWithoutPassword } = updatedUser;

      res.json({
        success: true,
        message: newPassword ? 'Perfil e senha atualizados com sucesso' : 'Perfil atualizado com sucesso',
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.userId;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      const isValidPassword = await User.validatePassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          error: 'Senha atual incorreta'
        });
      }

      await User.update(userId, { password: newPassword });

      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async logout(req, res, next) {
    try {
      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async refreshToken(req, res, next) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token é obrigatório'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      const newToken = generateToken(user.id);

      res.json({
        success: true,
        token: newToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token inválido ou expirado'
        });
      }
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
};

export default authController;