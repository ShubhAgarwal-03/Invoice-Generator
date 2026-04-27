import { Router, Request, Response } from 'express';
import CompanyConfig from '../models/CompanyConfig';

const router = Router();

router.get('/', async (_, res: Response) => {
  try {
    const config = await CompanyConfig.findOne();
    res.json(config ?? {});
  } catch {
    res.status(500).json({ error: 'Failed to fetch company config' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, address, email, phone, logo_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Company name is required' });

    const existing = await CompanyConfig.findOne();
    if (existing) {
      const updated = await CompanyConfig.findByIdAndUpdate(
        existing._id,
        { name, address, email, phone, logo_url },
        { new: true }
      );
      return res.json(updated);
    }

    const config = await CompanyConfig.create({ name, address, email, phone, logo_url });
    res.status(201).json(config);
  } catch {
    res.status(500).json({ error: 'Failed to save company config' });
  }
});

export default router;