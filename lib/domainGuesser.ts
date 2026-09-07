/**
 * lib/domainGuesser.ts
 * ----------------------
 * Free alternative to a search API for turning a business name into a
 * website URL. Validated before being wired into anything real:
 * tested guessDomains() against 5 real businesses already confirmed
 * elsewhere in this session (Hit The Switch, Sanelli Concreting, Rival
 * Air Services, Nathans Landscaping, A. Twin Electrics & Plumbing) -
 * 3 of 5 matched on the very first guess. The two misses both dropped
 * a leading initial or a trailing marketing suffix that the real
 * domain didn't include, a real limitation worth knowing rather than
 * assuming this is as reliable as an actual search.
 *
 * Because a wrong guess means potentially attaching a completely
 * unrelated business's website/content to a listing, every guess gets
 * verified before being trusted: fetch the candidate, confirm the
 * business's own name (or a normalized version of it) actually
 * appears on the page, not just that *something* responded with 200.
 */

import { getRandomUserAgent } from "@/lib/websiteScraper";

function stripLegalSuffixes(name: string): string {
  return name
    .replace(/\b(pty\.?\s*ltd\.?|pty\.?\s*limited|proprietary\s*limited|limited|ltd\.?|inc\.?|incorporated)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_TRAILING_WORDS = ["services", "solutions", "group", "contractors", "electrical", "plumbing", "building"];

export function guessDomains(businessName: string): string[] {
  const clean = stripLegalSuffixes(businessName)
    .toLowerCase()
    .replace(/[^a-z0-9\s&]/g, "")
    .replace(/&/g, "and")
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const concatenated = words.join("");
  const hyphenated = words.join("-");
  const lastWord = words[words.length - 1];
  const trimmedWords = lastWord && GENERIC_TRAILING_WORDS.includes(lastWord) ? words.slice(0, -1) : words;
  const trimmedConcat = trimmedWords.join("");

  const bases = [...new Set([concatenated, hyphenated, trimmedConcat])].filter(b => b.length >= 3);
  const tlds = [".com.au", ".net.au", ".com"];

  const candidates: string[] = [];
  for (const base of bases) {
    for (const tld of tlds) candidates.push(`${base}${tld}`);
  }
  return candidates.slice(0, 8);
}

/**
 * Normalizes a business name down to its significant words (drops
 * legal suffixes and short filler words) for checking whether a
 * fetched page is actually about this business, not just that a
 * guessed domain happened to resolve to *something*.
 */
function significantWords(businessName: string): string[] {
  const clean = stripLegalSuffixes(businessName).toLowerCase().replace(/[^a-z0-9\s]/g, "");
  return clean.split(/\s+/).filter(w => w.length >= 3);
}

export interface DomainGuessResult {
  url: string | null;
  candidatesTried: number;
}

/**
 * Checks every guessed domain+scheme combo concurrently rather than
 * one at a time, verifying the fetched page actually mentions the
 * business's own name before accepting it. Requires at least half of
 * the business name's significant words to appear on the page - not
 * an exact-phrase match, since real sites often render the name with
 * different spacing/formatting than the ABN register's legal name,
 * but not a single-word match either, since that would accept almost
 * anything.
 *
 * Originally sequential (one fetch at a time, up to 16 attempts per
 * business) - worked in isolated testing but the math doesn't hold up
 * at real batch scale: 16 sequential attempts x up to an 8s timeout
 * each is a 128s worst case for ONE business, and phase 2 processes
 * 50 of them - a batch could take up to two hours and almost
 * certainly exceed any serverless function's execution limit long
 * before finishing. Caught this before it shipped a broken "run a
 * batch and it just times out" experience: checking every candidate
 * concurrently bounds one business's lookup to roughly the slowest
 * single attempt (~8s worst case) instead of the sum of all of them.
 */
export async function findWebsiteByGuessing(businessName: string): Promise<DomainGuessResult> {
  const candidates = guessDomains(businessName);
  const nameWords = significantWords(businessName);
  if (nameWords.length === 0 || candidates.length === 0) {
    return { url: null, candidatesTried: 0 };
  }

  const attempts: string[] = [];
  for (const domain of candidates) {
    for (const scheme of ["https://www.", "https://"]) attempts.push(`${scheme}${domain}`);
  }

  async function tryOne(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: { "User-Agent": getRandomUserAgent() },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(t);
      if (!res.ok) return null;

      const html = (await res.text()).toLowerCase();
      const matchedWords = nameWords.filter(w => html.includes(w));
      if (matchedWords.length >= Math.ceil(nameWords.length / 2)) {
        return res.url || url;
      }
      return null;
    } catch {
      return null;
    }
  }

  const results = await Promise.allSettled(attempts.map(tryOne));
  const hit = results.find((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled" && r.value !== null);

  return { url: hit ? hit.value : null, candidatesTried: attempts.length };
}
