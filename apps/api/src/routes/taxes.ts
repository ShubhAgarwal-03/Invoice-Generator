import { Router, Request, Response } from 'express';
import Tax from '../models/Tax';

const router = Router();

// GET all
router.get('/', async (_, res: Response) => {
  try {
    const taxes = await Tax.find({ is_deleted: false }).sort({ createdAt: -1 });
    res.json(taxes);
  } catch {
    res.status(500).json({ error: 'Failed to fetch taxes' });
  }
});

// POST
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, percent, tax_id } = req.body;
    if (!name || percent === undefined || !tax_id) return res.status(400).json({ error: 'name, percent, and tax_id are required' });

    const tax = await Tax.create({ name, percent, tax_id });
    res.status(201).json(tax);
  } catch (err: any) {
    if (err.code === 11000) {
       return res.status(400).json({ error: 'Tax ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create tax' });
  }
});

// DELETE (soft)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tax = await Tax.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true },
      { new: true }
    );
    if (!tax) return res.status(404).json({ error: 'Tax not found' });
    res.json({ message: 'Tax deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete tax' });
  }
});

export default router;
