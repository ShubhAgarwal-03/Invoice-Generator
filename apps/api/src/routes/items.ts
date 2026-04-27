import { Router, Request, Response } from 'express';
import Item from '../models/Item';

const router = Router();

router.get('/', async (_, res: Response) => {
  try {
    const items = await Item.find({ is_deleted: false }).sort({ createdAt: -1 });
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, unit_price, tax_percent } = req.body;
    if (!name || unit_price === undefined) {
      return res.status(400).json({ error: 'name and unit_price are required' });
    }
    const item = await Item.create({ name, description, unit_price, tax_percent: tax_percent ?? 0 });
    res.status(201).json(item);
  } catch {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      req.body,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;