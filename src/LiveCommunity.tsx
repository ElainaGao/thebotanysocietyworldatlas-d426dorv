import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import './LiveCommunity.css';

type Cursor = { user_id: string; name: string; color: string; x: number; y: number; at: number };
type Message = { id: string; user_id: string; display_name: string; cursor_color: string; body: string; created_at: string };
const DAY = 86_400_000;
const STALE = 16_000;
const safeColor = (s: string) => /^#[0-9a-f]{6}$/i.test(s) ? s : '#678c70';

function CursorMark({ p, x, y, own = false }: { p: Cursor; x: number; y: number; own?: boolean }) {
  return <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none', transform: 'translate(0, 0)', zIndex: 2 }}>
    <svg width="23" height="32" viewBox="0 0 23 32" aria-hidden="true" style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 1px 2px #0006)' }}>
      <path d="M1 1V26L7 20L12 31L17 29L12 18H22Z" fill={safeColor(p.color)} stroke="#fff7e7" strokeWidth="1.7" />
    </svg>
    <span style={{ position: 'absolute', left: 20, top: -5, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 5, color: '#35281d', background: '#f6eacf', border: `1.5px solid ${safeColor(p.color)}`, boxShadow: '0 2px 6px #0003', font: '13px Georgia,serif' }}>{p.name}{own ? ' (you)' : ''}</span>
  </div>;
}

