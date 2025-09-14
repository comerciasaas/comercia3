import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { executeUserQuery } from '../config/database.js';
import AIService from '../services/aiService.js';

const router = express.Router();

// Middleware para verificar se é usuário da barbearia
const verificarUsuarioBarbearia = (req, res, next) => {
  if (req.user.role !== 'barbearia') {
    return res.status(403).json({ 
      success: false, 
      error: 'Acesso negado. Apenas usuários da barbearia podem acessar esta funcionalidade.' 
    });
  }
  next();
};

// Aplicar middleware de autenticação e verificação em todas as rotas
router.use(authMiddleware);
router.use(verificarUsuarioBarbearia);

// GET /api/barbearia/agendamentos - Listar agendamentos
router.get('/agendamentos', async (req, res) => {
  try {
    const { data } = req.query;
    const dataFiltro = data || new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT 
        id, cliente, telefone, email, data, horario, servico, valor,
        pago, metodo_pagamento, observacoes, status, created_at, updated_at
      FROM agendamentos 
      WHERE DATE(data) = ?
      ORDER BY horario ASC
    `;
    
    const agendamentos = await executeUserQuery(req.user.id, query, [dataFiltro]);
    
    const agendamentosFormatados = agendamentos.map(agendamento => ({
      id: agendamento.id,
      cliente: agendamento.cliente,
      telefone: agendamento.telefone,
      email: agendamento.email,
      servico: agendamento.servico,
      data: agendamento.data,
      horario: agendamento.horario,
      valor: parseFloat(agendamento.valor || 0),
      pago: Boolean(agendamento.pago),
      metodo_pagamento: agendamento.metodo_pagamento,
      observacoes: agendamento.observacoes,
      status: agendamento.status,
      created_at: agendamento.created_at,
      updated_at: agendamento.updated_at
    }));
    
    res.json({
      success: true,
      data: agendamentosFormatados
    });
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/barbearia/agendamentos - Criar agendamento
router.post('/agendamentos', async (req, res) => {
  try {
    const { cliente, telefone, email, data, horario, servico, valor, observacoes } = req.body;
    
    if (!cliente || !telefone || !data || !horario || !servico) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: cliente, telefone, data, horario, servico'
      });
    }

    const query = `
      INSERT INTO agendamentos (
        cliente, telefone, email, data, horario, servico, valor, observacoes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmado')
    `;
    
    const result = await executeUserQuery(req.user.id, query, [
      cliente, telefone, email, data, horario, servico, valor || 0, observacoes
    ]);
    
    res.json({
      success: true,
      data: { id: result.insertId },
      message: 'Agendamento criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/barbearia/agendamentos/:id - Atualizar agendamento
router.put('/agendamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, pago, metodo_pagamento, observacoes } = req.body;
    
    const updateFields = [];
    const updateValues = [];
    
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    
    if (pago !== undefined) {
      updateFields.push('pago = ?');
      updateValues.push(pago);
    }
    
    if (metodo_pagamento !== undefined) {
      updateFields.push('metodo_pagamento = ?');
      updateValues.push(metodo_pagamento);
    }
    
    if (observacoes !== undefined) {
      updateFields.push('observacoes = ?');
      updateValues.push(observacoes);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar'
      });
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);
    
    const query = `
      UPDATE agendamentos 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    const result = await executeUserQuery(req.user.id, query, updateValues);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agendamento não encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Agendamento atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/barbearia/configuracao - Obter configurações
router.get('/configuracao', async (req, res) => {
  try {
    // Buscar agente da barbearia
    const query = `
      SELECT name, description, system_prompt, ai_provider, model, temperature, max_tokens
      FROM agents 
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const agente = await executeUserQuery(req.user.id, query);
    
    let configuracao = {
      whatsappApiKey: process.env.WHATSAPP_ACCESS_TOKEN || '',
      geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      numeroWhatsapp: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      horarioFuncionamento: {
        inicio: '08:00',
        fim: '18:00'
      },
      diasFolga: [],
      agente: agente[0] || null
    };
    
    res.json({
      success: true,
      data: configuracao
    });
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/barbearia/configuracao - Salvar configurações
router.post('/configuracao', async (req, res) => {
  try {
    const { horarioFuncionamento, diasFolga, agenteConfig } = req.body;
    
    // Se há configuração de agente, criar ou atualizar
    if (agenteConfig) {
      const systemPrompt = `Você é um assistente virtual da barbearia especializado em agendamentos.

Horário de funcionamento: ${horarioFuncionamento?.inicio || '08:00'} às ${horarioFuncionamento?.fim || '18:00'}
Serviços disponíveis:
- Corte de Cabelo: R$ 25,00
- Barba: R$ 15,00
- Cabelo + Barba: R$ 35,00

Agendamentos disponíveis a cada 30 minutos.
Dias de folga: ${diasFolga?.join(', ') || 'Nenhum'}

Sempre seja cordial e profissional. Quando receber uma solicitação de agendamento, colete:
1. Nome do cliente
2. Telefone
3. Serviço desejado
4. Data preferida
5. Horário preferido

Confirme todos os detalhes antes de finalizar o agendamento.`;

      // Verificar se já existe um agente
      const existingAgent = await executeUserQuery(req.user.id, 'SELECT id FROM agents LIMIT 1');
      
      if (existingAgent.length > 0) {
        // Atualizar agente existente
        await executeUserQuery(req.user.id, `
          UPDATE agents 
          SET name = ?, description = ?, system_prompt = ?, ai_provider = ?, model = ?, updated_at = NOW()
          WHERE id = ?
        `, [
          agenteConfig.name || 'Agente Barbearia',
          agenteConfig.description || 'Agente especializado em agendamentos',
          systemPrompt,
          agenteConfig.ai_provider || 'gemini',
          agenteConfig.model || 'gemini-1.5-flash',
          existingAgent[0].id
        ]);
      } else {
        // Criar novo agente
        await executeUserQuery(req.user.id, `
          INSERT INTO agents (
            name, description, system_prompt, ai_provider, model, 
            personality, temperature, max_tokens, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          agenteConfig.name || 'Agente Barbearia',
          agenteConfig.description || 'Agente especializado em agendamentos',
          systemPrompt,
          agenteConfig.ai_provider || 'gemini',
          agenteConfig.model || 'gemini-1.5-flash',
          'professional',
          0.7,
          1000,
          true
        ]);
      }
    }
    
    res.json({
      success: true,
      message: 'Configurações salvas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;