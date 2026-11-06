import React from 'react';
import {PortalShell} from '../components/PortalShell';
import './globals.css';
import './theme.css';
import './client-images.css';
import './match-intelligence.css';
const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||'https://team47studio.com';
export const metadata={metadataBase:new URL(siteUrl),title:{default:'Team 47 Studio — Care, color and style, connected',template:'%s · Team 47 Studio'},description:'A personal studio for skincare routines, color discovery, wardrobe guidance and considered shopping.',alternates:{canonical:'/'},openGraph:{type:'website',url:'/',siteName:'Team 47 Studio',title:'Team 47 Studio — Care, color and style, connected',description:'Personalized skincare, color discovery, wardrobe guidance and considered shopping.'},icons:{icon:'/brand/team47studio-app-icon-1024.png',apple:'/brand/team47studio-app-icon-1024.png'}};
const themeScript="try{var t=localStorage.getItem('mgt-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}";
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><PortalShell>{children}</PortalShell></body></html>}
