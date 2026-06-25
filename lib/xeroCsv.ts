// Builds a CSV matching Xero's "Import sales invoices" template
// (Business menu > Invoices > Import in Xero). The tradie downloads this
// and imports it themselves — no API connection, no OAuth, no per-connection
// cost, and it works identically whether you have 10 customers or 10,000.
//
// Xero's required/expected columns for this template, in order:
// *ContactName, EmailAddress, POAddressLine1, POAddressLine2, POAddressLine3,
// POAddressLine4, POCity, PORegion, POPostalCode, POCountry, *InvoiceNumber,
// *InvoiceDate, *DueDate, InventoryItemCode, *Description, *Quantity,
// *UnitAmount, Discount, *AccountCode, *TaxType, TrackingName1, TrackingOption1,
// TrackingName2, TrackingOption2, Currency, BrandingTheme
//
// Columns marked * are required by Xero. Quantity is left at 1 and the full
// job total goes in UnitAmount, since a quote is one lump-sum line item, not
// a per-unit breakdown — Xero doesn't need the labour/materials split, just
// the total owed.

export interface QuoteForExport {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  siteAddress: string | null;
  acceptedAt: string; // ISO date
  totalCost: number;
  jobType: string | null;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const HEADER = [
  "*ContactName",
  "EmailAddress",
  "POAddressLine1",
  "POAddressLine2",
  "POAddressLine3",
  "POAddressLine4",
  "POCity",
  "PORegion",
  "POPostalCode",
  "POCountry",
  "*InvoiceNumber",
  "*InvoiceDate",
  "*DueDate",
  "InventoryItemCode",
  "*Description",
  "*Quantity",
  "*UnitAmount",
  "Discount",
  "*AccountCode",
  "*TaxType",
  "TrackingName1",
  "TrackingOption1",
  "TrackingName2",
  "TrackingOption2",
  "Currency",
  "BrandingTheme",
];

// AccountCode 200 is Xero's default "Sales" revenue account on most AU charts
// of accounts — the tradie can remap this in Xero if their chart differs.
// TaxType "OUTPUT" is the standard AU GST-on-income tax type.
export function buildXeroInvoiceCsv(
  quotes: QuoteForExport[],
  options: { accountCode?: string; taxType?: string; dueInDays?: number } = {}
): string {
  const accountCode = options.accountCode ?? "200";
  const taxType = options.taxType ?? "OUTPUT";
  const dueInDays = options.dueInDays ?? 14;

  const rows = quotes.map((q) => {
    const invoiceDate = q.acceptedAt.slice(0, 10);
    const dueDate = addDays(q.acceptedAt, dueInDays);
    const description = `Electrical work${q.jobType ? " — " + q.jobType : ""}${
      q.siteAddress ? " at " + q.siteAddress : ""
    }`;

    const row = [
      q.clientName || "Unknown client",
      q.clientEmail ?? "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      q.invoiceNumber,
      invoiceDate,
      dueDate,
      "",
      description,
      "1",
      q.totalCost.toFixed(2),
      "",
      accountCode,
      taxType,
      "",
      "",
      "",
      "",
      "AUD",
      "",
    ];
    return row.map((v) => csvEscape(String(v))).join(",");
  });

  return [HEADER.join(","), ...rows].join("\n");
}
