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
  PlusIcon
} from '@heroicons/react/24/outline';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiService } from '../services/api';

interface Agendamento {
  id: string;
  cliente: string;
  telefone: string;
  email?: string;
  servico: 'cabelo' | 'barba' | 'cabelo_barba';
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

interface ConfiguracaoBarbearia {
  whatsappApiKey: string;
  geminiApiKey: string;
  numeroWhatsapp: string;
  horarioFuncionamento: {
    inicio: string;
    fim: string;
  };
  diasFolga: string[];
}

export const Barbearia: React.FC = () => {
  const { state } = useApp();
  const { showSuccess, showError } = useNotification();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoBarbearia>({
    whatsappApiKey: '',
    geminiApiKey: '',
    numeroWhatsapp: '',
    horarioFuncionamento: {
      inicio: '08:00',
      fim: '18:00'
    },
    diasFolga: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'agendamentos' | 'configuracao'>('agendamentos');
  const [modalAberto, setModalAberto] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      const [agendamentosRes, configRes] = await Promise.all([
        apiService.getBarbeariaAgendamentos(),
        apiService.getBarbeariaConfig()
      ]);
      
      if (agendamentosRes.success) {
        setAgendamentos(agendamentosRes.data || []);
      }
      
      if (configRes.success) {
        setConfiguracao(configRes.data || configuracao);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro', 'Não foi possível carregar os dados da barbearia');
    } finally {
      setLoading(false);
    }
  };

  const salvarConfiguracao = async () => {
    try {
      const response = await apiService.saveBarbeariaConfig(configuracao);
      
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

  const atualizarStatusAgendamento = async (agendamentoId: string, novoStatus: string) => {
    try {
      const response = await apiService.updateBarbeariaAgendamento(agendamentoId, {
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

  const formatarServico = (servico: string) => {
    switch (servico) {
      case 'cabelo': return 'Corte de Cabelo';
      case 'barba': return 'Barba';
      case 'cabelo_barba': return 'Cabelo + Barba';
      default: return servico;
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
            <button
              onClick={() => setActiveTab('agendamentos')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'agendamentos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CalendarDaysIcon className="h-5 w-5 inline mr-2" />
              Agendamentos
            </button>
            <button
              onClick={() => setActiveTab('configuracao')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'configuracao'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CogIcon className="h-5 w-5 inline mr-2" />
              Configurações
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === 'agendamentos' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Agendamentos de Hoje</h3>
                  <p className="text-sm text-gray-500">Visualize e gerencie os agendamentos</p>
                </div>
                <div className="divide-y divide-gray-200">
                  {agendamentos.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum agendamento</h3>
                      <p className="mt-1 text-sm text-gray-500">Não há agendamentos para hoje.</p>
                    </div>
                  ) : (
                    agendamentos.map((agendamento) => (
                      <div 
                        key={agendamento.id} 
                        className="px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center cursor-pointer flex-1"
                            onClick={() => {
                              setAgendamentoSelecionado(agendamento);
                              setModalAberto(true);
                            }}
                          >
                            <div className="flex-shrink-0">
                              <UserIcon className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {agendamento.cliente}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatarServico(agendamento.servico)} • {agendamento.telefone}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                R$ {(agendamento.valor || 0).toFixed(2)} • {agendamento.pago ? '✅ Pago' : '❌ Não pago'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-900">
                              <ClockIcon className="h-4 w-4 inline mr-1" />
                              {agendamento.horario}
                            </div>
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  atualizarStatusAgendamento(agendamento.id, 'concluido');
                                }}
                                className="bg-green-600 text-white px-3 py-1 rounded-md text-xs hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                                title="Marcar como concluído"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
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

          {activeTab === 'configuracao' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Configurações da Barbearia</h3>
                  <p className="text-sm text-gray-500">Configure as APIs e horários de funcionamento</p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">API Key do WhatsApp</label>
                    <input
                      type="text"
                      value={configuracao.whatsappApiKey}
                      onChange={(e) => setConfiguracao({...configuracao, whatsappApiKey: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Insira sua API Key do WhatsApp"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">API Key do Gemini</label>
                    <input
                      type="text"
                      value={configuracao.geminiApiKey}
                      onChange={(e) => setConfiguracao({...configuracao, geminiApiKey: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Insira sua API Key do Gemini"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Número do WhatsApp</label>
                    <input
                      type="text"
                      value={configuracao.numeroWhatsapp}
                      onChange={(e) => setConfiguracao({...configuracao, numeroWhatsapp: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: +5511999999999"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Horário de Início</label>
                      <input
                        type="time"
                        value={configuracao.horarioFuncionamento.inicio}
                        onChange={(e) => setConfiguracao({
                          ...configuracao,
                          horarioFuncionamento: {
                            ...configuracao.horarioFuncionamento,
                            inicio: e.target.value
                          }
                        })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Horário de Fim</label>
                      <input
                        type="time"
                        value={configuracao.horarioFuncionamento.fim}
                        onChange={(e) => setConfiguracao({
                          ...configuracao,
                          horarioFuncionamento: {
                            ...configuracao.horarioFuncionamento,
                            fim: e.target.value
                          }
                        })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={salvarConfiguracao}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Salvar Configurações
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes do Agendamento */}
      {modalAberto && agendamentoSelecionado && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Detalhes do Agendamento</h3>
                <button
                  onClick={() => setModalAberto(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cliente</label>
                    <p className="mt-1 text-sm text-gray-900">{agendamentoSelecionado.cliente}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Telefone</label>
                    <p className="mt-1 text-sm text-gray-900">{agendamentoSelecionado.telefone}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(agendamentoSelecionado.data).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Horário</label>
                    <p className="mt-1 text-sm text-gray-900">{agendamentoSelecionado.horario}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Serviço</label>
                  <p className="mt-1 text-sm text-gray-900">{formatarServico(agendamentoSelecionado.servico)}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Valor</label>
                    <p className="mt-1 text-sm text-gray-900 font-semibold">R$ {(agendamentoSelecionado.valor || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status do Pagamento</label>
                    <p className={`mt-1 text-sm font-medium ${
                      agendamentoSelecionado.pago ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {agendamentoSelecionado.pago ? '✅ Pago' : '❌ Não pago'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status do Agendamento</label>
                    <div className="mt-1 flex items-center">
                      {getStatusIcon(agendamentoSelecionado.status)}
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                        getStatusColor(agendamentoSelecionado.status)
                      }`}>
                        {agendamentoSelecionado.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setModalAberto(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Barbearia;