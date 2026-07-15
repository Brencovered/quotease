"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

type Job = {
  id: string;
  job_id?: string | null;
  client_name: string | null;
  site_address: string | null;
  status: string;
  total_cost: number | null;
  site_lat: number | null;
  site_lng: number | null;
};

const STATUS_COLOR: Record<string, string> = {
  accepted: "#FFB400",
  paid: "#16A34A",
};

export default function MapPanel({ jobs }: { jobs: Job[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!mapRef.current || jobs.length === 0) return;

    import("leaflet").then((L) => {
      if (mapInstanceRef.current) return; // already initialized (e.g. fast refresh)

      const map = L.map(mapRef.current!).setView([jobs[0].site_lat!, jobs[0].site_lng!], 11);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];

      for (const job of jobs) {
        const color = STATUS_COLOR[job.status] ?? "#8993A1";
        const icon = L.divIcon({
          html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const marker = L.marker([job.site_lat!, job.site_lng!], { icon }).addTo(map);
        marker.bindPopup(
          `<div style="font-family:Archivo,sans-serif;min-width:160px;">
             <p style="font-weight:700;margin:0 0 2px;">${job.client_name ?? "Unnamed client"}</p>
             <p style="font-size:12px;color:#666;margin:0 0 6px;">${job.site_address ?? ""}</p>
             <p style="font-weight:700;margin:0 0 6px;">$${(job.total_cost ?? 0).toLocaleString()}</p>
             <a href="/${job.job_id ? `jobs/${job.job_id}` : `quotes/${job.id}`}" style="color:#0a1722;font-weight:600;font-size:12.5px;text-decoration:underline;">View job →</a>
           </div>`
        );
        bounds.push([job.site_lat!, job.site_lng!]);
      }

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="map-page-wrap max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-16">
      <h1 className="font-display text-2xl text-[var(--ink)] mb-4">Job map</h1>

      {jobs.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-8 text-center">
          <p className="text-[var(--ink-faint)] text-sm">
            No accepted jobs with a site address yet - they&apos;ll show up here once you&apos;ve got some.
          </p>
        </div>
      ) : (
        <>
          <div ref={mapRef} className="w-full h-[60vh] rounded-xl border border-[var(--line)]" />
          <div className="flex gap-4 mt-3 text-[12.5px] text-[var(--ink-faint)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#FFB400" }} /> Active job
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#16A34A" }} /> Paid
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 mt-4">
            {jobs.map((j) => (
              <Link
                key={j.id}
                href={j.job_id ? `/jobs/${j.job_id}` : `/quotes/${j.id}`}
                className="flex items-center justify-between bg-[var(--surface)] border border-[var(--line)] rounded-lg px-3 py-2.5 text-[13px]"
              >
                <span className="text-[var(--ink)] font-medium truncate">{j.client_name ?? "Unnamed"}</span>
                <span className="text-[var(--ink-faint)] truncate ml-2">{j.site_address}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
