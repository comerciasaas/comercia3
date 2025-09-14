import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAnalytics } from '../hooks/useAnalytics';

export const Login: React.FC = () => {
  const { dispatch } = useApp();
  const { showSuccess, showError } = useNotification();
  const { trackFormInteraction, trackUserAction, trackError, trackApiResponse } = useAnalytics();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('Email é obrigatório');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Email inválido');
      return false;
    }
    if (!formData.password.trim()) {
      setError('Senha é obrigatória');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    
    // Rastrear início do formulário de login
    trackFormInteraction('login', 'submit', {
      email: formData.email.split('@')[1] || 'unknown', // apenas o domínio por privacidade
      hasPassword: formData.password.length > 0
    });

    try {
      const response = await apiService.login(formData.email, formData.password);
      const responseTime = Date.now() - startTime;
      
      if (response.success) {
        trackApiResponse('/api/auth/login', responseTime, 200);
        
        // Rastrear login bem-sucedido
        trackUserAction('login_success', 'authentication', {
          loginMethod: 'email_password',
          responseTime
        });
        
        dispatch({ type: 'SET_USER', payload: response.data.user });
        showSuccess('Login realizado com sucesso!', `Bem-vindo, ${response.data.user.name}`);
        
        // Navegar baseado no tipo de usuário retornado pela API
        const userRole = response.data.user.role || 'user';
        if (userRole === 'barber' || userRole === 'barbearia') {
          navigate('/barbearia');
        } else if (userRole === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        // Rastrear erro de login
        trackError('login_failed', response.error || 'Invalid credentials', {
          email: formData.email.split('@')[1] || 'unknown',
          responseTime
        });
        
        trackFormInteraction('login', 'error', {
          errorType: 'invalid_credentials',
          email: formData.email.split('@')[1] || 'unknown'
        });
        
        setError(response.error || 'Credenciais inválidas');
        showError('Erro no login', response.error || 'Credenciais inválidas');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const responseTime = Date.now() - startTime;
      const errorMessage = error.message || 'Não foi possível conectar com o servidor';
      
      // Rastrear erro de conexão
      trackError('login_connection_error', errorMessage, {
        email: formData.email.split('@')[1] || 'unknown',
        responseTime
      });
      
      trackFormInteraction('login', 'error', {
        errorType: 'connection_error',
        email: formData.email.split('@')[1] || 'unknown'
      });
      
      setError(errorMessage);
      showError('Erro de conexão', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  // Rastrear início do formulário quando o usuário começa a digitar
  const handleEmailFocus = () => {
    trackFormInteraction('login', 'start', {
      field: 'email'
    });
  };

  const handlePasswordToggle = () => {
    setShowPassword(!showPassword);
    trackUserAction('password_visibility_toggle', 'form_interaction', {
      visible: !showPassword
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Dinâmica</h1>
                <p className="text-gray-600 mt-2">Soluções em IA</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo de volta</h2>
            <p className="text-gray-600">Entre na sua conta para continuar</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <p className="text-red-600 text-sm">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={handleEmailFocus}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="seu@email.com"
                />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={handlePasswordToggle}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Entrando...
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-4">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-500 font-medium">
                Criar conta
              </Link>
            </p>
            
            <div className="border-t border-gray-200 pt-4">
              <a
                href="/admin"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Painel Administrativo
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            © 2025 Dinâmica. Todos os direitos reservados.
          </p>
        </div>
      </motion.div>
    </div>
  );
};