import dotenv from 'dotenv';

dotenv.config();
console.log('KEY:', process.env.GROQ_API_KEY?.slice(0, 15));
import cors from 'cors';

import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { Server } from 'socket.io';
import { attachSocketBridge, createForgeEmitter, getRunEvents } from './dashboard/events';
import forgeRoutes from './routes/forge.routes';


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false
  },
  transports: ['polling', 'websocket'],
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/forge', forgeRoutes);

app.get('/', (req, res) => res.json({ status: 'ok', service: 'FORGE', message: 'Welcome to FORGE API' }));
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'FORGE' }));

io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);

  socket.on('join:run', (runId: string) => {
    socket.join(runId);
    console.log(`Socket ${socket.id} joined run ${runId}`);

    const pastEvents = getRunEvents(runId);
    if (pastEvents.length > 0) {
      socket.emit('run:history', pastEvents);
    }
  });

  socket.on('leave:run', (runId: string) => {
    socket.leave(runId);
  });

  socket.on('disconnect', () => {
    console.log('Dashboard disconnected:', socket.id);
  });
});

app.locals.io = io;
app.locals.createForgeEmitter = createForgeEmitter;
app.locals.attachSocketBridge = attachSocketBridge;

app.use(
  (
    err: Error & { status?: number; runId?: string },
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Global error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      runId: err.runId,
    });
  }
);

async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/forge', {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✓ MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed. FORGE server will keep running:', err);
  }
}

function start(): void {
  const port = process.env.PORT || 3001;

  mongoose.connection.on('connected', () => {
    console.log('✓ MongoDB connection active');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  httpServer.listen(port, () => {
    console.log(`✓ FORGE server running on http://localhost:${port}`);
    console.log('✓ Socket.io ready');
    console.log('✓ Dashboard: http://localhost:3000');
  });

  void connectMongo();
}

start();
