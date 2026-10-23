import { useState } from 'react';
import './EcologyWorkspace.css';

type Node = { id: string; name: string; category: 'flora' | 'fauna' };
type Link = { id: string; sourceId: string; targetId: string; kind: string; description: string };
type Props = { scopeName: string; nodes: Node[]; links: Link[] };
const feeding = /predation|herbivory|parasitism|decomposition|detrit/i;

/** Read-only interactive visualization of the existing Ecological Relationships register. */
export default function EcologyWorkspace({scopeName,nodes,links}: Props) {
  const [selected,setSelected] = useState<string | null>(null);
  const positioned = nodes.map((n,i)=>({
    ...n,
    x:300+240*Math.cos(2*Math.PI*i/Math.max(nodes.length,1)-Math.PI/2),
    y:220+158*Math.sin(2*Math.PI*i/Math.max(nodes.length,1)-Math.PI/2)
  }));
  const byId = new Map(positioned.map(n=>[n.id,n]));
  const chosen = links.find(l=>l.id===selected);
  return <section className="ecology-workspace" aria-label={`Food web for ${scopeName}`}>
    <h3>Interactive Food Web</h3>
    <p>This diagram uses the ecological relationships recorded above. Select a species to highlight its connections, or select a line to view the observation.</p>
    {!nodes.length ? <p>Add plants or wildlife to this ecosystem to start its food web.</p> : <div className="ecology-web-wrap">
      <svg viewBox="0 0 600 440" role="img" aria-label={`Ecological relationship network for ${scopeName}`}>
        <defs><marker id="ecology-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#746348"/></marker></defs>
        {links.map(l=>{
          const a=byId.get(l.sourceId), b=byId.get(l.targetId);
          if(!a||!b)return null;
          const highlighted=!selected||selected===a.id||selected===b.id||selected===l.id;
          return <g key={l.id} opacity={highlighted?1:0.15} onClick={()=>setSelected(selected===l.id?null:l.id)} style={{cursor:'pointer'}}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={feeding.test(l.kind)?'#8c6848':'#68866f'} strokeWidth={selected===l.id?4:2.2} strokeDasharray={feeding.test(l.kind)?undefined:'6 4'} markerEnd={feeding.test(l.kind)?'url(#ecology-arrow)':undefined}/>
            <title>{a.name} — {l.kind} — {b.name}: {l.description}</title>
          </g>;
        })}
        {positioned.map(n=><g key={n.id} onClick={()=>setSelected(selected===n.id?null:n.id)} style={{cursor:'pointer'}} opacity={!selected||selected===n.id||links.some(l=>l.id===selected&&(l.sourceId===n.id||l.targetId===n.id))||links.some(l=>(l.sourceId===selected&&l.targetId===n.id)||(l.targetId===selected&&l.sourceId===n.id))?1:0.35}>
          <circle cx={n.x} cy={n.y} r="22" fill={n.category==='flora'?'#8eab83':'#d5b786'} stroke="#62563d" strokeWidth={selected===n.id?3:1.5}/>
          <text x={n.x} y={n.y+4} textAnchor="middle" fontSize="13" fill="#392c1d">{n.category==='flora'?'P':'A'}</text>
          <text x={n.x} y={n.y+39} textAnchor="middle" fontSize="12" fill="#493923" stroke="#f4edd9" strokeWidth="3" paintOrder="stroke">{n.name.length>21?n.name.slice(0,20)+'…':n.name}</text>
          <title>{n.name}</title>
        </g>)}
      </svg>
    </div>}
    <p className="ecology-web-legend">Green: plants, fungi and algae · Ochre: animals · Solid arrows: feeding-related links · Dashed lines: other relationships</p>
    {chosen&&<div className="ecology-web-detail"><strong>{byId.get(chosen.sourceId)?.name} — {chosen.kind} — {byId.get(chosen.targetId)?.name}</strong><p>{chosen.description||'No field observation supplied.'}</p></div>}
    <p className="ecology-web-legend">Arrows follow the order organisms were entered; they do not automatically indicate energy-flow direction.</p>
  </section>;
}
