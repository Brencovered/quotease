/**
 * Australian GST helpers.
 * Quotes are stored and calculated EX-GST. Display layers add 10% for
 * customer-facing totals so every trade is consistent (roofer previously
 * baked GST into the saved total; that path should migrate to store ex-GST).
 */

export const GST_RATE = 0.1;

export function exGst(amount: number): number {
  return Math.round(amount);
}

export function gstOn(exGstAmount: number): number {
  return Math.round(exGstAmount * GST_RATE);
}

export function incGst(exGstAmount: number): number {
  return Math.round(exGstAmount * (1 + GST_RATE));
}

/** Split a total that may already include GST into ex + gst + inc. */
export function splitGst(exGstAmount: number): { ex: number; gst: number; inc: number } {
  const ex = exGst(exGstAmount);
  return { ex, gst: gstOn(ex), inc: incGst(ex) };
}
