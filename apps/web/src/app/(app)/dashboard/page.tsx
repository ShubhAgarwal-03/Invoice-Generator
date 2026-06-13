'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Loader2, TrendingUp, Clock, AlertTriangle, FileText,
  CheckCircle2, Send, FilePen, Users,
} from 'lucide-react';
import { dashboardService, DashboardSummary } from '@/services/dashboard';

function fmt(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function KPICard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-blue-600">{fmt(payload[0].value)} revenue</p>
      <p className="text-slate-400">{payload[0].payload.count} invoice{payload[0].payload.count !== 1 ? 's' : ''}</p>
    </div>
  );
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService.getSummary()
      .then(setData)
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  if (!data) return null;

  const { kpis, chart, top_customers } = data;
  const maxRevenue = Math.max(...chart.map(c => c.revenue), 1);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Your business at a glance</p>
        </div>

        {/* KPI row 1 — money */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Revenue"
            value={fmt(kpis.total_revenue)}
            sub="from paid invoices"
            icon={TrendingUp}
            color="bg-green-100 text-green-600"
          />
          <KPICard
            label="This Month"
            value={fmt(kpis.revenue_this_month)}
            sub="revenue collected"
            icon={CheckCircle2}
            color="bg-blue-100 text-blue-600"
          />
          <KPICard
            label="Outstanding"
            value={fmt(kpis.total_outstanding)}
            sub={`${kpis.sent_count} sent invoice${kpis.sent_count !== 1 ? 's' : ''}`}
            icon={Clock}
            color="bg-amber-100 text-amber-600"
          />
          <KPICard
            label="Overdue"
            value={fmt(kpis.overdue_amount)}
            sub={`${kpis.overdue_count} invoice${kpis.overdue_count !== 1 ? 's' : ''} past due`}
            icon={AlertTriangle}
            color="bg-red-100 text-red-600"
          />
        </div>

        {/* KPI row 2 — counts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Invoices"
            value={String(kpis.total_invoices)}
            icon={FileText}
            color="bg-slate-100 text-slate-500"
          />
          <KPICard
            label="Draft"
            value={String(kpis.draft_count)}
            icon={FilePen}
            color="bg-slate-100 text-slate-500"
          />
          <KPICard
            label="Sent"
            value={String(kpis.sent_count)}
            icon={Send}
            color="bg-blue-100 text-blue-500"
          />
          <KPICard
            label="Paid"
            value={String(kpis.paid_count)}
            icon={CheckCircle2}
            color="bg-green-100 text-green-500"
          />
        </div>

        {/* Chart + Top Customers side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Revenue chart — 2/3 width */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Revenue over time</h2>
            <p className="text-xs text-slate-400 mb-6">Paid invoices — last 6 months</p>
            {chart.every(c => c.revenue === 0) ? (
              <div className="flex items-center justify-center h-40 text-slate-300 text-sm">
                No paid invoices yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chart} barCategoryGap="30%">
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {chart.map((entry, i) => (
                      <Cell key={i} fill={entry.revenue === maxRevenue ? '#2563eb' : '#bfdbfe'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top customers — 1/3 width */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Top Customers</h2>
            </div>
            <p className="text-xs text-slate-400 mb-5">By total invoiced</p>
            {top_customers.length === 0 ? (
              <p className="text-sm text-slate-300 text-center py-6">No invoices yet</p>
            ) : (
              <div className="space-y-4">
                {top_customers.map((c, i) => (
                  <div key={c.customer_id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => router.push(`/customers`)}
                        className="text-sm font-medium text-slate-700 hover:text-blue-600 truncate block text-left cursor-pointer w-full"
                      >
                        {c.name}
                      </button>
                      <p className="text-xs text-slate-400">
                        {c.invoice_count} invoice{c.invoice_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 flex-shrink-0">
                      {fmt(c.total_invoiced)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => router.push('/invoices/new')}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer"
          >
            New Invoice
          </button>
          <button
            onClick={() => router.push('/invoices?status=sent')}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-md hover:bg-slate-50 cursor-pointer"
          >
            View Outstanding
          </button>
          {kpis.overdue_count > 0 && (
            <button
              onClick={() => router.push('/invoices?status=sent')}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-md hover:bg-red-50 cursor-pointer"
            >
              {kpis.overdue_count} Overdue
            </button>
          )}
        </div>

      </div>
    </div>
  );
}