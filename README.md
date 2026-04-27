# Invoice Generator

A professional invoice management web app — create, track, and export invoices in seconds.

🔗 **Live:** [your-vercel-url.vercel.app](https://your-vercel-url.vercel.app)

## What it does

**Invoices**
- Create invoices with multiple line items, automatic tax calculation, and real-time totals
- Sequential invoice numbers in INV-000001 format, system-generated and non-editable
- Edit, duplicate, and soft-delete invoices
- Filter by status, date range, and search by invoice number or customer name
- Download any invoice as a professionally formatted PDF

**Customers**
- Manage a customer directory with contact details and GSTIN
- Currency is automatically detected from the customer's country
- All monetary amounts are formatted in the customer's locale

**Items**
- Maintain a reusable item catalogue with unit prices and default tax rates
- Pick items directly into invoice line items without retyping

**Status Tracking**
- Three statuses: Draft → Sent → Paid
- Colour-coded badges and one-click status updates

**Company Settings**
- Configure your business name, address, email, phone, and logo
- Details appear on all invoices and exported PDFs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| PDF | PDFKit |
| Monorepo | Nx |
| Language | TypeScript |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET/POST | `/api/customers` | List / create customers |
| PUT/DELETE | `/api/customers/:id` | Update / delete customer |
| GET/POST | `/api/items` | List / create items |
| PUT/DELETE | `/api/items/:id` | Update / delete item |
| GET/POST | `/api/invoices` | List with filters / create |
| GET/PUT | `/api/invoices/:id` | Get / update invoice |
| DELETE | `/api/invoices/:id` | Soft delete |
| PATCH | `/api/invoices/:id/status` | Update status |
| POST | `/api/invoices/:id/duplicate` | Duplicate |
| GET | `/api/invoices/:id/pdf` | Download PDF |
| GET/POST | `/api/company` | Get / save company config |

## Local Development

```bash
# Install
npm install

# API — Terminal 1
cd apps/api && npx tsx src/main.ts

# Web — Terminal 2
cd apps/web && npx next dev --port 4200
```

Requires `apps/api/.env` with `MONGODB_URI` and `PORT=3333`.

## License
MIT
