import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { ShieldCheck, Lock, Mail, ArrowRight } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await api.adminLogin(email, password);
      if (!res.token) throw new Error('Server did not issue an administrator session.');
      localStorage.setItem('yatribus_admin_token', res.token);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid administrator credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-yatribrand-900 text-white flex items-center justify-center mx-auto shadow-card">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-yatriwarm-950">YatraBus Super Admin</h1>
        <p className="text-xs text-yatriwarm-500">Private owner access for bus verification and platform management.</p>
      </div>
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-yatriwarm-200 shadow-card">
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded-xl">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-yatriwarm-700 mb-1">Administrator Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-yatriwarm-400 absolute left-3.5 top-3" />
              <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-yatriwarm-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-yatriwarm-400 absolute left-3.5 top-3" />
              <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white" />
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="w-full py-3 bg-yatribrand-900 hover:bg-yatribrand-950 text-white font-bold text-xs rounded-xl shadow-subtle transition-colors flex items-center justify-center gap-2">
            <span>{isLoading ? 'Verifying...' : 'Sign In to Admin Panel'}</span><ArrowRight className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-4 pt-4 border-t border-yatriwarm-100 text-center text-[11px] text-yatriwarm-500">No public admin registration. Owner credentials must be configured securely by the deployment owner.</div>
      </div>
    </div>
  );
};
