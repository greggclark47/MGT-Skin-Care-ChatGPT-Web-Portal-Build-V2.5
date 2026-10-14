'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLIENT_IMAGE_CATEGORIES, CLIENT_IMAGE_LIMIT, CLIENT_IMAGE_MAX_BYTES,
  deleteClientImage, listClientImages, prepareClientImage, saveClientImage,
  updateClientImageCategory, listTestDriveClientImages, uploadTestDriveClientImage, deleteTestDriveClientImage, updateTestDriveClientImageCategory,
  type ClientImage, type TestDriveClientImage, type ClientImageCategory,
} from '../lib/client-images';
import { useHub } from '../lib/hub';

function ImageCard({ image, onCategory, onDelete }: { image: ClientImage; onCategory: (id: string, category: ClientImageCategory) => void; onDelete: (image: ClientImage) => void }) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(image.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image.blob]);
  return <article className="client-image-card">
    {preview && <img src={preview} alt={`${CLIENT_IMAGE_CATEGORIES.find(item => item.id === image.category)?.label || 'Skincare'} image`} loading="lazy"/>}
    <div className="client-image-card-details">
      <strong>{image.name}</strong>
      <label className="field">Image purpose<select aria-label={`Image purpose for ${image.name}`} value={image.category} onChange={event => onCategory(image.id, event.target.value as ClientImageCategory)}>{CLIENT_IMAGE_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <small>{(image.size / 1024).toFixed(0)} KB · Saved in this browser</small>
      <button type="button" className="text-button" onClick={() => onDelete(image)}>Remove image</button>
    </div>
  </article>;
}

