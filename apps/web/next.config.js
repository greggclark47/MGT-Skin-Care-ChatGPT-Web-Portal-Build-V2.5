/** @type {import('next').NextConfig} */
module.exports=(phase)=>({distDir:phase==='phase-development-server'?'.next-dev':'.next',reactStrictMode:true,transpilePackages:['@mgt/domain','@mgt/shared'],async rewrites(){return [{source:'/api/hub/:path*',destination:(process.env.PORTAL_API_ORIGIN||'http://127.0.0.1:3100')+'/api/hub/:path*'}];}});



