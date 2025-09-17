import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CogIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useNotification } from '../contexts/NotificationContext';
import { apiService } from '../services/api';

interface ApiConfig {
  openai_api_key: string;
  gemini_api_key: string;
  huggingface_api_key: string;
  whatsapp_access_token: string;
  whatsapp_phone_number_id: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
}

export const Configuracoes: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [config, setConfig] = useState<ApiConfig>({
    openai_api_key: '',
    gemini_api_key: '',
    huggingface_api_key: '',
    whatsapp_access_token: '',
    whatsapp_phone_number_id: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfiguracoes();
  }, []);

  const loadConfiguracoes = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/config');
      
      if (response.success) {
        setConfig(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      showError('Erro', 'Não foi possível carregar as configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: keyof ApiConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const salvarConfiguracao = async (key: keyof ApiConfig) => {
    try {
      setSaving(true);
      
      const response = await apiService.post('/config', {
        chave: key,
        valor: config[key]
      });
      
      if (response.success) {
        showSuccess('Configuração salva!', `${key} foi salva com sucesso`);
      } else {
        showError('Erro', response.error || 'Erro ao salvar configuração');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      showError('Erro', 'Não foi possível salvar a configuração');
    } finally {
      setSaving(false);
    }
  };

  const testarAPI = async (provider: string, apiKey: string) => {
    if (!apiKey.trim()) {
      showError('Erro', 'API Key não pode estar vazia');
      return;
    }

    try {
      setTesting(prev => ({ ...prev, [provider]: true }));
      
      const response = await apiService.post('/config/test-api', {
        provider,
        apiKey
      });
      
      setTestResults(prev => ({ ...prev, [provider]: response.success }));
      
      if (response.success) {
        showSuccess('Teste bem-sucedido!', response.message);
      } else {
        showError('Teste falhou', response.message);
      }
    } catch (error) {
      console.error('Erro ao testar API:', error);
      setTestResults(prev => ({ ...prev, [provider]: false }));
      showError('Erro', 'Não foi possível testar a API');
    } finally {
      setTesting(prev => ({ ...prev, [provider]: false }));
    }
  };

  const getTestIcon = (provider: string) => {
    if (testing[provider]) {
      return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>;
    }
    
    if (testResults[provider] === true) {
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
    }
    
    if (testResults[provider] === false) {
      return <XCircleIcon className="w-4 h-4 text-red-500" />;
    }
    
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações de API</h1>
          <p className="text-gray-600">Configure suas chaves de API para integração com serviços externos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* APIs de IA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <CogIcon className="w-6 h-6 mr-2 text-blue-600" />
            APIs de Inteligência Artificial
          </h2>

          <div className="space-y-6">
            {/* OpenAI */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API Key
              </label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={config.openai_api_key}
                  onChange={(e) => handleInputChange('openai_api_key', e.target.value)}
                  placeholder="sk-proj-..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => testarAPI('openai', config.openai_api_key)}
                  disabled={testing.openai}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {getTestIcon('openai') || 'Testar'}
                </button>
                <button
                  onClick={() => salvarConfiguracao('openai_api_key')}
                  disabled={saving}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Obtenha em: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com</a>
              </p>
            </div>

            {/* Gemini */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google Gemini API Key
              </label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={config.gemini_api_key}
                  onChange={(e) => handleInputChange('gemini_api_key', e.target.value)}
                  placeholder="AIza..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => testarAPI('gemini', config.gemini_api_key)}
                  disabled={testing.gemini}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {getTestIcon('gemini') || 'Testar'}
                </button>
                <button
                  onClick={() => salvarConfiguracao('gemini_api_key')}
                  disabled={saving}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Obtenha em: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">makersuite.google.com</a>
              </p>
            </div>

            {/* Hugging Face */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hugging Face API Key
              </label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={config.huggingface_api_key}
                  onChange={(e) => handleInputChange('huggingface_api_key', e.target.value)}
                  placeholder="hf_..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => testarAPI('huggingface', config.huggingface_api_key)}
                  disabled={testing.huggingface}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {getTestIcon('huggingface') || 'Testar'}
                </button>
                <button
                  onClick={() => salvarConfiguracao('huggingface_api_key')}
                  disabled={saving}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Obtenha em: <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">huggingface.co/settings/tokens</a>
              </p>
            </div>
          </div>
        </motion.div>

        {/* WhatsApp e Email */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <KeyIcon className="w-6 h-6 mr-2 text-green-600" />
            Integrações Externas
          </h2>

          <div className="space-y-6">
            {/* WhatsApp */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">WhatsApp Business API</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Token
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="password"
                      value={config.whatsapp_access_token}
                      onChange={(e) => handleInputChange('whatsapp_access_token', e.target.value)}
                      placeholder="EAAx..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => salvarConfiguracao('whatsapp_access_token')}
                      disabled={saving}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number ID
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={config.whatsapp_phone_number_id}
                      onChange={(e) => handleInputChange('whatsapp_phone_number_id', e.target.value)}
                      placeholder="123456789"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => salvarConfiguracao('whatsapp_phone_number_id')}
                      disabled={saving}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Email SMTP */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">Configurações de Email</h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Servidor SMTP
                    </label>
                    <input
                      type="text"
                      value={config.smtp_host}
                      onChange={(e) => handleInputChange('smtp_host', e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Porta
                    </label>
                    <input
                      type="text"
                      value={config.smtp_port}
                      onChange={(e) => handleInputChange('smtp_port', e.target.value)}
                      placeholder="587"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuário
                  </label>
                  <input
                    type="email"
                    value={config.smtp_user}
                    onChange={(e) => handleInputChange('smtp_user', e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={config.smtp_pass}
                    onChange={(e) => handleInputChange('smtp_pass', e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <button
                  onClick={() => {
                    salvarConfiguracao('smtp_host');
                    salvarConfiguracao('smtp_port');
                    salvarConfiguracao('smtp_user');
                    salvarConfiguracao('smtp_pass');
                  }}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Salvar Configurações de Email
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Informações importantes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
      >
        <div className="flex items-start">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Informações Importantes</h3>
            <div className="text-sm text-yellow-700 mt-1">
              <ul className="list-disc list-inside space-y-1">
                <li>As configurações são salvas de forma segura e criptografada</li>
                <li>Teste sempre suas API Keys após configurá-las</li>
                <li>Para WhatsApp, você precisa de uma conta Business verificada</li>
                <li>As configurações de email são necessárias para notificações</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Configuracoes;