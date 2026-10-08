const assert=require('node:assert/strict');
const {createPortal}=require('../dist/portal/server');
const {LocalStore}=require('../dist/portal/store');

(async()=>{
 const store=new LocalStore(':memory:');store.kind='postgres';
 const app=await createPortal({store,env:{NODE_ENV:'production',DEMO_MODE:'false',PUBLIC_ORIGIN:'https://portal.example',OLLAMA_ENABLED:'false'}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/api/hub/session';
 try{
  for(let index=0;index<120;index++){
   const response=await fetch(url,{headers:{'x-mgt-client-ip':'198.51.100.42'}});
   assert.equal(response.status,200,`session ${index+1} should be admitted`);
  }
  const limited=await fetch(url,{headers:{'x-mgt-client-ip':'198.51.100.42'}});
  assert.equal(limited.status,429);
  const body=await limited.json();assert.equal(body.error.code,'rate_limited');
  assert.equal(JSON.stringify(await store.tx(records=>records.get('rate','session-create:'+require('node:crypto').createHash('sha256').update('198.51.100.42').digest('hex'))).then(record=>record)).includes('198.51.100.42'),false);
  console.log('Anonymous session creation is source-throttled without retaining raw client addresses.');
 }finally{await new Promise(resolve=>server.close(resolve));await store.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
