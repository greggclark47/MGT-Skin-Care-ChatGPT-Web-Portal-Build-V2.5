import Link from 'next/link';

const paths = [
  {
    number: '01',
    eyebrow: 'PERSONAL STUDIO',
    title: 'Build a routine that can keep up with you.',
    copy: 'Start with Skin Match, then return to a connected workspace for routine care, progress, replenishment, and preferences.',
    primary: { href: '/skin-match', label: 'Start Skin Match' },
    secondary: { href: '/routine', label: 'Open my routine' },
    accent: 'aqua',
    outcomes: ['Profile-led starting point', 'AM / PM routine clarity', 'You approve every change'],
  },
  {
    number: '02',
    eyebrow: 'CURATED DISCOVERY',
    title: 'Explore beauty, style, and retail with context.',
    copy: 'Review ingredients, color, wardrobe, and retailer destinations with clear labels, practical context, and your choices in control.',
    primary: { href: '/anti-aging', label: 'Explore the edit' },
    secondary: { href: '/shop', label: 'Find retailer destinations' },
    accent: 'rose',
    outcomes: ['Reviewed discovery', 'Retailer links stay external', 'Style meets everyday care'],
  },
  {
    number: '03',
    eyebrow: 'PARTNER COLLABORATION',
    title: 'Create a stronger, more considered customer journey.',
    copy: 'Retail and professional partners can explore a transparent collaboration path built around customer choice, support, and approved placements.',
    primary: { href: '/partners', label: 'Explore partnership' },
    secondary: { href: '/support', label: 'Talk to support' },
    accent: 'orange',
    outcomes: ['Customer-first referrals', 'Clear support handoffs', 'Approved partner workflow'],
  },
] as const;

export function HomeExperienceMap() {
  return <section className="experience-map" aria-labelledby="experience-map-heading">
    <div className="experience-map-heading">
      <div>
        <span className="eyebrow">ONE CONNECTED EXPERIENCE</span>
        <h2 id="experience-map-heading">Choose what you need <em>right now.</em></h2>
      </div>
      <p>Start simply, go deeper when it is useful, and keep every decision understandable.</p>
    </div>
    <div className="experience-paths">
      {paths.map(path => <article className={'experience-path path-' + path.accent} key={path.number}>
        <div className="experience-path-top"><span className="experience-number">{path.number}</span><span className="eyebrow">{path.eyebrow}</span></div>
        <h3>{path.title}</h3>
        <p>{path.copy}</p>
        <ul>{path.outcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
        <div className="experience-path-actions">
          <Link className="button primary" href={path.primary.href}>{path.primary.label} <span aria-hidden="true">↗</span></Link>
          <Link className="text-link" href={path.secondary.href}>{path.secondary.label} <span aria-hidden="true">→</span></Link>
        </div>
      </article>)}
    </div>
  </section>;
}
