import { Router, Request, Response } from 'express';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';

const router = Router();

// GET /api/dashboard/summary
// Returns KPI cards + monthly revenue chart + top customers
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const base = { is_deleted: false };
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── KPI counts ────────────────────────────────────────────────────────────
    const [
      totalInvoices,
      draftCount,
      sentCount,
      paidCount,
    ] = await Promise.all([
      Invoice.countDocuments(base),
      Invoice.countDocuments({ ...base, status: 'draft' }),
      Invoice.countDocuments({ ...base, status: 'sent' }),
      Invoice.countDocuments({ ...base, status: 'paid' }),
    ]);

    // ── Revenue (sum of total on paid invoices) ───────────────────────────────
    const revenueAgg = await Invoice.aggregate([
      { $match: { ...base, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const totalRevenue = revenueAgg[0]?.total ?? 0;

    // ── Outstanding (sum of balance_due on sent invoices) ────────────────────
    const outstandingAgg = await Invoice.aggregate([
      { $match: { ...base, status: 'sent' } },
      { $group: { _id: null, total: { $sum: '$balance_due' } } },
    ]);
    const totalOutstanding = outstandingAgg[0]?.total ?? 0;

    // ── Overdue (sent invoices with due_date < today) ─────────────────────────
    const overdueAgg = await Invoice.aggregate([
      { $match: { ...base, status: 'sent', due_date: { $lt: now } } },
      { $group: { _id: null, total: { $sum: '$balance_due' }, count: { $sum: 1 } } },
    ]);
    const overdueAmount = overdueAgg[0]?.total ?? 0;
    const overdueCount = overdueAgg[0]?.count ?? 0;

    // ── Revenue this month ────────────────────────────────────────────────────
    const monthRevenueAgg = await Invoice.aggregate([
      { $match: { ...base, status: 'paid', issue_date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const revenueThisMonth = monthRevenueAgg[0]?.total ?? 0;

    // ── Monthly revenue chart (last 6 months) ─────────────────────────────────
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyAgg = await Invoice.aggregate([
      { $match: { ...base, status: 'paid', issue_date: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$issue_date' },
            month: { $month: '$issue_date' },
          },
          revenue: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Fill in zeroes for months with no paid invoices
    const chartData: { month: string; revenue: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const found = monthlyAgg.find(
        m => m._id.year === d.getFullYear() && m._id.month === d.getMonth() + 1
      );
      chartData.push({
        month: MONTH_NAMES[d.getMonth()],
        revenue: found?.revenue ?? 0,
        count: found?.count ?? 0,
      });
    }

    // ── Top 5 customers by total invoiced ────────────────────────────────────
    const topCustomersAgg = await Invoice.aggregate([
      { $match: base },
      {
        $group: {
          _id: '$customer_id',
          customer_name: { $first: '$customer_snapshot.customer_name' },
          company_name: { $first: '$customer_snapshot.company_name' },
          total_invoiced: { $sum: '$total' },
          total_paid: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total', 0] }
          },
          invoice_count: { $sum: 1 },
        },
      },
      { $sort: { total_invoiced: -1 } },
      { $limit: 5 },
    ]);

    const topCustomers = topCustomersAgg.map(c => ({
      customer_id: c._id,
      name: c.customer_name || c.company_name || 'Unknown',
      total_invoiced: c.total_invoiced,
      total_paid: c.total_paid,
      invoice_count: c.invoice_count,
    }));

    res.json({
      kpis: {
        total_revenue: totalRevenue,
        revenue_this_month: revenueThisMonth,
        total_outstanding: totalOutstanding,
        overdue_amount: overdueAmount,
        overdue_count: overdueCount,
        total_invoices: totalInvoices,
        draft_count: draftCount,
        sent_count: sentCount,
        paid_count: paidCount,
      },
      chart: chartData,
      top_customers: topCustomers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

export default router;