'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type FramingState = 'checking' | 'centered' | 'off_center' | 'multiple' | 'not_detected' | 'unavailable';
type FaceBox = { x: number; y: number; width: number; height: number };
type LocalFaceDetector = { detect(source: HTMLVideoElement): Promise<Array<{ boundingBox?: FaceBox }>> };
type LocalFaceDetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => LocalFaceDetector;

const framingMessage: Record<FramingState, string> = {
  checking: 'Checking the local framing guide…',
  centered: 'One face appears centered in the guide.',
  off_center: 'Move a little closer or center your whole face in the circle.',
  multiple: 'Please keep only one person in the frame.',
  not_detected: 'Center your face in even light. You can still take the photo when ready.',
  unavailable: 'Use the circle to center your full face; this device cannot check framing automatically.',
};

function detectFraming(faces: Array<{ boundingBox?: FaceBox }>, video: HTMLVideoElement): FramingState {
  if (faces.length > 1) return 'multiple';
  const face = faces[0]?.boundingBox;
  if (!face || !video.videoWidth || !video.videoHeight) return 'not_detected';
  const centerX = face.x + face.width / 2;
  const centerY = face.y + face.height / 2;
  const centered = Math.abs(centerX - video.videoWidth / 2) <= video.videoWidth * 0.16
    && Math.abs(centerY - video.videoHeight / 2) <= video.videoHeight * 0.18;
  const complete = face.width >= video.videoWidth * 0.26 && face.width <= video.videoWidth * 0.78
    && face.height >= video.videoHeight * 0.26 && face.height <= video.videoHeight * 0.9;
  return centered && complete ? 'centered' : 'off_center';
}

export function GuidedFaceCapture({ onCapture, onCancel, disabled = false }: { onCapture: (file: File) => void | Promise<void>; onCancel: () => void; disabled?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [framing, setFraming] = useState<FramingState>('checking');
  const [message, setMessage] = useState('');
  const [capturing, setCapturing] = useState(false);

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (camera !== 'ready' || !video.current) return;
    const Detector = (window as unknown as { FaceDetector?: LocalFaceDetectorConstructor }).FaceDetector;
    if (!Detector) { setFraming('unavailable'); return; }
    let active = true;
    const detector = new Detector({ fastMode: true, maxDetectedFaces: 2 });
    const inspect = async () => {
      const element = video.current;
      if (!element || element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      try {
        const faces = await detector.detect(element);
        if (active) setFraming(detectFraming(faces, element));
      } catch {
        if (active) setFraming('unavailable');
      }
    };
    void inspect();
    const interval = window.setInterval(() => void inspect(), 700);
    return () => { active = false; window.clearInterval(interval); };
  }, [camera]);

  async function startCamera() {
    setMessage('');
    if (!navigator.mediaDevices?.getUserMedia) { setCamera('error'); setMessage('This browser does not support camera capture. Choose a photo from your device instead.'); return; }
    setCamera('starting');
    try {
      const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'user' }, width: { ideal: 1080 }, height: { ideal: 1080 } } });
      stream.current = next;
      if (!video.current) throw new Error('camera_preview_unavailable');
      video.current.srcObject = next;
      await video.current.play();
      setFraming('checking');
      setCamera('ready');
    } catch {
      stopCamera();
      setCamera('error');
      setMessage('Camera access was not granted. No image was captured; choose a photo from your device instead.');
    }
  }

  async function capture() {
    const element = video.current;
    if (!element || element.videoWidth < 1 || element.videoHeight < 1) { setMessage('Wait for the camera preview before taking a photo.'); return; }
    setCapturing(true); setMessage('');
    try {
      const side = Math.min(element.videoWidth, element.videoHeight);
      const sourceX = Math.max(0, Math.round((element.videoWidth - side) / 2));
      const sourceY = Math.max(0, Math.round((element.videoHeight - side) / 2));
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 1024;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('camera_canvas_unavailable');
      context.drawImage(element, sourceX, sourceY, side, side, 0, 0, 1024, 1024);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('camera_capture_failed')), 'image/jpeg', 0.9));
      await onCapture(new File([blob], `guided-face-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      stopCamera();
    } catch {
      setMessage('The photo could not be captured. No image was saved; try again or choose a photo from your device.');
    } finally { setCapturing(false); }
  }

  function cancel() { stopCamera(); onCancel(); }

  return <section className="guided-face-capture" aria-labelledby="guided-face-capture-title">
    <div className="guided-face-capture-heading"><div><span className="eyebrow">OPTIONAL GUIDED CAPTURE</span><h3 id="guided-face-capture-title">Frame a consistent full-face photo</h3></div><button type="button" className="text-button" onClick={cancel} disabled={capturing}>Close camera</button></div>
    <p>Camera access starts only after you choose it. The circular guide runs in this browser and does not identify you, save a face template, or compare you with anyone else.</p>
    {camera === 'idle' && <button type="button" className="button primary" onClick={() => void startCamera()} disabled={disabled}>Start camera guide</button>}
    {camera === 'starting' && <p className="notice" role="status">Opening your camera…</p>}
    {camera === 'error' && <p className="notice error" role="alert">{message}</p>}
    <div className={`guided-face-stage${camera === 'ready' ? ' is-active' : ''}`} hidden={camera !== 'ready'}>
      <video ref={video} className="guided-face-video" muted playsInline aria-label="Live camera preview for optional face framing" />
      <div className="guided-face-ring" aria-hidden="true"><i /></div>
    </div>
    {camera === 'ready' && <><p className={`guided-face-status state-${framing}`} aria-live="polite">{framingMessage[framing]}</p><p className="muted">Use soft, even light. Remove filters, portrait effects, tinted glasses, and strong shadows. This guide does not require a perfect match; you decide whether to take the picture.</p><div className="actions"><button type="button" className="button primary" onClick={() => void capture()} disabled={disabled || capturing}>{capturing ? 'Preparing photo…' : 'Use this photo'}</button><button type="button" className="button" onClick={cancel} disabled={capturing}>Cancel</button></div></>}
  </section>;
}
