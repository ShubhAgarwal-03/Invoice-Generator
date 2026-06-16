import { Router, Request, Response } from 'express';
import Customer from '../models/Customer';
import { getCurrencyForCountry } from '../utils/countryCurrency';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import CompanyConfig from '../models/CompanyConfig';
import { generateLedgerPdf } from '../services/ledgerPdfServices';

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
    const { 
      customer_code, customer_type, customer_name, company_name, 
      email, phone, address, billing_address_1, billing_address_2, city, state, postal_code,
      country, gstin, pan, registration_number 
    } = req.body;
    
    if (!customer_name || !country) return res.status(400).json({ error: 'customer_name and country are required' });
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const currency = getCurrencyForCountry(country);
    const customer = await Customer.create({ 
      customer_code, customer_type, customer_name, company_name, 
      email, phone, address, billing_address_1, billing_address_2, city, state, postal_code,
      country, currency, gstin, pan, registration_number
    });
    res.status(201).json(customer);
  } catch {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { 
      customer_code, customer_type, customer_name, company_name, 
      email, phone, address, billing_address_1, billing_address_2, city, state, postal_code,
      country, gstin, pan, registration_number 
    } = req.body;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const updates: Record<string, unknown> = { 
      customer_code, customer_type, customer_name, company_name, 
      email, phone, address, billing_address_1, billing_address_2, city, state, postal_code,
      country, gstin, pan, registration_number
    };
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

// ── LEDGER ────────────────────────────────────────────

router.get('/:id/ledger', async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, is_deleted: false });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const invoices = await Invoice.find({ customer_id: req.params.id, is_deleted: false })
      .sort({ issue_date: 1, createdAt: 1 });

    const rows: any[] = [];
    let balance = 0;

    for (const inv of invoices) {
      const payments = await Payment.find({ invoice_id: inv._id }).sort({ paid_at: 1 });

      rows.push({
        date: inv.issue_date,
        description: `Invoice ${inv.invoice_number}`,
        invoice_number: inv.invoice_number,
        invoice_id: inv._id.toString(),
        type: 'invoice',
        debit: inv.total,
        credit: 0,
      });

      for (const p of payments) {
        rows.push({
          date: p.paid_at,
          description: `Payment${(p as any).notes ? ` – ${(p as any).notes}` : ''}`,
          invoice_number: inv.invoice_number,
          invoice_id: inv._id.toString(),
          type: 'payment',
          debit: 0,
          credit: p.amount,
        });
      }
    }

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const ledgerRows = rows.map(row => {
      balance = parseFloat((balance + row.debit - row.credit).toFixed(2));
      return { ...row, balance };
    });

    const allPayments = await Payment.find({
      invoice_id: { $in: invoices.map(i => i._id) }
    });

    const summary = {
      total_invoiced: parseFloat(invoices.reduce((s, inv) => s + inv.total, 0).toFixed(2)),
      total_paid: parseFloat(allPayments.reduce((s: number, p: any) => s + p.amount, 0).toFixed(2)),
      closing_balance: balance,
      currency: customer.currency,
      country: customer.country,
    };

    res.json({ customer, rows: ledgerRows, summary });
  } catch (err) {
    console.error('Ledger error:', err);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

router.get('/:id/statement/pdf', async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, is_deleted: false }).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const company = await CompanyConfig.findOne().lean();
    const invoices = await Invoice.find({ customer_id: req.params.id, is_deleted: false })
      .sort({ issue_date: 1, createdAt: 1 }).lean();

    const rows: any[] = [];
    let balance = 0;

    for (const inv of invoices) {
      const payments = await Payment.find({ invoice_id: inv._id }).sort({ paid_at: 1 }).lean();
      rows.push({
        date: inv.issue_date,
        description: `Invoice ${inv.invoice_number}`,
        invoice_number: inv.invoice_number,
        type: 'invoice',
        debit: inv.total,
        credit: 0,
      });
      for (const p of payments) {
        rows.push({
          date: (p as any).paid_at,
          description: `Payment${(p as any).notes ? ` – ${(p as any).notes}` : ''}`,
          invoice_number: inv.invoice_number,
          type: 'payment',
          debit: 0,
          credit: (p as any).amount,
        });
      }
    }

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const ledgerRows = rows.map(row => {
      balance = parseFloat((balance + row.debit - row.credit).toFixed(2));
      return { ...row, balance };
    });

    const allPayments = await Payment.find({
      invoice_id: { $in: invoices.map((i: any) => i._id) }
    }).lean();

    const summary = {
      total_invoiced: parseFloat(invoices.reduce((s, inv) => s + inv.total, 0).toFixed(2)),
      total_paid: parseFloat(allPayments.reduce((s: number, p: any) => s + p.amount, 0).toFixed(2)),
      closing_balance: balance,
      currency: (customer as any).currency,
      country: (customer as any).country,
    };

    const pdfBuffer = await generateLedgerPdf(customer, ledgerRows, summary, company);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="statement-${(customer as any).customer_name.replace(/\s+/g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Statement PDF error:', err);
    res.status(500).json({ error: 'Failed to generate statement PDF' });
  }
});


export default router;