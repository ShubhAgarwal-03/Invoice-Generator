import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

function formatMoney(amount: number, currency: string, country: string): string {
  try {
    const localeMap: Record<string, string> = {
      IN: 'en-IN', US: 'en-US', GB: 'en-GB', DE: 'de-DE',
      FR: 'fr-FR', AU: 'en-AU', CA: 'en-CA', JP: 'ja-JP',
      SG: 'en-SG', AE: 'ar-AE',
    };
    const locale = localeMap[country] ?? 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(date: Date | string): string {
  try {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return '—'; }
}

export async function generateLedgerPdf(
  customer: any,
  rows: any[],
  summary: { total_invoiced: number; total_paid: number; closing_balance: number; currency: string; country: string },
  company: any
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    const PAGE_WIDTH = 595 - 80;
    const fmt = (n: number) => formatMoney(n, summary.currency, summary.country);

    // ── Top color bar ─────────────────────────────────
    doc.rect(0, 0, 595, 6).fill('#2563eb');

    // ── Company (left) ────────────────────────────────
    let leftY = 30;
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e293b')
      .text(company?.name ?? 'Your Company', 40, leftY);
    leftY += 22;
    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    if (company?.address) { doc.text(company.address, 40, leftY); leftY += 12; }
    if (company?.email)   { doc.text(company.email,   40, leftY); leftY += 12; }
    if (company?.phone)   { doc.text(company.phone,   40, leftY); leftY += 12; }
    if (company?.gstin)   { doc.text(`GSTIN: ${company.gstin}`, 40, leftY); leftY += 12; }

    // ── Statement heading (right) ─────────────────────
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#2563eb')
      .text('ACCOUNT STATEMENT', 300, 30, { width: 255, align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor('#64748b')
      .text(`Generated: ${formatDate(new Date())}`, 300, 60, { width: 255, align: 'right' });

    // ── Customer info box ─────────────────────────────
    const custY = Math.max(leftY + 16, 90);
    doc.rect(40, custY, PAGE_WIDTH, 0.5).fill('#e2e8f0');
    const boxY = custY + 10;
    doc.rect(40, boxY, PAGE_WIDTH / 2 - 5, 70).fill('#f8fafc');

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8')
      .text('BILL TO', 48, boxY + 8);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      .text(customer.customer_name, 48, boxY + 20);
    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    let cY = boxY + 34;
    if (customer.company_name) { doc.text(customer.company_name, 48, cY); cY += 11; }
    if (customer.email)        { doc.text(customer.email, 48, cY); cY += 11; }
    if (customer.phone)        { doc.text(customer.phone, 48, cY); }

    // Summary box (right side)
    const sumX = 40 + PAGE_WIDTH / 2 + 5;
    const sumW = PAGE_WIDTH / 2 - 5;
    doc.rect(sumX, boxY, sumW, 70).fill('#eff6ff');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#2563eb')
      .text('ACCOUNT SUMMARY', sumX + 8, boxY + 8);
    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    doc.text('Total Invoiced', sumX + 8, boxY + 22, { width: sumW - 70 });
    doc.font('Helvetica-Bold').fillColor('#1e293b')
      .text(fmt(summary.total_invoiced), sumX + 8 + (sumW - 70), boxY + 22, { width: 62, align: 'right' });
    doc.font('Helvetica').fillColor('#64748b')
      .text('Total Paid',     sumX + 8, boxY + 36, { width: sumW - 70 });
    doc.font('Helvetica-Bold').fillColor('#15803d')
      .text(fmt(summary.total_paid), sumX + 8 + (sumW - 70), boxY + 36, { width: 62, align: 'right' });

    doc.rect(sumX + 8, boxY + 50, sumW - 16, 0.5).fill('#bfdbfe');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
      .text('Balance Due', sumX + 8, boxY + 56, { width: sumW - 70 });
    doc.fillColor(summary.closing_balance > 0 ? '#dc2626' : '#15803d')
      .text(fmt(summary.closing_balance), sumX + 8 + (sumW - 70), boxY + 56, { width: 62, align: 'right' });

    // ── Ledger table ──────────────────────────────────
    const tableY = boxY + 90;

    // Column positions
    const cols = {
      date:    40,
      desc:    110,
      inv:     270,
      debit:   360,
      credit:  430,
      balance: 490,
    };
    const colW = {
      date:    65,
      desc:    155,
      inv:     85,
      debit:   65,
      credit:  55,
      balance: 65,
    };

    // Table header
    doc.rect(40, tableY, PAGE_WIDTH, 20).fill('#2563eb');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Date',          cols.date,    tableY + 7, { width: colW.date });
    doc.text('Description',   cols.desc,    tableY + 7, { width: colW.desc });
    doc.text('Invoice #',     cols.inv,     tableY + 7, { width: colW.inv });
    doc.text('Debit',         cols.debit,   tableY + 7, { width: colW.debit,   align: 'right' });
    doc.text('Credit',        cols.credit,  tableY + 7, { width: colW.credit,  align: 'right' });
    doc.text('Balance',       cols.balance, tableY + 7, { width: colW.balance, align: 'right' });

    let rowY = tableY + 20;

    if (rows.length === 0) {
      doc.fontSize(9).font('Helvetica').fillColor('#94a3b8')
        .text('No transactions found.', 40, rowY + 10, { width: PAGE_WIDTH, align: 'center' });
    }

    rows.forEach((row, i) => {
      const rowH = 20;

      // Check if we need a new page
      if (rowY + rowH > doc.page.height - 80) {
        doc.addPage();
        // Repeat header on new page
        doc.rect(0, 0, 595, 6).fill('#2563eb');
        doc.rect(40, 30, PAGE_WIDTH, 20).fill('#2563eb');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
        doc.text('Date',        cols.date,    37, { width: colW.date });
        doc.text('Description', cols.desc,    37, { width: colW.desc });
        doc.text('Invoice #',   cols.inv,     37, { width: colW.inv });
        doc.text('Debit',       cols.debit,   37, { width: colW.debit,   align: 'right' });
        doc.text('Credit',      cols.credit,  37, { width: colW.credit,  align: 'right' });
        doc.text('Balance',     cols.balance, 37, { width: colW.balance, align: 'right' });
        rowY = 50;
      }

      if (i % 2 === 1) doc.rect(40, rowY, PAGE_WIDTH, rowH).fill('#f8fafc');

      const isPayment = row.type === 'payment';

      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
        .text(formatDate(row.date), cols.date, rowY + 6, { width: colW.date });

      doc.fillColor(isPayment ? '#64748b' : '#334155')
        .text(row.description, cols.desc, rowY + 6, { width: colW.desc });

      doc.fillColor('#64748b')
        .text(row.invoice_number ?? '—', cols.inv, rowY + 6, { width: colW.inv });

      // Debit (red tint) / Credit (green tint)
      if (row.debit > 0) {
        doc.font('Helvetica-Bold').fillColor('#dc2626')
          .text(fmt(row.debit), cols.debit, rowY + 6, { width: colW.debit, align: 'right' });
      } else {
        doc.font('Helvetica').fillColor('#94a3b8')
          .text('—', cols.debit, rowY + 6, { width: colW.debit, align: 'right' });
      }

      if (row.credit > 0) {
        doc.font('Helvetica-Bold').fillColor('#15803d')
          .text(fmt(row.credit), cols.credit, rowY + 6, { width: colW.credit, align: 'right' });
      } else {
        doc.font('Helvetica').fillColor('#94a3b8')
          .text('—', cols.credit, rowY + 6, { width: colW.credit, align: 'right' });
      }

      // Running balance
      doc.font('Helvetica-Bold').fillColor(row.balance > 0 ? '#1e293b' : '#15803d')
        .text(fmt(row.balance), cols.balance, rowY + 6, { width: colW.balance, align: 'right' });

      doc.rect(40, rowY + rowH, PAGE_WIDTH, 0.5).fill('#f1f5f9');
      rowY += rowH;
    });

    // ── Closing balance row ───────────────────────────
    rowY += 4;
    doc.rect(40, rowY, PAGE_WIDTH, 22).fill('#1e293b');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
      .text('Closing Balance', cols.date, rowY + 7, { width: colW.date + colW.desc + colW.inv + colW.debit + colW.credit });
    doc.fillColor(summary.closing_balance > 0 ? '#fca5a5' : '#86efac')
      .text(fmt(summary.closing_balance), cols.balance, rowY + 7, { width: colW.balance, align: 'right' });

    // ── Footer ────────────────────────────────────────
    doc.rect(0, doc.page.height - 6, 595, 6).fill('#2563eb');
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
      .text(
        `${company?.name ?? ''} · Account Statement · ${formatDate(new Date())}`,
        40, doc.page.height - 20, { width: PAGE_WIDTH, align: 'center' }
      );

    doc.end();
  });
}