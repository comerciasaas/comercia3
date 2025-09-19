import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { executeQuery } from '../config/database.js';
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

// ==================== AGENDAMENTOS ====================

// GET /api/barbearia/agendamentos - Listar agendamentos
router.get('/agendamentos', async (req, res) => {
  try {
    const { data, status } = req.query;
    const userId = req.user.id;
    
    let query = `
      SELECT 
        a.id, a.cliente, a.telefone, a.email, a.data, a.horario, 
        a.servico, a.valor, a.pago, a.metodo_pagamento, a.observacoes, 
        a.status, a.created_at, a.updated_at,
        s.nome as servico_nome, s.duracao as servico_duracao,
        c.nome as cliente_nome, c.email as cliente_email
      FROM agendamentos a
      LEFT JOIN servicos s ON a.servico = s.id
      LEFT JOIN clientes c ON a.cliente = c.nome
      WHERE a.user_id = ?
    `;
    
    const params = [userId];
    
    if (data) {
      query += ' AND DATE(a.data) = ?';
      params.push(data);
    }
    
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY a.data ASC, a.horario ASC';
    
    const agendamentos = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: agendamentos
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
    const { cliente, telefone, email, data, horario, servico, observacoes } = req.body;
    const userId = req.user.id;
    
    if (!cliente || !telefone || !data || !horario || !servico) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: cliente, telefone, data, horario, servico'
      });
    }

    // Verificar se o horário está disponível
    const conflito = await executeQuery(`
      SELECT id FROM agendamentos 
      WHERE user_id = ? AND data = ? AND horario = ? AND status != 'cancelado'
    `, [userId, data, horario]);

    if (conflito.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Horário já ocupado'
      });
    }

    // Buscar preço do serviço
    const servicoInfo = await executeQuery(`
      SELECT preco FROM servicos WHERE id = ? AND user_id = ?
    `, [servico, userId]);

    const valor = servicoInfo[0]?.preco || 0;

    const query = `
      INSERT INTO agendamentos (
        user_id, cliente, telefone, email, data, horario, servico, valor, observacoes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmado')
    `;
    
    const result = await executeQuery(query, [
      userId, cliente, telefone, email, data, horario, servico, valor, observacoes
    ]);

    // Log da ação
    await executeQuery(`
      INSERT INTO agendamento_logs (agendamento_id, acao, detalhes)
      VALUES (?, 'criado', ?)
    `, [result.insertId, `Agendamento criado via sistema para ${cliente}`]);
    
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
    const { status, pago, metodo_pagamento, observacoes, data, horario } = req.body;
    const userId = req.user.id;
    
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

    if (data !== undefined) {
      updateFields.push('data = ?');
      updateValues.push(data);
    }

    if (horario !== undefined) {
      updateFields.push('horario = ?');
      updateValues.push(horario);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar'
      });
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(id, userId);
    
    const query = `
      UPDATE agendamentos 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND user_id = ?
    `;
    
    const result = await executeQuery(query, updateValues);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agendamento não encontrado'
      });
    }

    // Log da ação
    await executeQuery(`
      INSERT INTO agendamento_logs (agendamento_id, acao, detalhes)
      VALUES (?, 'atualizado', ?)
    `, [id, `Agendamento atualizado: ${JSON.stringify(req.body)}`]);
    
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

