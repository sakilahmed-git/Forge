import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) { throw new Error('MONGODB_URI environment variable is required'); }
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use((err: Error, req: Request, res: Response, next: NextFunction) => { console.error(err); res.status(500).json({ error: err.message || 'Internal server error' }); });
async function startServer(): Promise<void> { await mongoose.connect(mongoUri); console.log('MongoDB connected'); app.listen(port, () => { console.log(`Server running on port ${port}`); }); }
void startServer();