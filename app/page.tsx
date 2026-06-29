import Link from "next/link";
import Image from "next/image";

const HERO_IMG  = "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=1800&q=85&auto=format&fit=crop";
const BUILD_IMG = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=85&auto=format&fit=crop";

export default function Home() {
  return (
    <main className="bg-white text-[#0a1722] overflow-hidden">

      {/* NAV */}
      <div className="absolute top-0 left-0 right-0 z-30 max-w-7xl mx-auto px-6 pt-6 flex items-center justify-between">
        <span className="font-display text-xl tracking-wide text-white drop-shadow-lg">SWIFTSCOPE</span>
        <div className="flex items-center gap-5">
          <Link href="/directory" className="text-white/80 hover:text-white font-semibold text-sm transition-colors hidden sm:block drop-shadow">Find a tradie</Link>
          <Link href="/get-quotes" className="text-white/80 hover:text-white font-semibold text-sm transition-colors hidden sm:block drop-shadow">Get quotes</Link>
          <Link href="/login" className="text-white/80 hover:text-white font-semibold text-sm transition-colors hidden sm:block drop-shadow">Log in</Link>
          <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-sm px-5 py-2.5 rounded-xl hover:bg-[#e89e00] transition-colors">
            Sign up free
          </Link>
        </div>
      </div>

      {/* HERO */}
      <div className="relative h-screen min-h-[700px] max-h-[960px] flex items-end bg-[#0a1722]">
        <div className="absolute inset-0 z-0">
          <Image src={HERO_IMG} alt="Tradie on site" fill className="object-cover object-center" priority unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1722] via-[#0a1722]/50 to-[#0a1722]/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722]/70 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-24 w-full">
          <div className="max-w-[720px]">
            {/* Audience toggle label */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-[#ffb400]" />
              <span className="text-[12px] font-bold text-white/80 uppercase tracking-widest">Australia&apos;s trade platform</span>
            </div>

            <h1 className="font-display uppercase leading-[0.88] mb-6">
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-white">One platform.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-white">Every tradie.</span>
              <span className="block text-[3.2rem] sm:text-[5rem] lg:text-[5.5rem] text-[#ffb400]">Every job.</span>
            </h1>
            <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[#c8d8e4] max-w-[560px] mb-10">
              Swiftscope is where homeowners find trusted tradies and tradies run their whole business.
              No HiPages. No Fergus. No ServiceM8. One flat $39/month.
            </p>

            {/* Two CTAs */}
            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors" style={{ boxShadow: "0 12px 32px rgba(255,180,0,.3)" }}>
                I&apos;m a tradie — start free
              </Link>
              <Link href="/get-quotes" className="text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/25 hover:border-white/50 transition-colors">
                I need a tradie →
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 text-[13px] font-semibold text-[#8aa4b4]">
              <span>3-day free trial — then $39/month</span>
              <span className="text-[#2a3a47]">|</span>
              <span>Unlimited users</span>
              <span className="text-[#2a3a47]">|</span>
              <span>196 verified tradies</span>
            </div>
          </div>
        </div>
      </div>

      {/* TWO AUDIENCES */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Who it&apos;s for</p>
            <h2 className="font-display uppercase text-[2.8rem] sm:text-[3.5rem] leading-[0.93] text-[#0a1722]">
              Built for both sides<br />of every job
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Homeowner side */}
            <div className="bg-[#f8f9fa] rounded-3xl p-8 border border-[#e8ecef]">
              <div className="w-12 h-12 bg-[#ffb400] rounded-2xl flex items-center justify-center text-[24px] mb-5">🏠</div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Homeowners &amp; Builders</p>
              <h3 className="font-display text-[1.8rem] text-[#0a1722] mb-3">Find and hire the right tradie</h3>
              <p className="text-[15px] text-[#5a6a78] leading-relaxed mb-6">
                Post your job once. Up to 3 matched local tradies respond with quotes.
                No auction. No dodgy reviews. Every tradie is verified and runs on Swiftscope.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "Post a job in 2 minutes",
                  "Up to 3 quotes from local tradies",
                  "See Google ratings before you choose",
                  "All 13 trades covered",
                  "Free for homeowners",
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-[14px] font-semibold text-[#0a1722]">
                    <span className="w-5 h-5 bg-[#ffb400] rounded-full flex items-center justify-center text-[11px] font-black text-[#0a1722] shrink-0">✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/get-quotes" className="block text-center bg-[#0a1722] text-white font-extrabold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity">
                Get quotes from local tradies →
              </Link>
            </div>

            {/* Tradie side */}
            <div className="bg-[#0a1722] rounded-3xl p-8">
              <div className="w-12 h-12 bg-[#ffb400] rounded-2xl flex items-center justify-center text-[24px] mb-5">🔧</div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Tradies &amp; Trade Businesses</p>
              <h3 className="font-display text-[1.8rem] text-white mb-3">Run your whole business</h3>
              <p className="text-[15px] text-[#8aa4b4] leading-relaxed mb-6">
                Quote, win, manage, and invoice jobs from your phone. Get leads from homeowners in your area.
                Replace 4-5 tools with one flat $39/month subscription.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "Quote from your phone in 4 minutes on site",
                  "Get homeowner leads in your area",
                  "Job management, scheduling, variations",
                  "Xero live sync — no double entry",
                  "Drawing markup linked to quotes",
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-[14px] font-semibold text-white">
                    <span className="w-5 h-5 bg-[#ffb400] rounded-full flex items-center justify-center text-[11px] font-black text-[#0a1722] shrink-0">✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="block text-center bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity">
                Start free trial — 3 days, no card →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS -- HOMEOWNER */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">For homeowners</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              Three steps to a<br />trusted tradie
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n:"01", title:"Post your job", body:"Tell us the trade, your suburb and what needs doing. Takes 2 minutes. Budget and timeline optional.", icon:"📋" },
              { n:"02", title:"Get up to 3 quotes", body:"Matched local tradies claim your request and contact you directly. No bidding war. No spam. Just real tradies.", icon:"📬" },
              { n:"03", title:"Hire with confidence", body:"Every tradie on Swiftscope has real Google reviews. See their rating before you pick up the phone.", icon:"⭐" },
            ].map(s => (
              <div key={s.n} className="bg-white rounded-2xl p-7 border border-[#e8ecef]">
                <div className="text-[2.5rem] mb-4">{s.icon}</div>
                <p className="text-[11px] font-bold tracking-[.15em] uppercase text-[#ffb400] mb-1">{s.n}</p>
                <h3 className="font-display text-[1.4rem] text-[#0a1722] mb-2">{s.title}</h3>
                <p className="text-[14px] text-[#5a6a78] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/get-quotes" className="inline-block bg-[#0a1722] text-white font-extrabold text-[15px] px-10 py-4 rounded-xl hover:opacity-90">
              Post a job — it&apos;s free →
            </Link>
          </div>
        </div>
      </div>

      {/* REPLACES SECTION */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">For tradies</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              Cancel everything.<br />One tool replaces all of it.
            </h2>
            <p className="text-[16px] text-[#5a6a78] mt-4 max-w-xl mx-auto">
              Most tradies run 4-5 different tools. Swiftscope replaces all of them for less than the cost of one.
            </p>
          </div>

          {/* Replace grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {[
              { replaces:"HiPages", with:"Lead generation", note:"Get homeowner leads in your area. Flat $10/month, no per-lead auction.", icon:"📣" },
              { replaces:"Fergus", with:"Job management", note:"Quotes, jobs, scheduling, variations, job costing. Everything in one place.", icon:"📋" },
              { replaces:"ServiceM8", with:"Mobile quoting", note:"Full quote builder on your phone, on site. Send before you leave the driveway.", icon:"📱" },
              { replaces:"SimPro", with:"Drawing markup", note:"Upload site plans, mark up cable runs or pipe routes, costs link to your quote.", icon:"📐" },
              { replaces:"Tradify", with:"Client management", note:"Client database, quote history, follow-up reminders, online acceptance.", icon:"👥" },
              { replaces:"Xero manual entry", with:"Live Xero sync", note:"Accepted quotes push to Xero as invoices automatically. No double entry.", icon:"🔄" },
            ].map(r => (
              <div key={r.replaces} className="bg-[#f8f9fa] rounded-2xl p-6 border border-[#e8ecef]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[2rem]">{r.icon}</span>
                  <span className="text-[11px] font-bold bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full line-through">
                    {r.replaces}
                  </span>
                </div>
                <p className="font-bold text-[15px] text-[#0a1722] mb-1">{r.with}</p>
                <p className="text-[13px] text-[#5a6a78] leading-relaxed">{r.note}</p>
              </div>
            ))}
          </div>

          {/* Cost comparison */}
          <div className="bg-[#0a1722] rounded-3xl p-8 md:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="font-display text-[2rem] text-white mb-4">What you&apos;re probably paying now</h3>
                <div className="space-y-2">
                  {[
                    ["HiPages lead credits", "$80-300/month"],
                    ["Fergus or ServiceM8", "$40-130/month"],
                    ["GroundPlan (drawings)", "$60-100/month"],
                    ["Xero", "$35-85/month"],
                  ].map(([tool, cost]) => (
                    <div key={tool} className="flex items-center justify-between py-2 border-b border-white/[0.07]">
                      <span className="text-[14px] text-[#8aa4b4]">{tool}</span>
                      <span className="text-[14px] font-bold text-white/60 line-through">{cost}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-[15px] font-bold text-white">Total</span>
                    <span className="text-[15px] font-bold text-red-400 line-through">$215-615/month</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.05] rounded-2xl p-7 text-center border border-white/10">
                <p className="text-[12px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Swiftscope</p>
                <div className="font-display text-[5rem] leading-none text-[#ffb400] mb-1">$39</div>
                <p className="text-[#8aa4b4] text-[16px] mb-1">/month</p>
                <p className="text-[13px] text-[#4a6070] mb-6">Everything included. Unlimited seats.</p>
                <Link href="/signup" className="block bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-3.5 rounded-xl hover:opacity-90">
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TRADIE FEATURES */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Features</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              Everything a tradie<br />actually needs
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon:"⚡", title:"Quote in 4 minutes", body:"Trade-specific fields. Numbers calculate live. Send from your phone before you leave the driveway." },
              { icon:"📬", title:"Win more leads", body:"Homeowners in your area post jobs. You claim them for a flat $10/month directory fee. No auction." },
              { icon:"📐", title:"Mark up drawings", body:"Upload site plans. Draw cable runs, pipe routes, areas. Costs feed into your quote automatically." },
              { icon:"💰", title:"Know your margin", body:"Job costing tracks actual vs quoted on every single job. See exactly where you made or lost money." },
              { icon:"✍️", title:"Variations in writing", body:"Scope creep kills margins. Raise a variation order in one tap. Gets signed before you touch it." },
              { icon:"🔄", title:"Xero live sync", body:"Accepted quotes push directly to Xero as invoices. No CSV. No double entry. No bookkeeper chasing." },
              { icon:"📅", title:"Schedule and track", body:"Calendar view for all jobs. Drag to reschedule. Materials checklist seeded from the quote scope." },
              { icon:"👥", title:"Unlimited team", body:"Add apprentices, admin, or partners. No per-user fees. Everyone on the same job, same time." },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-[#e8ecef]">
                <div className="text-[2rem] mb-3">{f.icon}</div>
                <h3 className="font-bold text-[15px] text-[#0a1722] mb-1.5">{f.title}</h3>
                <p className="text-[13px] text-[#5a6a78] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRADES */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-4 text-center">13 trades supported</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              "Electricians","Plumbers","Builders","Roofers","Painters","Carpenters",
              "Tilers","Landscapers","Arborists","Concreters","Fencers","Air conditioning","Surveyors",
            ].map(t => (
              <span key={t} className="px-4 py-2 bg-[#f8f9fa] border border-[#e8ecef] rounded-full text-[13.5px] font-semibold text-[#0a1722]">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* COMPETITOR TABLE */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Comparison</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              How we stack up
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-[#e8ecef]">
                  <th className="pb-4 pr-6 text-[12px] font-bold uppercase tracking-wider text-[#8a9ba8] w-[28%]"></th>
                  {[
                    { name:"Swiftscope", highlight:true },
                    { name:"HiPages",   highlight:false },
                    { name:"Fergus",    highlight:false },
                    { name:"ServiceM8", highlight:false },
                  ].map(c => (
                    <th key={c.name} className={`pb-4 px-4 text-center text-[13px] font-extrabold ${c.highlight ? "text-[#0a1722]" : "text-[#8a9ba8]"}`}>
                      {c.highlight ? (
                        <span className="inline-flex flex-col items-center gap-1">
                          {c.name}
                          <span className="text-[10px] bg-[#ffb400] text-[#0a1722] px-2 py-0.5 rounded-full font-bold tracking-wide uppercase">Us</span>
                        </span>
                      ) : c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f2f4]">
                {[
                  { feature:"Lead generation", us:"✓ $10/month flat", c1:"✗ $30-150/lead auction", c2:"✗ Not included", c3:"✗ Not included", usBest:true },
                  { feature:"Job management", us:"✓ Included", c1:"✗ Not included", c2:"✓ Yes", c3:"✓ Yes", usBest:false },
                  { feature:"Quoting on mobile", us:"✓ Built for it", c1:"✗ Not included", c2:"✓ Yes", c3:"✓ Yes", usBest:false },
                  { feature:"Drawing markup", us:"✓ Built in", c1:"✗ No", c2:"✗ Extra $60-100/mo", c3:"✗ Basic only", usBest:true },
                  { feature:"Xero live sync", us:"✓ Included", c1:"✗ No", c2:"✓ Yes", c3:"✓ Yes", usBest:false },
                  { feature:"Homeowner directory", us:"✓ 196+ listings", c1:"✓ Large network", c2:"✗ No", c3:"✗ No", usBest:false },
                  { feature:"Pricing", us:"$39/mo flat", c1:"$80-300/mo + leads", c2:"$40/user/mo", c3:"$29-349/mo", usBest:true },
                  { feature:"Unlimited users", us:"✓ Always", c1:"N/A", c2:"✗ Per user", c3:"✓ Yes", usBest:true },
                  { feature:"Setup time", us:"Same day", c1:"Same day", c2:"Days to weeks", c3:"1-2 days", usBest:true },
                ].map(row => (
                  <tr key={row.feature} className="hover:bg-[#fafbfc]">
                    <td className="py-3.5 pr-6 text-[13.5px] font-semibold text-[#0a1722]">{row.feature}</td>
                    <td className={`py-3.5 px-4 text-center ${row.usBest ? "bg-[#fffbf0]" : ""}`}>
                      <span className={`text-[12.5px] font-bold ${row.usBest ? "text-[#e89e00]" : "text-[#0a1722]"}`}>{row.us}</span>
                    </td>
                    {[row.c1, row.c2, row.c3].map((val, i) => (
                      <td key={i} className="py-3.5 px-4 text-center">
                        <span className="text-[12px] text-[#8a9ba8] leading-snug whitespace-pre-line">{val}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Pricing</p>
            <h2 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-[#0a1722]">
              Simple. Flat. No surprises.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Tradie plan */}
            <div className="bg-[#0a1722] rounded-3xl overflow-hidden">
              <div className="h-3" style={{ background:"repeating-linear-gradient(135deg,#FFB400 0 14px,#E89E00 14px 28px)" }} />
              <div className="p-8">
                <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">For tradies</p>
                <div className="flex items-end gap-2 mb-1">
                  <span className="font-display text-[4rem] leading-none text-[#ffb400]">$39</span>
                  <span className="text-[#7e94a2] text-[16px] font-bold mb-2">/month</span>
                </div>
                <p className="text-[#7e94a2] text-[13px] mb-6">3-day free trial. No card needed.</p>
                <div className="space-y-2.5 mb-8">
                  {[
                    "Unlimited quotes and jobs",
                    "Unlimited team members",
                    "Job management and scheduling",
                    "Drawing markup",
                    "Xero live sync",
                    "Client portal and online acceptance",
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-[13.5px] text-white">
                      <span className="text-[#ffb400] font-black">✓</span> {f}
                    </div>
                  ))}
                </div>
                <Link href="/signup" className="block text-center bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-3.5 rounded-xl hover:opacity-90">
                  Start free trial
                </Link>
              </div>
            </div>

            {/* Directory add-on */}
            <div className="bg-[#f8f9fa] rounded-3xl border border-[#e8ecef] p-8 flex flex-col">
              <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">Directory add-on</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="font-display text-[4rem] leading-none text-[#0a1722]">$10</span>
                <span className="text-[#8a9ba8] text-[16px] font-bold mb-2">/month</span>
              </div>
              <p className="text-[#8a9ba8] text-[13px] mb-6">On top of the $39 plan.</p>
              <div className="space-y-2.5 mb-8 flex-1">
                {[
                  "Listed in the public tradie directory",
                  "Homeowner quote requests in your area",
                  "Set your service suburbs and radius",
                  "Choose lead types (early, warm, hot)",
                  "No per-lead costs. Ever.",
                ].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-[13.5px] text-[#0a1722]">
                    <span className="text-[#ffb400] font-black">✓</span> {f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="block text-center bg-[#0a1722] text-white font-extrabold text-[15px] py-3.5 rounded-xl hover:opacity-90">
                Add to your plan
              </Link>
              <p className="text-[12px] text-[#8a9ba8] text-center mt-3">Free for homeowners — always</p>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid sm:grid-cols-2 gap-8">
          <div className="bg-white/[0.04] rounded-2xl p-8 border border-white/10">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Tradies</p>
            <h3 className="font-display text-[1.8rem] text-white mb-2">The other tradie just sent their quote.</h3>
            <p className="text-[#8aa4b4] text-[14px] mb-6">How long does yours take?</p>
            <Link href="/signup" className="inline-block bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:opacity-90">
              Start quoting today →
            </Link>
          </div>
          <div className="bg-white/[0.04] rounded-2xl p-8 border border-white/10">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Homeowners</p>
            <h3 className="font-display text-[1.8rem] text-white mb-2">Need something done?</h3>
            <p className="text-[#8aa4b4] text-[14px] mb-6">Post your job and get up to 3 quotes from verified local tradies.</p>
            <Link href="/get-quotes" className="inline-block bg-white text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:opacity-90">
              Get quotes — it&apos;s free →
            </Link>
          </div>
        </div>
        <div className="border-t border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-lg text-white">SWIFTSCOPE</span>
            <div className="flex gap-6 text-[12.5px] font-semibold text-white/40">
              <Link href="/directory" className="hover:text-white transition-colors">Directory</Link>
              <Link href="/get-quotes" className="hover:text-white transition-colors">Get quotes</Link>
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Sign up</Link>
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
