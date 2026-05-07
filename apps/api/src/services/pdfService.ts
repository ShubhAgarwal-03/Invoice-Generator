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

function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHundreds(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    return ones[Math.floor(n / 100)] + ' Hundred ' + convertHundreds(n % 100);
  }

  if (amount === 0) return 'Zero Only';
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  let result = '';
  if (intPart >= 10000000) result += convertHundreds(Math.floor(intPart / 10000000)) + 'Crore ';
  if (intPart >= 100000) result += convertHundreds(Math.floor((intPart % 10000000) / 100000)) + 'Lakh ';
  if (intPart >= 1000) result += convertHundreds(Math.floor((intPart % 100000) / 1000)) + 'Thousand ';
  result += convertHundreds(intPart % 1000);
  if (decPart > 0) result += 'and ' + convertHundreds(decPart) + 'Paise ';
  return result.trim() + ' Only';
}

export async function generateInvoicePdf(invoice: any, company: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
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
    const PAGE_WIDTH = 595 - 80; // A4 minus margins

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
    if (company?.pan)     { doc.text(`PAN: ${company.pan}`,     40, leftY); leftY += 12; }

    // ── Invoice meta (right) ──────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#2563eb')
      .text('INVOICE', 300, 30, { width: 255, align: 'right' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b')
      .text(invoice.invoice_number, 300, 58, { width: 255, align: 'right' });

    const statusColors: Record<string, string> = {
      draft: '#64748b', sent: '#1d4ed8', paid: '#15803d'
    };
    doc.fontSize(8).fillColor(statusColors[invoice.status] ?? '#64748b')
      .text(invoice.status.toUpperCase(), 300, 74, { width: 255, align: 'right' });

    doc.fontSize(8).fillColor('#64748b');
    doc.text(`Issue Date: ${formatDate(invoice.issue_date)}`, 300, 90, { width: 255, align: 'right' });
    if (invoice.due_date) {
      doc.text(`Due Date: ${formatDate(invoice.due_date)}`, 300, 102, { width: 255, align: 'right' });
    }
    doc.text(`Currency: ${currency}`, 300, invoice.due_date ? 114 : 102, { width: 255, align: 'right' });

    // ── Bill To / Ship To ─────────────────────────────
    const billY = Math.max(leftY + 16, 140);
    doc.rect(40, billY, PAGE_WIDTH, 0.5).fill('#e2e8f0');

    const billBoxY = billY + 10;
    doc.rect(40, billBoxY, PAGE_WIDTH / 2 - 5, 80).fill('#f8fafc');
    doc.rect(40 + PAGE_WIDTH / 2 + 5, billBoxY, PAGE_WIDTH / 2 - 5, 80).fill('#f8fafc');

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8')
      .text('BILL TO', 48, billBoxY + 8);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      .text(snap.name, 48, billBoxY + 20);
    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    let btY = billBoxY + 34;
    if (snap.address) { doc.text(snap.address, 48, btY, { width: PAGE_WIDTH / 2 - 20 }); btY += 12; }
    if (snap.email)   { doc.text(snap.email,   48, btY); btY += 12; }
    if (snap.phone)   { doc.text(snap.phone, 48, btY); btY += 12;}
    if (snap.gstin)   { doc.text(`GSTIN: ${snap.gstin}`, 48, btY);}

    const shipX = 40 + PAGE_WIDTH / 2 + 13;
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8')
      .text('SHIP TO', shipX, billBoxY + 8);
    if (invoice.shipping_address) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
        .text(snap.name, shipX, billBoxY + 20);
      doc.fontSize(8).font('Helvetica').fillColor('#64748b')
        .text(invoice.shipping_address, shipX, billBoxY + 32, { width: PAGE_WIDTH / 2 - 20 });
    } else {
      doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
        .text(snap.address || 'Same as billing address', shipX, billBoxY + 20, { width: PAGE_WIDTH / 2 - 20 });
    }

    // ── Table ─────────────────────────────────────────
    const tableY = billBoxY + 100;
    const colWidths = { num: 20, desc: 150, hsn: 60, qty: 35, price: 70, tax: 35, total: 75 };
    const cols = {
      num:   40,
      desc:  40 + colWidths.num,
      hsn:   40 + colWidths.num + colWidths.desc,
      qty:   40 + colWidths.num + colWidths.desc + colWidths.hsn,
      price: 40 + colWidths.num + colWidths.desc + colWidths.hsn + colWidths.qty,
      tax:   40 + colWidths.num + colWidths.desc + colWidths.hsn + colWidths.qty + colWidths.price,
      total: 40 + colWidths.num + colWidths.desc + colWidths.hsn + colWidths.qty + colWidths.price + colWidths.tax,
    };

    // Table header
    doc.rect(40, tableY, PAGE_WIDTH, 20).fill('#2563eb');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('#',           cols.num,   tableY + 7);
    doc.text('Description', cols.desc,  tableY + 7, { width: colWidths.desc });
    doc.text('HSN/SAC',     cols.hsn,   tableY + 7, { width: colWidths.hsn });
    doc.text('Qty',         cols.qty,   tableY + 7, { width: colWidths.qty,  align: 'right' });
    doc.text('Unit Price',  cols.price, tableY + 7, { width: colWidths.price, align: 'right' });
    doc.text('Tax%',        cols.tax,   tableY + 7, { width: colWidths.tax,  align: 'right' });
    doc.text('Total',       cols.total, tableY + 7, { width: colWidths.total, align: 'right' });

    // Rows
    let rowY = tableY + 20;
    invoice.items.forEach((item: any, i: number) => {
      const rowH = 22;
      if (i % 2 === 1) doc.rect(40, rowY, PAGE_WIDTH, rowH).fill('#f8fafc');
      doc.fontSize(8).font('Helvetica').fillColor('#334155');
      doc.text(String(i + 1),          cols.num,   rowY + 7);
      doc.text(item.description,       cols.desc,  rowY + 7, { width: colWidths.desc });
      doc.text(item.hsn_sac || '—',   cols.hsn,   rowY + 7, { width: colWidths.hsn });
      doc.fillColor('#64748b')
        .text(String(item.quantity),   cols.qty,   rowY + 7, { width: colWidths.qty,  align: 'right' })
        .text(fmt(item.unit_price),    cols.price, rowY + 7, { width: colWidths.price, align: 'right' })
        .text(`${item.tax_percent}%`,  cols.tax,   rowY + 7, { width: colWidths.tax,  align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#1e293b')
        .text(fmt(item.line_total),    cols.total, rowY + 7, { width: colWidths.total, align: 'right' });
      doc.rect(40, rowY + rowH, PAGE_WIDTH, 0.5).fill('#f1f5f9');
      rowY += rowH;
    });

    // ── Tax Breakdown + Totals ────────────────────────
    const taxTotal = invoice.tax_total;
    const totY = rowY + 16;

    // Tax breakdown box
    const isInterstate = true; // Default to IGST; update to use invoice field when available
    doc.rect(40, totY, PAGE_WIDTH / 2, 60).fill('#f8fafc');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8')
      .text('TAX BREAKDOWN', 48, totY + 8);
    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    if (isInterstate) {
      doc.text(`IGST: ${fmt(taxTotal)}`, 48, totY + 20);
      doc.text('(Interstate supply)', 48, totY + 32);
    } else {
      const half = taxTotal / 2;
      doc.text(`CGST: ${fmt(half)}`, 48, totY + 20);
      doc.text(`SGST: ${fmt(half)}`, 48, totY + 32);
      doc.text('(Intrastate supply)', 48, totY + 44);
    }

    // Totals
    const totX = 40 + PAGE_WIDTH / 2 + 10;
    const totW = PAGE_WIDTH / 2 - 10;
    let tY = totY;

    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    doc.text('Subtotal',   totX, tY,      { width: totW - 60 });
    doc.text(fmt(invoice.subtotal), totX + totW - 60, tY, { width: 60, align: 'right' });
    tY += 14;
    doc.text('Tax',        totX, tY,      { width: totW - 60 });
    doc.text(fmt(taxTotal), totX + totW - 60, tY, { width: 60, align: 'right' });
    tY += 14;
    doc.rect(totX, tY, totW, 0.5).fill('#e2e8f0');
    tY += 6;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text('Grand Total', totX, tY,     { width: totW - 60 });
    doc.text(fmt(invoice.total), totX + totW - 60, tY, { width: 60, align: 'right' });

    // ── Amount in Words ───────────────────────────────
    const wordsY = tY + 30; // tY is where Grand Total ended, so this places it below
    doc.rect(40, wordsY, PAGE_WIDTH, 24).fill('#eff6ff');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#2563eb')
      .text('Amount in Words:', 48, wordsY + 4);
    doc.fontSize(8).font('Helvetica').fillColor('#1e293b')
      .text(numberToWords(invoice.total), 48, wordsY + 14, { width: PAGE_WIDTH - 16 });

    // ── Bank Details ──────────────────────────────────
    if (company?.bank_name || company?.account_number) {
      const bankY = wordsY + 36;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8')
        .text('BANK DETAILS', 40, bankY);
      doc.fontSize(8).font('Helvetica').fillColor('#64748b');
      let bY = bankY + 12;
      if (company.bank_name)      { doc.text(`Bank: ${company.bank_name}`,         40, bY); bY += 11; }
      if (company.account_number) { doc.text(`Account No: ${company.account_number}`, 40, bY); bY += 11; }
      if (company.ifsc_code)      { doc.text(`IFSC: ${company.ifsc_code}`,         40, bY); bY += 11; }
      if (company.branch)         { doc.text(`Branch: ${company.branch}`,           40, bY); }
    }

    // ── Notes ─────────────────────────────────────────
    if (invoice.notes) {
      const notesY = wordsY + 100;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#94a3b8')
        .text('NOTES', 40, notesY);
      doc.fontSize(8).font('Helvetica').fillColor('#475569')
        .text(invoice.notes, 40, notesY + 12, { width: PAGE_WIDTH });
    }

    // ── Authorized Signatory ──────────────────────────
    const sigY = doc.page.height - 100;
    doc.moveTo(355, sigY).lineTo(555, sigY).strokeColor('#94a3b8').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b')
      .text('Authorized Signatory', 355, sigY + 6, { width: 200, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
      .text(company?.name ?? '', 355, sigY + 18, { width: 200, align: 'center' });

    // ── Footer line ───────────────────────────────────
    doc.rect(0, doc.page.height - 6, 595, 6).fill('#2563eb');

    doc.end();
  });
}