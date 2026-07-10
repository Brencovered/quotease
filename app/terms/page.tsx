import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";

export const metadata = {
  title: "Terms of Use - Swiftscope",
  description: "The terms and conditions governing use of the Swiftscope quoting and job management platform.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 py-8 border-b border-[#e8ecef] last:border-b-0">
      <h2 className="font-display uppercase text-[1.5rem] sm:text-[1.7rem] text-[#0a1722] mb-4">{title}</h2>
      <div className="space-y-4 text-[14.5px] leading-relaxed text-[#3d4a54]">{children}</div>
    </section>
  );
}

export default function TermsOfUsePage() {
  return (
    <main className="bg-white text-[#0a1722]">
      <MarketingNav />

      {/* HEADER */}
      <div className="bg-[#0a1722] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-16">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Legal</p>
          <h1 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-white max-w-2xl">
            Terms of Use
          </h1>
          <p className="text-[15px] text-[#8aa4b4] mt-4 max-w-xl">
            Last updated: 11 July 2026. These terms govern your use of the Swiftscope platform. Please read
            them carefully before creating an account.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        {/* Important notice box */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-10">
          <p className="text-[13.5px] leading-relaxed text-[#5a4a00]">
            <strong>Before you publish this:</strong> this is a working draft written to cover the ground a
            SaaS terms of use document for an Australian/NZ business typically needs (acceptable use, liability,
            IP, termination, governing law). It is not legal advice. Have it reviewed by a qualified Australian
            and/or New Zealand lawyer before relying on it, and fill in the bracketed placeholders (registered
            entity name, ABN, and registered address) with your actual business details.
          </p>
        </div>

        <Section id="acceptance" title="1. Acceptance of these terms">
          <p>
            These Terms of Use (&quot;<strong>Terms</strong>&quot;) are a legal agreement between you (and, if
            applicable, the business you represent) and <strong>[Your registered business/company name], ABN
            [insert ABN]</strong> trading as Swiftscope (&quot;<strong>Swiftscope</strong>&quot;, &quot;<strong>we</strong>&quot;,
            &quot;<strong>us</strong>&quot;), governing your access to and use of the swiftscope.com.au website and the
            Swiftscope quoting and job management platform (together, the &quot;<strong>Service</strong>&quot;).
          </p>
          <p>
            By creating an account, or by accessing or using the Service in any way, you agree to be bound by
            these Terms and our{" "}
            <Link href="/privacy" className="text-[#c98600] underline font-semibold">Privacy Policy</Link>. If
            you don&apos;t agree, don&apos;t use the Service. If you&apos;re accepting these Terms on behalf of a
            business, you confirm you have the authority to bind that business.
          </p>
        </Section>

        <Section id="the-service" title="2. What Swiftscope is">
          <p>
            Swiftscope is a subscription software platform that helps trade businesses (electricians, plumbers,
            carpenters, roofers, and other trades) build quotes, manage jobs, track materials and job costing,
            schedule work, and optionally connect to third-party services such as Xero. Swiftscope also operates
            a public directory that lets homeowners find tradies and submit quote requests.
          </p>
          <p>
            We may add, change, or remove features from time to time. We&apos;ll try to give reasonable notice of
            changes that materially reduce functionality you&apos;re actively paying for.
          </p>
        </Section>

        <Section id="accounts" title="3. Accounts and eligibility">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>You must be at least 18 years old and have the legal capacity to enter into a contract to create an account.</li>
            <li>You&apos;re responsible for keeping your login credentials confidential and for all activity that occurs under your account.</li>
            <li>You must provide accurate, current information when you register, and keep it up to date.</li>
            <li>If you invite team members to your account, you&apos;re responsible for their use of the Service under your subscription, and for having any necessary authority to give them access to your business data.</li>
            <li>Notify us immediately at <a href="mailto:support@swiftscope.com.au" className="text-[#c98600] underline font-semibold">support@swiftscope.com.au</a> if you suspect unauthorised use of your account.</li>
          </ul>
        </Section>

        <Section id="trial-fees" title="4. Free trial, fees, and billing">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>New accounts start with a free trial period (currently 7 days), after which continued use requires an active paid subscription.</li>
            <li>Fees are as set out on our pricing page or in your account at the time you subscribe, and are charged in advance on a recurring basis (e.g. monthly or annually) until you cancel.</li>
            <li>Payment is processed by our third-party payment processor, Stripe. We don&apos;t store your full card details.</li>
            <li>We may change our fees from time to time. We&apos;ll give you reasonable advance notice of any price increase that affects your subscription before it takes effect.</li>
            <li>You can cancel your subscription at any time from your account settings; cancellation takes effect at the end of your current billing period, and we don&apos;t provide refunds for partial periods except where required by law (including the Australian Consumer Law).</li>
            <li>If a payment fails, we may suspend or limit access to the Service until the outstanding amount is paid.</li>
          </ul>
        </Section>

        <Section id="acceptable-use" title="5. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Use the Service for any unlawful purpose, or in a way that infringes the rights of others.</li>
            <li>Attempt to gain unauthorised access to the Service, other accounts, or our systems, including by circumventing rate limits, security measures, or usage quotas.</li>
            <li>Upload content you don&apos;t have the right to upload, or that is defamatory, fraudulent, or infringes someone else&apos;s intellectual property or privacy.</li>
            <li>Use the Service to send unsolicited communications (spam) to homeowners or any other person.</li>
            <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service, except to the extent applicable law gives you the right to do so.</li>
            <li>Use automated means (bots, scrapers) to access the Service outside of the interfaces and APIs we provide.</li>
            <li>Resell or provide the Service to third parties as your own product without our written consent.</li>
          </ul>
          <p>
            We may suspend or terminate accounts that breach this section, with or without notice depending on
            the severity of the breach.
          </p>
        </Section>

        <Section id="your-content" title="6. Your content and data">
          <p>
            You (or, where you enter client details on behalf of your own customers, your business) retain
            ownership of the content and data you input into Swiftscope, including quotes, price book items,
            job records, client details, drawings, photos, and voice recordings (&quot;<strong>Your Content</strong>&quot;).
          </p>
          <p>
            You grant us a licence to host, store, process, and display Your Content solely as necessary to
            provide the Service to you, including sending relevant portions of Your Content to our AI provider
            (Anthropic, via the Vercel AI Gateway) when you use an AI-assisted feature such as drawing analysis
            or voice quoting. We don&apos;t use Your Content to train our own or third-party AI models, and we
            don&apos;t sell it.
          </p>
          <p>
            If you enter another person&apos;s personal information into Swiftscope (for example, a client&apos;s
            name and address on a quote), you&apos;re responsible for having a lawful basis to collect and use
            that information, and for complying with your own obligations under applicable privacy law with
            respect to it.
          </p>
          <p>
            You&apos;re solely responsible for the accuracy of quotes, pricing, and job information you create
            using the Service. Swiftscope provides tools to help you build and calculate quotes, but doesn&apos;t
            review, approve, or warrant the accuracy of any quote, estimate, or price you generate - that
            professional responsibility remains yours.
          </p>
        </Section>

        <Section id="ai-features" title="7. AI-assisted features">
          <p>
            Features that use AI (drawing analysis, voice-to-quote, and the business assistant) are provided as
            a convenience to speed up quote building. AI-generated output - including detected item counts,
            labour hour estimates, and suggested pricing - may contain errors and should always be reviewed and
            confirmed by you before being sent to a client. We&apos;re not liable for loss arising from
            undetected inaccuracies in AI-generated content that you didn&apos;t review before relying on it.
          </p>
        </Section>

        <Section id="third-party" title="8. Third-party integrations">
          <p>
            The Service may integrate with third-party services you choose to connect, such as Xero. Your use
            of those third-party services is governed by their own terms and privacy policies, and we&apos;re not
            responsible for their availability, accuracy, or conduct. We&apos;ll try to keep integrations working
            reliably, but a third party changing or discontinuing their API may affect the integration&apos;s
            availability.
          </p>
        </Section>

        <Section id="directory" title="9. Public directory and homeowner quote requests">
          <p>
            Homeowners can browse tradie profiles in our public directory and submit quote requests. Swiftscope
            passes on quote requests to relevant tradies but is not a party to, and takes no responsibility for,
            any agreement, quote, or work carried out between a homeowner and a tradie. We don&apos;t vet, license,
            insure, or guarantee the work of any tradie listed on the platform.
          </p>
        </Section>

        <Section id="ip" title="10. Intellectual property">
          <p>
            Swiftscope and its licensors own all intellectual property rights in the Service itself (the
            software, design, branding, and underlying technology), excluding Your Content. Nothing in these
            Terms transfers any of our intellectual property to you, except the limited right to use the
            Service in accordance with these Terms.
          </p>
        </Section>

        <Section id="disclaimers" title="11. Disclaimers">
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the maximum extent permitted by law, we
            exclude all warranties, express or implied, about the Service, including any warranty that it will
            be uninterrupted, error-free, or fit for a particular purpose. Nothing in these Terms excludes,
            restricts, or modifies any guarantee, warranty, or right you have under the{" "}
            <em>Australian Consumer Law</em> or equivalent New Zealand consumer protection law that cannot
            lawfully be excluded.
          </p>
        </Section>

        <Section id="liability" title="12. Limitation of liability">
          <p>
            To the maximum extent permitted by law, and subject to Section 11, Swiftscope&apos;s total liability
            to you arising out of or in connection with these Terms or the Service, however arising (including
            in contract, tort, or under statute), is limited to the total fees you paid us in the 12 months
            immediately preceding the event giving rise to the claim. We&apos;re not liable for any indirect,
            consequential, or special loss, including loss of profits, loss of business, or loss arising from
            quotes, estimates, or pricing you generated using the Service.
          </p>
        </Section>

        <Section id="indemnity" title="13. Indemnity">
          <p>
            You agree to indemnify and hold Swiftscope harmless against any claim, loss, or liability arising
            from your breach of these Terms, your misuse of the Service, or Your Content, except to the extent
            caused by our own negligence or breach of these Terms.
          </p>
        </Section>

        <Section id="termination" title="14. Suspension and termination">
          <p>
            You may stop using the Service and close your account at any time via your account settings. We may
            suspend or terminate your access to the Service if you breach these Terms, if required by law, or on
            reasonable notice for any other reason (for example, if we discontinue the Service). On termination,
            your right to use the Service ends, and Your Content will be handled in accordance with our{" "}
            <Link href="/privacy" className="text-[#c98600] underline font-semibold">Privacy Policy</Link> (including
            the 30-day recovery window described there).
          </p>
        </Section>

        <Section id="changes-terms" title="15. Changes to these Terms">
          <p>
            We may update these Terms from time to time. If we make a material change, we&apos;ll give you
            reasonable notice by email or an in-app notice before it takes effect. Continuing to use the Service
            after a change takes effect means you accept the updated Terms.
          </p>
        </Section>

        <Section id="governing-law" title="16. Governing law">
          <p>
            These Terms are governed by the laws of Victoria, Australia, and you submit to the non-exclusive
            jurisdiction of the courts of Victoria, Australia, without prejudice to any mandatory consumer
            protection rights you may have under New Zealand law if you&apos;re a New Zealand-based user.
          </p>
        </Section>

        <Section id="contact-terms" title="17. Contact us">
          <p>
            Questions about these Terms can be sent to:
          </p>
          <p>
            <strong>[Your registered business/company name]</strong><br />
            ABN: [insert ABN]<br />
            Registered address: [insert address]<br />
            Email: <a href="mailto:support@swiftscope.com.au" className="text-[#c98600] underline font-semibold">support@swiftscope.com.au</a>
          </p>
        </Section>
      </div>

      {/* FOOTER */}
      <div className="bg-[#0a1722] border-t border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <span className="font-display text-lg text-white">SWIFTSCOPE</span>
          <div className="flex gap-6 text-[12.5px] font-semibold text-white/40">
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Use</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
