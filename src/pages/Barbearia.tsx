import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  CogIcon,
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiService } from '../services/api';

interface Agendamento {
  id: string;
  cliente: string;
  telefone: string;
  email?: string;
  servico: string;
  servico_nome?: string;
  data: string;
  horario: string;
  valor: number;
  pago: boolean;
  metodo_pagamento: 'dinheiro' | 'pix' | 'cartao' | 'pendente';
  observacoes?: string;
  status: 'confirmado' | 'pendente' | 'cancelado' | 'concluido';
  created_at: string;
  updated_at: string;
}

interface Servico {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  duracao: number;
  is_active: boolean;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  data_nascimento?: string;
  observacoes?: string;
}

export const Barbearia: React.FC = () => {
  const { state } = useApp();
  const { showSuccess, showError } = useNotification();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'agendamentos' | 'servicos' | 'clientes' | 'chat' | 'configuracao' | 'relatorios'>('agendamentos');
  
  // Estados para modais
  const [modalAberto, setModalAberto] = useState(false);
  const [modalTipo, setModalTipo] = useState<'agendamento' | 'servico' | 'cliente'>('agendamento');
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  
  // Estados para chat IA
  const [chatMessages, setChatMessages] = useState<Array<{id: string, sender: 'user' | 'ai', message: string, timestamp: Date}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Estados para configuração
  const [configuracao, setConfiguracao] = useState<any>({});
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  // Estados para relatórios
  const [relatorios, setRelatorios] = useState<any>({});

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      const [agendamentosRes, servicosRes, clientesRes, configRes] = await Promise.all([
        apiService.get('/barbearia/agendamentos'),
        apiService.get('/barbearia/servicos'),
        apiService.get('/barbearia/clientes'),
        apiService.get('/barbearia/configuracao')
      ]);
      
      if (agendamentosRes.success) {
        setAgendamentos(agendamentosRes.data || []);
      }
      
      if (servicosRes.success) {
        setServicos(servicosRes.data || []);
      }
      
      if (clientesRes.success) {
        setClientes(clientesRes.data || []);
      }
      
      if (configRes.success) {
        setConfiguracao(configRes.data || {});
        setGeminiApiKey(configRes.data?.config?.gemini_api_key || '');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro', 'Não foi possível carregar os dados da barbearia');
    } finally {
      setLoading(false);
    }
  };

  const carregarRelatorios = async () => {
    try {
      const response = await apiService.get('/barbearia/relatorios?periodo=30');
      if (response.success) {
        setRelatorios(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      showError('Erro', 'Não foi possível carregar os relatórios');
    }
  };

  const salvarConfiguracao = async () => {
    try {
      const response = await apiService.post('/barbearia/configuracao', {
        config: configuracao.config,
        horarios: configuracao.horarios,
        gemini_api_key: geminiApiKey
      });
      
      if (response.success) {
        showSuccess('Sucesso', 'Configurações salvas com sucesso!');
      } else {
        showError('Erro', response.error || 'Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      showError('Erro', 'Não foi possível salvar as configurações');
    }
  };

  const enviarMensagemChat = async () => {
    if (!chatInput.trim()) return;
    
    if (!geminiApiKey) {
      showError('Erro', 'Configure a API Key do Gemini primeiro na aba Configurações');
      return;
    }

    const mensagemUsuario = {
      id: Date.now().toString(),
      sender: 'user' as const,
      message: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, mensagemUsuario]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await apiService.post('/barbearia/chat', {
        message: chatInput
      });

      if (response.success) {
        const mensagemIA = {
          id: (Date.now() + 1).toString(),
          sender: 'ai' as const,
          message: response.data.response,
          timestamp: new Date()
        };

        setChatMessages(prev => [...prev, mensagemIA]);

        // Se um agendamento foi criado automaticamente
        if (response.data.agendamento_criado) {
          showSuccess('Agendamento Criado!', `Agendamento para ${response.data.agendamento_criado.cliente} foi criado automaticamente`);
          carregarDados(); // Recarregar dados para mostrar o novo agendamento
        }
      } else {
        showError('Erro', response.error || 'Erro ao processar mensagem');
      }
    } catch (error) {
      console.error('Erro no chat:', error);
      showError('Erro', 'Não foi possível processar a mensagem');
    } finally {
      setChatLoading(false);
    }
  };

  const atualizarStatusAgendamento = async (agendamentoId: string, novoStatus: string) => {
    try {
      const response = await apiService.put(`/barbearia/agendamentos/${agendamentoId}`, {
        status: novoStatus
      });
      
      if (response.success) {
        setAgendamentos(prev => prev.map(ag => 
          ag.id === agendamentoId ? { ...ag, status: novoStatus as any } : ag
        ));
        showSuccess('Status atualizado com sucesso!');
      } else {
        showError('Erro ao atualizar status do agendamento');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showError('Erro ao atualizar status do agendamento');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmado':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'pendente':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'cancelado':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'concluido':
        return <CheckCircleIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-100 text-green-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      case 'concluido':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">Painel da Barbearia</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Bem-vindo, {state.user?.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'agendamentos', name: 'Agendamentos', icon: CalendarDaysIcon },
              { id: 'servicos', name: 'Serviços', icon: WrenchScrewdriverIcon },
              { id: 'clientes', name: 'Clientes', icon: UserIcon },
              { id: 'chat', name: 'Chat IA', icon: ChatBubbleLeftRightIcon },
              { id: 'relatorios', name: 'Relatórios', icon: ChartBarIcon },
              { id: 'configuracao', name: 'Configurações', icon: CogIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'relatorios') carregarRelatorios();
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="mt-6">
          {/* Agendamentos Tab */}
          {activeTab === 'agendamentos' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Agendamentos</h3>
                    <p className="text-sm text-gray-500">Gerencie os agendamentos da barbearia</p>
                  </div>
                  <button
                    onClick={() => {
                      setModalTipo('agendamento');
                      setItemSelecionado(null);
                      setModalAberto(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Novo Agendamento
                  </button>
                </div>
                <div className="divide-y divide-gray-200">
                  {agendamentos.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum agendamento</h3>
                      <p className="mt-1 text-sm text-gray-500">Comece criando um novo agendamento.</p>
                    </div>
                  ) : (
                    agendamentos.map((agendamento) => (
                      <div 
                        key={agendamento.id} 
                        className="px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center cursor-pointer flex-1">
                            <div className="flex-shrink-0">
                              <UserIcon className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {agendamento.cliente}
                              </div>
                              <div className="text-sm text-gray-500">
                                {agendamento.servico_nome || agendamento.servico} • {agendamento.telefone}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {new Date(agendamento.data).toLocaleDateString('pt-BR')} às {agendamento.horario}
                              </div>
                              <div className="text-xs text-gray-400">
                                R$ {(agendamento.valor || 0).toFixed(2)} • {agendamento.pago ? '✅ Pago' : '❌ Não pago'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              {getStatusIcon(agendamento.status)}
                              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                                getStatusColor(agendamento.status)
                              }`}>
                                {agendamento.status}
                              </span>
                            </div>
                            {agendamento.status !== 'concluido' && agendamento.status !== 'cancelado' && (
                              <button
                                onClick={() => atualizarStatusAgendamento(agendamento.id, 'concluido')}
                                className="bg-green-600 text-white px-3 py-1 rounded-md text-xs hover:bg-green-700"
                                title="Marcar como concluído"
                              >
                                Concluir
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Chat IA Tab */}
          {activeTab === 'chat' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg h-96 flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Chat IA - Agendamentos</h3>
                  <p className="text-sm text-gray-500">
                    Converse com a IA para criar agendamentos automaticamente
                    {!geminiApiKey && (
                      <span className="text-red-500 ml-2">
                        (Configure a API Key do Gemini nas Configurações)
                      </span>
                    )}
                  </p>
                </div>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p>Inicie uma conversa para criar agendamentos</p>
                      <p className="text-sm mt-2">
                        Exemplo: "Quero agendar um corte para João, telefone (11) 99999-9999, amanhã às 14h"
                      </p>
                    </div>
                  )}
                  
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}>
                        <p className="text-sm">{msg.message}</p>
                        <p className={`text-xs mt-1 ${
                          msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {msg.timestamp.toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                          <span className="text-sm">IA está pensando...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Input */}
                <div className="p-4 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagemChat()}
                      placeholder={geminiApiKey ? "Digite sua mensagem..." : "Configure a API Key primeiro"}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={chatLoading || !geminiApiKey}
                    />
                    <button
                      onClick={enviarMensagemChat}
                      disabled={chatLoading || !chatInput.trim() || !geminiApiKey}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {chatLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <PaperAirplaneIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Configurações Tab */}
          {activeTab === 'configuracao' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Configurações da Barbearia</h3>
                  <p className="text-sm text-gray-500">Configure as informações e API da barbearia</p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key do Gemini (para Chat IA)
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="password"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Cole sua API Key do Gemini aqui"
                      />
                      <button
                        onClick={salvarConfiguracao}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Salvar
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Obtenha em: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">makersuite.google.com</a>
                    </p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-medium text-yellow-800">Como usar o Chat IA</h3>
                        <div className="text-sm text-yellow-700 mt-1">
                          <p>1. Configure sua API Key do Gemini acima</p>
                          <p>2. Vá para a aba "Chat IA"</p>
                          <p>3. Digite mensagens como: "Agendar corte para João, telefone (11) 99999-9999, amanhã às 14h"</p>
                          <p>4. A IA criará o agendamento automaticamente se todos os dados estiverem corretos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Outras abas podem ser implementadas aqui */}
          {activeTab === 'servicos' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Serviços</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {servicos.map((servico) => (
                  <div key={servico.id} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">{servico.nome}</h4>
                    <p className="text-sm text-gray-500">{servico.descricao}</p>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-lg font-bold text-green-600">R$ {servico.preco.toFixed(2)}</span>
                      <span className="text-sm text-gray-500">{servico.duracao} min</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'clientes' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Clientes</h3>
              <div className="space-y-4">
                {clientes.map((cliente) => (
                  <div key={cliente.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{cliente.nome}</h4>
                        <p className="text-sm text-gray-500">{cliente.telefone}</p>
                        {cliente.email && <p className="text-sm text-gray-500">{cliente.email}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'relatorios' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Agendamentos</h3>
                  <p className="text-3xl font-bold text-blue-600">{relatorios.resumo?.total || 0}</p>
                  <p className="text-sm text-gray-500">Total no período</p>
                </div>
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Faturamento</h3>
                  <p className="text-3xl font-bold text-green-600">
                    R$ {(relatorios.resumo?.faturamento || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">Últimos 30 dias</p>
                </div>
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ticket Médio</h3>
                  <p className="text-3xl font-bold text-purple-600">
                    R$ {(relatorios.resumo?.ticket_medio || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">Por atendimento</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Barbearia;