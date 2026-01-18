import cors from 'cors';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { type DocsConfig, loadConfig, validateEnv } from '../core/config';
import { setupAuth } from './auth';
import authRoutes from './routes/auth';
import docsRoutes from './routes/docs';
import draftsRoutes from './routes/drafts';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      config?: DocsConfig;
    }
  }
}

export async function createServer(): Promise<express.Application> {
  // Validate environment
  validateEnv();

  // Load config
  const config = await loadConfig();

  // Create Express app
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        // In development, allow any localhost port
        if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
          return callback(null, true);
        }

        // In production, check against APP_URL
        if (origin === process.env.APP_URL) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Session
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
      },
    })
  );

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup auth strategies based on config
  setupAuth(config);

  // Store config in request
  app.use((req, res, next) => {
    req.config = config;
    next();
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/drafts', draftsRoutes);
  app.use('/api/docs', docsRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      authMode: config.auth.mode,
    });
  });

  // API info
  app.get('/api', (req, res) => {
    res.json({
      name: 'DocPush API',
      version: '1.0.0',
      authMode: config.auth.mode,
      endpoints: [
        'GET /api/health',
        'GET /api/auth/me',
        'POST /api/auth/logout',
        'POST /api/auth/magic-link',
        'POST /api/auth/verify',
        'GET /api/auth/github',
        'GET /api/auth/google',
        'GET /api/docs/tree',
        'GET /api/docs/content',
        'GET /api/drafts',
        'POST /api/drafts',
        'PUT /api/drafts/:id',
        'POST /api/drafts/:id/approve',
        'POST /api/drafts/:id/reject',
      ],
    });
  });

  // Error handler
  app.use(
    (
      err: Error & { status?: number },
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('Server error:', err);
      res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
      });
    }
  );

  return app;
}

export async function startServer(port = 3000): Promise<void> {
  const app = await createServer();

  app.listen(port, () => {
    console.log(`🚀 DocPush server running on http://localhost:${port}`);
    console.log(`📝 API available at http://localhost:${port}/api`);
    console.log(`❤️  Health check at http://localhost:${port}/api/health`);
  });
}
