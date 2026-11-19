/** @type {import('next').NextConfig} */
const securityHeaders=[
 {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'},
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:'DENY'},
 {key:'X-Permitted-Cross-Domain-Policies',value:'none'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
 {key:'Cross-Origin-Resource-Policy',value:'same-origin'},
 {key:'Content-Security-Policy',value:"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; upgrade-insecure-requests"}
];
module.exports=(phase)=>({
 distDir:process.env.MGT_NEXT_DIST_DIR||(phase==='phase-development-server'?'.next-dev':'.next'),
 reactStrictMode:true,
 poweredByHeader:false,
 transpilePackages:['@mgt/domain','@mgt/shared'],
 async headers(){return [{source:'/:path*',headers:securityHeaders}];},
 async rewrites(){return ['hub','v1'].map(prefix=>({source:'/api/'+prefix+'/:path*',destination:(process.env.PORTAL_API_ORIGIN||'http://127.0.0.1:3100')+'/api/'+prefix+'/:path*'}));}
});



