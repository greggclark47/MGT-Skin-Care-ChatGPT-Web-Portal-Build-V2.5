import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { verifyOperationsAlertRequest } from './operations';

const MAX_BODY_BYTES=65536;
const header=(req:IncomingMessage,name:string)=>{const value=req.headers[name];return Array.isArray(value)?value[0]||'':value||'';};
const respond=(res:ServerResponse,status:number,body:Record<string,unknown>)=>{const encoded=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json','content-length':Buffer.byteLength(encoded),'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(encoded);};

export function createOperationsAlertReceiver(env:NodeJS.ProcessEnv=process.env,log:(record:Record<string,unknown>)=>void=record=>console.log(JSON.stringify(record))){
 const secret=env.OPERATIONS_ALERT_WEBHOOK_TOKEN||'';const keyId=env.OPERATIONS_ALERT_KEY_ID||'primary';const maxAgeSeconds=Number(env.OPERATIONS_ALERT_MAX_AGE_SECONDS||300);
 if(!secret||secret.length>4096)throw new Error('Operations alert receiver token is missing.');
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(keyId))throw new Error('Operations alert receiver key ID is invalid.');
 if(!Number.isInteger(maxAgeSeconds)||maxAgeSeconds<30||maxAgeSeconds>900)throw new Error('Operations alert receiver replay window is invalid.');
 return createServer((req,res)=>{
  if(req.method==='GET'&&req.url==='/healthz'){respond(res,200,{status:'ok'});return;}
  if(req.method!=='POST'||req.url!=='/events'){respond(res,404,{error:'not_found'});return;}
  if(header(req,'content-type').split(';')[0].trim().toLowerCase()!=='application/json'){respond(res,415,{error:'unsupported_media_type'});return;}
  const chunks:Buffer[]=[];let size=0,finished=false;
  req.on('data',(chunk:Buffer)=>{if(finished)return;size+=chunk.length;if(size>MAX_BODY_BYTES){finished=true;respond(res,413,{error:'payload_too_large'});req.destroy();return;}chunks.push(chunk);});
  req.on('end',()=>{if(finished)return;const body=Buffer.concat(chunks).toString('utf8');const deliveryId=header(req,'x-mgt-delivery-id'),attempt=header(req,'x-mgt-attempt'),receivedAt=new Date().toISOString();
   const valid=header(req,'x-mgt-key-id')===keyId&&verifyOperationsAlertRequest({event:header(req,'x-mgt-event'),signatureVersion:header(req,'x-mgt-signature-version'),deliveryId,attempt,timestamp:header(req,'x-mgt-timestamp'),contentDigest:header(req,'x-mgt-content-sha256'),signature:header(req,'x-mgt-signature'),body,secret,maxAgeSeconds});
   if(!valid){respond(res,401,{error:'invalid_signature'});return;}
   let status='unknown',alertCount=0;try{const parsed=JSON.parse(body);status=parsed.alert.status;alertCount=Array.isArray(parsed.alert.alerts)?parsed.alert.alerts.length:0;}catch{respond(res,400,{error:'invalid_payload'});return;}
   log({event:'operations_alert_received',delivery_id:deliveryId,attempt:Number(attempt),status,alert_count:alertCount,received_at:receivedAt});respond(res,202,{accepted:true,delivery_id:deliveryId});
  });
 });
}

if(require.main===module){const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT is invalid.');const server=createOperationsAlertReceiver();server.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({event:'operations_alert_receiver_started',port})));}
