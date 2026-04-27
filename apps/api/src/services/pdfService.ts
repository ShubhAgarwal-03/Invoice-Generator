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

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return '—'; }
}

export async function generateInvoicePdf(invoice: any, company: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    const snap = invoice.customer_snapshot;
    const currency = snap.currency ?? 'USD';
    const country = snap.country ?? 'US';
    const fmt = (n: number) => formatMoney(n, currency, country);

    const STATUS_COLORS: Record<string, string> = {
      draft: '#64748b', sent: '#1d4ed8', paid: '#15803d'
    };

    // ── Company ───────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').text(company?.name ?? 'Your Company', 50, 50);
    doc.fontSize(9).font('Helvetica').fillColor('#64748b');
    let companyY = 75;
    if (company?.address) { doc.text(company.address, 50, companyY); companyY += 14; }
    if (company?.email)   { doc.text(company.email,   50, companyY); companyY += 14; }
    if (company?.phone)   { doc.text(company.phone,   50, companyY); }

    // ── Invoice number + meta (right side) ───────────
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e293b')
      .text(invoice.invoice_number, 300, 50, { width: 245, align: 'right' });

    const statusColor = STATUS_COLORS[invoice.status] ?? '#64748b';
    doc.fontSize(8).font('Helvetica').fillColor(statusColor)
      .text(invoice.status.toUpperCase(), 300, 78, { width: 245, align: 'right' });

    doc.fontSize(9).fillColor('#64748b');
    doc.text(`Issue date: ${formatDate(invoice.issue_date)}`, 300, 95, { width: 245, align: 'right' });
    if (invoice.due_date) {
      doc.text(`Due date: ${formatDate(invoice.due_date)}`, 300, 109, { width: 245, align: 'right' });
    }
    doc.text(`Currency: ${currency}`, 300, invoice.due_date ? 123 : 109, { width: 245, align: 'right' });

    // ── Bill To ───────────────────────────────────────
    const billToY = Math.max(companyY + 20, 150);
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
      .text('BILL TO', 50, billToY);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b')
      .text(snap.name, 50, billToY + 14);
    doc.fontSize(9).font('Helvetica').fillColor('#64748b');
    let billY = billToY + 28;
    if (snap.email)   { doc.text(snap.email,   50, billY); billY += 13; }
    if (snap.address) { doc.text(snap.address, 50, billY); billY += 13; }
    if (snap.gstin)   { doc.text(`GSTIN: ${snap.gstin}`, 50, billY); billY += 13; }

    // ── Table header ──────────────────────────────────
    const tableTop = billY + 24;
    doc.rect(50, tableTop, 495, 20).fill('#f8fafc');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#94a3b8');
    doc.text('DESCRIPTION', 58, tableTop + 6);
    doc.text('QTY',        310, tableTop + 6, { width: 40,  align: 'right' });
    doc.text('UNIT PRICE', 355, tableTop + 6, { width: 70,  align: 'right' });
    doc.text('TAX',        430, tableTop + 6, { width: 35,  align: 'right' });
    doc.text('TOTAL',      468, tableTop + 6, { width: 72,  align: 'right' });

    // Border
    doc.moveTo(50, tableTop).lineTo(545, tableTop).strokeColor('#e2e8f0').stroke();
    doc.moveTo(50, tableTop + 20).lineTo(545, tableTop + 20).stroke();

    // ── Line items ────────────────────────────────────
    let rowY = tableTop + 28;
    doc.font('Helvetica').fillColor('#1e293b');

    invoice.items.forEach((item: any, i: number) => {
      if (i % 2 === 1) {
        doc.rect(50, rowY - 4, 495, 20).fill('#fafafa');
      }
      doc.fontSize(9).font('Helvetica').fillColor('#334155')
        .text(item.description, 58, rowY, { width: 245 });
      doc.fillColor('#64748b')
        .text(String(item.quantity),     310, rowY, { width: 40,  align: 'right' })
        .text(fmt(item.unit_price),      355, rowY, { width: 70,  align: 'right' })
        .text(`${item.tax_percent}%`,    430, rowY, { width: 35,  align: 'right' });
      doc.fillColor('#1e293b').font('Helvetica-Bold')
        .text(fmt(item.line_total),      468, rowY, { width: 72,  align: 'right' });

      doc.moveTo(50, rowY + 16).lineTo(545, rowY + 16).strokeColor('#f1f5f9').stroke();
      rowY += 22;
    });

    // ── Totals ────────────────────────────────────────
    const totalsY = rowY + 16;
    doc.fontSize(9).font('Helvetica').fillColor('#64748b')
      .text('Subtotal', 380, totalsY,      { width: 80, align: 'right' })
      .text(fmt(invoice.subtotal), 463, totalsY, { width: 77, align: 'right' });

    doc.text('Tax', 380, totalsY + 16,     { width: 80, align: 'right' })
      .text(fmt(invoice.tax_total), 463, totalsY + 16, { width: 77, align: 'right' });

    doc.moveTo(380, totalsY + 32).lineTo(545, totalsY + 32).strokeColor('#e2e8f0').stroke();

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b')
      .text('Total', 380, totalsY + 38,    { width: 80, align: 'right' })
      .text(fmt(invoice.total), 463, totalsY + 38, { width: 77, align: 'right' });

    // ── Notes ─────────────────────────────────────────
    if (invoice.notes) {
      const notesY = totalsY + 70;
      doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
        .text('NOTES', 50, notesY);
      doc.fontSize(9).fillColor('#475569')
        .text(invoice.notes, 50, notesY + 14, { width: 495 });
    }

    doc.end();
  });
}