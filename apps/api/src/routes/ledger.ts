import { Router, Request, Response } from 'express';
import Invoice from '../models/Invoice';
import Customer from '../models/Customer';
import Payment from '../models/Payment';
import CompanyConfig from '../models/CompanyConfig';
import { generateLedgerPdf } from '../services/ledgerPdfService';

const router = Router();

// GET /api/customers/:id/ledger
router.get('/:id/ledger', async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, is_deleted: false });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const invoices = await Invoice.find({
      customer_id: req.params.id,
      is_deleted: false,
    }).sort({ issue_date: 1, createdAt: 1 });

    // For each invoice, fetch its payments
    const paymentsByInvoice: Record<string, any[]> = {};
    for (const inv of invoices) {
      const payments = await Payment.find({ invoice_id: inv._id }).sort({ paid_at: 1 });
      paymentsByInvoice[inv._id.toString()] = payments;
    }

    // Build ledger rows — interleave invoices (debits) and payments (credits), sorted by date
    type LedgerRow = {
      date: Date;
      description: string;
      invoice_number?: string;
      invoice_id?: string;
      type: 'invoice' | 'payment';
      debit: number;
      credit: number;
      balance: number;
    };

    const rows: Omit<LedgerRow, 'balance'>[] = [];

    for (const inv of invoices) {
      rows.push({
        date: inv.issue_date,
        description: `Invoice ${inv.invoice_number}`,
        invoice_number: inv.invoice_number,
        invoice_id: inv._id.toString(),
        type: 'invoice',
        debit: inv.total,
        credit: 0,
      });
      for (const p of paymentsByInvoice[inv._id.toString()] ?? []) {
        rows.push({
          date: p.paid_at,
          description: `Payment – ${inv.invoice_number}${p.notes ? ` (${p.notes})` : ''}`,
          invoice_number: inv.invoice_number,
          invoice_id: inv._id.toString(),
          type: 'payment',
          debit: 0,
          credit: p.amount,
        });
      }
    }

    // Sort all rows by date ascending
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute running balance
    let balance = 0;
    const ledgerRows: LedgerRow[] = rows.map(row => {
      balance = parseFloat((balance + row.debit - row.credit).toFixed(2));
      return { ...row, balance };
    });

    const summary = {
      total_invoiced: parseFloat(invoices.reduce((s, inv) => s + inv.total, 0).toFixed(2)),
      total_paid: parseFloat(
        Object.values(paymentsByInvoice)
          .flat()
          .reduce((s: number, p: any) => s + p.amount, 0)
          .toFixed(2)
      ),
      closing_balance: balance,
      currency: customer.currency,
      country: customer.country,
    };

    res.json({ customer, rows: ledgerRows, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

// GET /api/customers/:id/statement/pdf
router.get('/:id/statement/pdf', async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, is_deleted: false }).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const company = await CompanyConfig.findOne().lean();

    // Re-use the same ledger aggregation logic (lean version)
    const invoices = await Invoice.find({ customer_id: req.params.id, is_deleted: false })
      .sort({ issue_date: 1, createdAt: 1 })
      .lean();

    const rows: any[] = [];
    let balance = 0;

    for (const inv of invoices) {
      const payments = await Payment.find({ invoice_id: inv._id }).sort({ paid_at: 1 }).lean();
      const invRow = {
        date: inv.issue_date,
        description: `Invoice ${inv.invoice_number}`,
        invoice_number: inv.invoice_number,
        type: 'invoice',
        debit: inv.total,
        credit: 0,
      };
      const paymentRows = payments.map((p: any) => ({
        date: p.paid_at,
        description: `Payment${p.notes ? ` – ${p.notes}` : ''}`,
        invoice_number: inv.invoice_number,
        type: 'payment',
        debit: 0,
        credit: p.amount,
      }));

      rows.push(invRow, ...paymentRows);
    }

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const ledgerRows = rows.map(row => {
      balance = parseFloat((balance + row.debit - row.credit).toFixed(2));
      return { ...row, balance };
    });

    const summary = {
      total_invoiced: parseFloat(invoices.reduce((s, inv) => s + inv.total, 0).toFixed(2)),
      total_paid: parseFloat(
        rows
        .filter(r => r.type === 'payment')
        .reduce((s, r) => s + r.credit, 0)
        .toFixed(2)
    ),
      closing_balance: balance,
      currency: customer.currency,
      country: customer.country,
    };

    const pdfBuffer = await generateLedgerPdf(customer, ledgerRows, summary, company);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="statement-${customer.customer_name.replace(/\s+/g, '-')}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate statement PDF' });
  }
});

export default router;