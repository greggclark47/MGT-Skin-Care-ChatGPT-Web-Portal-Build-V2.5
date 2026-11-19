const assert=require('node:assert/strict');
const {createPortal}=require('../dist/portal/server');
const {LocalStore}=require('../dist/portal/store');

(async()=>{
 const store=new LocalStore(':memory:');store.kind='postgres';
 const edgeToken='test-edge-token-not-for-production-use-123456';
 const app=await createPortal({store,env:{NODE_ENV:'production',DEMO_MODE:'false',PUBLIC_ORIGIN:'https://portal.example',PORTAL_DOMAIN:'portal.example',MGT_EDGE_TOKEN:edgeToken,OLLAMA_ENABLED:'false',RELEASE_OWNER_NAME:'Gregg Clark of MGT',SUPPORT_OWNER_NAME:'Gregg Clark of MGT',WORKER_INTERVAL_SECONDS:'60',WORKER_READINESS_MAX_AGE_SECONDS:'300'}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/api/hub/session';
 try{
  for(let index=0;index<120;index++){
   const response=await fetch(url,{headers:{'x-mgt-client-ip':`198.51.100.${index%200+1}`}});
   assert.equal(response.status,200,`session ${index+1} should be admitted`);
  }
  const limited=await fetch(url,{headers:{'x-mgt-client-ip':'203.0.113.99','x-mgt-edge-token':'forged'}});
  assert.equal(limited.status,429);
  const body=await limited.json();assert.equal(body.error.code,'rate_limited');
  const forwarded=await fetch(url,{headers:{'x-mgt-client-ip':'198.51.100.42','x-mgt-edge-token':edgeToken}});
  assert.equal(forwarded.status,200,'the authenticated edge keeps a separate per-client bucket');
  const receipt=await store.tx(records=>records.get('rate','session-create:'+require('node:crypto').createHash('sha256').update('198.51.100.42').digest('hex')));
  assert.equal(receipt.count,1);
  assert.equal(JSON.stringify(receipt).includes('198.51.100.42'),false);
  console.log('Anonymous session creation rejects spoofed client-IP headers and accepts authenticated edge forwarding.');
 }finally{await new Promise(resolve=>server.close(resolve));await store.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
