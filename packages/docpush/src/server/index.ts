import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { loadConfig, validateEnv } from '../core/config';
import { initDatabase } from './db';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      config?: any;
    }
  }
}

export async function createServer(): Promise<express.Application> {
  // Validate environment
  validateEnv();

  // Load config
  const config = await loadConfig();

  // Initialize database
  await initDatabase();

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.APP_URL,
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Session
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  }));

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Store config in request
  app.use((req, res, next) => {
    req.config = config;
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // API info
  app.get('/api', (req, res) => {
    res.json({
      name: 'DocPush API',
      version: '1.0.0',
      endpoints: [
        'GET /api/health',
        'GET /api/docs/tree',
        'GET /api/docs/content',
        'GET /api/drafts',
        'POST /api/drafts',
        'PUT /api/drafts/:id',
        'POST /api/drafts/:id/approve',
        'POST /api/drafts/:id/reject'
      ]
    });
  });

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error'
    });
  });

  return app;
}

export async function startServer(port: number = 3000): Promise<void> {
  const app = await createServer();

  app.listen(port, () => {
    console.log(`🚀 DocPush server running on http://localhost:${port}`);
    console.log(`📝 API available at http://localhost:${port}/api`);
    console.log(`❤️  Health check at http://localhost:${port}/api/health`);
  });
}
