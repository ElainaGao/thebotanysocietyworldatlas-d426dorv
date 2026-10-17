import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import './LiveCommunity.css';

type Cursor = { user_id:string; name:string; color:string; x:number; y:number; at:number };
type Message = { id:string; user_id:string; display_name:string; cursor_color:string; body:string; created_at:string };
const DAY = 24*60*60*1000;
const colorsafe = (s:string) => /^#[0-9a-f]{6}$/i.test(s) ? s : '#678c70';

/** Ephemeral, normalized world coordinates: not persisted in Postgres. */
export default function LiveCommunity({userId,name,color}:{userId:string;name:string;color:string}) {
  const [peers,setPeers]=useState<Record<string,Cursor>>({});
  const [messages,setMessages]=useState<Message[]>([]);
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [layer,setLayer]=useState<SVGGElement|null>(null);
  const channel=useRef<RealtimeChannel|null>(null);
  const target=useRef<SVGSVGElement|null>(null);
  const lastSent=useRef(0);
  const atBottom=useRef<HTMLDivElement|null>(null);
  const nameRef=useRef(name);nameRef.current=name;
  const colorRef=useRef(color);colorRef.current=colorsafe(color);

  const refresh=useCallback(async()=>{
    const since=new Date(Date.now()-DAY).toISOString();
    const {data,error:failure}=await supabase.from('atlas_chat').select('id,user_id,display_name,cursor_color,body,created_at')
      .gte('created_at',since).order('created_at',{ascending:false}).limit(50);
    if(failure){setError(`Chat unavailable: ${failure.message}`);return;}
    setMessages(((data||[]) as Message[]).reverse());
  },[]);

  useEffect(()=>{
    void refresh();
    const chatChannel=supabase.channel('atlas-chat-events')
      .on('postgres_changes',{event:'*',schema:'public',table:'atlas_chat'},()=>{void refresh();})
      .subscribe();
    const tick=window.setInterval(()=>{
      setMessages(prev=>prev.filter(m=>Date.now()-new Date(m.created_at).getTime()<DAY).slice(-50));
      void refresh();
    },60_000);
    const onFocus=()=>void refresh();
    window.addEventListener('focus',onFocus);
    return ()=>{window.removeEventListener('focus',onFocus);window.clearInterval(tick);void supabase.removeChannel(chatChannel);};
  },[refresh]);

  useEffect(()=>{
    if(open)atBottom.current?.scrollIntoView({behavior:'smooth',block:'end'});
  },[messages,open]);

  useEffect(()=>{
    const ch=supabase.channel('atlas-cursors-v1',{config:{presence:{key:userId}}});
    channel.current=ch;
    const sync=()=>{
      const state=ch.presenceState<Cursor>();
      const other:Record<string,Cursor>={};
      for(const [id,entries] of Object.entries(state)){
        if(id===userId)continue;
        const latest=entries[entries.length-1];
        if(latest && Date.now()-latest.at < 35_000)other[id]=latest;
      }
      setPeers(other);
    };
    ch.on('presence',{event:'sync'},sync).on('presence',{event:'join'},sync).on('presence',{event:'leave'},sync).subscribe();
    const tick=window.setInterval(sync,5_000);
    return ()=>{window.clearInterval(tick);channel.current=null;void supabase.removeChannel(ch);};
  },[userId]);

  // Attach an overlay to the REAL map SVG. The atlas keeps ownership of its geometry;
  // our overlay is pointer-events:none, so existing drawing and pan tools still work.
  useEffect(()=>{
    let map:SVGSVGElement|null=null;
    let group:SVGGElement|null=null;
    const attach=()=>{
      const next=document.querySelector<SVGSVGElement>('svg.atlas-map');
      if(next===map)return;
      if(group){group.remove();group=null;setLayer(null);}
      map=next;target.current=next;
      if(next){group=document.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('class','atlas-presence-layer');group.setAttribute('pointer-events','none');next.appendChild(group);setLayer(group);}
    };
    attach();
    const observer=new MutationObserver(attach);
    observer.observe(document.body,{childList:true,subtree:true});
    return ()=>{observer.disconnect();group?.remove();target.current=null;setLayer(null);};
  },[]);

  useEffect(()=>{
    const send=(e:PointerEvent)=>{
      const map=target.current;
      if(!map || !(e.target instanceof Node) || !map.contains(e.target))return;
      // pointer events in a map with preserveAspectRatio=none; read actual viewBox.
      const bounds=map.getBoundingClientRect(),vb=map.viewBox.baseVal;
      if(bounds.width<=0||bounds.height<=0)return;
      const x=vb.x+(e.clientX-bounds.left)/bounds.width*vb.width;
      const y=vb.y+(e.clientY-bounds.top)/bounds.height*vb.height;
      const now=Date.now();
      if(now-lastSent.current<75)return;
      lastSent.current=now;
      void channel.current?.track({user_id:userId,name:nameRef.current.slice(0,60),color:colorRef.current,x,y,at:now});
    };
    const leave=(e:PointerEvent)=>{
      const map=target.current;
      if(map && e.target instanceof Node && map.contains(e.target) && !(e.relatedTarget instanceof Node && map.contains(e.relatedTarget)))void channel.current?.untrack();
    };
    document.addEventListener('pointermove',send,{passive:true});
    document.addEventListener('pointerout',leave,{passive:true});
    const onHidden=()=>{if(document.hidden)void channel.current?.untrack();};
    document.addEventListener('visibilitychange',onHidden);
    return ()=>{document.removeEventListener('pointermove',send);document.removeEventListener('pointerout',leave);document.removeEventListener('visibilitychange',onHidden);};
  },[userId]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const body=draft.trim();if(!body||busy)return;
    setBusy(true);setError('');
    const {error:failure}=await supabase.from('atlas_chat').insert({user_id:userId,display_name:name.slice(0,60),cursor_color:colorsafe(color),body:body.slice(0,500)});
    if(failure)setError(failure.message);else{setDraft('');void refresh();}
    setBusy(false);
  }

  return <>
    {layer && createPortal(<g aria-hidden="true">{Object.values(peers).map(p=><g key={p.user_id} transform={`translate(${p.x} ${p.y})`}>
      <path d="M0 0 L0 20 L5 15 L10 24 L14 22 L9 13 L18 13Z" fill={colorsafe(p.color)} stroke="#fff8e6" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
      <g transform="translate(21 4)"><rect x="-4" y="-14" width={Math.max(64,p.name.length*8+12)} height="24" rx="5" fill="#f7ebd5" stroke={colorsafe(p.color)} strokeWidth="1.5"/><text x="3" y="2" fontSize="14" fontFamily="Georgia,serif" fill="#382919">{p.name.slice(0,60)}</text></g>
    </g>)}</g>,layer)}
    <aside className={'atlas-community '+(open?'is-open':'')}>
      <button className="atlas-chat-toggle" type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="atlas-chat-panel">{open?'Close Chat':'Atlas Chat'} · {Object.keys(peers).length} on map</button>
      {open&&<section className="atlas-chat-panel" id="atlas-chat-panel" aria-label="World Atlas chat">
        <header><strong>Explorers’ Correspondence</strong><small>Last 24 hours · up to 50 messages</small></header>
        <div className="atlas-chat-messages" aria-live="polite">{messages.length===0&&<p className="atlas-chat-empty">No letters yet. Begin a conversation…</p>}
          {messages.map(m=><article key={m.id} className="atlas-chat-message"><div><span className="atlas-chat-avatar" style={{background:colorsafe(m.cursor_color)}}/><strong>{m.display_name}</strong><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.body}</p></article>)}<div ref={atBottom}/>
        </div>
        {error&&<p className="atlas-chat-error" role="alert">{error}</p>}
        <form onSubmit={submit}><label htmlFor="atlas-message">Message</label><textarea id="atlas-message" value={draft} maxLength={500} rows={2} onChange={e=>setDraft(e.target.value)} placeholder="Write to fellow explorers…"/><button type="submit" disabled={busy||!draft.trim()}>Send</button></form>
      </section>}
    </aside>
  </>;
}
