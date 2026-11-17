import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export const StopLinkResolver: React.FC = () => {
  const { routeId, stopId } = useParams<{ routeId: string; stopId: string }>();
  if (!routeId || !stopId) return <Navigate to="/" replace />;
  return <Navigate to={`/routes/${encodeURIComponent(routeId)}?stop=${encodeURIComponent(stopId)}`} replace />;
};
