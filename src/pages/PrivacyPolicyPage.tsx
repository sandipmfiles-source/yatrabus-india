import React from 'react';
import { useLanguage } from '../context/LanguageContext.js';
import { ShieldCheck, Lock, Clock, EyeOff } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200"><ShieldCheck className="w-6 h-6" /></div>
        <h1 className="text-2xl sm:text-3xl font-bold text-yatriwarm-950">{t('privacy_policy_title')}</h1>
        <p className="text-xs text-yatriwarm-500">{t('privacy_effective_date')}</p>
      </div>
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-yatriwarm-200 shadow-card space-y-6 text-sm text-yatriwarm-700 leading-relaxed">
        <section className="space-y-2"><h2 className="text-base font-bold text-yatriwarm-900 flex items-center gap-2"><Lock className="w-4 h-4 text-yatribrand-700" />{t('privacy_no_account_title')}</h2><p>{t('privacy_no_account_body')}</p></section>
        <section className="space-y-2"><h2 className="text-base font-bold text-yatriwarm-900 flex items-center gap-2"><EyeOff className="w-4 h-4 text-yatribrand-700" />{t('privacy_gps_title')}</h2><p>{t('privacy_gps_body')}</p><p>{t('privacy_location_on_demand')}</p><ul className="list-disc pl-5 space-y-1 text-xs text-yatriwarm-600"><li>{t('privacy_nearby_item')}</li><li>{t('privacy_tracking_item')}</li></ul></section>
        <section className="space-y-2"><h2 className="text-base font-bold text-yatriwarm-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-yatribrand-700" />{t('privacy_aggregation_title')}</h2><p>{t('privacy_aggregation_body')}</p></section>
        <section className="space-y-2"><h2 className="text-base font-bold text-yatriwarm-900 flex items-center gap-2"><Clock className="w-4 h-4 text-yatribrand-700" />{t('privacy_session_title')}</h2><p>{t('privacy_session_body')}</p></section>
        <section className="space-y-2"><h2 className="text-base font-bold text-yatriwarm-900">{t('privacy_contact_title')}</h2><p className="text-xs">{t('privacy_contact_body')} <code className="bg-yatriwarm-100 px-1 py-0.5 rounded text-yatribrand-900">privacy@yatribus.in</code>.</p></section>
      </div>
    </div>
  );
};
