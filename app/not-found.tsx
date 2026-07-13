import Link from "next/link";
import { MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--navy)] flex items-center justify-center mx-auto mb-5">
          <MapPinOff size={24} className="text-[var(--amber)]" />
        </div>
        <h1 className="font-display text-[1.6rem] text-[var(--ink)] mb-2 uppercase">
          Page not found
        </h1>
        <p className="text-[14px] text-[var(--ink-faint)] mb-8 leading-relaxed">
          That page doesn&apos;t exist, or it&apos;s moved. Check the address, or head back to the homepage.
        </p>
        <Link href="/" className="btn-primary justify-center inline-flex">
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
