import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Heart, Trash2 } from 'lucide-react';
import { phase4, FavouriteRoute } from '../services/phase4.js';

export const FavouritesPage: React.FC = () => {
  const [items, setItems] = useState<FavouriteRoute[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => { setItems(phase4.getFavourites()); }, []);
  const remove = (id: string) => {
    const item = items.find(row => row.routeId === id);
    if (!item) return;
    phase4.toggleFavourite({ id: item.routeId, routeName: item.routeName, originStopName: item.origin, destinationStopName: item.destination });
    setItems(phase4.getFavourites());
  };
  const remind = async (item: FavouriteRoute) => {
    const value = window.prompt('Reminder date and time (YYYY-MM-DDTHH:mm)', '');
    if (!value) return;
    const date = new Date(value);
    try { await phase4.scheduleFavouriteReminder(item, date); setMessage('Journey reminder scheduled on this device.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not schedule reminder.'); }
  };
  return <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
    <div className="flex items-center gap-3"><Heart className="h-6 w-6 text-yatribrand-800"/><div><h1 className="text-2xl font-extrabold">Favourite routes</h1><p className="text-sm text-yatriwarm-600">Saved on this device only.</p></div></div>
    {message && <p role="status" className="rounded-xl bg-yatriwarm-100 p-3 text-sm">{message}</p>}
    {!items.length && <div className="rounded-2xl border bg-white p-6 text-center text-sm text-yatriwarm-600">No favourite routes yet. Open a route and tap Save favourite.</div>}
    {items.map(item => <article key={item.routeId} className="rounded-2xl border border-yatriwarm-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="min-w-0 flex-1"><h2 className="font-bold">{item.routeName}</h2><p className="text-sm text-yatriwarm-600">{item.origin} → {item.destination}</p><p className="text-xs text-yatriwarm-500">Saved {new Date(item.savedAt).toLocaleDateString()}</p></div>
      <div className="flex flex-wrap gap-2"><Link to={`/routes/${encodeURIComponent(item.routeId)}`} className="rounded-lg bg-yatribrand-900 px-3 py-2 text-xs font-semibold text-white">View route</Link><button onClick={() => void remind(item)} className="rounded-lg border px-3 py-2 text-xs font-semibold"><Bell className="inline h-3.5 w-3.5 mr-1"/>Remind me</button><button onClick={() => remove(item.routeId)} aria-label="Remove favourite" className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700"><Trash2 className="inline h-3.5 w-3.5"/></button></div>
    </article>)}
  </div>;
};
