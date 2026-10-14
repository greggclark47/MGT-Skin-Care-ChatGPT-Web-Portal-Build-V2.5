import { randomUUID } from 'node:crypto';
import type { Store } from './store';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const IMAGE_LIMIT = 12;
const IMAGE_BYTES_LIMIT = 5 * 1024 * 1024;
const LIBRARY_BYTES_LIMIT = 40 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set(['front','left','right','concern','routine','progress','product','other']);

type DriveRecord = { id:string; actor:string; fileId:string; category:string; name:string; size:number; createdAt:string; status:'pending'|'ready' };
export type ClientDriveImage = Omit<DriveRecord,'actor'|'fileId'|'status'> & { contentUrl:string };

export function clientImageDriveTestEnabled(env:NodeJS.ProcessEnv):boolean {
 return env.NODE_ENV!=='production'&&env.CLIENT_IMAGE_DRIVE_TEST_ENABLED==='true'&&!!env.TEST_GOOGLE_DRIVE_CLIENT_ID&&!!env.TEST_GOOGLE_DRIVE_CLIENT_SECRET&&!!env.TEST_GOOGLE_DRIVE_REFRESH_TOKEN;
}

export class TestDriveImageStorage {
 private token?:{value:string;expiresAt:number};
 private refreshing?:Promise<string>;
 constructor(private env:NodeJS.ProcessEnv){}
 get enabled(){return clientImageDriveTestEnabled(this.env);}
 get configuredFolderId(){return this.env.TEST_GOOGLE_DRIVE_FOLDER_ID||'';}
 private async accessToken():Promise<string>{
  if(!this.enabled)throw new Error('Test Google Drive image storage is not configured.');
  if(this.token&&this.token.expiresAt>Date.now()+60000)return this.token.value;
  if(this.refreshing)return this.refreshing;
  this.refreshing=(async()=>{
   const body=new URLSearchParams({client_id:this.env.TEST_GOOGLE_DRIVE_CLIENT_ID!,client_secret:this.env.TEST_GOOGLE_DRIVE_CLIENT_SECRET!,refresh_token:this.env.TEST_GOOGLE_DRIVE_REFRESH_TOKEN!,grant_type:'refresh_token'});
   const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error('Test Drive authorization is unavailable.');
   const result=await response.json() as {access_token?:string;expires_in?:number};
   if(typeof result.access_token!=='string'||!Number.isFinite(result.expires_in))throw new Error('Test Drive authorization is unavailable.');
   this.token={value:result.access_token,expiresAt:Date.now()+Math.max(60,Number(result.expires_in))*1000};return result.access_token;
  })().finally(()=>{this.refreshing=undefined;});
  return this.refreshing;
 }
 private async request(url:string,init:RequestInit):Promise<Response>{
  const token=await this.accessToken();
  const response=await fetch(url,{...init,headers:{...init.headers,authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
  if(response.status===401){this.token=undefined;const retryToken=await this.accessToken();const retry=await fetch(url,{...init,headers:{...init.headers,authorization:`Bearer ${retryToken}`},signal:AbortSignal.timeout(20000)});if(!retry.ok)throw new Error('Google Drive could not complete the image request.');return retry;}
  if(!response.ok)throw new Error('Google Drive could not complete the image request.');return response;
 }
 async upload(bytes:Buffer,id:string,folderId:string):Promise<string>{
  if(bytes.length<4||bytes.length>IMAGE_BYTES_LIMIT||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)throw new Error('Only prepared JPEG images up to 5 MB can be saved.');
  const boundary=`mgt_${randomUUID().replace(/-/g,'')}`;
  const metadata=JSON.stringify({name:`mgt-test-image-${id}.jpg`,mimeType:'image/jpeg',parents:[folderId]});
  const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--`)]);
  const response=await this.request(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`,{method:'POST',headers:{'content-type':`multipart/related; boundary=${boundary}`},body});
  const data=await response.json() as {id?:string};if(typeof data.id!=='string'||data.id.length>256)throw new Error('Google Drive did not confirm the saved image.');return data.id;
 }
 async createPrivateTestFolder():Promise<string>{
  const response=await this.request(`${DRIVE_API}/files?fields=id`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'MGT Skin Care Test Images',mimeType:'application/vnd.google-apps.folder'})});
  const data=await response.json() as {id?:string};if(typeof data.id!=='string'||data.id.length>256)throw new Error('Google Drive could not create the private test folder.');return data.id;
 }
 async content(fileId:string):Promise<Buffer>{const response=await this.request(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,{method:'GET'});if(!response.body)throw new Error('Google Drive returned no image content.');const reader=response.body.getReader(),parts:Buffer[]=[];let length=0;try{while(true){const item=await reader.read();if(item.done)break;length+=item.value.byteLength;if(length>IMAGE_BYTES_LIMIT)throw new Error('The stored test image is too large.');parts.push(Buffer.from(item.value));}}finally{await reader.cancel().catch(()=>undefined);}return Buffer.concat(parts,length);}
 async remove(fileId:string):Promise<void>{await this.request(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`,{method:'DELETE'});}
}

function publicImage(record:DriveRecord):ClientDriveImage{return{id:record.id,category:record.category,name:record.name,size:record.size,createdAt:record.createdAt,contentUrl:`/api/hub/client-images/${record.id}/content`};}
export async function listTestDriveImages(db:Store,actor:string):Promise<ClientDriveImage[]>{
 return db.tx(async records=>(await records.list<DriveRecord>('client_image_drive')).filter(item=>item.actor===actor&&item.status==='ready').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(publicImage));
}
export async function saveTestDriveImage(db:Store,drive:TestDriveImageStorage,actor:string,bytes:Buffer,category:string,name:string):Promise<ClientDriveImage>{
 if(!CATEGORIES.has(category))throw new Error('Choose a valid image purpose.');
 if(!UUID.test(name.slice(0,36)))throw new Error('The image request is invalid.');
 const id=name.slice(0,36),key=`${actor}:${id}`,safeName=name.slice(37).replace(/[\u0000-\u001f\\/]/g,'_').slice(0,120)||'skincare-photo.jpg';
 const record:DriveRecord={id,actor,fileId:'',category,name:safeName,size:bytes.length,createdAt:new Date().toISOString(),status:'pending'};
 await db.tx(async records=>{await records.lock(`client-image-drive:${actor}`);const recordsForActor=(await records.list<DriveRecord>('client_image_drive')).filter(item=>item.actor===actor);const stale=recordsForActor.filter(item=>item.status==='pending'&&Date.now()-Date.parse(item.createdAt)>3600000);for(const item of stale)await records.remove('client_image_drive',`${actor}:${item.id}`);const current=recordsForActor.filter(item=>!stale.includes(item));if(current.length>=IMAGE_LIMIT||current.reduce((sum,item)=>sum+item.size,0)+bytes.length>LIBRARY_BYTES_LIMIT)throw new Error(current.length>=IMAGE_LIMIT?'The test Drive image library is limited to 12 images.':'The test Drive image library is limited to 40 MB.');if(await records.get('client_image_drive',key))throw new Error('This image was already saved.');await records.put('client_image_drive',key,record);});
 let uploadedFileId='';
 try{let folderId=drive.configuredFolderId;if(!folderId){folderId=await db.tx(records=>records.get<string>('client_image_drive_config','test_folder'))||'';if(!folderId){const created=await drive.createPrivateTestFolder();folderId=await db.tx(async records=>{await records.lock('client-image-drive-folder');const existing=await records.get<string>('client_image_drive_config','test_folder');if(existing)return existing;await records.put('client_image_drive_config','test_folder',created);return created;});}}uploadedFileId=await drive.upload(bytes,id,folderId);record.fileId=uploadedFileId;record.status='ready';await db.tx(records=>records.put('client_image_drive',key,record));return publicImage(record);}
 catch(error){if(uploadedFileId)await drive.remove(uploadedFileId).catch(()=>undefined);await db.tx(records=>records.remove('client_image_drive',key)).catch(()=>undefined);throw error;}
}
export async function getTestDriveImage(db:Store,drive:TestDriveImageStorage,actor:string,id:string):Promise<{record:ClientDriveImage;bytes:Buffer}|undefined>{
 if(!UUID.test(id))return undefined;const item=await db.tx(records=>records.get<DriveRecord>('client_image_drive',`${actor}:${id}`));if(!item||item.actor!==actor||item.status!=='ready')return undefined;const bytes=await drive.content(item.fileId);if(bytes.length!==item.size||bytes.length>IMAGE_BYTES_LIMIT||bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)throw new Error('The stored test image did not pass validation.');return{record:publicImage(item),bytes};
}
export async function deleteTestDriveImage(db:Store,drive:TestDriveImageStorage,actor:string,id:string):Promise<boolean>{
 if(!UUID.test(id))return false;const key=`${actor}:${id}`,item=await db.tx(records=>records.get<DriveRecord>('client_image_drive',key));if(!item||item.actor!==actor||item.status!=='ready')return false;await drive.remove(item.fileId);await db.tx(records=>records.remove('client_image_drive',key));return true;
}
export async function updateTestDriveImageCategory(db:Store,actor:string,id:string,category:string):Promise<ClientDriveImage|undefined>{
 if(!UUID.test(id)||!CATEGORIES.has(category))return undefined;const key=`${actor}:${id}`;return db.tx(async records=>{await records.lock(`client-image-drive:${actor}`);const item=await records.get<DriveRecord>('client_image_drive',key);if(!item||item.actor!==actor||item.status!=='ready')return undefined;const updated={...item,category};await records.put('client_image_drive',key,updated);return publicImage(updated);});
}
