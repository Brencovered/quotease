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

import { resolveDueDate, termAmount, type PaymentTerm } from "./paymentTerms";

export interface QuoteForExport {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  siteAddress: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  totalCost: number;
  jobType: string | null;
  paymentTerms: PaymentTerm[];
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
//
// A quote with split payment terms (e.g. 30% deposit / 70% on completion)
// becomes one invoice ROW PER TERM, sharing the same invoice number with a
// letter suffix (INV-0001-A, INV-0001-B) so Xero treats them as related but
// distinct invoices rather than one invoice for the wrong amount.
export function buildXeroInvoiceCsv(
  quotes: QuoteForExport[],
  options: { accountCode?: string; taxType?: string } = {}
): string {
  const accountCode = options.accountCode ?? "200";
  const taxType = options.taxType ?? "OUTPUT";

  const rows: string[] = [];

  for (const q of quotes) {
    const terms = q.paymentTerms.length > 0
      ? q.paymentTerms
      : [{ label: "Payment due", percent: 100, trigger: "completion" as const, days: 14 }];

    const multiTerm = terms.length > 1;

    terms.forEach((term, i) => {
      const dueDate = resolveDueDate(term, {
        acceptedAt: q.acceptedAt,
        completedAt: q.completedAt,
        createdAt: q.createdAt,
      });
      const invoiceDate = new Date(q.acceptedAt ?? q.createdAt);
      const invoiceNumber = multiTerm
        ? `${q.invoiceNumber}-${String.fromCharCode(65 + i)}`
        : q.invoiceNumber;

      const description = `Electrical work${q.jobType ? " — " + q.jobType : ""}${
        q.siteAddress ? " at " + q.siteAddress : ""
      }${multiTerm ? ` (${term.label})` : ""}`;

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
        invoiceNumber,
        invoiceDate.toISOString().slice(0, 10),
        dueDate.toISOString().slice(0, 10),
        "",
        description,
        "1",
        termAmount(term, q.totalCost).toFixed(2),
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
      rows.push(row.map((v) => csvEscape(String(v))).join(","));
    });
  }

  return [HEADER.join(","), ...rows].join("\n");
}
