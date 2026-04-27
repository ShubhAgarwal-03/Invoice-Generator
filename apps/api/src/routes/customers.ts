import { Router, Request, Response } from 'express';
import Customer from '../models/Customer';
import { getCurrencyForCountry } from '../utils/countryCurrency';

const router = Router();

// GET all
router.get('/', async (_, res: Response) => {
  try {
    const customers = await Customer.find({ is_deleted: false }).sort({ createdAt: -1 });
    res.json(customers);
  } catch {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET one
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, is_deleted: false });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// POST
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, country, gstin } = req.body;
    if (!name || !country) return res.status(400).json({ error: 'name and country are required' });
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const currency = getCurrencyForCountry(country);
    const customer = await Customer.create({ name, email, phone, address, country, currency, gstin });
    res.status(201).json(customer);
  } catch {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, country, gstin } = req.body;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const updates: Record<string, unknown> = { name, email, phone, address, country, gstin };
    if (country) updates.currency = getCurrencyForCountry(country);

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      updates,
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE (soft)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true },
      { new: true }
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;