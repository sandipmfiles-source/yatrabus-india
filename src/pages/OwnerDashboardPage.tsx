import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Owner access is intentionally account-free for the launch period.
 * Bus operators and owners use the public contribution form without creating an account.
 * Owner submissions are routed to the separate Super Admin review queue.
 */
export const OwnerDashboardPage: React.FC = () => (
  <Navigate to="/contribute?type=SUGGEST_ROUTE&source=OPERATOR" replace />
);
