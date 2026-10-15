export const CLIENT_IMAGE_LIMIT = 12;
export const CLIENT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const CLIENT_IMAGE_STORED_MAX_BYTES = 5 * 1024 * 1024;
export const CLIENT_IMAGE_LIBRARY_MAX_BYTES = 40 * 1024 * 1024;

export const CLIENT_IMAGE_CATEGORIES = [
  { id: 'front', label: 'Front view' },
  { id: 'left', label: 'Left side' },
  { id: 'right', label: 'Right side' },
  { id: 'concern', label: 'Area of concern' },
  { id: 'routine', label: 'Routine or goal' },
  { id: 'progress', label: 'Progress check-in' },
  { id: 'product', label: 'Product label' },
  { id: 'other', label: 'Other' },
] as const;

export type ClientImageCategory = typeof CLIENT_IMAGE_CATEGORIES[number]['id'];
export type ClientImage = {
  id: string;
  category: ClientImageCategory;
  name: string;
  mimeType: 'image/jpeg';
  size: number;
  createdAt: string;
  blob: Blob;
};
export type TestDriveClientImage = Omit<ClientImage,'blob'|'mimeType'> & { contentUrl:string };
export type TestDriveConnection={enabled:boolean;environment:'test'|'unavailable';folder:'configured'|'created_on_first_upload'|'unavailable';connection:'ready'|'unavailable';message:string};

const DB_NAME = 'mgt-client-image-library-v1-';
const STORE_NAME = 'images';

async function testDriveRequest(path:string,init:RequestInit={}):Promise<any>{
  const sessionResponse=await fetch('/api/hub/session',{credentials:'same-origin',cache:'no-store'});
  if(!sessionResponse.ok)throw new Error('The portal session could not be checked. Refresh and try again.');
  const portalSession=await sessionResponse.json() as {csrf?:string;client_image_drive_test_enabled?:boolean};
  if(portalSession.client_image_drive_test_enabled!==true)throw new Error('Test Google Drive storage is not enabled for this environment.');
  const response=await fetch('/api/hub/client-images'+path,{...init,credentials:'same-origin',cache:'no-store',headers:{...(init.headers||{}),'x-csrf-token':portalSession.csrf||''}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error?.message||'The test image request could not be completed.');
  return data;
}

export async function listTestDriveClientImages():Promise<TestDriveClientImage[]>{return (await testDriveRequest('')).images as TestDriveClientImage[];}
export async function getTestDriveConnection():Promise<TestDriveConnection>{return testDriveRequest('/status') as Promise<TestDriveConnection>;}
export async function uploadTestDriveClientImage(image:ClientImage):Promise<TestDriveClientImage>{
  const data=await testDriveRequest('',{method:'POST',headers:{'content-type':'application/octet-stream','x-client-image-category':image.category,'x-client-image-name':`${image.id}|Skincare photo.jpg`},body:image.blob});
  return data.image as TestDriveClientImage;
}
export async function updateTestDriveClientImageCategory(id:string,category:ClientImageCategory):Promise<TestDriveClientImage>{
  const sessionResponse=await fetch('/api/hub/session',{credentials:'same-origin',cache:'no-store'});
  if(!sessionResponse.ok)throw new Error('The portal session could not be checked. Refresh and try again.');
  const portalSession=await sessionResponse.json() as {csrf?:string;client_image_drive_test_enabled?:boolean};
  if(portalSession.client_image_drive_test_enabled!==true)throw new Error('Test Google Drive storage is not enabled for this environment.');
  const response=await fetch('/api/hub/client-images/'+encodeURIComponent(id),{method:'PATCH',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','x-csrf-token':portalSession.csrf||''},body:JSON.stringify({category})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error?.message||'The image purpose could not be updated.');return data.image as TestDriveClientImage;
}
export async function deleteTestDriveClientImage(id:string):Promise<void>{await testDriveRequest('/'+encodeURIComponent(id),{method:'DELETE'});}

function database(scope: string): Promise<IDBDatabase> {
  if (!/^[a-f0-9]{64}$/.test(scope)) return Promise.reject(new Error('The image library needs an active portal session.'));
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('This browser does not support the private image library.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME + scope, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('The private image library could not be opened.'));
    request.onblocked = () => reject(new Error('Close another MGT tab to finish updating the private image library.'));
  });
}

function transact<T>(scope: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return database(scope).then(db => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    let result!: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error || new Error('The image change could not be saved.'));
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('The image change could not be saved.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('The image change could not be saved.')); };
  }));
}