// DELETE /api/barbearia/agendamentos/:id - Cancelar agendamento
router.delete('/agendamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await executeQuery(`
      UPDATE agendamentos 
      SET status = 'cancelado', updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agendamento não encontrado'
      });
    }

    // Log da ação
    await executeQuery(`
      INSERT INTO agendamento_logs (agendamento_id, acao, detalhes)
      VALUES (?, 'cancelado', 'Agendamento cancelado via sistema')
    `, [id]);

    res.json({
      success: true,
      message: 'Agendamento cancelado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ==================== SERVIÇOS ====================

// GET /api/barbearia/servicos - Listar serviços
router.get('/servicos', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const servicos = await executeQuery(`
      SELECT id, nome, descricao, preco, duracao, is_active, created_at, updated_at
      FROM servicos 
      WHERE user_id = ?
      ORDER BY nome ASC
    `, [userId]);
    
    res.json({
      success: true,
      data: servicos
    });
  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/barbearia/servicos - Criar serviço
router.post('/servicos', async (req, res) => {
  try {
    const { nome, descricao, preco, duracao } = req.body;
    const userId = req.user.id;
    
    if (!nome || !preco || !duracao) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: nome, preco, duracao'
      });
    }

    const result = await executeQuery(`
      INSERT INTO servicos (user_id, nome, descricao, preco, duracao)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, nome, descricao, preco, duracao]);
    
    res.json({
      success: true,
      data: { id: result.insertId },
      message: 'Serviço criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar serviço:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ==================== CLIENTES ====================

// GET /api/barbearia/clientes - Listar clientes
router.get('/clientes', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const clientes = await executeQuery(`
      SELECT id, nome, telefone, email, data_nascimento, observacoes, is_active, created_at
      FROM clientes 
      WHERE user_id = ?
      ORDER BY nome ASC
    `, [userId]);
    
    res.json({
      success: true,
      data: clientes
    });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/barbearia/clientes - Criar cliente
router.post('/clientes', async (req, res) => {
  try {
    const { nome, telefone, email, data_nascimento, observacoes } = req.body;
    const userId = req.user.id;
    
    if (!nome || !telefone) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: nome, telefone'
      });
    }

    const result = await executeQuery(`
      INSERT INTO clientes (user_id, nome, telefone, email, data_nascimento, observacoes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, nome, telefone, email, data_nascimento, observacoes]);
    
    res.json({
      success: true,
      data: { id: result.insertId },
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ==================== CONFIGURAÇÕES ====================

// GET /api/barbearia/configuracao - Obter configurações
router.get('/configuracao', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const config = await executeQuery(`
      SELECT * FROM barbearia_config WHERE user_id = ?
    `, [userId]);

    const horarios = await executeQuery(`
      SELECT * FROM horarios_funcionamento WHERE user_id = ? ORDER BY 
      FIELD(dia_semana, 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo')
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        config: config[0] || {},
        horarios: horarios
      }
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
    const userId = req.user.id;
    const { config, horarios, gemini_api_key } = req.body;
    
    // Atualizar configurações gerais
    if (config) {
      await executeQuery(`
        INSERT INTO barbearia_config (
          user_id, nome_barbearia, endereco, telefone, email, whatsapp, 
          intervalo_atendimento, antecedencia_minima, gemini_api_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          nome_barbearia = VALUES(nome_barbearia),
          endereco = VALUES(endereco),
          telefone = VALUES(telefone),
          email = VALUES(email),
          whatsapp = VALUES(whatsapp),
          intervalo_atendimento = VALUES(intervalo_atendimento),
          antecedencia_minima = VALUES(antecedencia_minima),
          gemini_api_key = VALUES(gemini_api_key),
          updated_at = NOW()
      `, [
        userId, config.nome_barbearia, config.endereco, config.telefone,
        config.email, config.whatsapp, config.intervalo_atendimento,
        config.antecedencia_minima, gemini_api_key
      ]);
    }

    // Atualizar horários de funcionamento
    if (horarios && Array.isArray(horarios)) {
      for (const horario of horarios) {
        await executeQuery(`
          INSERT INTO horarios_funcionamento (
            user_id, dia_semana, horario_inicio, horario_fim, intervalo_inicio, intervalo_fim
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            horario_inicio = VALUES(horario_inicio),
            horario_fim = VALUES(horario_fim),
            intervalo_inicio = VALUES(intervalo_inicio),
            intervalo_fim = VALUES(intervalo_fim),
            updated_at = NOW()
        `, [
          userId, horario.dia_semana, horario.horario_inicio, horario.horario_fim,
          horario.intervalo_inicio, horario.intervalo_fim
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

// ==================== CHAT IA PARA AGENDAMENTOS ====================

// POST /api/barbearia/chat - Chat IA para agendamentos
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mensagem é obrigatória'
      });
    }

    // Buscar configuração da barbearia
    const config = await executeQuery(`
      SELECT * FROM barbearia_config WHERE user_id = ?
    `, [userId]);

    if (!config[0] || !config[0].gemini_api_key) {
      return res.status(400).json({
        success: false,
        error: 'Configure a API Key do Gemini primeiro'
      });
    }

    // Buscar serviços disponíveis
    const servicos = await executeQuery(`
      SELECT nome, preco, duracao FROM servicos WHERE user_id = ? AND is_active = true
    `, [userId]);

    // Buscar horários de funcionamento
    const horarios = await executeQuery(`
      SELECT dia_semana, horario_inicio, horario_fim FROM horarios_funcionamento 
      WHERE user_id = ? AND is_active = true
    `, [userId]);

    // Buscar agendamentos do dia atual e próximos dias
    const agendamentosHoje = await executeQuery(`
      SELECT data, horario FROM agendamentos 
      WHERE user_id = ? AND data >= CURDATE() AND status != 'cancelado'
      ORDER BY data, horario
    `, [userId]);

    // Construir prompt contextual
    const systemPrompt = `Você é um assistente virtual da ${config[0].nome_barbearia}.

INFORMAÇÕES DA BARBEARIA:
- Nome: ${config[0].nome_barbearia}
- Endereço: ${config[0].endereco}
- Telefone: ${config[0].telefone}
- WhatsApp: ${config[0].whatsapp}

SERVIÇOS DISPONÍVEIS:
${servicos.map(s => `- ${s.nome}: R$ ${s.preco} (${s.duracao} min)`).join('\n')}

HORÁRIOS DE FUNCIONAMENTO:
${horarios.map(h => `- ${h.dia_semana}: ${h.horario_inicio} às ${h.horario_fim}`).join('\n')}

REGRAS PARA AGENDAMENTO:
- Intervalo entre atendimentos: ${config[0].intervalo_atendimento} minutos
- Antecedência mínima: ${config[0].antecedencia_minima} minutos
- Não agendar em horários já ocupados

HORÁRIOS JÁ OCUPADOS (próximos dias):
${agendamentosHoje.map(a => `- ${a.data} às ${a.horario}`).join('\n')}

INSTRUÇÕES:
1. Seja cordial e profissional
2. Quando o cliente quiser agendar, colete: nome, telefone, serviço desejado, data e horário
3. Verifique disponibilidade antes de confirmar
4. Se o horário estiver ocupado, sugira alternativas
5. Confirme todos os dados antes de finalizar
6. Para confirmar o agendamento, responda no formato JSON:
{
  "acao": "agendar",
  "dados": {
    "cliente": "Nome do Cliente",
    "telefone": "(11) 99999-9999",
    "servico": "Nome do Serviço",
    "data": "2024-01-15",
    "horario": "14:30"
  }
}

Responda sempre em português e seja prestativo!`;

    // Chamar IA
    const aiResponse = await AIService.callGemini(
      'gemini-1.5-flash',
      message,
      systemPrompt,
      0.7,
      1000,
      config[0].gemini_api_key
    );

    // Verificar se a resposta contém uma ação de agendamento
    let agendamentoCriado = null;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*"acao":\s*"agendar"[\s\S]*\}/);
      if (jsonMatch) {
        const agendamentoData = JSON.parse(jsonMatch[0]);
        if (agendamentoData.acao === 'agendar' && agendamentoData.dados) {
          // Buscar ID do serviço
          const servico = await executeQuery(`
            SELECT id, preco FROM servicos 
            WHERE user_id = ? AND nome LIKE ? AND is_active = true
          `, [userId, `%${agendamentoData.dados.servico}%`]);

          if (servico[0]) {
            // Criar agendamento automaticamente
            const result = await executeQuery(`
              INSERT INTO agendamentos (
                user_id, cliente, telefone, data, horario, servico, valor, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmado')
            `, [
              userId,
              agendamentoData.dados.cliente,
              agendamentoData.dados.telefone,
              agendamentoData.dados.data,
              agendamentoData.dados.horario,
              servico[0].id,
              servico[0].preco
            ]);

            // Log da ação
            await executeQuery(`
              INSERT INTO agendamento_logs (agendamento_id, acao, detalhes)
              VALUES (?, 'criado', 'Agendamento criado via chat IA')
            `, [result.insertId]);

            agendamentoCriado = {
              id: result.insertId,
              ...agendamentoData.dados,
              valor: servico[0].preco
            };
          }
        }
      }
    } catch (error) {
      console.log('Não foi possível processar agendamento automático:', error.message);
    }

    res.json({
      success: true,
      data: {
        response: aiResponse,
        agendamento_criado: agendamentoCriado
      }
    });

  } catch (error) {
    console.error('Erro no chat IA:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// ==================== RELATÓRIOS ====================

// GET /api/barbearia/relatorios - Relatórios e estatísticas
router.get('/relatorios', async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodo = '30' } = req.query;

    // Agendamentos por período
    const agendamentos = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'confirmado' THEN 1 END) as confirmados,
        COUNT(CASE WHEN status = 'concluido' THEN 1 END) as concluidos,
        COUNT(CASE WHEN status = 'cancelado' THEN 1 END) as cancelados,
        SUM(CASE WHEN pago = true THEN valor ELSE 0 END) as faturamento,
        AVG(valor) as ticket_medio
      FROM agendamentos 
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [userId, periodo]);

    // Serviços mais procurados
    const servicosPopulares = await executeQuery(`
      SELECT 
        s.nome,
        COUNT(a.id) as quantidade,
        SUM(a.valor) as receita
      FROM agendamentos a
      JOIN servicos s ON a.servico = s.id
      WHERE a.user_id = ? AND a.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY s.id, s.nome
      ORDER BY quantidade DESC
      LIMIT 5
    `, [userId, periodo]);

    // Agendamentos por dia
    const agendamentosPorDia = await executeQuery(`
      SELECT 
        DATE(data) as data,
        COUNT(*) as quantidade,
        SUM(valor) as receita
      FROM agendamentos 
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(data)
      ORDER BY data DESC
    `, [userId, periodo]);

    res.json({
      success: true,
      data: {
        resumo: agendamentos[0],
        servicos_populares: servicosPopulares,
        agendamentos_por_dia: agendamentosPorDia
      }
    });
  } catch (error) {
    console.error('Erro ao gerar relatórios:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;