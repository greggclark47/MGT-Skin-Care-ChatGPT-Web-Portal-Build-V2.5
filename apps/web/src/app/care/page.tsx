import Link from 'next/link';
import {AppFrame} from '../../components/HubFrames';

const needs=[
 {title:'Create or connect an account',detail:'Sign in by email code or the configured Google sign-in, and resolve profile linking if prompted.',href:'/account',action:'Open account setup'},
 {title:'Profile and preferences',detail:'Update your personal details, skin goals, communication preferences, style interests and connected service settings.',href:'/account#profile-settings',action:'Manage my profile'},
 {title:'Premium plan and payments',detail:'Review the plan and renewal status. When billing is available, payment methods and invoices open in secure billing.',href:'/account#payment-settings',action:'Open payment settings'},
 {title:'Subscription or cancellation',detail:'Review confirmed subscription activity and available renewal controls before the next billing period.',href:'/subscription',action:'Review subscription'},
 {title:'Photos and journal',detail:'Find upload guidance, image categories and removal controls where the test image service is enabled.',href:'/account#image-library',action:'Manage images'},
 {title:'Routine, match and AI guidance',detail:'Review your skin profile and routine; report inaccurate or concerning guidance for human review.',href:'/support?type=routine_guidance#portal-request',action:'Ask for guidance'},
 {title:'Retailer purchase or return',detail:'Use your retailer receipt for payment, shipping and returns. We can help locate the right handoff.',href:'/orders',action:'Get retailer help'},
 {title:'Privacy and account data',detail:'Download your account data, manage analysis permission or schedule account deletion.',href:'/account#privacy-controls',action:'Open privacy controls'},
 {title:'Accessibility or technical trouble',detail:'Tell us what page and device caused trouble. Do not include passwords, card details or medical records.',href:'/support?type=portal_help#portal-request',action:'Save a support request'},
];

export default function Care(){return <AppFrame title="Account & customer care">
 <p className="lead">One place to find the right account control or support route.</p>
 <p className="notice">This development preview saves portal requests in the account area. External delivery and response times are awaiting production setup.</p>
 <section className="care-grid" aria-label="Choose what you need help with">{needs.map(item=><article className="panel" key={item.title}><h2>{item.title}</h2><p>{item.detail}</p><Link className="text-link" href={item.href}>{item.action} →</Link></article>)}</section>
 <section className="panel"><h2>Still need help?</h2><p>Use Portal Support to save a request and track customer visible replies. For a security or privacy concern, choose “Account or privacy” in the request form.</p><div className="actions"><Link className="button primary" href="/support#portal-request">Open Portal Support</Link><Link className="button" href="/terms">Read draft terms</Link></div></section>
 </AppFrame>}