function TestDriveImageCard({ image, onCategory, onDelete }: { image: TestDriveClientImage; onCategory: (image: TestDriveClientImage, category: ClientImageCategory) => void; onDelete: (image: TestDriveClientImage) => void }) {
  return <article className="client-image-card">
    <img src={image.contentUrl} alt={`${CLIENT_IMAGE_CATEGORIES.find(item => item.id === image.category)?.label || 'Skincare'} image`} loading="lazy"/>
    <div className="client-image-card-details"><strong>{image.name}</strong><label className="field">Image purpose<select aria-label={`Image purpose for ${image.name}`} value={image.category} onChange={event => onCategory(image, event.target.value as ClientImageCategory)}>{CLIENT_IMAGE_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><small>{(image.size / 1024).toFixed(0)} KB · Private test Drive folder</small><button type="button" className="text-button" onClick={() => onDelete(image)}>Remove image</button></div>
  </article>;
}

export function ClientImageStudio({ compact = false }: { compact?: boolean }) {
  const [images, setImages] = useState<ClientImage[]>([]);
  const [driveImages, setDriveImages] = useState<TestDriveClientImage[]>([]);
  const [destination, setDestination] = useState<'device'|'test-drive'>('device');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [category, setCategory] = useState<ClientImageCategory>('front');
  const input = useRef<HTMLInputElement>(null);
  const session = useHub('/session');
  const scope = session.data?.client_image_scope || '';
  const testDriveEnabled = session.data?.client_image_drive_test_enabled === true;

  const refresh = useCallback(async (imageScope: string) => {
    setLoading(true); setError('');
    try { setImages(await listClientImages(imageScope)); }
    catch (failure) { setError((failure as Error).message); }
    finally { setLoading(false); }
  }, []);
  const refreshDrive = useCallback(async () => {
    setLoading(true); setError('');
    try { setDriveImages(await listTestDriveClientImages()); }
    catch (failure) { setError((failure as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (session.loading) { setImages([]); setLoading(true); return; }
    if (session.error) { setImages([]); setLoading(false); setError(session.error); return; }
    if (scope) { setImages([]); setDriveImages([]); void (destination === 'test-drive' && testDriveEnabled ? refreshDrive() : refresh(scope)); }
  }, [scope, session.loading, session.error, refresh, destination, testDriveEnabled, refreshDrive]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (!scope) throw new Error('Wait for your portal session to finish loading before adding photos.');
      const currentCount = destination === 'test-drive' ? driveImages.length : images.length;
      if (currentCount + files.length > CLIENT_IMAGE_LIMIT) throw new Error(`Keep up to ${CLIENT_IMAGE_LIMIT} images in this library. Remove an image before adding more.`);
      const prepared = await Promise.all(Array.from(files).map(file => prepareClientImage(file, category)));
      if (destination === 'test-drive') {
        if (!testDriveEnabled) throw new Error('Test Google Drive storage is not enabled for this environment.');
        for (const image of prepared) await uploadTestDriveClientImage(image);
        await refreshDrive();
        setMessage(`${prepared.length} ${prepared.length === 1 ? 'test copy is' : 'test copies are'} saved in the configured private Google Drive folder. Test storage only; not analyzed.`);
      } else {
        for (const image of prepared) await saveClientImage(scope, image);
        setImages(await listClientImages(scope));
        setMessage(`${prepared.length} ${prepared.length === 1 ? 'image is' : 'images are'} saved in this browser. They have not been uploaded to MGT or analyzed.`);
      }
      if (input.current) input.current.value = '';
    } catch (failure) {
      const name = (failure as Error).name;
      if (scope) {
        if (destination === 'test-drive') void listTestDriveClientImages().then(setDriveImages).catch(() => undefined);
        else void listClientImages(scope).then(setImages).catch(() => undefined);
      }
      setError(name === 'QuotaExceededError' ? 'This browser is out of storage space. Remove unused images or choose smaller files.' : (failure as Error).message);
    } finally { if (input.current) input.current.value = ''; setBusy(false); }
  }

  async function changeCategory(id: string, next: ClientImageCategory) {
    setError('');
    try { await updateClientImageCategory(scope, id, next); setImages(await listClientImages(scope)); setMessage('Image purpose updated.'); }
    catch (failure) { setError((failure as Error).message); }
  }

  async function removeImage(image: ClientImage) {
    setError(''); setMessage('');
    try { await deleteClientImage(scope, image.id); setImages(await listClientImages(scope)); setMessage('Image removed from this browser.'); }
    catch (failure) { setError((failure as Error).message); }
  }
  async function removeDriveImage(image: TestDriveClientImage) {
    setError(''); setMessage('');
    try { await deleteTestDriveClientImage(image.id); await refreshDrive(); setMessage('Test image removed from Google Drive.'); }
    catch (failure) { setError((failure as Error).message); }
  }
  async function changeDriveImageCategory(image: TestDriveClientImage, next: ClientImageCategory) {
    setError('');
    try { await updateTestDriveClientImageCategory(image.id,next); await refreshDrive(); setMessage('Image purpose updated.'); }
    catch (failure) { setError((failure as Error).message); }
  }

  return <section className="panel client-image-studio" aria-labelledby="client-images-heading" aria-busy={loading || busy}>
    <span className="eyebrow">OPTIONAL · YOUR PHOTOS</span>
    <h2 id="client-images-heading">{compact ? 'Plan your skincare photos' : 'Your skincare image library'}</h2>
    <p>Photos are optional. Clear, consistent pictures can help you keep a personal routine journal across your care goals. They are not needed for Skin Match and this feature does not diagnose skin or assess treatment results.</p>
    <details className="client-photo-guidance">
      <summary>How to take useful photos</summary>
      <div className="client-photo-guide-grid">
        <div><strong>Start with a front view</strong><p>Face a window or soft, even light. Use a clean camera lens, a neutral background, and hold the camera at eye level. Keep your full face in frame.</p></div>
        <div><strong>Add side views only if useful</strong><p>Take left and right views from the same distance and lighting. Avoid strong shadows, filters, portrait effects, makeup, or tinted glasses for comparisons.</p></div>
        <div><strong>Focus on one area</strong><p>For a personal journal, use a clear close-up of the area you want to track. Do not photograph intimate areas or anything you do not want saved to the selected storage location.</p></div>
        <div><strong>Keep progress pictures consistent</strong><p>Use the same lighting, angle, and distance. Add a date in your journal notes rather than editing the image.</p></div>
      </div>
      <p className="muted">Optional examples for your own organization: front and side views, a specific area you want to monitor, routine inspiration, or a product label to remember. Never include another person without their permission.</p>
    </details>
    <div className="client-image-controls">
      <label className="field">Storage location<select value={destination} disabled={busy || loading} onChange={event => setDestination(event.target.value as 'device'|'test-drive')}><option value="device">This device (private browser storage)</option><option value="test-drive" disabled={!testDriveEnabled}>Google Drive (test environment only){testDriveEnabled ? '' : ' · not configured'}</option></select></label>
      <label className="field">Photo purpose<select value={category} disabled={busy} onChange={event => setCategory(event.target.value as ClientImageCategory)}>{CLIENT_IMAGE_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="button primary client-image-select">{busy ? 'Preparing…' : 'Take or choose photos'}<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="user" multiple disabled={busy || loading || session.loading || session.error !== '' || !scope || !testDriveEnabled && destination === 'test-drive' || (destination === 'test-drive' ? driveImages.length : images.length) >= CLIENT_IMAGE_LIMIT} onChange={event => void addFiles(event.currentTarget.files)} aria-label="Take or choose JPEG, PNG, or WebP photos"/></label>
      <small>JPEG, PNG, or WebP · up to 8 MB each · max {CLIENT_IMAGE_LIMIT}. Saved copies are resized, converted to JPEG, and stripped of embedded metadata.</small>
    </div>
    <p className="notice">{destination === 'test-drive' ? 'Test-only destination: chosen copies are sent to the configured private Google Drive folder through the portal. Drive test storage is not for customer or production data. Images are not analyzed or shared with retailers.' : 'Stored only in this browser profile on this device. Images are not sent to MGT, shared with retailers, synced to your account, or used for AI analysis. Android native image picking is not connected.'}</p>
    {message && <p className="notice success" role="status">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && !session.loading && !session.error && scope && (destination === 'test-drive' ? driveImages.length ? <div className="client-image-grid">{driveImages.map(image => <TestDriveImageCard key={image.id} image={image} onCategory={(item,next) => void changeDriveImageCategory(item,next)} onDelete={item => void removeDriveImage(item)}/>)}</div> : <p className="empty">No test images saved in Google Drive. This list shows only the test storage destination.</p> : images.length ? <div className="client-image-grid">{images.map(image => <ImageCard key={image.id} image={image} onCategory={(id, next) => void changeCategory(id, next)} onDelete={item => void removeImage(item)}/>)}</div> : <p className="empty">No images saved in this browser. Choose only photos you are comfortable keeping on this device.</p>)}
    <small>{destination === 'test-drive' ? driveImages.length : images.length} / {CLIENT_IMAGE_LIMIT} images · Each original file must be under {(CLIENT_IMAGE_MAX_BYTES / 1024 / 1024).toFixed(0)} MB.</small>
  </section>;
}
