/**
 * lib/seo/tradeVisuals.tsx
 * -------------------------
 * Per-trade icon + "impact" line, used to give each trade x suburb landing
 * page (app/[tradeSuburb]/page.tsx) and the homepage trade strip a
 * distinctive visual identity.
 *
 * Deliberately icon-based rather than stock photography: this codebase's
 * <Image> remotePatterns and CSP img-src only allow images.unsplash.com,
 * and picking new photo IDs for 13 trades without being able to verify
 * they resolve risks shipping broken images across hundreds of
 * programmatic SEO pages. lucide-react is already a bundled dependency,
 * so there's nothing external to verify.
 */
import type { LucideIcon } from "lucide-react";
import {
  Zap, Wrench, HardHat, Home, Paintbrush, Hammer, Grid3x3, Sprout,
  TreeDeciduous, Blocks, Fence, AirVent, Ruler, Briefcase,
} from "lucide-react";

export interface TradeVisual {
  icon: LucideIcon;
  /** One line on what this trade actually delivers on a job -- used in the
   *  hero "impact strip" so the page reads as more than a listings table. */
  impact: string;
}

const TRADE_VISUALS: Record<string, TradeVisual> = {
  electrician: { icon: Zap,            impact: "Safe, code-compliant power and lighting that keeps a property running." },
  plumber:     { icon: Wrench,         impact: "Reliable water, gas and drainage systems, done right the first time." },
  builder:     { icon: HardHat,        impact: "Structural work that turns plans into a finished, liveable space." },
  roofer:      { icon: Home,           impact: "A weatherproof roof that protects everything underneath it." },
  painter:     { icon: Paintbrush,     impact: "A finish that makes a property look cared for, inside and out." },
  carpenter:   { icon: Hammer,         impact: "Precise joinery and framing that holds a build together." },
  tiler:       { icon: Grid3x3,        impact: "Hard-wearing, exact tiling for wet areas, floors and splashbacks." },
  landscaper:  { icon: Sprout,         impact: "Outdoor spaces that get used, not just mowed." },
  arborist:    { icon: TreeDeciduous,  impact: "Safe tree work that protects property and people below it." },
  concreter:   { icon: Blocks,         impact: "Solid foundations, slabs and driveways built to last decades." },
  fencer:      { icon: Fence,          impact: "Boundaries and security done properly, post to post." },
  aircon:      { icon: AirVent,        impact: "Climate control that actually keeps a home comfortable year-round." },
  surveyor:    { icon: Ruler,          impact: "Accurate measurements that keep a build on the right side of the boundary." },
};

const DEFAULT_VISUAL: TradeVisual = { icon: Briefcase, impact: "Quality work from a local tradie, done properly." };

export function getTradeVisual(trade: string): TradeVisual {
  return TRADE_VISUALS[trade.toLowerCase()] ?? DEFAULT_VISUAL;
}

export function getAllTradeKeys(): string[] {
  return Object.keys(TRADE_VISUALS);
}
