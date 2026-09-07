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
 * Tries each guessed domain in turn, verifying the fetched page
 * actually mentions the business's own name before accepting it.
 * Requires at least half of the business name's significant words to
 * appear on the page - not an exact-phrase match, since real sites
 * often render the name with different spacing/formatting than the
 * ABN register's legal name, but not a single-word match either,
 * since that would accept almost anything.
 */
export async function findWebsiteByGuessing(businessName: string): Promise<DomainGuessResult> {
  const candidates = guessDomains(businessName);
  const nameWords = significantWords(businessName);
  if (nameWords.length === 0 || candidates.length === 0) {
    return { url: null, candidatesTried: 0 };
  }

  let tried = 0;
  for (const domain of candidates) {
    tried++;
    for (const scheme of ["https://www.", "https://"]) {
      const url = `${scheme}${domain}`;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          headers: { "User-Agent": getRandomUserAgent() },
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(t);
        if (!res.ok) continue;

        const html = (await res.text()).toLowerCase();
        const matchedWords = nameWords.filter(w => html.includes(w));
        if (matchedWords.length >= Math.ceil(nameWords.length / 2)) {
          return { url: res.url || url, candidatesTried: tried };
        }
      } catch {
        // this candidate/scheme didn't resolve or timed out - try the next
      }
    }
  }

  return { url: null, candidatesTried: tried };
}
