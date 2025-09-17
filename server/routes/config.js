import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { executeQuery } from '../config/database.js';

const router = express.Router();

// Aplicar middleware de autenticação
router.use(authMiddleware);

// Obter configurações do usuário
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    
    const configs = await executeQuery(
      'SELECT chave, valor FROM configuracoes WHERE user_id = ?',
      [userId]
    );
    
    const configObj = {};
    configs.forEach(config => {
      configObj[config.chave] = config.valor;
    });
    
    res.json({
      success: true,
      data: configObj
    });
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Salvar configuração
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { chave, valor } = req.body;
    
    if (!chave) {
      return res.status(400).json({
        success: false,
        error: 'Chave é obrigatória'
      });
    }
    
    await executeQuery(`
      INSERT INTO configuracoes (user_id, chave, valor)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()
    `, [userId, chave, valor]);
    
    res.json({
      success: true,
      message: 'Configuração salva com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Testar API Key
router.post('/test-api', async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Provedor e API Key são obrigatórios'
      });
    }
    
    let testResult = false;
    let message = '';
    
    try {
      switch (provider) {
        case 'openai':
          // Teste básico da API OpenAI
          const openaiResponse = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          testResult = openaiResponse.ok;
          message = testResult ? 'OpenAI API funcionando' : 'Erro na API OpenAI';
          break;
          
        case 'gemini':
          // Teste básico da API Gemini
          const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          testResult = geminiResponse.ok;
          message = testResult ? 'Gemini API funcionando' : 'Erro na API Gemini';
          break;
          
        case 'huggingface':
          // Teste básico da API Hugging Face
          const hfResponse = await fetch('https://api-inference.huggingface.co/models/gpt2', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          testResult = hfResponse.ok;
          message = testResult ? 'Hugging Face API funcionando' : 'Erro na API Hugging Face';
          break;
          
        default:
          message = 'Provedor não suportado';
      }
    } catch (error) {
      testResult = false;
      message = `Erro ao testar API: ${error.message}`;
    }
    
    res.json({
      success: testResult,
      message,
      provider
    });
  } catch (error) {
    console.error('Erro ao testar API:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;