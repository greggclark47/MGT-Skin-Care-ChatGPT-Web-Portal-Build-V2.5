import React from 'react';
import {PortalShell} from '../components/PortalShell';
import './globals.css';
import './theme.css';
import './client-images.css';
import './match-intelligence.css';
import {BRAND} from '../lib/brand';
const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||BRAND.siteUrl;
export const metadata={metadataBase:new URL(siteUrl),title:{default:`${BRAND.name} — A more confident everyday studio`,template:`%s · ${BRAND.name}`},description:'A personal studio that turns skincare, color, style, and considered shopping into clearer everyday choices.',applicationName:BRAND.name,authors:[{name:BRAND.operator.name}],creator:BRAND.operator.name,publisher:`${BRAND.name}, owned and operated by ${BRAND.legalOwner}`,alternates:{canonical:'/'},openGraph:{type:'website',url:'/',siteName:BRAND.name,title:`${BRAND.name} — A more confident everyday studio`,description:'Skincare, color discovery, wardrobe guidance and considered shopping that help you move through your day with more clarity.'},icons:{icon:'/brand/team47studio-app-icon-1024.png',apple:'/brand/team47studio-app-icon-1024.png'}};
const themeScript=`try{var k='${BRAND.themeStorageKey}',l='${BRAND.legacyThemeStorageKey}',t=localStorage.getItem(k)||localStorage.getItem(l);if(!localStorage.getItem(k)&&(t==='light'||t==='dark'))localStorage.setItem(k,t);document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}`;
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><PortalShell>{children}</PortalShell></body></html>}
