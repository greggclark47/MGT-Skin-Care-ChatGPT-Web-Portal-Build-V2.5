const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {LocalStore}=require('../dist/portal/store');
const {OperationalWorker,InAppNotificationDelivery}=require('../dist/portal/operations');
const {createPortal}=require('../dist/portal/server');
const {
 clientImageDriveTestEnabled,clientImageDriveTestStatus,listTestDriveImages,saveTestDriveImage,getTestDriveImage,
 deleteTestDriveImage,updateTestDriveImageCategory,TestDriveImageStorage,TEST_IMAGE_FOLDER_NAME,TEST_IMAGE_UPLOAD_CONSENT_VERSION,
}=require('../dist/portal/client-image-drive');

const enabled={NODE_ENV:'test',CLIENT_IMAGE_DRIVE_TEST_ENABLED:'true',TEST_GOOGLE_DRIVE_CLIENT_ID:'client',TEST_GOOGLE_DRIVE_CLIENT_SECRET:'secret',TEST_GOOGLE_DRIVE_REFRESH_TOKEN:'refresh'};
const jpeg=Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3,4]);

test('test Drive configuration stays disabled in production and fails closed when incomplete',()=>{
 assert.equal(clientImageDriveTestEnabled(enabled),true);
 assert.equal(clientImageDriveTestEnabled({...enabled,NODE_ENV:'production'}),false);
 assert.equal(clientImageDriveTestEnabled({...enabled,TEST_GOOGLE_DRIVE_REFRESH_TOKEN:''}),false);
 assert.equal(clientImageDriveTestEnabled({...enabled,CLIENT_IMAGE_DRIVE_TEST_ENABLED:'false'}),false);
 assert.deepEqual(clientImageDriveTestStatus({...enabled,TEST_GOOGLE_DRIVE_FOLDER_ID:'folder-1'}),{enabled:true,environment:'test',folder:'configured',message:'Private test storage is available to verify before an upload.'});
 assert.equal(clientImageDriveTestStatus({...enabled,TEST_GOOGLE_DRIVE_REFRESH_TOKEN:''}).enabled,false);
 assert.equal(TEST_IMAGE_FOLDER_NAME,'MGT Skin Care Client Image Test Storage');
 assert.equal(TEST_IMAGE_UPLOAD_CONSENT_VERSION,'client-image-drive-test-1');
});

test('test Drive connection checks the actual writable folder, including a folder created earlier',async t=>{
 const originalFetch=global.fetch,folderId='folder-1',requests=[];
 let metadata={id:folderId,mimeType:'application/vnd.google-apps.folder',trashed:false,capabilities:{canAddChildren:true}};
 global.fetch=async(url,init)=>{
  requests.push(String(url));
  if(String(url)==='https://oauth2.googleapis.com/token')return Response.json({access_token:'test-token',expires_in:3600});
  assert.equal(init.headers.authorization,'Bearer test-token');
  if(String(url).includes('/files/'+folderId))return Response.json(metadata);
  return new Response('',{status:404});
 };
 t.after(()=>{global.fetch=originalFetch;});
 const drive=new TestDriveImageStorage({...enabled,TEST_GOOGLE_DRIVE_FOLDER_ID:folderId});
 assert.equal(await drive.verifyConnection(),true);
 assert.match(requests.at(-1),/fields=id,mimeType,trashed,capabilities\(canAddChildren\)&supportsAllDrives=true$/);
 for(const invalid of [
  {...metadata,id:'different-folder'},
  {...metadata,mimeType:'image/jpeg'},
  {...metadata,trashed:true},
  {...metadata,capabilities:{canAddChildren:false}},
  {...metadata,capabilities:{}},
 ]){metadata=invalid;assert.equal(await drive.verifyConnection(),false);}
 metadata={id:folderId,mimeType:'application/vnd.google-apps.folder',trashed:false,capabilities:{canAddChildren:true}};
 assert.equal(await new TestDriveImageStorage(enabled).verifyConnection(folderId),true);
 const withoutFolder=new TestDriveImageStorage(enabled),before=requests.length;
 assert.equal(await withoutFolder.verifyConnection(),true);
 assert.equal(requests.length,before+1);
});