export function listClientImages(scope: string): Promise<ClientImage[]> {
  return transact(scope, 'readonly', store => store.getAll()).then(items => (items as ClientImage[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function saveClientImage(scope: string, image: ClientImage): Promise<IDBValidKey> {
  return database(scope).then(db => new Promise<IDBValidKey>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let key: IDBValidKey | undefined;
    let limitError: Error | undefined;
    const read = store.getAll();
    read.onsuccess = () => {
      const existing = read.result as ClientImage[];
      const total = existing.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
      if (existing.length >= CLIENT_IMAGE_LIMIT || total + image.size > CLIENT_IMAGE_LIBRARY_MAX_BYTES) {
        limitError = new Error(existing.length >= CLIENT_IMAGE_LIMIT ? `Keep up to ${CLIENT_IMAGE_LIMIT} images in this browser.` : 'The image library limit is 40 MB. Remove an image or choose a smaller file.');
        transaction.abort();
        return;
      }
      const add = store.add(image);
      add.onsuccess = () => { key = add.result; };
      add.onerror = () => { limitError = add.error || undefined; };
    };
    transaction.oncomplete = () => { db.close(); if (key === undefined) reject(new Error('The image change could not be saved.')); else resolve(key); };
    transaction.onerror = () => { db.close(); reject(limitError || transaction.error || new Error('The image change could not be saved.')); };
    transaction.onabort = () => { db.close(); reject(limitError || transaction.error || new Error('The image change could not be saved.')); };
  }));
}

export function updateClientImageCategory(scope: string, id: string, category: ClientImageCategory): Promise<ClientImage | undefined> {
  return database(scope).then(db => new Promise<ClientImage | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const read = store.get(id);
    let updated: ClientImage | undefined;
    read.onsuccess = () => {
      if (read.result) { updated = { ...read.result, category }; store.put(updated); }
    };
    transaction.oncomplete = () => { db.close(); resolve(updated); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('The image category could not be updated.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('The image category could not be updated.')); };
  }));
}

export function deleteClientImage(scope: string, id: string): Promise<undefined> {
  return transact(scope, 'readwrite', store => store.delete(id));
}

export async function prepareClientImage(file: File, category: ClientImageCategory): Promise<ClientImage> {
  const supported = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supported.includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image. HEIC and other formats are not supported yet.');
  if (file.size <= 0 || file.size > CLIENT_IMAGE_MAX_BYTES) throw new Error('Each image must be between 1 byte and 8 MB.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('This image could not be opened. Try a JPEG, PNG, or WebP file.'); }
  try {
    if (bitmap.width < 320 || bitmap.height < 320) throw new Error('Choose a clear image at least 320 pixels wide and tall.');
    if (bitmap.width > 12000 || bitmap.height > 12000 || bitmap.width * bitmap.height > 60_000_000) throw new Error('This image is too large to prepare safely. Choose one under 60 megapixels.');
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('This browser could not prepare the image.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('This image could not be prepared.')), 'image/jpeg', 0.86));
    if (blob.size > CLIENT_IMAGE_STORED_MAX_BYTES) throw new Error('The prepared image is over 5 MB. Choose a smaller image.');
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return { id, category, name: file.name.replace(/[\u0000-\u001f\\/]/g, '_').slice(0, 120) || 'skincare-photo.jpg', mimeType: 'image/jpeg', size: blob.size, createdAt: new Date().toISOString(), blob };
  } finally { bitmap.close(); }
}
