import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import customerRoutes from './routes/customers';
import itemRoutes from './routes/items';
import invoiceRoutes from './routes/invoices';
import companyRoutes from './routes/company';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

// app.use(cors());
app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://invoice-generator-roan-seven.vercel.app',
  ],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/customers', customerRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/company', companyRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
});