test('test Drive status validates the saved folder rather than only its OAuth token',async t=>{
 const db=new LocalStore(':memory:'),env={...enabled,DEMO_MODE:'true',PUBLIC_ORIGIN:'http://localhost:3000'};
 await db.tx(r=>r.put('client_image_drive_config','test_folder','saved-folder'));
 const app=await createPortal({store:db,env});const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const originalFetch=global.fetch;t.after(async()=>{global.fetch=originalFetch;await new Promise(resolve=>server.close(resolve));await db.close();});
 let canAddChildren=false;global.fetch=async(url)=>String(url)==='https://oauth2.googleapis.com/token'?Response.json({access_token:'test-token',expires_in:3600}):Response.json({id:'saved-folder',mimeType:'application/vnd.google-apps.folder',trashed:false,capabilities:{canAddChildren}});
 let cookie='';const status=async()=>{const response=await originalFetch(`http://127.0.0.1:${server.address().port}/api/hub/client-images/status`,{headers:{cookie}});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response.json();};
 assert.equal((await status()).connection,'unavailable');
 canAddChildren=true;assert.equal((await status()).connection,'ready');
});

test('test Drive binary uploads require request-scoped consent',async t=>{
 const db=new LocalStore(':memory:'),env={...enabled,DEMO_MODE:'true',PUBLIC_ORIGIN:'http://localhost:3000',TEST_GOOGLE_DRIVE_FOLDER_ID:'folder-1'};const app=await createPortal({store:db,env,verifyOtp:async email=>({id:'image-consent',email})});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
 let cookie='',csrf='';const base=`http://127.0.0.1:${server.address().port}/api/hub`;const request=async(path,init={})=>{const response=await fetch(base+path,{...init,headers:{cookie,origin:'http://localhost:3000',...(init.headers||{})}});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=await response.json();if(data.csrf)csrf=data.csrf;return{response,data};};
 await request('/session');await request('/auth/verify',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({email:'image-consent@example.test',code:'123456'})});await request('/session');
 const missing=await request('/client-images',{method:'POST',headers:{'content-type':'application/octet-stream','x-csrf-token':csrf,'x-client-image-category':'front','x-client-image-name':'123e4567-e89b-42d3-a456-426614174004|photo.jpg'},body:jpeg});
 assert.equal(missing.response.status,400);assert.equal(missing.data.error.code,'image_consent_required');
});

test('test Drive image records are actor-isolated and support lifecycle changes',async t=>{
 const db=new LocalStore(':memory:');t.after(()=>db.close());
 const stored=new Map(),removed=[];
 const drive={configuredFolderId:'test-folder',upload:async(bytes,id,folder)=>{assert.equal(folder,'test-folder');stored.set('file-'+id,Buffer.from(bytes));return 'file-'+id;},content:async id=>Buffer.from(stored.get(id)),remove:async id=>{removed.push(id);stored.delete(id);},createPrivateTestFolder:async()=>{throw new Error('not expected');}};
 const actorA='a'.repeat(64),actorB='b'.repeat(64),id='123e4567-e89b-42d3-a456-426614174000';
 const created=await saveTestDriveImage(db,drive,actorA,jpeg,'front',`${id}|source-name.jpg`);
 assert.equal(created.id,id);assert.equal(created.name,'source-name.jpg');assert.equal(created.contentUrl,`/api/hub/client-images/${id}/content`);
 assert.deepEqual((await listTestDriveImages(db,actorA)).map(item=>item.id),[id]);
 assert.deepEqual(await listTestDriveImages(db,actorB),[]);
 assert.equal(await getTestDriveImage(db,drive,actorB,id),undefined);
 const loaded=await getTestDriveImage(db,drive,actorA,id);assert.deepEqual(loaded.bytes,jpeg);
 const updated=await updateTestDriveImageCategory(db,actorA,id,'progress');assert.equal(updated.category,'progress');
 assert.equal(await updateTestDriveImageCategory(db,actorB,id,'progress'),undefined);
 assert.equal(await deleteTestDriveImage(db,drive,actorB,id),false);assert.equal(removed.length,0);
 assert.equal(await deleteTestDriveImage(db,drive,actorA,id),true);assert.equal(removed.length,1);
 assert.deepEqual(await listTestDriveImages(db,actorA),[]);
});

