/**
 * TradePlan
 * ---------
 * The visual on the trade pages: a marked-up plan, drawn as inline SVG.
 *
 * The docket that preceded this was specific and legible but it was a
 * document, and documents are not what a tradie looks at. A tradie looks at
 * a plan. It is also the thing this page keeps describing in prose and never
 * showing: mark up the drawing, the quantities flow into the quote.
 *
 * Why SVG and not a screenshot:
 *  - It is genuinely visual, which a line-item table is not.
 *  - No image request, and it stays sharp and legible at any width, which is
 *     the problem that a long run of frame ratios and width caps was chasing.
 *  - The geometry differs per trade by construction. A roof plan with a ridge
 *     and two valleys cannot be mistaken for an electrical plan with GPOs and
 *     a cable run to the shed. That difference is the argument this page is
 *     making, so the artwork should carry it rather than the caption.
 *
 * Drawing conventions are taken from the subject rather than invented: pale
 * grid paper, navy for the structure, amber only for what has been marked up
 * and counted, dashed for runs, and every annotation carrying its real unit
 * (lm, m2, poles). The measurement labels are the same numbers as the quote
 * beside it, because that is the actual product behaviour.
 *
 * Motion: the marked-up runs draw themselves in once on load. It is a single
 * orchestrated moment rather than scattered effects, it mirrors the act of
 * drawing on a plan, and it is disabled under prefers-reduced-motion.
 */

export type PlanKind =
  | "electricians"
  | "plumbers"
  | "roofers"
  | "carpenters"
  | "painters-and-plasterers"
  | "trades";

const NAVY = "#0a1722";
const AMBER = "#ffb400";
const FAINT = "#c8d2da";

/** Shared chrome: grid paper, sheet border, and the trade's title block. */
function Sheet({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-auto block"
      role="img"
      aria-label={label}
    >
      <defs>
        <pattern id="tp-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="#e3e9ee" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill="#fbfcfd" />
      <rect width="400" height="300" fill="url(#tp-grid)" />
      {children}
      {/* Title block, bottom right, as on a real drawing sheet. */}
      <g>
        <rect x="262" y="266" width="130" height="26" fill={NAVY} rx="3" />
        <text x="271" y="277" fill={AMBER} fontSize="6" letterSpacing="1.4" fontWeight="700">
          SWIFTSCOPE
        </text>
        <text x="271" y="287" fill="#8aa4b4" fontSize="6.5" letterSpacing="0.4">
          Marked up on site
        </text>
      </g>
    </svg>
  );
}

/**
 * A measurement annotation: amber tick, value, unit.
 *
 * Deliberately NOT a pill with a computed width. Sizing a background box from
 * a character count is guesswork, and when the guess is short the text runs
 * out of the box, which is precisely what it did on first render. Text on the
 * sheet with a white halo behind it (paint-order) cannot overflow anything,
 * and a leader line to the thing being measured is how a drawing actually
 * annotates. One less box to get wrong.
 */
function Flag({
  x,
  y,
  value,
  unit,
  leader,
}: {
  x: number;
  y: number;
  value: string;
  unit: string;
  /** Optional line back to the element being measured. */
  leader?: string;
}) {
  return (
    <g>
      {leader && <path d={leader} fill="none" stroke={AMBER} strokeWidth="1.2" strokeDasharray="3 3" />}
      <circle cx={x} cy={y - 3} r="2.8" fill={AMBER} />
      <text
        x={x + 7}
        y={y}
        fontSize="10"
        fontWeight="700"
        fill={NAVY}
        stroke="#fbfcfd"
        strokeWidth="3"
        paintOrder="stroke"
      >
        {value}
        <tspan fontSize="8.5" fontWeight="600" fill="#5a6a78">
          {" "}
          {unit}
        </tspan>
      </text>
    </g>
  );
}

/** Shell of a house: outer walls plus two internal partitions. Shared base. */
function FloorShell() {
  return (
    <g fill="none" stroke={NAVY} strokeWidth="2.4" strokeLinejoin="round">
      <path d="M40 52 H300 V214 H40 Z" />
      <path d="M170 52 V140" strokeWidth="1.8" />
      <path d="M170 140 H300" strokeWidth="1.8" />
      <path d="M40 140 H110" strokeWidth="1.8" />
      {/* door openings, drawn as gaps with a swing */}
      <path d="M110 140 a18 18 0 0 1 18 -18" stroke={FAINT} strokeWidth="1.4" />
    </g>
  );
}

