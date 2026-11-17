import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '../services/api.js';

export const StopQrResolverPage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api.verifyStopQrToken(decodeURIComponent(token)).then(result => {
      if (active) navigate(`/routes/${encodeURIComponent(result.routeId)}?stop=${encodeURIComponent(result.stopId)}&qrToken=${encodeURIComponent(token)}`, { replace: true });
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'This stop QR could not be verified.'); });
    return () => { active = false; };
  }, [token, navigate]);
  return <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
    <ShieldCheck className="h-10 w-10 mx-auto text-yatribrand-800"/>
    <h1 className="text-xl font-extrabold">Verifying bus stop QR</h1>
    {error ? <><p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p><Link to="/scan" className="text-sm font-semibold underline">Open QR scanner</Link></> : <p className="text-sm text-yatriwarm-600">Checking the signed token and current stop record with YatraBus…</p>}
  </div>;
};
