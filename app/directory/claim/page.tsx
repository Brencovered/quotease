"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MarketingNav from "@/components/MarketingNav";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import {
  Search, Loader2, CheckCircle2, ArrowRight, Star,
  MapPin, ShieldCheck, AlertCircle, Mail, Lock, ImagePlus,
} from "lucide-react";

const TRADES = [
  { key: "electrician", label: "Electrician" },
  { key: "plumber", label: "Plumber" },
  { key: "builder", label: "Builder" },
  { key: "roofer", label: "Roofer" },
  { key: "painter", label: "Painter" },
  { key: "carpenter", label: "Carpenter" },
  { key: "tiler", label: "Tiler" },
  { key: "landscaper", label: "Landscaper" },
  { key: "concreter", label: "Concreter" },
  { key: "fencer", label: "Fencer" },
  { key: "plasterer", label: "Plasterer" },
  { key: "handyman", label: "Handyman" },
];

type ListingMatch = {
  id: string;
  business_name: string;
  suburb: string | null;
  trades: string[] | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  logo_url: string | null;
  similarity: number;
};

type Step = "auth" | "search" | "resolve" | "abn" | "done";

export default function ClaimDirectoryListingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
        <Loader2 className="animate-spin text-[#0a1722]" size={28} />
      </main>
    }>
      <ClaimDirectoryListingInner />
    </Suspense>
  );
}

function ClaimDirectoryListingInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  // Search/resolve/abn now come before auth (see the mount effect below for
  // why), so "auth" is no longer the entry step. Kept as a step in the Step
  // type -- it is still shown, just later, right before the actual submit.
  const [step, setStep] = useState<Step>("search");

  // Auth step - deliberately separate from the main app's /login and
  // /signup: this is the free claimed directory page's own entry point, not the
  // $45 plan's onboarding wizard, and shouldn't look or feel like it. A new
  // account created here should never be routed through /onboarding.
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [checkYourEmail, setCheckYourEmail] = useState(false);

  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingListingSlug, setExistingListingSlug] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState(() => searchParams.get("name") ?? "");
  const [trade, setTrade] = useState(() => searchParams.get("trade") ?? "");
  const [suburb, setSuburb] = useState(() => searchParams.get("suburb") ?? "");
  const [postcode, setPostcode] = useState(() => searchParams.get("postcode") ?? "");

  const [matches, setMatches] = useState<ListingMatch[]>([]);
  const [strongMatch, setStrongMatch] = useState<ListingMatch | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null | "new">(null);

  const [abn, setAbn] = useState("");
  // Only ever required/shown for a brand new listing (selectedListingId
  // === "new"), never when claiming an existing scraped one -- those
  // already carry their own contact data from the Google Places import.
  // Required by a database trigger on source='manual' regardless of what
  // this page sends; these fields existed nowhere in this form for a real
  // stretch of time, meaning every new-listing creation was silently
  // failing at the trigger with no way to fix it from here.
  const [streetAddress, setStreetAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  // logoUrl is only ever the real, uploaded Supabase Storage public URL --
  // never set to a local preview. pendingLogoFile holds a selected file
  // before it can actually be uploaded, and logoPreviewUrl (an effect
  // below) is what the abn step's <img> actually displays: the real
  // logoUrl once uploaded, or a local object URL for pendingLogoFile in
  // the meantime. See handleLogoChange for why the split exists.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [resultSlug, setResultSlug] = useState<string | null>(null);
  const [resultOutcome, setResultOutcome] = useState<"claimed" | "created_new" | null>(null);
  const [resultVerified, setResultVerified] = useState(false);

  // Returning tradie who already claimed a listing shouldn't have to search
  // for their business again just to log back in - send them straight to
  // the management screen instead. Returns true if it redirected.
  async function redirectIfAlreadyClaimed(): Promise<boolean> {
    try {
      const res = await fetch("/api/directory/manage");
      if (res.ok) {
        router.push("/directory/manage");
        return true;
      }
    } catch {
      // fall through - if this check fails, just proceed to the normal
      // search flow rather than blocking the user entirely
    }
    return false;
  }

  // Reordered from auth-first after checking real numbers: 2,080 page
  // loads and 495 distinct visitors to this page over 5 days, and exactly
  // one ever reached the actual claim submission. The very first thing
  // everyone saw was a mandatory account-creation form, before they had
  // even confirmed their business was in the directory or seen anything
  // resembling a payoff. Search/resolve/abn now come first regardless of
  // auth state; an account is only asked for at the point someone is
  // actually about to submit, once they have something concrete to want.
  //
  // Auth state is still checked on mount, for three things that still
  // need it up front: (1) an already-logged-in tradie (e.g. an existing
  // $45 platform user extending into the directory) should skip the auth
  // step entirely at submission time; (2) someone who already has a
  // claimed listing should be sent straight to managing it, not back
  // through search; (3) restoring in-progress claim data after an email
  // confirmation round trip -- see below.
  const STASH_KEY = "swiftscope_claim_draft";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setIsAuthed(!!data.user);

      if (data.user) {
        // Email confirmation redirects the browser to a fresh load of this
        // same page, which loses all React state -- businessName and
        // suburb survive via the URL's own query params, but abn, logoUrl
        // and which exact listing was matched do not, since those are
        // only ever set interactively during search -> resolve -> abn.
        // Stashed to sessionStorage right before the redirect (see
        // handleAuth), restored here so a signup that required email
        // confirmation does not throw away two screens of already-entered
        // work and land the person back at a blank search box.
        const stashed = sessionStorage.getItem(STASH_KEY);
        if (stashed) {
          sessionStorage.removeItem(STASH_KEY);
          try {
            const draft = JSON.parse(stashed);
            setBusinessName(draft.businessName ?? "");
            setTrade(draft.trade ?? "");
            setSuburb(draft.suburb ?? "");
            setPostcode(draft.postcode ?? "");
            setAbn(draft.abn ?? "");
            setSelectedListingId(draft.selectedListingId ?? null);
            setStreetAddress(draft.streetAddress ?? "");
            setContactPhone(draft.contactPhone ?? "");
            setCheckingAuth(false);

            // A logo picked before a session existed was stashed as a
            // data URL (see stashDraftForRedirect), not uploaded yet --
            // there is a real session now, so do the actual upload here
            // rather than passing the stashed data URL itself down to
            // finaliseClaim, which expects a real Supabase Storage URL,
            // not a multi-megabyte base64 string.
            let resolvedLogoUrl: string | null = draft.logoUrl ?? null;
            if (draft.pendingLogoDataUrl) {
              try {
                const file = dataUrlToFile(draft.pendingLogoDataUrl, draft.pendingLogoFileName ?? "logo.jpg");
                resolvedLogoUrl = await uploadLogoFile(file, data.user.id);
                setLogoUrl(resolvedLogoUrl);
              } catch (err) {
                console.error("[claim] failed to upload stashed logo:", err);
                // Not fatal to the claim itself -- proceed without a
                // logo rather than blocking someone's entire signup over
                // an image that failed to re-upload.
              }
            } else {
              setLogoUrl(resolvedLogoUrl);
            }

            await finaliseClaim(draft.selectedListingId === "new" ? null : draft.selectedListingId, {
              businessName: draft.businessName ?? "",
              trade: draft.trade ?? "",
              suburb: draft.suburb ?? "",
              postcode: draft.postcode ?? "",
              abn: draft.abn ?? "",
              logoUrl: resolvedLogoUrl,
              streetAddress: draft.streetAddress ?? "",
              contactPhone: draft.contactPhone ?? "",
            });
            return;
          } catch {
            // Malformed stash -- fall through to the normal flow rather
            // than getting stuck.
          }
        }

        const redirected = await redirectIfAlreadyClaimed();
        if (redirected) { setCheckingAuth(false); return; }
      }

      await resolveEntryStep();
      setCheckingAuth(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Claim links (outreach emails, HubSpot export, admin-triggered invites)
  // carry a claim_token that resolves straight to one exact listing -
  // skips the fuzzy search-and-pick step entirely. Falls back to the
  // normal search step if there's no token, or if it doesn't resolve.
  async function resolveEntryStep() {
    const token = searchParams.get("token");
    if (!token) {
      // A real gap, not a hunch: two outreach-campaign visitors (Revma
      // Electrical, Tucker Wired Electrical Solutions) landed on this
      // exact search screen with their business name already filled in
      // from the link's ?name=&trade=&suburb= params, and neither ever
      // clicked "Find my business" -- zero accounts, zero claim attempts,
      // nothing. A form that already shows your own business name reads
      // as "this is already done" to someone skimming an email link, not
      // as "there is still a button to press." Auto-run the same search
      // a token link already gets, rather than making a fully-identified
      // outreach visitor click through a form that looks finished.
      const nameParam = searchParams.get("name");
      const tradeParam = searchParams.get("trade");
      const suburbParam = searchParams.get("suburb");
      if (nameParam?.trim() && tradeParam?.trim() && suburbParam?.trim()) {
        const ran = await runSearch(nameParam, tradeParam, suburbParam, searchParams.get("postcode") ?? "");
        if (ran) return;
      }
      setStep("search");
      return;
    }
    try {
      const res = await fetch("/api/directory/lookup-by-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || !data.match) {
        setStep("search");
        return;
      }
      if (data.isClaimed) {
        // Already claimed by someone else by the time they clicked through
        // - fall back to search rather than dead-ending them.
        setStep("search");
        return;
      }
      setBusinessName(data.match.business_name ?? businessName);
      setSuburb(data.match.suburb ?? suburb);
      if (Array.isArray(data.match.trades) && data.match.trades[0]) setTrade(data.match.trades[0]);
      setStrongMatch(data.match);
      setMatches([data.match]);
      setStep("resolve");
    } catch {
      setStep("search");
    }
  }

  // Shared by both full-page-redirect paths (email confirmation and
  // Google sign-in) that unmount this component before it can come back.
  // A raw File cannot survive that (not serialisable to sessionStorage),
  // so a selected-but-not-yet-uploaded logo is converted to a data URL
  // first -- the mount effect's restore logic converts it back to a File
  // and does the real upload once a session actually exists.
  async function stashDraftForRedirect() {
    try {
      const pendingLogoDataUrl = pendingLogoFile ? await fileToDataUrl(pendingLogoFile) : null;
      sessionStorage.setItem(STASH_KEY, JSON.stringify({
        businessName, trade, suburb, postcode, abn, logoUrl, selectedListingId,
        streetAddress, contactPhone,
        pendingLogoDataUrl, pendingLogoFileName: pendingLogoFile?.name ?? null,
      }));
    } catch {
      // sessionStorage can throw in some privacy modes, and a very large
      // image could in principle exceed its quota -- the person just
      // re-enters ABN/logo after confirming, not a hard failure either way.
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setAuthLoading(true);
    try {
      const supabase = createClient();
      if (authMode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Explicitly back to /directory/claim - never the $45 plan's
            // /onboarding default that a bare signUp() would otherwise send
            // an email-confirmation link to. Preserve the query string so
            // a claim_token (or pre-filled name/trade/suburb) survives the
            // email-confirmation round trip instead of dropping the user
            // back at a blank search step.
            emailRedirectTo: `${window.location.origin}/directory/claim${window.location.search}`,
            // Read by handle_new_user() (see migration) to skip starting a
            // platform trial. Without this, every directory-only signup got
            // trial_ends_at = now() + 7 days like a real platform signup,
            // and middleware's trialStillValid check does not look at
            // subscription_status, only trial_ends_at - so a listing-only
            // account got full access to quoting, jobs, materials etc for
            // a week with no card and no intent to use any of it. Found via
            // team+demosu@swiftscope.com.au, created purely to test this
            // form, which came out with live platform access.
            data: { signup_source: "directory_claim" },
          },
        });
        if (signUpError) { setError(signUpError.message); return; }
        if (data.session) {
          // No email confirmation required for this project/config -
          // straight to submitting the claim they already filled in,
          // rather than back through resolveEntryStep (which would send
          // them to "search" and throw away everything entered so far).
          await resolvePendingLogoAndFinalise(selectedListingId === "new" ? null : selectedListingId);
        } else {
          // Email confirmation required. The browser is about to redirect
          // away and this component will fully unmount, so stash what has
          // already been entered -- it is restored and submitted
          // automatically by the mount effect once they click back
          // through from their inbox and land here authenticated.
          await stashDraftForRedirect();
          setCheckYourEmail(true);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) { setError(signInError.message); return; }
        const redirected = await redirectIfAlreadyClaimed();
        if (!redirected) {
          // Logging in mid-claim (not a fresh visit) - submit what was
          // already collected rather than sending them back to search.
          await resolvePendingLogoAndFinalise(selectedListingId === "new" ? null : selectedListingId);
        }
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function runSearch(name: string, tradeVal: string, suburbVal: string, postcodeVal: string): Promise<boolean> {
    setSearching(true);
    try {
      const res = await fetch("/api/directory/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: name, trade: tradeVal, suburb: suburbVal, postcode: postcodeVal.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed. Please try again.");
        return false;
      }
      setMatches(data.matches ?? []);
      setStrongMatch(data.strongMatch ?? null);
      setStep("resolve");
      return true;
    } catch {
      setError("Search failed. Please check your connection and try again.");
      return false;
    } finally {
      setSearching(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!businessName.trim() || !trade || !suburb.trim()) {
      setError("Please fill in your business name, trade, and suburb.");
      return;
    }
    if (postcode.trim() && !/^\d{4}$/.test(postcode.trim())) {
      setError("Postcode must be 4 digits.");
      return;
    }
    await runSearch(businessName, trade, suburb, postcode);
  }

  // Keeps the abn step's preview in sync with whichever of logoUrl /
  // pendingLogoFile is currently the real answer, and revokes the object
  // URL when it is replaced or the component unmounts, so a page session
  // with several logo picks does not leak blob URLs.
  useEffect(() => {
    if (logoUrl) {
      setLogoPreviewUrl(logoUrl);
      return;
    }
    if (pendingLogoFile) {
      const objectUrl = URL.createObjectURL(pendingLogoFile);
      setLogoPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setLogoPreviewUrl(null);
  }, [logoUrl, pendingLogoFile]);

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  function dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/jpeg";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  }

  // The actual Supabase Storage write, split out of handleLogoChange so it
  // can also run later -- once authentication actually exists -- for a
  // file that was selected before it did.
  async function uploadLogoFile(file: File, userId: string): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("logos").upload(path, file, { upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    try {
      // This is the bug a real tradie hit: the abn step (where this input
      // lives) is now reached before authentication, on purpose, but this
      // upload still silently required a session -- `if (!user) return`
      // with no error shown, so choosing a logo before creating an
      // account looked like it worked (the file picker closed normally)
      // while nothing was actually uploaded and the placeholder icon never
      // changed. Store the file and preview it locally instead of
      // uploading yet; the real upload happens once a session actually
      // exists, from whichever path gets there (see finaliseClaim's
      // callers and the mount effect's stash-restore).
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPendingLogoFile(file);
        return;
      }
      const url = await uploadLogoFile(file, user.id);
      setLogoUrl(url);
      setPendingLogoFile(null);
    } catch (err) {
      setError(`Logo upload failed: ${err instanceof Error ? err.message : "please try again"}`);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function finaliseClaim(
    listingId: string | null,
    override?: { businessName: string; trade: string; suburb: string; postcode: string; abn: string; logoUrl: string | null; streetAddress: string; contactPhone: string }
  ) {
    setSubmitting(true);
    setError(null);
    // override is used only right after restoring a sessionStorage draft
    // (see the mount effect): the setState calls that just ran to restore
    // that draft have not re-rendered yet, so businessName/trade/etc in
    // this closure would still read the empty initial values, not what
    // was just restored. Reading from the override object sidesteps that
    // rather than relying on state that has not settled yet.
    const b = override ?? { businessName, trade, suburb, postcode, abn, logoUrl, streetAddress, contactPhone };
    try {
      const res = await fetch("/api/directory/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          businessName: b.businessName,
          trade: b.trade,
          suburb: b.suburb,
          postcode: b.postcode.trim() || undefined,
          abn: b.abn.trim() || undefined,
          logoUrl: b.logoUrl || undefined,
          streetAddress: b.streetAddress.trim() || undefined,
          contactPhone: b.contactPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setExistingListingSlug(data.existingSlug ?? null);
        // Restoring from a draft and the submit itself failed (eg the
        // listing was claimed by someone else in the meantime) - land on
        // "abn" rather than leaving them stuck on a blank auth screen with
        // no way back to their own entered data.
        if (override) setStep("abn");
        return;
      }
      setResultSlug(data.slug);
      setResultOutcome(data.outcome);
      setResultVerified(Boolean(data.verifiedBadge));
      setStep("done");
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      if (override) setStep("abn");
    } finally {
      setSubmitting(false);
    }
  }

  // Uploads pendingLogoFile if one was selected before a session existed
  // (see handleLogoChange), then submits the claim. Used by both
  // immediate-auth paths in handleAuth (a fresh signup with no email
  // confirmation required, and logging into an existing account) -- both
  // stay on this page with no redirect, so pendingLogoFile is still a
  // real File in memory and can just be uploaded directly, no stash
  // needed.
  async function resolvePendingLogoAndFinalise(listingId: string | null) {
    if (!pendingLogoFile) {
      await finaliseClaim(listingId);
      return;
    }
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Should not happen -- this is only called right after a
        // successful auth call -- but fail safely rather than throw if
        // it somehow does.
        await finaliseClaim(listingId);
        return;
      }
      const url = await uploadLogoFile(pendingLogoFile, user.id);
      setLogoUrl(url);
      setPendingLogoFile(null);
      // Pass the freshly uploaded URL explicitly rather than relying on
      // the setLogoUrl above having re-rendered yet -- same staleness
      // reasoning as finaliseClaim's own override parameter.
      await finaliseClaim(listingId, { businessName, trade, suburb, postcode, abn, logoUrl: url, streetAddress, contactPhone });
    } catch (err) {
      setError(`Logo upload failed: ${err instanceof Error ? err.message : "please try again"}. You can remove it and try again, or finish without one.`);
      setStep("abn");
    }
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
        <Loader2 className="animate-spin text-[#0a1722]" size={28} />
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      <MarketingNav />

      <div className="max-w-2xl mx-auto px-6 py-14">
        <h1 className="font-display text-[2.2rem] sm:text-[2.6rem] text-[#0a1722] leading-tight mb-3">
          Claim or add your business listing
        </h1>
        <p className="text-[15px] text-[#5a6b78] mb-10">
          Get a free page in the Swiftscope directory, built for homeowners
          searching for a tradie in your area. Already listed? Claim it. Not
          listed yet? We&apos;ll create your page right now.
        </p>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-[13.5px] rounded-xl px-4 py-3 mb-6">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span>{error}</span>
              {existingListingSlug && (
                <Link href="/directory/manage" className="block mt-1.5 font-semibold underline underline-offset-2">
                  Manage your existing listing →
                </Link>
              )}
            </div>
          </div>
        )}

        {step === "auth" && (
          <div className="card p-6 rounded-2xl bg-white">
            {!checkYourEmail && (
              <button
                type="button"
                onClick={() => setStep("abn")}
                className="text-[13px] font-semibold text-[#5a6b78] hover:text-[#0a1722] mb-4"
              >
                ← Back to your details
              </button>
            )}
            {checkYourEmail ? (
              <div className="text-center py-4">
                <Mail size={32} className="text-[#ffb400] mx-auto mb-3" />
                <p className="text-[14px] text-[#0a1722] font-semibold mb-1">Check your email</p>
                <p className="text-[13.5px] text-[#5a6b78]">
                  We&apos;ve sent a confirmation link to {email}. Click it to come back here and set up your page.
                </p>
                <p className="text-[12.5px] text-[#8a97a1] mt-3">
                  Nothing arriving after a few minutes usually means you already have an account with
                  this email -- try the &quot;Log in&quot; tab instead, including &quot;Continue with
                  Google&quot; if that is how you originally signed up.
                </p>
              </div>
            ) : (
              <>
                {/* Added after a real tradie got stuck: they had signed up
                    for the $45 platform via Google separately, then tried
                    email+password here with the same address. Supabase
                    silently sends no confirmation email for an email that
                    is already registered (by design, to prevent account
                    enumeration) -- this button means someone in that exact
                    situation can just sign back in the way they actually
                    signed up, instead of only ever seeing an email
                    password form and hitting the same silent dead end.
                    Routed through a dedicated callback
                    (app/api/directory/auth-callback), not the shared
                    /auth/callback -- that one force-redirects a brand-new
                    user to the $45 plan's /onboarding regardless of where
                    they came from, which would recreate the same kind of
                    confusion for a genuinely new Google signup here. */}
                <GoogleSignInButton
                  next={`/directory/claim${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
                  callbackPath="/api/directory/auth-callback"
                  onBeforeRedirect={stashDraftForRedirect}
                />
                <div className="flex items-center gap-3 my-5">
                  <div className="h-px flex-1 bg-[#e8ecef]" />
                  <span className="text-[11.5px] font-semibold text-[#8a97a1] uppercase tracking-wide">or</span>
                  <div className="h-px flex-1 bg-[#e8ecef]" />
                </div>
              <form onSubmit={handleAuth} className="space-y-5">
                <div className="flex gap-1 bg-[#f1f4f6] rounded-lg p-1 mb-1">
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className={`flex-1 text-[13px] font-semibold py-1.5 rounded-md transition-colors ${authMode === "signup" ? "bg-white shadow-sm text-[#0a1722]" : "text-[#5a6b78]"}`}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className={`flex-1 text-[13px] font-semibold py-1.5 rounded-md transition-colors ${authMode === "login" ? "bg-white shadow-sm text-[#0a1722]" : "text-[#5a6b78]"}`}
                  >
                    Log in
                  </button>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97a1]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@business.com.au"
                      className="app-field w-full pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97a1]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={authMode === "signup" ? "Choose a password" : "Your password"}
                      className="app-field w-full pl-9"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {authLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {authLoading ? "One moment..." : authMode === "signup" ? "Create my account" : "Log in"}
                </button>

                <p className="text-[12px] text-[#8a97a1] text-center">
                  This is just for your directory page - not the full Swiftscope job management sign up. Already claimed a listing? Log in above to manage it.
                </p>
              </form>
              </>
            )}
          </div>
        )}

        {step === "search" && (
          <>
            {/* Deliberately not conditional on any client-side auth check --
                a real tradie reported repeatedly landing back on this
                search step instead of their existing listing, and every
                server-side piece the auto-redirect depends on
                (redirectIfAlreadyClaimed -> /api/directory/manage ->
                getActiveBusinessId) checked out correctly against their
                real account and a real, already-claimed listing. The most
                likely remaining explanation is the session itself not
                being present on whichever load this ran on (this page has
                been tested across multiple browsers, and a session lives
                per-browser) -- but rather than keep chasing the exact
                cause with no way to reproduce it, this gives a direct,
                manual path that works regardless of why the automatic one
                did not fire on a given visit. If there is no session,
                clicking this simply lands on a normal "please log in"
                state on /directory/manage rather than a dead end. */}
            <Link
              href="/directory/manage"
              className="block text-center text-[13px] font-semibold text-[#5a6b78] hover:text-[#0a1722] mb-4"
            >
              Already claimed your listing? Manage it here →
            </Link>
            <form onSubmit={handleSearch} className="card p-6 rounded-2xl bg-white space-y-5">
              <div>
                <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Business name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Smith Electrical"
                className="app-field w-full"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Trade</label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="app-field w-full"
              >
                <option value="">Select your trade</option>
                {TRADES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Suburb</label>
                <input
                  type="text"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  placeholder="e.g. Parramatta"
                  className="app-field w-full"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Postcode</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 2150"
                  className="app-field w-full"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={searching}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {searching ? "Searching..." : "Find my business"}
            </button>
            </form>
          </>
        )}

        {step === "resolve" && (
          <div className="space-y-4">
            {strongMatch ? (
              <div className="card p-6 rounded-2xl bg-white">
                <p className="text-[13px] font-semibold text-[#5a6b78] mb-4">Is this your business?</p>
                <ListingMatchCard match={strongMatch} />
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => { setSelectedListingId(strongMatch.id); setStep("abn"); }}
                    className="btn-primary flex-1"
                  >
                    Yes, this is us
                  </button>
                  <button
                    onClick={() => { setSelectedListingId("new"); setStep("abn"); }}
                    className="btn-secondary flex-1"
                  >
                    Not us
                  </button>
                </div>
              </div>
            ) : matches.length > 0 ? (
              <div className="card p-6 rounded-2xl bg-white">
                <p className="text-[13px] font-semibold text-[#5a6b78] mb-4">
                  We found a few similar listings. Is one of these you?
                </p>
                <div className="space-y-3">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedListingId(m.id); setStep("abn"); }}
                      className="w-full text-left"
                    >
                      <ListingMatchCard match={m} />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setSelectedListingId("new"); setStep("abn"); }}
                  className="btn-secondary w-full mt-4"
                >
                  None of these - create a new listing
                </button>
              </div>
            ) : (
              <div className="card p-6 rounded-2xl bg-white">
                <p className="text-[14px] text-[#5a6b78] mb-4">
                  We couldn&apos;t find an existing listing for &quot;{businessName}&quot;.
                  We&apos;ll create a brand new one for you.
                </p>
                <button
                  onClick={() => { setSelectedListingId("new"); setStep("abn"); }}
                  className="btn-primary w-full"
                >
                  Create my listing <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {step === "abn" && (
          <div className="card p-6 rounded-2xl bg-white space-y-5">
            {/* The suburb validation error can only ever be shown after
                Finish setup is clicked from here, but suburb itself is only
                ever editable on "search" -- this step never had a way back
                to it at all, so anyone who hit that error was stuck reading
                "please fix your suburb" on a screen with no suburb field. */}
            <button
              type="button"
              onClick={() => setStep("search")}
              className="text-[13px] font-semibold text-[#5a6b78] hover:text-[#0a1722]"
            >
              ← Back to search
            </button>

            {selectedListingId === "new" && (
              <>
                <div>
                  <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Business address</label>
                  <input
                    type="text"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="e.g. 12 King Street, Newtown"
                    className="app-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Contact number</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. 0412 345 678"
                    className="app-field w-full"
                  />
                  {/* Not for verification -- it is the number a homeowner
                      sees on the finished listing page, shown behind a
                      tap-to-reveal (see ContactReveal) rather than sitting
                      in the page's raw HTML, so it is not immediately
                      scrapeable. Required by a database trigger on new
                      (source='manual') listings regardless of what this
                      form sends -- see check_listing_has_real_identity. */}
                  <p className="text-[11.5px] text-[#8a97a1] mt-1.5">
                    Shown on your listing page behind a tap-to-reveal, so it is not sitting in plain text for scrapers.
                  </p>
                </div>
              </>
            )}
            <div>
              <label className="block text-[13px] font-semibold text-[#0a1722] mb-2">Logo or photo (optional)</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-[#f1f4f6] overflow-hidden flex items-center justify-center shrink-0">
                  {logoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreviewUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus size={20} className="text-[#8a97a1]" />
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="claim-logo-upload" />
                <label htmlFor="claim-logo-upload" className="btn-secondary cursor-pointer text-[13px] !py-1.5">
                  {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : "Upload logo"}
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
              <ShieldCheck size={15} />
              Add your ABN to show a verified badge on your page (optional, can add later)
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">ABN</label>
              <input
                type="text"
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                placeholder="11 digits"
                className="app-field w-full"
              />
            </div>
            <button
              onClick={() => {
                if (selectedListingId === "new" && (!streetAddress.trim() || !contactPhone.trim())) {
                  setError("Please add your business address and contact number.");
                  return;
                }
                if (isAuthed) {
                  finaliseClaim(selectedListingId === "new" ? null : selectedListingId);
                } else {
                  // This is the one and only place an account is asked
                  // for now - right at the point of actually committing,
                  // with the business already matched and every field
                  // already filled in, not as the first thing a visitor
                  // sees before they know whether their business is even
                  // in the directory.
                  setStep("auth");
                }
              }}
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? "Setting up your page..." : isAuthed ? "Finish setup" : "Create account & finish setup"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="card p-8 rounded-2xl bg-white text-center">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="font-display text-[1.6rem] text-[#0a1722] mb-2">
              {resultOutcome === "claimed" ? "Your page is claimed!" : "Your page is live!"}
            </h2>
            <p className="text-[14px] text-[#5a6b78] mb-2">
              Homeowners searching for a {trade} in {suburb} can now find you.
            </p>
            {abn && (
              <p className={`text-[13px] mb-6 ${resultVerified ? "text-emerald-600" : "text-[#8a97a1]"}`}>
                {resultVerified
                  ? "Your ABN was verified - the Verified Business badge is now showing on your page."
                  : "We couldn't verify that ABN right now. You can add it again later from Manage your page."}
              </p>
            )}
            {resultSlug && (
              <div className="flex items-center justify-center gap-3">
                <Link href={`/directory/${resultSlug}`} className="btn-primary inline-flex items-center gap-2">
                  View my page <ArrowRight size={16} />
                </Link>
                <Link href="/directory/manage" className="btn-secondary inline-flex items-center gap-2">
                  Add photos & description
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function ListingMatchCard({ match }: { match: ListingMatch }) {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <div className="flex items-center gap-3 border border-[#e5e9ec] rounded-xl p-3">
      {match.logo_url && !logoFailed && !match.logo_url.startsWith("http://") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={match.logo_url}
          alt=""
          className="w-10 h-10 rounded-lg object-cover shrink-0"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-[#f1f4f6] shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[#0a1722] truncate">{match.business_name}</p>
        <div className="flex items-center gap-3 text-[12px] text-[#5a6b78]">
          {match.suburb && (
            <span className="flex items-center gap-1"><MapPin size={11} /> {match.suburb}</span>
          )}
          {match.google_rating && (
            <span className="flex items-center gap-1"><Star size={11} className="fill-[#f59e0b] text-[#f59e0b]" /> {match.google_rating.toFixed(1)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