function Electrical() {
  return (
    <>
      <FloorShell />
      {/* cable run to the shed, the thing that gets absorbed into a round number */}
      <path
        d="M60 200 H150 V166 H250 V96 H332"
        fill="none"
        stroke={AMBER}
        strokeWidth="2.4"
        strokeDasharray="7 5"
        strokeLinecap="round"
        className="tp-draw"
      />
      <rect x="326" y="86" width="20" height="26" rx="2" fill="none" stroke={NAVY} strokeWidth="2" />
      <text x="330" y="128" fontSize="7" fill={NAVY} fontWeight="700">SHED</text>
      {/* downlights */}
      {[[92, 88], [126, 88], [92, 112], [126, 112], [214, 82], [252, 82], [214, 106], [252, 106]].map(
        ([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="6" fill="none" stroke={AMBER} strokeWidth="2" />
        )
      )}
      {/* GPOs, drawn as the standard double-slash symbol */}
      {[[52, 176], [140, 176], [188, 200], [278, 176], [278, 120], [52, 96]].map(([x, y], i) => (
        <g key={i} stroke={NAVY} strokeWidth="2" strokeLinecap="round">
          <path d={`M${x} ${y} h11`} />
          <path d={`M${x + 3} ${y} v-6`} />
          <path d={`M${x + 8} ${y} v-6`} />
        </g>
      ))}
      {/* switchboard */}
      <rect x="42" y="56" width="24" height="16" rx="2" fill={NAVY} />
      <text x="70" y="68" fontSize="7.5" fill={NAVY} fontWeight="700">SWITCHBOARD</text>
      <Flag x={196} y={150} value="42" unit="lm run" />
      <Flag x={196} y={62} value="12" unit="downlights" />
      <Flag x={48} y={236} value="8" unit="poles RCBO" />
    </>
  );
}

function Plumbing() {
  return (
    <>
      <FloorShell />
      {/* waste run, falling to the sewer point */}
      <path
        d="M78 96 H150 V178 H236 V214"
        fill="none"
        stroke={AMBER}
        strokeWidth="2.6"
        strokeDasharray="8 5"
        strokeLinecap="round"
        className="tp-draw"
      />
      {/* fixtures: basin, shower tray, toilet pan, kitchen sink */}
      <circle cx="72" cy="92" r="9" fill="none" stroke={NAVY} strokeWidth="2.2" />
      <rect x="96" y="60" width="30" height="30" rx="2" fill="none" stroke={NAVY} strokeWidth="2.2" />
      <path d="M96 60 L126 90 M126 60 L96 90" stroke={FAINT} strokeWidth="1.2" />
      <rect x="132" y="98" width="16" height="22" rx="7" fill="none" stroke={NAVY} strokeWidth="2.2" />
      <rect x="206" y="60" width="42" height="22" rx="2" fill="none" stroke={NAVY} strokeWidth="2.2" />
      <text x="206" y="96" fontSize="7" fill={NAVY} fontWeight="700">KITCHEN</text>
      {/* hot water unit, outside */}
      <rect x="286" y="168" width="22" height="30" rx="4" fill={NAVY} />
      <text x="256" y="212" fontSize="7" fill={NAVY} fontWeight="700">HWU</text>
      <Flag x={60} y={140} value="1" unit="bathroom rough-in" />
      <Flag x={196} y={128} value="4" unit="mixers" />
      <Flag x={48} y={236} value="1" unit="heat pump" />
    </>
  );
}

function Roofing() {
  return (
    <>
      {/* Hip roof with an L return off the right, which is what actually
          creates a valley. The first pass drew two parallel ridges, which
          reads as a rectangle rather than a roof. */}
      <g fill="none" stroke={NAVY} strokeWidth="2.4" strokeLinejoin="round">
        <path d="M44 66 H236 V214 H44 Z" />
        <path d="M236 108 H330 V214 H236" />
        {/* hips from each corner to the ridge ends */}
        <path d="M44 66 L104 122 M236 66 L176 122 M44 214 L104 158 M236 214 L176 158" strokeWidth="1.5" />
        <path d="M330 108 L302 161 M330 214 L302 161 M236 108 L272 161 M236 214 L272 161" strokeWidth="1.5" />
      </g>

      {/* ridge, the run that carries capping */}
      {/* One ridge per roof plane, running the long way. The first pass left
          a vertical stub on the main ridge, which drew a T. */}
      <path d="M104 140 H176" stroke={AMBER} strokeWidth="4.5" strokeLinecap="round" className="tp-draw" />
      <path d="M272 161 H302" stroke={AMBER} strokeWidth="4.5" strokeLinecap="round" className="tp-draw" />

      {/* valley where the two roof planes meet at the return */}
      <path
        d="M236 108 L272 161 M236 214 L272 161"
        stroke={AMBER}
        strokeWidth="2.6"
        strokeDasharray="6 4"
        strokeLinecap="round"
        className="tp-draw"
      />

      {/* gutter line around the perimeter */}
      <path d="M40 62 H240 V104 H334 V218 H40 Z" fill="none" stroke={FAINT} strokeWidth="3" />

      <Flag x={112} y={112} value="22" unit="lm ridge" leader="M110 115 L140 138" />
      <Flag x={246} y={98} value="14" unit="lm valley" leader="M250 101 L252 124" />
      <Flag x={52} y={246} value="182" unit="m2 at 22 degrees" />
    </>
  );
}

function Carpentry() {
  return (
    <>
      <FloorShell />
      {/* new stud walls, heavier and amber: what gets counted */}
      <path d="M170 52 V140" stroke={AMBER} strokeWidth="4.5" strokeLinecap="round" className="tp-draw" />
      <path d="M40 140 H110" stroke={AMBER} strokeWidth="4.5" strokeLinecap="round" className="tp-draw" />
      {/* deck off the back, hatched */}
      <defs>
        <pattern id="tp-deck" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 V7" stroke={AMBER} strokeWidth="1.4" opacity="0.55" />
        </pattern>
      </defs>
      <rect x="300" y="96" width="66" height="90" fill="url(#tp-deck)" stroke={NAVY} strokeWidth="2.2" />
      <text x="304" y="204" fontSize="7" fill={NAVY} fontWeight="700">DECK</text>
      {/* skirting run traced around the living area */}
      <path
        d="M46 146 H164 V208 H46 Z"
        fill="none"
        stroke={AMBER}
        strokeWidth="1.8"
        strokeDasharray="5 4"
        className="tp-draw"
      />
      {/* door swings */}
      {[[176, 96], [176, 168]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} a16 16 0 0 1 16 16`} fill="none" stroke={NAVY} strokeWidth="1.6" />
      ))}
      <Flag x={46} y={128} value="64" unit="lm skirting" />
      <Flag x={196} y={62} value="6" unit="doors hung" />
      <Flag x={236} y={240} value="32" unit="m2 deck" />
    </>
  );
}

function Painting() {
  return (
    <>
      <FloorShell />
      {/* rooms shaded by area, the unit this trade prices in */}
      <rect x="44" y="56" width="122" height="80" fill={AMBER} fillOpacity="0.16" className="tp-draw" />
      <rect x="174" y="56" width="122" height="80" fill={AMBER} fillOpacity="0.10" className="tp-draw" />
      <rect x="44" y="144" width="252" height="66" fill={AMBER} fillOpacity="0.20" className="tp-draw" />
      <text x="54" y="100" fontSize="8" fill={NAVY} fontWeight="700">BED 1</text>
      <text x="54" y="110" fontSize="7" fill="#5a6a78">14 m2</text>
      <text x="184" y="100" fontSize="8" fill={NAVY} fontWeight="700">BED 2</text>
      <text x="184" y="110" fontSize="7" fill="#5a6a78">12 m2</text>
      <text x="54" y="180" fontSize="8" fill={NAVY} fontWeight="700">LIVING / DINING</text>
      <text x="54" y="190" fontSize="7" fill="#5a6a78">34 m2, ceilings included</text>
      <Flag x={196} y={238} value="196" unit="m2 walls" />
      <Flag x={46} y={238} value="2" unit="coats" />
    </>
  );
}

function Generic() {
  return (
    <>
      {/* driveway slab and house footprint: the concreter's version of a plan */}
      <path d="M196 44 H340 V150 H196 Z" fill="none" stroke={NAVY} strokeWidth="2.4" />
      <text x="204" y="62" fontSize="7.5" fill={NAVY} fontWeight="700">HOUSE</text>
      <defs>
        <pattern id="tp-slab" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8 H8 M8 0 V8" stroke={AMBER} strokeWidth="1.1" opacity="0.5" />
        </pattern>
      </defs>
      <path d="M46 92 H176 V232 H46 Z" fill="url(#tp-slab)" stroke={NAVY} strokeWidth="2.4" className="tp-draw" />
      <text x="54" y="112" fontSize="8" fill={NAVY} fontWeight="700">DRIVEWAY</text>
      {/* edging run */}
      <path
        d="M176 92 V232"
        stroke={AMBER}
        strokeWidth="3.4"
        strokeDasharray="7 4"
        strokeLinecap="round"
        className="tp-draw"
      />
      <path d="M40 240 H182" stroke={FAINT} strokeWidth="1.4" />
      <text x="40" y="252" fontSize="7" fill="#5a6a78">STREET</text>
      <Flag x={196} y={176} value="60" unit="m2 exposed agg" />
      <Flag x={196} y={210} value="12" unit="lm edging" />
    </>
  );
}

const PLANS: Record<PlanKind, { node: React.ReactNode; label: string; caption: string }> = {
  electricians: {
    node: <Electrical />,
    label: "Floor plan marked up with downlights, GPOs, a switchboard and a 42 metre cable run to the shed",
    caption: "Points and runs counted straight off the plan, with the cable to the shed measured rather than guessed.",
  },
  plumbers: {
    node: <Plumbing />,
    label: "Floor plan marked up with fixtures, a bathroom rough-in and a waste run to the sewer point",
    caption: "Every fixture on its own line, rough-ins priced as the multi-day items they are.",
  },
  roofers: {
    node: <Roofing />,
    label: "Roof plan marked up with ridge, valleys, gutter line and area at pitch",
    caption: "Area and pitch for the sheeting, linear metres for everything that runs along an edge.",
  },
  carpenters: {
    node: <Carpentry />,
    label: "Floor plan marked up with new stud walls, a skirting run and a 32 square metre deck",
    caption: "Linear metre, square metre and unit work kept as separate things, not flattened into one.",
  },
  "painters-and-plasterers": {
    node: <Painting />,
    label: "Floor plan with rooms shaded and wall areas measured in square metres",
    caption: "Room by room or whole house, on the units and coat counts you set yourself.",
  },
  trades: {
    node: <Generic />,
    label: "Site plan with a driveway slab measured in square metres and edging in linear metres",
    caption: "Your own line items and units, measured off the plan the same way.",
  },
};

export default function TradePlan({ kind }: { kind: PlanKind }) {
  const plan = PLANS[kind] ?? PLANS.trades;
  return (
    <figure className="w-full max-w-[560px]">
      <div className="rounded-2xl overflow-hidden border border-[#e8ecef] bg-white shadow-[0_18px_44px_rgba(10,23,34,0.10)]">
        {plan.node ? <Sheet label={plan.label}>{plan.node}</Sheet> : null}
      </div>
      <figcaption className="mt-3 text-[12.5px] leading-[1.55] text-[#8aa4b4]">{plan.caption}</figcaption>

      {/* The marked-up elements fade up once on load, so the plan reads as
          drawn on rather than printed. Deliberately a fade and not a
          stroke-dashoffset draw: several of these runs already carry a
          strokeDasharray for the dashed convention, and animating dashoffset
          would need dasharray set too, which would wipe that pattern out.
          The shaded rooms and hatched deck are fills, where dashoffset does
          nothing at all. One shared animation covers strokes and fills alike.
          Off under reduced motion. */}
      <style>{`
        .tp-draw { opacity: 0; animation: tp-in .6s ease-out .3s forwards; }
        @keyframes tp-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .tp-draw { animation: none; opacity: 1; }
        }
      `}</style>
    </figure>
  );
}