export default function LiveCommunity({ userId, name, color }: { userId: string; name: string; color: string }) {
  const [peers, setPeers] = useState<Record<string, Cursor>>({});
  const [myCursor, setMyCursor] = useState<Cursor | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapContainer, setMapContainer] = useState<HTMLElement | null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const channel = useRef<RealtimeChannel | null>(null);
  const latestLocal = useRef<Cursor | null>(null);
  const lastSent = useRef(0);
  const nameRef = useRef(name);
  const colorRef = useRef(safeColor(color));
  const atBottom = useRef<HTMLDivElement | null>(null);
  nameRef.current = name;
  colorRef.current = safeColor(color);

  const refresh = useCallback(async () => {
    const since = new Date(Date.now() - DAY).toISOString();
    const { data, error: failure } = await supabase.from('atlas_chat')
      .select('id,user_id,display_name,cursor_color,body,created_at')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(50);
    if (failure) { setError(`Chat unavailable: ${failure.message}`); return; }
    setMessages(((data || []) as Message[]).reverse());
  }, []);

  useEffect(() => {
    void refresh();
    const chatChannel = supabase.channel('atlas-chat-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atlas_chat' }, () => { void refresh(); })
      .subscribe();
    const tick = window.setInterval(() => {
      setMessages(p => p.filter(m => Date.now() - new Date(m.created_at).getTime() < DAY).slice(-50));
      void refresh();
    }, 60_000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => { window.clearInterval(tick); window.removeEventListener('focus', focus); void supabase.removeChannel(chatChannel); };
  }, [refresh]);

  useEffect(() => { if (open) atBottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [open, messages]);

  // Broadcast positions rather than relying on high-frequency Presence track calls.
  // This is one common public channel for signed-in visitors, separate from the chat table.
  useEffect(() => {
    let active = true;
    const ch = supabase.channel('atlas-cursors-v2', { config: { broadcast: { self: false, ack: false } } });
    channel.current = ch;
    ch.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (!active || !payload || typeof payload !== 'object') return;
      const p = payload as Cursor;
      if (p.user_id === userId || !p.user_id || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      const clean: Cursor = { user_id: p.user_id, name: String(p.name || 'Explorer').slice(0, 60), color: safeColor(p.color), x: p.x, y: p.y, at: Date.now() };
      setPeers(old => ({ ...old, [clean.user_id]: clean }));
    });
    ch.on('broadcast', { event: 'leave' }, ({ payload }) => {
      if (!active || !payload?.user_id) return;
      setPeers(old => { const next = { ...old }; delete next[payload.user_id as string]; return next; });
    });
    ch.subscribe(status => { if (active) setConnected(status === 'SUBSCRIBED'); });
    const expire = window.setInterval(() => setPeers(old => {
      const fresh = Object.fromEntries(Object.entries(old).filter(([, p]) => Date.now() - p.at < STALE));
      return Object.keys(fresh).length === Object.keys(old).length ? old : fresh;
    }), 2000);
    return () => { active = false; window.clearInterval(expire); channel.current = null; void supabase.removeChannel(ch); };
  }, [userId]);

  // Find the map container (the book and other controls are outside this surface).
  useEffect(() => {
    const find = () => {
      const next = document.querySelector<HTMLElement>('.atlas-viewport');
      setMapContainer(current => current === next ? current : next);
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const sendCursor = useCallback((p: Cursor) => {
    if (!channel.current || channel.current.state !== 'joined') return;
    void channel.current.send({ type: 'broadcast', event: 'cursor', payload: p });
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const map = document.querySelector<SVGSVGElement>('svg.atlas-map');
      if (!map || !(event.target instanceof Node) || !map.contains(event.target)) return;
      const rect = map.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const box = map.viewBox.baseVal;
      const p: Cursor = {
        user_id: userId, name: nameRef.current.slice(0, 60), color: colorRef.current,
        x: box.x + (event.clientX - rect.left) / rect.width * box.width,
        y: box.y + (event.clientY - rect.top) / rect.height * box.height,
        at: Date.now(),
      };
      latestLocal.current = p;
      setMyCursor(p);
      const now = Date.now();
      if (now - lastSent.current >= 85) { lastSent.current = now; sendCursor(p); }
    };
    const onOut = (event: PointerEvent) => {
      const map = document.querySelector<SVGSVGElement>('svg.atlas-map');
      if (!map || !(event.target instanceof Node) || !map.contains(event.target)) return;
      if (event.relatedTarget instanceof Node && map.contains(event.relatedTarget)) return;
      latestLocal.current = null;
      setMyCursor(null);
      void channel.current?.send({ type: 'broadcast', event: 'leave', payload: { user_id: userId } });
    };
    const onHidden = () => {
      if (!document.hidden) return;
      latestLocal.current = null;
      setMyCursor(null);
      void channel.current?.send({ type: 'broadcast', event: 'leave', payload: { user_id: userId } });
    };
    const heartbeat = window.setInterval(() => { if (latestLocal.current) sendCursor({ ...latestLocal.current, at: Date.now() }); }, 4500);
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [userId, sendCursor]);

  // Re-project geographic coordinates for *each viewer's* zoom/pan position.
  // Overlay is HTML above the SVG, so map redraws cannot remove it.
  useEffect(() => {
    if (!mapContainer) return;
    let raf = 0;
    let lastBox = '';
    const update = () => {
      const svg = mapContainer.querySelector<SVGSVGElement>('svg.atlas-map');
      if (svg) {
        const b = svg.getAttribute('viewBox') || '';
        if (b !== lastBox) { lastBox = b; setMapVersion(v => v + 1); }
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [mapContainer]);

  function project(p: Cursor) {
    const svg = mapContainer?.querySelector<SVGSVGElement>('svg.atlas-map');
    if (!svg) return null;
    const v = svg.viewBox.baseVal;
    if (!v.width || !v.height) return null;
    const width = svg.clientWidth, height = svg.clientHeight;
    const x = (p.x - v.x) / v.width * width;
    const y = (p.y - v.y) / v.height * height;
    if (x < -40 || y < -40 || x > width + 40 || y > height + 40) return null;
    return { x, y };
  }
  void mapVersion;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim(); if (!body || busy) return;
    setBusy(true); setError('');
    const { error: failure } = await supabase.from('atlas_chat').insert({ user_id: userId, display_name: name.slice(0, 60), cursor_color: safeColor(color), body: body.slice(0, 500) });
    if (failure) setError(failure.message); else { setDraft(''); void refresh(); }
    setBusy(false);
  }

  return <>
    {mapContainer && createPortal(<div aria-label="Live explorer cursors" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 60 }}>
      {Object.values(peers).map(p => { const pos = project(p); return pos ? <CursorMark key={p.user_id} p={p} {...pos} /> : null; })}
      {myCursor && (() => { const pos = project(myCursor); return pos ? <CursorMark key="me" p={myCursor} {...pos} own /> : null; })()}
    </div>, mapContainer)}
    <aside className={'atlas-community ' + (open ? 'is-open' : '')}>
      <button className="atlas-chat-toggle" type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="atlas-chat-panel">{open ? 'Close Chat' : 'Atlas Chat'} · {Object.keys(peers).length} on map{!connected ? ' · reconnecting' : ''}</button>
      {open && <section className="atlas-chat-panel" id="atlas-chat-panel" aria-label="World Atlas chat">
        <header><strong>Explorers’ Correspondence</strong><small>Last 24 hours · up to 50 messages</small></header>
        <div className="atlas-chat-messages" aria-live="polite">{messages.length === 0 && <p className="atlas-chat-empty">No letters yet. Begin a conversation…</p>}
          {messages.map(m => <article key={m.id} className="atlas-chat-message"><div><span className="atlas-chat-avatar" style={{ background: safeColor(m.cursor_color) }} /><strong>{m.display_name}</strong><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p>{m.body}</p></article>)}<div ref={atBottom} />
        </div>
        {error && <p className="atlas-chat-error" role="alert">{error}</p>}
        <form onSubmit={submit}><label htmlFor="atlas-message">Message</label><textarea id="atlas-message" value={draft} maxLength={500} rows={2} onChange={e => setDraft(e.target.value)} placeholder="Write to fellow explorers…" /><button type="submit" disabled={busy || !draft.trim()}>Send</button></form>
      </section>}
    </aside>
  </>;
}
