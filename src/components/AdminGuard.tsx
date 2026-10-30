import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('yatribus_admin_token');
  return token ? <>{children}</> : <Navigate to="/admin" replace state={{ from: location.pathname }} />;
};
