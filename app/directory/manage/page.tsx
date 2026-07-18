"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MarketingNav from "@/components/MarketingNav";
import { buildDirectorySlug } from "@/lib/seo/meta";
import OwnerGoalWidget from "./_components/OwnerGoalWidget";
import {
  Loader2, ImagePlus, X, Save, AlertCircle, CheckCircle2,
  Link2, Globe, ExternalLink,
} from "lucide-react";

type License = { type: string; number: string };

type Listing = {
  id: string;
  business_name: string;
  suburb: string | null;
  trades: string[] | null;
  blurb: string | null;
  logo_url: string | null;
  photo_references: string[] | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  services_offered: string[] | null;
  years_experience: number | null;
  licenses: License[] | null;
};

const MAX_PHOTOS = 8;

export default function ManageDirectoryListingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [listing, setListing] = useState<Listing | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [blurb, setBlurb] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [licenses, setLicenses] = useState<License[]>([]);
  const [licenseTypeInput, setLicenseTypeInput] = useState("");
  const [licenseNumberInput, setLicenseNumberInput] = useState("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/directory/manage")
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json();
          setError(d.error ?? "Could not load your page.");
          return;
        }
        const data = await r.json();
        setListing(data.listing);
        setBusinessId(data.businessId);
        setBlurb(data.listing.blurb ?? "");
        setLogoUrl(data.listing.logo_url ?? null);
        setPhotos(data.listing.photo_references ?? []);
        setWebsiteUrl(data.listing.website_url ?? "");
        setInstagramUrl(data.listing.instagram_url ?? "");
        setFacebookUrl(data.listing.facebook_url ?? "");
        setServices(data.listing.services_offered ?? []);
        setYearsExperience(data.listing.years_experience != null ? String(data.listing.years_experience) : "");
        setLicenses(data.listing.licenses ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  function addService() {
    const trimmed = serviceInput.trim();
    if (!trimmed || services.length >= 15 || services.includes(trimmed)) {
      setServiceInput("");
      return;
    }
    setServices((s) => [...s, trimmed]);
    setServiceInput("");
  }

  function removeService(service: string) {
    setServices((s) => s.filter((x) => x !== service));
  }

  function addLicense() {
    const type = licenseTypeInput.trim();
    const number = licenseNumberInput.trim();
    if (!type || !number || licenses.length >= 10) return;
    setLicenses((l) => [...l, { type, number }]);
    setLicenseTypeInput("");
    setLicenseNumberInput("");
  }

  function removeLicense(index: number) {
    setLicenses((l) => l.filter((_, i) => i !== index));
  }

  async function uploadFile(file: File, bucket: string): Promise<string | null> {
    if (!businessId) return null;
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (uploadErr) {
      setError(`Upload failed: ${uploadErr.message}`);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    const url = await uploadFile(file, "logos");
    if (url) setLogoUrl(url);
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (photos.length >= MAX_PHOTOS) {
      setError(`You can have up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setUploadingPhoto(true);
    setError(null);
    const remaining = MAX_PHOTOS - photos.length;
    const toUpload = files.slice(0, remaining);
    const uploaded: string[] = [];
    for (const file of toUpload) {
      const url = await uploadFile(file, "directory-photos");
      if (url) uploaded.push(url);
    }
    setPhotos((p) => [...p, ...uploaded]);
    setUploadingPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function removePhoto(url: string) {
    setPhotos((p) => p.filter((u) => u !== url));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/directory/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blurb,
          logo_url: logoUrl ?? "",
          photo_references: photos,
          website_url: websiteUrl,
          instagram_url: instagramUrl,
          facebook_url: facebookUrl,
          services_offered: services,
          years_experience: yearsExperience.trim() === "" ? null : Number(yearsExperience),
          licenses,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
        <Loader2 className="animate-spin text-[#0a1722]" size={28} />
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen" style={{ background: "var(--app-bg)" }}>
        <MarketingNav />
        <div className="max-w-2xl mx-auto px-6 py-14">
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-[13.5px] rounded-xl px-4 py-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error ?? "You don't have a claimed directory page yet."}</span>
          </div>
          <Link href="/directory/claim" className="btn-primary inline-flex items-center gap-2 mt-5">
            Claim a directory page
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      <MarketingNav />

      <div className="max-w-2xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-[2rem] text-[#0a1722]">Manage your page</h1>
          <a
            href={`/directory/${buildDirectorySlug({ id: listing.id, business_name: listing.business_name, suburb: listing.suburb ?? "" })}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-[#5a6b78] hover:underline inline-flex items-center gap-1"
          >
            View live page <ExternalLink size={12} />
          </a>
        </div>
        <p className="text-[14px] text-[#5a6b78] mb-8">{listing.business_name} -- {listing.suburb}</p>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-[13.5px] rounded-xl px-4 py-3 mb-6">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="card p-6 rounded-2xl bg-white space-y-6">
          {/* Logo */}
          <div>
            <label className="block text-[13px] font-semibold text-[#0a1722] mb-2">Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-[#f1f4f6] overflow-hidden flex items-center justify-center shrink-0">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={20} className="text-[#8a97a1]" />
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="logo-upload" />
              <label htmlFor="logo-upload" className="btn-secondary cursor-pointer text-[13px] !py-1.5">
                {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : "Upload logo"}
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Description</label>
            <textarea
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              maxLength={1500}
              rows={6}
              placeholder="Tell homeowners what you do, what makes you different, and why they should choose you. This is the main thing homeowners read before requesting a quote, so give it some detail..."
              className="app-field w-full resize-none"
            />
            <p className="text-[11.5px] text-[#8a97a1] mt-1">{blurb.length}/1500</p>
          </div>

          {/* Services offered */}
          <div>
            <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Services offered</label>
            <p className="text-[12px] text-[#8a97a1] mb-2">
              Add specific services so homeowners know exactly what you do, e.g. &quot;Switchboard upgrades&quot;, &quot;Emergency callouts&quot;, &quot;Hot water systems&quot;.
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {services.map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-[12.5px] font-medium bg-[#f1f4f6] text-[#0a1722] rounded-full pl-3 pr-2 py-1">
                  {s}
                  <button onClick={() => removeService(s)} className="text-[#8a97a1] hover:text-[#0a1722]">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            {services.length < 15 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={serviceInput}
                  onChange={(e) => setServiceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addService(); } }}
                  placeholder="Add a service and press Enter"
                  className="app-field flex-1"
                />
                <button onClick={addService} type="button" className="btn-secondary text-[13px]">Add</button>
              </div>
            )}
          </div>

          {/* Years experience */}
          <div>
            <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Years of experience</label>
            <input
              type="number"
              min={0}
              max={80}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              placeholder="e.g. 12"
              className="app-field w-32"
            />
          </div>

          {/* Licenses / certifications */}
          <div>
            <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Licences & certifications</label>
            <p className="text-[12px] text-[#8a97a1] mb-2">
              e.g. Electrical Contractor Licence, plumbing licence, builder&apos;s licence, working-at-heights certification.
            </p>
            {licenses.length > 0 && (
              <div className="space-y-2 mb-3">
                {licenses.map((l, i) => (
                  <div key={`${l.type}-${l.number}-${i}`} className="flex items-center justify-between gap-2 bg-[#f1f4f6] rounded-lg px-3 py-2">
                    <span className="text-[13px] text-[#0a1722]">
                      <span className="font-semibold">{l.type}</span> -- {l.number}
                    </span>
                    <button onClick={() => removeLicense(i)} className="text-[#8a97a1] hover:text-[#0a1722] shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {licenses.length < 10 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseTypeInput}
                  onChange={(e) => setLicenseTypeInput(e.target.value)}
                  placeholder="Licence type"
                  className="app-field flex-1"
                />
                <input
                  type="text"
                  value={licenseNumberInput}
                  onChange={(e) => setLicenseNumberInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLicense(); } }}
                  placeholder="Licence number"
                  className="app-field flex-1"
                />
                <button onClick={addLicense} type="button" className="btn-secondary text-[13px] shrink-0">Add</button>
              </div>
            )}
          </div>

          {/* Gallery */}
          <div>
            <label className="block text-[13px] font-semibold text-[#0a1722] mb-2">
              Photos ({photos.length}/{MAX_PHOTOS})
            </label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {photos.map((url) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-[#f1f4f6] group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            {photos.length < MAX_PHOTOS && (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="btn-secondary cursor-pointer text-[13px] !py-1.5 inline-flex items-center gap-1.5">
                  {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  Add photos
                </label>
              </>
            )}
          </div>

          {/* Socials */}
          <div className="space-y-3">
            <label className="block text-[13px] font-semibold text-[#0a1722]">Website & socials</label>
            <div className="relative">
              <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97a1]" />
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="Your website"
                className="app-field w-full pl-9"
              />
            </div>
            <div className="relative">
              <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97a1]" />
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="Instagram link"
                className="app-field w-full pl-9"
              />
            </div>
            <div className="relative">
              <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97a1]" />
              <input
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="Facebook link"
                className="app-field w-full pl-9"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
          </button>
        </div>

        {/* Monthly goal -- private to this page, never shown to the public */}
        <div className="card p-6 rounded-2xl bg-[#fffbeb] mt-6">
          <OwnerGoalWidget />
        </div>
      </div>
    </main>
  );
}
