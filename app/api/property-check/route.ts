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
  const mapExtent = `${lon - 0.001},${lat - 0.001},${lon + 0.001},${lat + 0.001}`;
  const params = new URLSearchParams({
    f: "json", geometry, geometryType: "esriGeometryPoint", sr: "4326",
    layers: "all", tolerance: "3", mapExtent, imageDisplay: "600,600,96", returnGeometry: "false",
  });
  try {
    const res = await fetch(`${serviceUrl}/identify?${params}`, { headers: HEADERS });
    const data = await res.json();
    return data.results ?? [];
  } catch { return []; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
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

  let heritageOverlay = heritageResults.length > 0;
  const overlayNames: string[] = [];
  for (const f of overlayResults as Array<{ value?: string; attributes?: Record<string, string> }>) {
    const name = f.value || f.attributes?.ZONE_CODE || f.attributes?.Name || "";
    if (name) overlayNames.push(name);
    if (/\bHO\b/i.test(name) || /heritage/i.test(name)) heritageOverlay = true;
  }

  const bushfireOverlay = bushfireResults.length > 0;

  const zones: string[] = [];
  for (const f of zoneResults as Array<{ value?: string; attributes?: Record<string, string> }>) {
    const name = f.value || f.attributes?.ZONE_CODE || "";
    if (name) zones.push(name);
  }

  const zoneLabel = zones[0]
    ? zones[0]
        .replace(/^GRZ\d*/i,  "General Residential Zone")
        .replace(/^NRZ\d*/i,  "Neighbourhood Residential Zone")
        .replace(/^MUZ\d*/i,  "Mixed Use Zone")
        .replace(/^LDRZ\d*/i, "Low Density Residential Zone")
        .replace(/^RGZ\d*/i,  "Residential Growth Zone")
        .replace(/^TZ\d*/i,   "Township Zone")
        .replace(/^RUZ\d*/i,  "Rural Zone")
        .replace(/^RCZ\d*/i,  "Rural Conservation Zone")
        .replace(/^RURFLZ\d*/i,"Rural Floodway Zone")
        .replace(/^C1Z\d*/i,  "Commercial 1 Zone")
        .replace(/^C2Z\d*/i,  "Commercial 2 Zone")
        .replace(/^IN1Z\d*/i, "Industrial 1 Zone")
        .replace(/^IN2Z\d*/i, "Industrial 2 Zone")
        .replace(/^IN3Z\d*/i, "Industrial 3 Zone")
        .replace(/^PUZ\d*/i,  "Public Use Zone")
        .replace(/^PCRZ\d*/i, "Public Conservation & Resource Zone")
        .replace(/^RDZ\d*/i,  "Road Zone")
        .replace(/^CDZ\d*/i,  "Comprehensive Development Zone")
        .replace(/^DZ\d*/i,   "Development Zone")
        .replace(/^UFZ\d*/i,  "Urban Floodway Zone")
        .replace(/^ZN\d*/i,   "Unclassified Zone (verify on VicPlan)")
    : null;

  // VicPlan public viewer URL for this address
  const vicplanUrl = `https://mapshare.vic.gov.au/vicplan/?query=${encodeURIComponent(address)}`;

  const flags = [
    heritageOverlay ? {
      type: "heritage", severity: "warning",
      label: "Heritage Overlay",
      detail: "This property is under a Heritage Overlay. Expect restricted access, heritage-compliant materials, and possible council approvals. Labour costs will be significantly higher.",
      verifyUrl: vicplanUrl,
      verifyLabel: "Verify on VicPlan →",
    } : null,
    bushfireOverlay ? {
      type: "bushfire", severity: "warning",
      label: "Bushfire Management Overlay",
      detail: "Bushfire Prone Area applies. BAL rating may affect materials and compliance requirements. Confirm with local council before finalising the quote.",
      verifyUrl: vicplanUrl,
      verifyLabel: "Verify on VicPlan →",
    } : null,
    zoneLabel ? {
      type: "zone", severity: "info",
      label: zoneLabel,
      detail: null,
      verifyUrl: vicplanUrl,
      verifyLabel: "View on VicPlan →",
    } : null,
  ].filter(Boolean);

  return NextResponse.json({
    found: true, lat, lon,
    heritageOverlay, bushfireOverlay,
    overlays: overlayNames, zones, zoneLabel,
    ceilingHint: heritageOverlay ? "heritage_timber" : null,
    flags,
  });
}
