import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";

export const metadata = {
  title: "Privacy Policy - Swiftscope",
  description: "How Swiftscope collects, uses, stores, and protects personal information, in line with the Australian Privacy Principles and the New Zealand Privacy Act 2020.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 py-8 border-b border-[#e8ecef] last:border-b-0">
      <h2 className="font-display uppercase text-[1.5rem] sm:text-[1.7rem] text-[#0a1722] mb-4">{title}</h2>
      <div className="space-y-4 text-[14.5px] leading-relaxed text-[#3d4a54]">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-white text-[#0a1722]">
      <MarketingNav />

      {/* HEADER */}
      <div className="bg-[#0a1722] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-16">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Legal</p>
          <h1 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.93] text-white max-w-2xl">
            Privacy Policy
          </h1>
          <p className="text-[15px] text-[#8aa4b4] mt-4 max-w-xl">
            Last updated: 11 July 2026. This policy explains what personal information Swiftscope collects,
            why, how it&apos;s stored and protected, and what rights you have over it.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        {/* Important notice box */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-10">
          <p className="text-[13.5px] leading-relaxed text-[#5a4a00]">
            <strong>Before you publish this:</strong> this policy is a working draft prepared to align with the
            Australian Privacy Principles (Privacy Act 1988 (Cth)) and the New Zealand Privacy Act 2020. It is
            not legal advice. Have it reviewed by a qualified Australian and/or New Zealand privacy lawyer before
            relying on it, and fill in the bracketed placeholders (your full legal name as the registered sole
            trader, ABN, and business
            address) with your actual business details before this goes live.
          </p>
        </div>

        <Section id="overview" title="1. Overview">
          <p>
            This policy applies to <strong>[Your full legal name], ABN [insert ABN]</strong> trading
            as Swiftscope (&quot;<strong>Swiftscope</strong>&quot;, &quot;<strong>we</strong>&quot;, &quot;<strong>us</strong>&quot;), and covers the
            swiftscope.com.au website, the Swiftscope quoting and job management platform, and any related
            mobile or desktop experience (together, the &quot;<strong>Service</strong>&quot;).
          </p>
          <p>
            Swiftscope has two kinds of users whose personal information we handle differently:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Tradie account holders</strong> - the trade businesses and their staff who sign up to use Swiftscope to quote, manage, and invoice jobs.</li>
            <li><strong>Homeowners and other members of the public</strong> - people who submit a quote request through our public directory, or whose contact details a tradie enters into the platform as part of running their own business (e.g. a client&apos;s name, address, or phone number on a quote).</li>
          </ul>
          <p>
            We handle personal information in accordance with the Australian Privacy Principles (APPs) under
            the <em>Privacy Act 1988</em> (Cth), and, for individuals in New Zealand, the Information Privacy
            Principles (IPPs) under the <em>Privacy Act 2020</em> (NZ). Where this policy refers to &quot;personal
            information&quot;, that has the meaning given in both Acts - broadly, information about an identified
            or reasonably identifiable individual.
          </p>
        </Section>

        <Section id="what-we-collect" title="2. What we collect">
          <p><strong>From tradie account holders, we collect:</strong></p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Account details: name, email address, phone number, password (stored as a salted hash, never in plain text), business name, ABN, trade type, and service area.</li>
            <li>Billing details, where applicable: handled directly by our payment processor (Stripe) - Swiftscope does not store full card numbers.</li>
            <li>Content you create or upload: quotes, price book items, job records, client details you enter (see below), site photos, drawings and plans, and voice notes you record for AI-assisted quoting.</li>
            <li>Team and business data: details of staff you invite to your account, timesheets, and job costing records.</li>
            <li>Communications: support requests and any correspondence with us.</li>
            <li>Technical data: IP address, device and browser type, and usage data collected via analytics (see Section 5).</li>
          </ul>
          <p><strong>From homeowners and other members of the public, we collect:</strong></p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Contact and job details submitted through a quote request form on our public directory (name, contact details, suburb/postcode, and a description of the job).</li>
            <li>Any client details a tradie using Swiftscope enters about you in the course of quoting or managing your job (e.g. your name, address, phone number, and email) - this information is entered and controlled by the tradie as our customer, not collected by us directly from you.</li>
          </ul>
          <p>
            We do not intentionally collect sensitive information (as defined under the APPs and the NZ Privacy
            Act, e.g. health information, and we ask that tradies and homeowners avoid including it in free-text
            fields such as job descriptions or notes.
          </p>
        </Section>

        <Section id="how-we-collect" title="3. How we collect it">
          <p>
            We collect personal information directly from you when you create an account, use the Service, submit
            a quote request, contact support, or otherwise interact with our website. Where practical, we collect
            information directly from the individual concerned. Where a tradie enters details about their own
            client into Swiftscope, that information is collected by the tradie in the course of running their
            business - the tradie is responsible for having a lawful basis to hold and use that information, and
            Swiftscope processes it on the tradie&apos;s behalf as described in Section 4.
          </p>
        </Section>

        <Section id="why-we-use-it" title="4. Why we collect, use, and disclose personal information">
          <p>We use personal information to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Provide, operate, and maintain the Service, including generating quotes, managing jobs, and syncing with connected services such as Xero.</li>
            <li>Provide AI-assisted features - for example, analysing an uploaded drawing or photo, or transcribing a voice note, to help populate a quote. These uploads are sent to our AI provider (Anthropic, via the Vercel AI Gateway) solely to generate that response; see Section 6 for how this is handled.</li>
            <li>Process payments and manage billing, via Stripe.</li>
            <li>Send transactional emails (e.g. quote notifications, onboarding emails, team invitations) via Resend.</li>
            <li>Connect homeowners with tradies through the public directory and quote request system.</li>
            <li>Respond to support requests and communicate with you about your account.</li>
            <li>Monitor, secure, and improve the Service, including detecting and preventing fraud, abuse, and security incidents.</li>
            <li>Comply with our legal obligations.</li>
          </ul>
          <p>
            We do not sell personal information to third parties, and we do not use tradie client data or
            uploaded drawings to train our own AI models.
          </p>
        </Section>

        <Section id="cookies-analytics" title="5. Cookies and analytics">
          <p>The Service uses the following:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Essential cookies</strong>: used to keep you signed in (via Supabase Authentication) and to
              maintain basic site functionality. These are required for the Service to work and can&apos;t be
              disabled without losing access to your account.
            </li>
            <li>
              <strong>Vercel Analytics and Speed Insights</strong>: privacy-oriented, cookieless analytics used to
              understand aggregate site performance and usage. This does not use tracking cookies or build a
              profile of you as an individual.
            </li>
            <li>
              <strong>Google Analytics</strong>: we use Google Analytics (gtag.js) to understand how visitors use
              our website. Google Analytics uses cookies and collects information such as pages viewed, referral
              source, and device/browser type. This data is processed by Google, which may store and process it
              on servers located outside Australia and New Zealand, including in the United States. You can opt
              out of Google Analytics tracking using{" "}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#c98600] underline font-semibold"
              >
                Google&apos;s browser opt-out add-on
              </a>{" "}
              or your browser&apos;s cookie/tracking protection settings.
            </li>
          </ul>
          <p>
            Most browsers let you block or delete cookies through their settings. Blocking essential cookies will
            prevent you from logging in to Swiftscope.
          </p>
        </Section>

        <Section id="overseas-disclosure" title="6. Where your information is stored and processed">
          <p>
            Under Australian Privacy Principle 8 and the equivalent NZ Privacy Act provisions, we&apos;re required to
            tell you where personal information may be disclosed overseas. Here&apos;s the actual breakdown for
            Swiftscope:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Database and file storage (Supabase)</strong>: hosted in Sydney, Australia (ap-southeast-2). Your account data, quotes, jobs, and uploaded files are stored here.</li>
            <li><strong>Application hosting (Vercel)</strong>: our web application runs on Vercel&apos;s infrastructure, which may process requests through servers located outside Australia as part of its global network.</li>
            <li><strong>AI processing (Anthropic, via the Vercel AI Gateway)</strong>: when you use an AI-assisted feature (drawing analysis, voice quoting, or the business assistant), the relevant image, audio transcript, or text is sent to Anthropic for processing. This processing occurs on infrastructure located outside Australia, primarily in the United States.</li>
            <li><strong>Payments (Stripe)</strong>: if you subscribe to a paid plan, your payment details are collected and processed directly by Stripe, which operates internationally including in the United States.</li>
            <li><strong>Email delivery (Resend)</strong>: transactional emails are sent via Resend, which may process email content and delivery metadata on servers outside Australia.</li>
            <li><strong>Accounting integration (Xero)</strong>: if you choose to connect Xero, invoice and contact data is shared with Xero in accordance with your own Xero account and its privacy terms. Xero is an Australian and New Zealand company with regional data hosting options.</li>
          </ul>
          <p>
            We take reasonable steps to ensure our service providers handle personal information in a manner
            consistent with the APPs and the NZ Privacy Act, including through contractual commitments, but we
            are not always able to guarantee that overseas recipients are bound by an equivalent law - this is
            disclosed here so you can make an informed decision about using the Service.
          </p>
        </Section>

        <Section id="security" title="7. How we protect your information">
          <p>
            Consistent with Australian Privacy Principle 11 and the equivalent NZ requirement to take reasonable
            security safeguards, we take the following steps to protect personal information from misuse,
            interference, loss, unauthorised access, modification, or disclosure:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Encryption in transit (HTTPS/TLS) for all traffic to and from the Service.</li>
            <li>Row-level security policies in our database, so that one business&apos;s data is not accessible to another business&apos;s account.</li>
            <li>Rate limiting on AI-powered and other sensitive endpoints to reduce the risk of automated abuse.</li>
            <li>Access to production systems and customer data is restricted to authorised personnel on a need-to-know basis.</li>
            <li>Passwords are never stored in plain text.</li>
            <li>Regular dependency and security review of the platform&apos;s codebase.</li>
          </ul>
          <p>
            No method of transmission or storage is 100% secure, and we can&apos;t guarantee absolute security.
            If you become aware of a security issue affecting Swiftscope, please contact us immediately at{" "}
            <a href="mailto:security@swiftscope.com.au" className="text-[#c98600] underline font-semibold">security@swiftscope.com.au</a>.
          </p>
        </Section>

        <Section id="data-breach" title="8. Data breach notification">
          <p>
            If we experience a data breach that is likely to result in serious harm to individuals whose personal
            information is involved, we will comply with our obligations under the Notifiable Data Breaches (NDB)
            scheme in Australia (Part IIIC of the Privacy Act 1988) and the equivalent notification obligations
            under the NZ Privacy Act 2020, including notifying affected individuals and the relevant regulator
            (the Office of the Australian Information Commissioner, and/or the NZ Office of the Privacy
            Commissioner) where required.
          </p>
        </Section>

        <Section id="retention" title="9. How long we keep your information">
          <p>
            We keep personal information for as long as your account is active, and for a reasonable period
            afterwards to meet legal, accounting, or reporting requirements. If you close or delete your
            Swiftscope account, your data enters a 30-day recovery window during which it can be restored on
            request, after which it is permanently deleted from our active systems (residual copies may persist
            briefly in backups before they are cycled out).
          </p>
          <p>
            Homeowner quote request data submitted through the public directory is retained for as long as
            reasonably necessary to facilitate the relevant job enquiry, or until the homeowner asks us to
            delete it.
          </p>
        </Section>

        <Section id="access-correction" title="10. Access, correction, and complaints">
          <p>
            Under APP 12 and 13 (and the equivalent NZ IPPs 6 and 7), you have the right to ask for access to
            the personal information we hold about you, and to ask us to correct it if it&apos;s inaccurate,
            out of date, incomplete, irrelevant, or misleading. You can access and update most of your account
            information directly within the Service under Settings.
          </p>
          <p>
            For anything you can&apos;t access or correct yourself, or if you have a complaint about how we&apos;ve
            handled your personal information, contact us at{" "}
            <a href="mailto:privacy@swiftscope.com.au" className="text-[#c98600] underline font-semibold">privacy@swiftscope.com.au</a>.
            We&apos;ll acknowledge your complaint and aim to resolve it within a reasonable time.
          </p>
          <p>
            If you&apos;re not satisfied with our response, you can lodge a complaint with:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              In Australia: the{" "}
              <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-[#c98600] underline font-semibold">
                Office of the Australian Information Commissioner (OAIC)
              </a>.
            </li>
            <li>
              In New Zealand: the{" "}
              <a href="https://www.privacy.org.nz" target="_blank" rel="noopener noreferrer" className="text-[#c98600] underline font-semibold">
                Office of the Privacy Commissioner
              </a>.
            </li>
          </ul>
        </Section>

        <Section id="childrens-data" title="11. Children's information">
          <p>
            Swiftscope is a business-to-business platform intended for trade business owners, staff, and adult
            homeowners. It is not directed at, and we do not knowingly collect personal information from,
            children.
          </p>
        </Section>

        <Section id="third-party-links" title="12. Third-party links and listings">
          <p>
            Our public directory may display information about trade businesses, and tradie profiles may link to
            external websites or review platforms. We are not responsible for the privacy practices of external
            sites you visit from Swiftscope. This policy only covers information handled by Swiftscope itself.
          </p>
        </Section>

        <Section id="changes" title="13. Changes to this policy">
          <p>
            We may update this policy from time to time to reflect changes to the Service or our legal
            obligations. The &quot;last updated&quot; date at the top of this page shows when it was last revised.
            Material changes will be notified to account holders via email or an in-app notice.
          </p>
        </Section>

        <Section id="contact" title="14. Contact us">
          <p>
            For any question about this policy or how we handle personal information, contact:
          </p>
          <p>
            <strong>[Your full legal name]</strong><br />
            ABN: [insert ABN]<br />
            Business address: [insert address]<br />
            Email: <a href="mailto:privacy@swiftscope.com.au" className="text-[#c98600] underline font-semibold">privacy@swiftscope.com.au</a>
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
