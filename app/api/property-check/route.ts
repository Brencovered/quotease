import { NextResponse } from "next/server";

const HEADERS = {
  "User-Agent": "quotease-tradie-tool/1.0 (contact: hello@quotease.com.au)",
};

const VICPLAN = {
  overlays: "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer",
  heritage: "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/VicPlan_Heritage/MapServer",
  bushfire: "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/VicPlan_Bushfire/MapServer",
  zones:    "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeZones/MapServer",
};

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&countrycodes=au&limit=1`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { return null; }
}

async function identify(serviceUrl: string, lat: number, lon: number): Promise<unknown[]> {
  const geometry = JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } });
  // Use a very tight map extent (~20m radius) and tolerance of 1 pixel to avoid
  // false positives from neighbouring properties
  const delta = 0.0001; // ~11m -- tight enough to stay on-parcel
  const mapExtent = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const params = new URLSearchParams({
    f: "json",
    geometry,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    layers: "all",
    tolerance: "1",        // 1 pixel only -- was 3 (too loose)
    mapExtent,
    imageDisplay: "800,800,96",
    returnGeometry: "false",
  });
  try {
    const res = await fetch(`${serviceUrl}/identify?${params}`, { headers: HEADERS });
    const data = await res.json();
    return data.results ?? [];
  } catch { return []; }
}

function decodeZone(raw: string): string {
  return raw
    .replace(/^GRZ\d*/i,    "General Residential Zone")
    .replace(/^NRZ\d*/i,    "Neighbourhood Residential Zone")
    .replace(/^MUZ\d*/i,    "Mixed Use Zone")
    .replace(/^LDRZ\d*/i,   "Low Density Residential Zone")
    .replace(/^RGZ\d*/i,    "Residential Growth Zone")
    .replace(/^TZ\d*/i,     "Township Zone")
    .replace(/^RUZ\d*/i,    "Rural Zone")
    .replace(/^RCZ\d*/i,    "Rural Conservation Zone")
    .replace(/^RURFLZ\d*/i, "Rural Floodway Zone")
    .replace(/^C1Z\d*/i,    "Commercial 1 Zone")
    .replace(/^C2Z\d*/i,    "Commercial 2 Zone")
    .replace(/^IN1Z\d*/i,   "Industrial 1 Zone")
    .replace(/^IN2Z\d*/i,   "Industrial 2 Zone")
    .replace(/^IN3Z\d*/i,   "Industrial 3 Zone")
    .replace(/^PUZ\d*/i,    "Public Use Zone")
    .replace(/^PCRZ\d*/i,   "Public Conservation & Resource Zone")
    .replace(/^RDZ\d*/i,    "Road Zone")
    .replace(/^CDZ\d*/i,    "Comprehensive Development Zone")
    .replace(/^DZ\d*/i,     "Development Zone")
    .replace(/^UFZ\d*/i,    "Urban Floodway Zone");
  // Note: ZN codes and others are returned as-is for the raw field,
  // and shown as "check on VicPlan" in the UI only if nothing else matched
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const debug   = searchParams.get("debug") === "1";

  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const isVic = /\bVIC\b/i.test(address) || /\bvictoria\b/i.test(address) || /\b3\d{3}\b/.test(address);
  if (!isVic) {
    return NextResponse.json({ found: false, reason: "Property lookup currently covers Victoria only. More states coming soon." });
  }

  const coords = await geocode(address);
  if (!coords) return NextResponse.json({ found: false, reason: "Could not geocode this address." });

  const { lat, lon } = coords;

  const [overlayResults, heritageResults, bushfireResults, zoneResults] = await Promise.all([
    identify(VICPLAN.overlays, lat, lon),
    identify(VICPLAN.heritage, lat, lon),
    identify(VICPLAN.bushfire, lat, lon),
    identify(VICPLAN.zones, lat, lon),
  ]);

  // Heritage: only flag if the dedicated heritage service returns results
  // OR the overlays layer has a feature whose layer name contains "Heritage"
  // and the overlay code starts with "HO"
  const heritageFromLayer = heritageResults.length > 0;
  const heritageFromOverlay = (overlayResults as Array<{ layerName?: string; value?: string; attributes?: Record<string, string> }>)
    .some((f) => {
      const layerName = f.layerName ?? "";
      const code = f.value || f.attributes?.ZONE_CODE || f.attributes?.OVERLAY_CODE || "";
      return /heritage/i.test(layerName) && /^HO/i.test(code);
    });
  const heritageOverlay = heritageFromLayer || heritageFromOverlay;

  // Bushfire: the bushfire service returns results only if the point
  // is actually within a designated BPA polygon
  const bushfireOverlay = bushfireResults.length > 0;

  // Overlay names from the overlays layer (for informational display)
  const overlayNames: string[] = [];
  for (const f of overlayResults as Array<{ value?: string; attributes?: Record<string, string> }>) {
    const name = f.value || f.attributes?.ZONE_CODE || f.attributes?.OVERLAY_CODE || "";
    if (name) overlayNames.push(name);
  }

  // Zone
  const rawZones: string[] = [];
  for (const f of zoneResults as Array<{ value?: string; attributes?: Record<string, string> }>) {
    const name = f.value || f.attributes?.ZONE_CODE || "";
    if (name) rawZones.push(name);
  }

  const zoneRaw   = rawZones[0] ?? null;
  const zoneDecoded = zoneRaw ? decodeZone(zoneRaw) : null;
  // If the decoded string still looks like a raw code (unchanged), mark it for manual check
  const zoneLabel = zoneDecoded && zoneDecoded !== zoneRaw
    ? zoneDecoded
    : zoneRaw
      ? `${zoneRaw} - verify on VicPlan`
      : null;

  const vicplanUrl = `https://mapshare.vic.gov.au/vicplan/?query=${encodeURIComponent(address)}`;

  const flags = [
    heritageOverlay ? {
      type: "heritage", severity: "warning",
      label: "Heritage Overlay",
      detail: "This property is under a Heritage Overlay. Expect restricted access, heritage-compliant materials, and possible council approvals. Labour costs will be significantly higher.",
      verifyUrl: vicplanUrl, verifyLabel: "Verify on VicPlan →",
    } : null,
    bushfireOverlay ? {
      type: "bushfire", severity: "warning",
      label: "Bushfire Management Overlay",
      detail: "Bushfire Prone Area applies. BAL rating may affect materials and compliance requirements. Confirm with local council before finalising the quote.",
      verifyUrl: vicplanUrl, verifyLabel: "Verify on VicPlan →",
    } : null,
    zoneLabel ? {
      type: "zone", severity: "info",
      label: zoneLabel, detail: null,
      verifyUrl: vicplanUrl, verifyLabel: "View on VicPlan →",
    } : null,
  ].filter(Boolean);

  return NextResponse.json({
    found: true, lat, lon,
    heritageOverlay, bushfireOverlay,
    overlays: overlayNames,
    zones: rawZones,
    zoneLabel,
    ceilingHint: heritageOverlay ? "heritage_timber" : null,
    flags,
    // Debug field: include raw API responses when ?debug=1
    ...(debug ? { _raw: { overlayResults, heritageResults, bushfireResults, zoneResults } } : {}),
  });
}
