import Link from 'next/link';

const paths = [
  {
    number: '01',
    eyebrow: 'PERSONAL STUDIO',
    title: 'Build a routine that makes your day feel more possible.',
    copy: 'Start with Skin Match, then return to a connected workspace that helps turn daily care into a calmer, more confident rhythm.',
    primary: { href: '/skin-match', label: 'Start Skin Match' },
    secondary: { href: '/routine', label: 'Open my routine' },
    accent: 'aqua',
    outcomes: ['A starting point shaped by you', 'A calmer AM / PM rhythm', 'Every change stays yours to approve'],
  },
  {
    number: '02',
    eyebrow: 'CURATED DISCOVERY',
    title: 'Let your care and style tell the same story.',
    copy: 'Explore ingredients, color, wardrobe, and retailer destinations with practical context that makes it easier to choose what feels right.',
    primary: { href: '/anti-aging', label: 'Explore the edit' },
    secondary: { href: '/shop', label: 'Find retailer destinations' },
    accent: 'rose',
    outcomes: ['Inspiration with useful context', 'Independent retailer choices', 'Care and style in one place'],
  },
  {
    number: '03',
    eyebrow: 'PARTNER COLLABORATION',
    title: 'Create moments customers want to return to.',
    copy: 'Retail and professional partners can build transparent, high-care experiences with clear choices, reliable handoffs, and a shared commitment to customer confidence.',
    primary: { href: '/partners', label: 'Explore partnership' },
    secondary: { href: '/support', label: 'Talk to support' },
    accent: 'orange',
    outcomes: ['Customer-first referrals', 'Warm, clear support handoffs', 'A review-led partner workflow'],
  },
] as const;

export function HomeExperienceMap() {
  return <section className="experience-map" aria-labelledby="experience-map-heading">
    <div className="experience-map-heading">
      <div>
        <span className="eyebrow">ONE CONNECTED EXPERIENCE</span>
        <h2 id="experience-map-heading">Choose the next thing that helps you <em>feel amazing.</em></h2>
      </div>
      <p>Start simply, go deeper when it is useful, and let every choice build toward more confidence in your everyday life.</p>
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
