import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import './SharedLands.css';

type SharedLand = {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  map_data: Record<string, unknown>;
  created_at: string;
};

export default function SharedLands() {
  const [userId, setUserId] = useState('');
  const [lands, setLands] = useState<SharedLand[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('lands')
      .select('id,creator_id,name,description,latitude,longitude,map_data,created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (queryError) { setError(queryError.message); return; }
    setError('');
    setLands((data ?? []) as SharedLand[]);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? '');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void reload();
    const channel = supabase
      .channel('atlas-shared-lands-v12')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lands' }, () => {
        // Re-read authoritative rows; this also respects RLS.
        void reload();
      })
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setStatus('Live');
          void reload();
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          setStatus('Connection interrupted — reconnecting');
        }
      });
    const onFocus = () => { void reload(); };
    const onOnline = () => { void reload(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = editingId
        ? await supabase.from('lands').update({ name: name.trim(), description: description.trim() })
            .eq('id', editingId).eq('creator_id', userId).select('id').single()
        : await supabase.from('lands').insert({
            creator_id: userId, name: name.trim(), description: description.trim(),
            map_data: { shared_demo: true },
          }).select('id').single();
      if (result.error) throw result.error;
      setName(''); setDescription(''); setEditingId(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Save failed');
    } finally { setBusy(false); }
  }

  function beginEdit(land: SharedLand) {
    if (land.creator_id !== userId) return;
    setEditingId(land.id);
    setName(land.name);
    setDescription(land.description ?? '');
    setExpanded(true);
  }

  async function remove(land: SharedLand) {
    if (land.creator_id !== userId) return;
    if (!window.confirm(`Delete shared land "${land.name}"? This cannot be undone.`)) return;
    setBusy(true); setError('');
    const { data, error: removeError } = await supabase.from('lands')
      .delete().eq('id', land.id).eq('creator_id', userId).select('id');
    if (removeError) setError(removeError.message);
    else if (!data?.length) setError('Nothing was deleted. Please check your account permissions.');
    else {
      if (editingId === land.id) { setEditingId(null); setName(''); setDescription(''); }
      await reload();
    }
    setBusy(false);
  }

  return (
    <section className="shared-lands" aria-label="Live shared lands test">
      <div className="shared-lands-heading">
        <div>
          <p className="shared-lands-kicker">MULTIPLAYER FOUNDATION · TEST AREA</p>
          <h2>Shared Lands</h2>
          <p>Test real-time syncing here. The illustrated atlas below is still saved in your browser.</p>
        </div>
        <button type="button" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Close Test Panel' : 'Open Live Test'} · {lands.length}
        </button>
      </div>
      {expanded && (
        <div className="shared-lands-content">
          <p className="shared-status">Connection: {status}</p>
          {error && <p role="alert" className="shared-error">{error}</p>}
          <form onSubmit={save} className="shared-land-form">
            <label>Land name
              <input required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="The First Shared Isle" />
            </label>
            <label>Description
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="A shared test land…" />
            </label>
            <div className="shared-actions">
              <button type="submit" disabled={busy || !userId}>{editingId ? 'Save Changes' : 'Create Shared Land'}</button>
              {editingId && <button type="button" onClick={() => {setEditingId(null);setName('');setDescription('');}}>Cancel Edit</button>}
              <button type="button" onClick={() => void reload()}>Refresh Records</button>
            </div>
          </form>
          <div className="shared-land-list">
            {lands.length === 0 && <p>No shared lands yet. Create one above.</p>}
            {lands.map(land => (
              <article className="shared-land-entry" key={land.id}>
                <div>
                  <strong>{land.name}</strong>
                  <p>{land.description || 'No description yet.'}</p>
                  <small>{land.creator_id === userId ? 'Created by you' : 'Created by another explorer'}</small>
                </div>
                {land.creator_id === userId && <div className="shared-actions">
                  <button type="button" disabled={busy} onClick={() => beginEdit(land)}>Edit</button>
                  <button type="button" disabled={busy} onClick={() => void remove(land)}>Delete</button>
                </div>}
              </article>
            ))}
          </div>
          <p className="shared-caution">These are actual records in Supabase, but they're not imported into the illustrated map yet. Do not recreate your existing islands here; use temporary test names.</p>
        </div>
      )}
    </section>
  );
}