test('failed Drive uploads remove pending ownership records',async t=>{
 const db=new LocalStore(':memory:');t.after(()=>db.close());
 const drive={configuredFolderId:'test-folder',upload:async()=>{throw new Error('offline');},remove:async()=>{},createPrivateTestFolder:async()=>{throw new Error('not expected');}};
 const actor='c'.repeat(64),id='123e4567-e89b-42d3-a456-426614174001';
 await assert.rejects(saveTestDriveImage(db,drive,actor,jpeg,'front',`${id}|photo.jpg`),/offline/);
 assert.deepEqual(await db.tx(records=>records.list('client_image_drive')),[]);
});

test('account deletion is blocked until test Drive images are removed',async t=>{
 const db=new LocalStore(':memory:');t.after(()=>db.close());
 const at=Date.parse('2026-10-14T12:00:00.000Z'),actor='user_drive-owner',imageActor=createHash('sha256').update(actor).digest('hex');
 await db.tx(async records=>{
  await records.put('accounts','drive-owner',{id:'drive-owner',roles:[]});
  await records.put('deletion_requests',actor,{request_id:'delete-drive-owner',actor,user_id:'drive-owner',requested_at:'2026-10-01T00:00:00.000Z',not_before:'2026-10-10T00:00:00.000Z',status:'pending'});
  await records.put('client_image_drive',`${imageActor}:123e4567-e89b-42d3-a456-426614174002`,{id:'123e4567-e89b-42d3-a456-426614174002',actor:imageActor,fileId:'private-drive-id',category:'front',name:'photo.jpg',size:jpeg.length,createdAt:'2026-10-14T00:00:00.000Z',status:'ready'});
 });
 const identities=[];const worker=new OperationalWorker(db,{delivery:new InAppNotificationDelivery(),identityDeletion:{kind:'test',remove:async id=>identities.push(id)}});
 const result=await worker.runOnce(at);assert.equal(result.deletions_completed,0);assert.equal(result.deletions_blocked,1);assert.deepEqual(identities,[]);
 const request=await db.tx(records=>records.get('deletion_requests',actor));assert(request.blocked_reasons.includes('test_drive_images_present'));
});

test('account export includes safe test image metadata without Drive identifiers',async t=>{
 const db=new LocalStore(':memory:');const app=await createPortal({store:db,env:{NODE_ENV:'test',DEMO_MODE:'true',PUBLIC_ORIGIN:'http://localhost:3000'},verifyOtp:async email=>({id:'image-export',email})});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
 let cookie='',csrf='';const call=async(path,body)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/hub${path}`,{method:body===undefined?'GET':'POST',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json','x-csrf-token':csrf},body:body===undefined?undefined:JSON.stringify(body)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=await response.json();if(data.csrf)csrf=data.csrf;return{status:response.status,data};};
 await call('/session');assert.equal((await call('/auth/verify',{email:'images@example.test',code:'123456'})).status,200);await call('/session');
 const status=await call('/client-images/status');assert.equal(status.status,200);assert.deepEqual(status.data,{enabled:false,environment:'unavailable',folder:'unavailable',connection:'unavailable',message:'Private Google Drive test storage has not been configured for this environment.'});
 const actor='user_image-export',imageActor=createHash('sha256').update(actor).digest('hex'),id='123e4567-e89b-42d3-a456-426614174003';
 await db.tx(records=>records.put('client_image_drive',`${imageActor}:${id}`,{id,actor:imageActor,fileId:'must-not-export',category:'progress',name:'Skincare photo.jpg',size:1234,createdAt:'2026-10-14T00:00:00.000Z',status:'ready'}));
 const exported=await call('/account/export');assert.equal(exported.status,200);assert.deepEqual(exported.data.test_drive_images,[{id,category:'progress',name:'Skincare photo.jpg',size:1234,created_at:'2026-10-14T00:00:00.000Z'}]);assert.equal(JSON.stringify(exported.data).includes('must-not-export'),false);
});
