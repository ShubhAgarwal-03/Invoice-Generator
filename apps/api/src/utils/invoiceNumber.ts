import Invoice from '../models/Invoice';

export async function generateInvoiceNumber(): Promise<string> {
  // Find the latest invoice by number to get next sequence
  const latest = await Invoice.findOne({}, { invoice_number: 1 })
    .sort({ createdAt: -1 })
    .lean();

  let next = 1;
  if (latest?.invoice_number) {
    const match = latest.invoice_number.match(/INV-(\d+)/);
    if (match) next = parseInt(match[1], 10) + 1;
  }

  return `INV-${String(next).padStart(6, '0')}`;
}