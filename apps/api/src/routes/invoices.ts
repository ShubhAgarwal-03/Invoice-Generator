import { Router, Request, Response } from 'express';
import Invoice from '../models/Invoice';
import Customer from '../models/Customer';
import CompanyConfig from '../models/CompanyConfig';
import { generateInvoiceNumber } from '../utils/invoiceNumber';
import { generateInvoicePdf } from '../services/pdfService';

const router = Router();



// Helper to process line items and totals
const calculateTotals = (items: any[], discount_percent: number = 0) => {
  let subtotal = 0, tax_total = 0;
  const processedItems = items.map((item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;

    const base = qty * price;
    let itemTaxTotal = 0;
    
    // Process multiple taxes
    const processedTaxes = (item.taxes || []).map((tax: any) => {
      const taxRate = Number(tax.percent) || 0;
      const taxAmount = base * (taxRate / 100);
      itemTaxTotal += taxAmount;
      return {
        tax_id: tax.tax_id,
        name: tax.name,
        percent: taxRate,
        tax_amount: parseFloat(taxAmount.toFixed(2))
      };
    });

    subtotal += base;
    tax_total += itemTaxTotal;

    return { 
      ...item, 
      taxes: processedTaxes,
      line_total: parseFloat((base + itemTaxTotal).toFixed(2)) 
    };
  });

  const discount_amount = subtotal * (discount_percent / 100);
  const total = subtotal - discount_amount + tax_total;

  return {
    processedItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount_amount: parseFloat(discount_amount.toFixed(2)),
    tax_total: parseFloat(tax_total.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
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
      filter.$or = [{ invoice_number: regex }, { 'customer_snapshot.customer_name': regex }, { 'customer_snapshot.company_name': regex }];
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
    const { 
      customer_id, po_so_number, issue_date, due_date, items, notes, shipping_address, is_interstate,
      discount_percent, tax_exempt, payment_terms, terms_and_conditions, auto_payment_reminder, created_by
    } = req.body;

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
      customer_code: customer.customer_code,
      customer_type: customer.customer_type,
      customer_name: customer.customer_name,
      company_name: customer.company_name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      billing_address_1: customer.billing_address_1,
      billing_address_2: customer.billing_address_2,
      city: customer.city,
      state: customer.state,
      postal_code: customer.postal_code,
      gstin: customer.gstin,
      pan: customer.pan,
      registration_number: customer.registration_number,
      country: customer.country,
      currency: customer.currency,
    };

    // 3. Process Totals
    const dPercent = Number(discount_percent) || 0;
    const { processedItems, subtotal, discount_amount, tax_total, total } = calculateTotals(items, dPercent);
    const invoice_number = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoice_number,
      po_so_number,
      customer_id,
      customer_snapshot,
      issue_date: issue_date ?? new Date(),
      shipping_address: shipping_address ?? null,
      due_date: due_date ?? null,
      items: processedItems,
      is_interstate: is_interstate ?? true,
      subtotal,
      discount_percent: dPercent,
      discount_amount,
      tax_total,
      total,
      notes,
      tax_exempt,
      payment_terms,
      terms_and_conditions,
      auto_payment_reminder,
      created_by
    });

    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// UPDATE
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { 
      customer_id, po_so_number, items, due_date, issue_date, notes, status, shipping_address, is_interstate,
      discount_percent, tax_exempt, payment_terms, terms_and_conditions, auto_payment_reminder
    } = req.body;

    // 1. Validation
    if (due_date && new Date(due_date) < new Date(new Date().setHours(0,0,0,0))) {
      return res.status(400).json({ error: 'Due date cannot be in the past' });
    }

    const customer = await Customer.findOne({ _id: customer_id, is_deleted: false });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const dPercent = Number(discount_percent) || 0;
    const { processedItems, subtotal, discount_amount, tax_total, total } = calculateTotals(items, dPercent);

    const updated = await Invoice.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      {
        customer_id,
        po_so_number,
        customer_snapshot: {
          _id: customer._id.toString(),
          customer_code: customer.customer_code,
          customer_type: customer.customer_type,
          customer_name: customer.customer_name,
          company_name: customer.company_name,
          email: customer.email,
          phone: customer.phone,  
          address: customer.address,
          billing_address_1: customer.billing_address_1,
          billing_address_2: customer.billing_address_2,
          city: customer.city,
          state: customer.state,
          postal_code: customer.postal_code,
          gstin: customer.gstin,
          pan: customer.pan,
          registration_number: customer.registration_number,
          country: customer.country,
          currency: customer.currency,
        },
        issue_date,
        due_date: due_date ?? null,
        items: processedItems,
        subtotal,
        discount_percent: dPercent,
        discount_amount,
        tax_total,
        total,
        notes,
        status,
        shipping_address: shipping_address ?? null,
        is_interstate: is_interstate ?? true,
        tax_exempt,
        payment_terms,
        terms_and_conditions,
        auto_payment_reminder
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

// STATUS UPDATE
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'sent', 'paid'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be draft, sent, or paid.' });
    }
    const updated = await Invoice.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
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