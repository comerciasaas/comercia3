import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server as socketIo } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import SocketHandlers from './handlers/socketHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '.env') });

import { testConnection } from './config/database.js';
import { 
  sanitizeInput, 
  errorHandler, 
  notFoundHandler 
} from './middleware/validation.js';

// Import routes
import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import adminRoutes from './routes/admin.js';
import conversationRoutes from './routes/conversations.js';
import chatRoutes from './routes/chat.js';
import barbeariaRoutes from './routes/barbearia.js';

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Input sanitization
app.use(sanitizeInput);

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/barbearia', barbeariaRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Initialize Socket.IO handlers
const socketHandlers = new SocketHandlers(io);
socketHandlers.initialize();

// Make io and socketHandlers available to routes
app.set('io', io);
app.set('socketHandlers', socketHandlers);

// 404 handler
app.use(notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 Received ${signal}. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.log('❌ Forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.log('⚠️  Starting server without database connection');
      console.log('📝 Please check your database configuration in .env file');
    }
    
    server.listen(PORT, () => {
      console.log('\n🚀 ===================================');
      console.log(`🚀 Dinâmica Server Running`);
      console.log(`🚀 Port: ${PORT}`);
      console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚀 ===================================`);
      console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
      console.log(`🌐 Frontend: http://localhost:5173`);
      console.log('🚀 ===================================\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, server, io };