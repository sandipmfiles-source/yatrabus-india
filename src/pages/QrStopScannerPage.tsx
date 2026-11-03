import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, CameraOff } from 'lucide-react';

export const QrStopScannerPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();

  const resolveCode = (value: string) => {
    try {
      const url = new URL(value, window.location.origin);
      if (url.protocol !== 'https:' && url.origin !== window.location.origin) throw new Error('Use a secure YatraBus stop link.');
      const match = url.pathname.match(/^\/stop\/([^/]+)\/([^/]+)$/);
      if (!match) throw new Error('QR code format is not a supported YatraBus stop link.');
      navigate(`/routes/${encodeURIComponent(decodeURIComponent(match[1]))}?stop=${encodeURIComponent(decodeURIComponent(match[2]))}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Invalid QR code.'); }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const start = async () => {
    setError('');
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) { setError('QR camera scanning is not supported by this browser. Paste a YatraBus stop QR link below instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setScanning(true);
      const detector = new Detector({ formats: ['qr_code'] });
      const scanFrame = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.[0]?.rawValue) { stop(); resolveCode(String(codes[0].rawValue)); return; }
        } catch { /* Continue scanning; camera frames can be temporarily undecodable. */ }
        if (streamRef.current) window.requestAnimationFrame(() => void scanFrame());
      };
      window.requestAnimationFrame(() => void scanFrame());
    } catch { setError('Camera permission was denied or the camera is unavailable. You can paste the stop link manually.'); stop(); }
  };

  useEffect(() => () => stop(), []);
  return <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
    <div className="flex items-center gap-3"><Camera className="h-6 w-6"/><div><h1 className="text-2xl font-extrabold">Bus stop QR lookup</h1><p className="text-sm text-yatriwarm-600">Scan a YatraBus stop link and confirm the route/stop record online.</p></div></div>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    <div className="rounded-2xl border bg-black p-2"><video ref={videoRef} className={scanning ? "w-full rounded-xl" : "hidden"} muted playsInline/><div className={scanning ? "hidden" : "aspect-video flex flex-col items-center justify-center gap-2 text-white"}><CameraOff className="h-8 w-8"/><p className="text-sm">Camera scanner is stopped</p></div></div>
    <div className="flex gap-2"><button onClick={() => void start()} disabled={scanning} className="rounded-xl bg-yatribrand-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Start scanner</button><button onClick={stop} disabled={!scanning} className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50">Stop</button></div>
    <form onSubmit={e => { e.preventDefault(); resolveCode(manual.trim()); }} className="space-y-2"><label htmlFor="yb-qr-manual" className="block text-sm font-bold">Or paste a YatraBus stop link</label><input id="yb-qr-manual" value={manual} onChange={e => setManual(e.target.value)} className="w-full rounded-xl border p-3" placeholder="https://your-yatribus-domain/stop/route-id/stop-id"/><button className="rounded-xl border px-4 py-2 text-sm font-semibold">Open stop</button></form>
    <p className="text-xs text-yatriwarm-600">A readable QR link is not proof of a physically surveyed stop. The route and stop must still be checked against YatraBus records and their verification status.</p>
    <Link to="/" className="text-sm font-semibold">← Back to search</Link>
  </div>;
};
