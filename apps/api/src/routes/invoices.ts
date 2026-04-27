import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice';
import Customer from '../models/Customer';
import { generateInvoiceNumber } from '../utils/invoiceNumber';
import { generateInvoicePdf } from '../services/pdfService';
import CompanyConfig from '../models/CompanyConfig';
const router = Router();



// LIST with filters + pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, from, to, search, page = '1', limit = '20' } = req.query;

    const filter: Record<string, unknown> = { is_deleted: false };
    if (status && status !== 'all') filter.status = status;
    if (from || to) {
      filter.issue_date = {};
      if (from) (filter.issue_date as Record<string, unknown>)['$gte'] = new Date(from as string);
      if (to) (filter.issue_date as Record<string, unknown>)['$lte'] = new Date(to as string);
    }
    if (search) {
      const regex = new RegExp(search as string, 'i');
      filter['$or'] = [{ invoice_number: regex }, { 'customer_snapshot.name': regex }];
    }

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      invoices,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET one
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// CREATE
router.post('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, issue_date, due_date, items, notes } = req.body;

    if (!customer_id || !items?.length) {
      return res.status(400).json({ error: 'customer_id and at least one item are required' });
    }

    const customer = await Customer.findOne({ _id: customer_id, is_deleted: false });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const customer_snapshot = {
      _id: customer._id.toString(),
      name: customer.name,
      email: customer.email,
      address: customer.address,
      gstin: customer.gstin,
      country: customer.country,
      currency: customer.currency,
    };

    let subtotal = 0, tax_total = 0;
    const processedItems = items.map((item: { description: string; quantity: number; unit_price: number; tax_percent: number }) => {
      const base = item.quantity * item.unit_price;
      const tax = base * (item.tax_percent / 100);
      subtotal += base;
      tax_total += tax;
      return { ...item, line_total: parseFloat((base + tax).toFixed(2)) };
    });

    const invoice_number = await generateInvoiceNumber();
    const invoice = await Invoice.create({
      invoice_number,
      customer_id,
      customer_snapshot,
      issue_date: issue_date ?? new Date(),
      due_date: due_date ?? null,
      items: processedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax_total: parseFloat(tax_total.toFixed(2)),
      total: parseFloat((subtotal + tax_total).toFixed(2)),
      notes,
    });

    res.status(201).json(invoice);
  } catch {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// UPDATE
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const { customer_id, issue_date, due_date, items, notes, status } = req.body;

    // Re-snapshot customer
    const customer = await Customer.findOne({ _id: customer_id, is_deleted: false });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const customer_snapshot = {
      _id: customer._id.toString(),
      name: customer.name,
      email: customer.email,
      address: customer.address,
      gstin: customer.gstin,
      country: customer.country,
      currency: customer.currency,
    };

    let subtotal = 0, tax_total = 0;
    const processedItems = items.map((item: { description: string; quantity: number; unit_price: number; tax_percent: number }) => {
      const base = item.quantity * item.unit_price;
      const tax = base * (item.tax_percent / 100);
      subtotal += base;
      tax_total += tax;
      return { ...item, line_total: parseFloat((base + tax).toFixed(2)) };
    });

    const updated = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        customer_id,
        customer_snapshot,
        issue_date,
        due_date: due_date ?? null,
        items: processedItems,
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax_total: parseFloat(tax_total.toFixed(2)),
        total: parseFloat((subtotal + tax_total).toFixed(2)),
        notes,
        status,
      },
      { new: true }
    );

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// DUPLICATE
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const source = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!source) return res.status(404).json({ error: 'Invoice not found' });

    const invoice_number = await generateInvoiceNumber();
    const duplicate = await Invoice.create({
      invoice_number,
      customer_id: source.customer_id,
      customer_snapshot: source.customer_snapshot,
      status: 'draft',
      issue_date: new Date(),
      due_date: null,
      items: source.items,
      subtotal: source.subtotal,
      tax_total: source.tax_total,
      total: source.total,
      notes: source.notes,
    });

    res.status(201).json(duplicate);
  } catch {
    res.status(500).json({ error: 'Failed to duplicate invoice' });
  }
});

// PATCH status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['draft', 'sent', 'paid'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { status },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// SOFT DELETE
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: `Invoice ${invoice.invoice_number} deleted` });
  } catch {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});



// PDF download
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false }).lean();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const company = await CompanyConfig.findOne().lean();
    const pdfBuffer = await generateInvoicePdf(invoice, company);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${(invoice as any).invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});


export default router;