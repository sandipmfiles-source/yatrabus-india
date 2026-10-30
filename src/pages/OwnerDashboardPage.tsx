import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Owner access is intentionally account-free for the launch period.
 * Bus operators and owners use the same public contribution workflow as passengers.
 * Every submission remains pending until the single configured YatraBus Super Admin approves it.
 */
export const OwnerDashboardPage: React.FC = () => (
  <Navigate to="/contribute?type=SUGGEST_ROUTE" replace />
);
