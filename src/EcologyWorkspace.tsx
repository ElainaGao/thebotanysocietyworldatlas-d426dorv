import { useState } from 'react';
import type { FormEvent } from 'react';
import './EcologyWorkspace.css';

type Node = { id: string; name: string; category: 'flora' | 'fauna' };
type Link = { id: string; sourceId: string; targetId: string; kind: string; description: string };
type Note = { id: string; title: string; text: string; image?: string; created: string; scopeKey?: string };
type Props = {
  scopeName: string;
  scopeKey: string;
  nodes: Node[];
  links: Link[];
  notes: Note[];
  onAddNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onSelectLink: (id: string) => void;
};
const feeding = /predation|herbivory|parasitism|decomposition|detrit/i;
export default function EcologyWorkspace({scopeName,scopeKey,nodes,links,notes,onAddNote,onDeleteNote,onSelectLink}: Props) {
  const [tab,setTab] = useState<'web'|'journal'>('web');
  const [selected,setSelected] = useState<string | null>(null);
  const [title,setTitle] = useState('');
  const [body,setBody] = useState('');
  const [image,setImage] = useState('');
  const displayNotes = notes.filter(n=>n.scopeKey===scopeKey);
  const nCount=nodes.length;
  const positioned=nodes.map((n,i)=>({ ...n, x: 300+240*Math.cos(2*Math.PI*i/Math.max(nCount,1)-Math.PI/2), y:220+158*Math.sin(2*Math.PI*i/Math.max(nCount,1)-Math.PI/2) }));
  const byId=new Map(positioned.map(n=>[n.id,n]));
  function add(e:FormEvent) {
    e.preventDefault();
    if(!title.trim()&&!body.trim()&&!image)return;
    onAddNote({id:crypto.randomUUID(),scopeKey,title:title.trim()||'Untitled field observation',text:body.trim(),image:image||undefined,created:new Date().toLocaleDateString()});
    setTitle('');setBody('');setImage('');
  }
  function attach(file?:File) {
    if(!file)return;
    if(file.size>900000){window.alert('Please choose an illustration smaller than 900 KB.');return;}
    const reader=new FileReader();reader.onload=()=>setImage(String(reader.result||''));reader.readAsDataURL(file);
  }
  return <section className="ecology-workspace">
    <p className="panel-kicker">FIELD ECOLOGY · {scopeName}</p>
    <div className="ecology-workspace-tabs">
      <button type="button" aria-pressed={tab==='web'} onClick={()=>setTab('web')}>Interactive Food Web</button>
      <button type="button" aria-pressed={tab==='journal'} onClick={()=>setTab('journal')}>My Field Journal ({displayNotes.length})</button>
    </div>
    {tab==='web' ? <>
      <p>The relationship register below is the source of truth. This diagram visualizes its links—no duplicate ecosystem records. Select an organism to highlight its connections, or a connection to see its field observation.</p>
      {!nodes.length ? <p>Register plants or wildlife here to begin this ecosystem’s web.</p> : <div className="ecology-web-wrap">
        <svg viewBox="0 0 600 440" role="img" aria-label={`Ecological relationship network for ${scopeName}`}>
          <defs><marker id="ecology-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#746348"/></marker></defs>
          {links.map(l=>{const a=byId.get(l.sourceId),b=byId.get(l.targetId);if(!a||!b)return null;const highlighted=!selected||selected===a.id||selected===b.id||selected===l.id;return <g key={l.id} opacity={highlighted?1:0.15} onClick={()=>{setSelected(l.id);onSelectLink(l.id)}} style={{cursor:'pointer'}}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={feeding.test(l.kind)?'#8c6848':'#68866f'} strokeWidth={selected===l.id?4:2.2} strokeDasharray={feeding.test(l.kind)?undefined:'6 4'} markerEnd={feeding.test(l.kind)?'url(#ecology-arrow)':undefined}/><title>{a.name} — {l.kind} — {b.name}: {l.description}</title></g>})}
          {positioned.map(n=><g key={n.id} onClick={()=>setSelected(selected===n.id?null:n.id)} style={{cursor:'pointer'}} opacity={!selected||selected===n.id||links.some(l=>l.id===selected&&(l.sourceId===n.id||l.targetId===n.id))||links.some(l=>(l.sourceId===selected&&l.targetId===n.id)||(l.targetId===selected&&l.sourceId===n.id))?1:0.35}><circle cx={n.x} cy={n.y} r="22" fill={n.category==='flora'?'#8eab83':'#d5b786'} stroke="#62563d" strokeWidth={selected===n.id?3:1.5}/><text x={n.x} y={n.y+4} textAnchor="middle" fontSize="13" fill="#392c1d">{n.category==='flora'?'P':'A'}</text><text x={n.x} y={n.y+39} textAnchor="middle" fontSize="12" fill="#493923" stroke="#f4edd9" strokeWidth="3" paintOrder="stroke">{n.name.length>21?n.name.slice(0,20)+'…':n.name}</text><title>{n.name}</title></g>)}
        </svg>
      </div>}
      <p className="ecology-web-legend">Green nodes: flora/fungi/algae · Ochre nodes: wildlife · Solid arrows: feeding-related links · Dashed lines: other ecological relationships</p>
      {selected&&links.some(l=>l.id===selected)&&<div className="ecology-web-detail">{links.filter(l=>l.id===selected).map(l=><p key={l.id}><strong>{byId.get(l.sourceId)?.name} — {l.kind} — {byId.get(l.targetId)?.name}</strong><br/>{l.description||'No observation supplied.'}</p>)}</div>}
      <p className="ecology-web-legend">Arrows indicate the order organisms were entered in the relationship form, not automatically inferred energy-flow direction.</p>
    </> : <>
      <p>Private field observations for <strong>{scopeName}</strong>. These notes use your existing personal journal storage and follow you between ecosystems.</p>
      <form onSubmit={add} className="ecology-notebook-form"><label>Observation title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="A nocturnal pollinator…"/></label><label>Field notes<textarea value={body} onChange={e=>setBody(e.target.value)} rows={4}/></label><label>Illustration (optional)<input type="file" accept="image/*" onChange={e=>attach(e.target.files?.[0])}/></label>{image&&<button type="button" onClick={()=>setImage('')}>Remove illustration</button>}<button type="submit">Save Private Observation</button></form>
      {displayNotes.length===0&&<p>No observations for this ecosystem yet.</p>}
      {displayNotes.map(n=><article className="ecology-journal-entry" key={n.id}><strong>{n.title}</strong><small>{n.created}</small><p>{n.text}</p>{n.image&&<img src={n.image} alt={`Illustration for ${n.title}`}/>}<button type="button" onClick={()=>{if(window.confirm(`Delete observation “${n.title}”?`))onDeleteNote(n.id)}}>Delete note</button></article>)}
    </>}
  </section>;
}
