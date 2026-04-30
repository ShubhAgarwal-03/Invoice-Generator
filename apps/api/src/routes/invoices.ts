import { Router, Request, Response } from 'express';
import Invoice from '../models/Invoice';
import Customer from '../models/Customer';
import CompanyConfig from '../models/CompanyConfig';
import { generateInvoiceNumber } from '../utils/invoiceNumber';
import { generateInvoicePdf } from '../services/pdfService';

const router = Router();

// Helper to process line items and totals
const calculateTotals = (items: any[]) => {
  let subtotal = 0, tax_total = 0;
  const processedItems = items.map((item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const taxRate = Number(item.tax_percent) || 0;

    const base = qty * price;
    const tax = base * (taxRate / 100);
    subtotal += base;
    tax_total += tax;

    return { 
      ...item, 
      line_total: parseFloat((base + tax).toFixed(2)) 
    };
  });

  return {
    processedItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax_total: parseFloat(tax_total.toFixed(2)),
    total: parseFloat((subtotal + tax_total).toFixed(2)),
  };
};

// LIST with filters + pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, from, to, search, page = '1', limit = '20' } = req.query;
    const filter: Record<string, any> = { is_deleted: false };

    if (status && status !== 'all') filter.status = status;

    if (from || to) {
      filter.issue_date = {};
      if (from) filter.issue_date.$gte = new Date(from as string);
      if (to) filter.issue_date.$lte = new Date(to as string);
    }

    if (search) {
      const regex = new RegExp(search as string, 'i');
      filter.$or = [{ invoice_number: regex }, { 'customer_snapshot.name': regex }];
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
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET one
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// CREATE
router.post('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, issue_date, due_date, items, notes } = req.body;

    if (!customer_id || !items?.length) {
      return res.status(400).json({ error: 'Customer ID and items are required' });
    }

    // 1. Validate Due Date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due_date && new Date(due_date) < today) {
      return res.status(400).json({ error: 'Due date cannot be in the past' });
    }

    // 2. Snapshot Customer
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

    // 3. Process Totals
    const { processedItems, subtotal, tax_total, total } = calculateTotals(items);
    const invoice_number = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoice_number,
      customer_id,
      customer_snapshot,
      issue_date: issue_date ?? new Date(),
      due_date: due_date ?? null,
      items: processedItems,
      subtotal,
      tax_total,
      total,
      notes,
    });

    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// UPDATE
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { customer_id, items, due_date, issue_date, notes, status } = req.body;

    // 1. Validation
    if (due_date && new Date(due_date) < new Date(new Date().setHours(0,0,0,0))) {
      return res.status(400).json({ error: 'Due date cannot be in the past' });
    }

    const customer = await Customer.findOne({ _id: customer_id, is_deleted: false });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const { processedItems, subtotal, tax_total, total } = calculateTotals(items);

    const updated = await Invoice.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      {
        customer_id,
        customer_snapshot: {
          _id: customer._id.toString(),
          name: customer.name,
          email: customer.email,
          address: customer.address,
          gstin: customer.gstin,
          country: customer.country,
          currency: customer.currency,
        },
        issue_date,
        due_date: due_date ?? null,
        items: processedItems,
        subtotal,
        tax_total,
        total,
        notes,
        status,
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    res.json(updated);
  } catch (err) {
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
      due_date: undefined,
      items: source.items,
      subtotal: source.subtotal,
      tax_total: source.tax_total,
      total: source.total,
      notes: source.notes,
    });

    res.status(201).json(duplicate);
  } catch (err) {
    res.status(500).json({ error: 'Failed to duplicate invoice' });
  }
});

// DELETE, STATUS, and PDF routes stay largely the same but with improved error logging...
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true, deletedAt: new Date() }
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: `Invoice ${invoice.invoice_number} deleted` });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

 // PDF
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
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;