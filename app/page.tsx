import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="text-sm font-medium text-blue-600 mb-3">Built by tradies, for tradies</p>
        <h1 className="text-4xl font-semibold tracking-tight mb-4">
          Quote the job before you've left the driveway
        </h1>
        <p className="text-lg text-neutral-600 mb-8 max-w-xl mx-auto">
          Fill in what you see on site, get a real number on the spot, and send it before the
          next tradie even calls the client back. No per-user fees, no bloated job-management
          suite you'll never touch.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/signup" className="bg-blue-600 text-white rounded-md px-6 py-3 font-medium">
            Start free trial
          </Link>
          <Link href="/login" className="border rounded-md px-6 py-3 font-medium">
            Log in
          </Link>
        </div>
        <p className="text-xs text-neutral-400 mt-4">7-day free trial. $40/mo flat, unlimited users.</p>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-8 border-t">
        <div>
          <p className="font-medium mb-1">Built for your trade</p>
          <p className="text-sm text-neutral-600">
            Pick your trades once. Every job after that uses fields built for how you actually
            work — not a generic form bolted onto a scheduling app.
          </p>
        </div>
        <div>
          <p className="font-medium mb-1">Your real prices</p>
          <p className="text-sm text-neutral-600">
            Upload your own supplier pricing. The quote calculates off what you actually pay,
            not a guess.
          </p>
        </div>
        <div>
          <p className="font-medium mb-1">Send it, track it, get paid</p>
          <p className="text-sm text-neutral-600">
            Email the quote straight to the client. Set payment terms — deposit up front, balance
            on completion, whatever your business runs on — and see what's still outstanding.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 border-t text-center">
        <p className="text-2xl font-semibold mb-2">$40/month flat</p>
        <p className="text-neutral-600 mb-6">Unlimited users. No per-seat pricing. Cancel anytime.</p>
        <Link href="/signup" className="bg-blue-600 text-white rounded-md px-6 py-3 font-medium inline-block">
          Start your 7-day free trial
        </Link>
      </section>
    </main>
  );
}
