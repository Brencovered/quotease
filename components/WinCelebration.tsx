"use client";

export default function WinCelebration({ amount }: { amount: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-[var(--navy)] rounded-2xl px-8 py-7 text-center shadow-2xl animate-[popIn_0.3s_cubic-bezier(0.2,0.9,0.3,1.2)]">
        <p className="text-4xl mb-2">🎉</p>
        <p className="font-display text-xl text-white mb-1">Job won!</p>
        <p className="text-[var(--amber)] font-display text-2xl">${amount.toLocaleString()}</p>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
