import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import './LaunchCenter.css';

type AtlasItem = { id:string; name:string; kind:string; x?:number; y?:number; description?:string };
type Revision = { id:number;kind:string;object_id:string;payload:Record<string,unknown>;creator_id:string;edited_by:string|null;action:string;recorded_at:string };
type Report = {id:string;record_kind:string;record_id:string;reason:string;details:string;status:string;created_at:string};
type Page = 'guide'|'search'|'report'|'history'|'review';
const guide = [
 ['Welcome, Explorer','This planet is a shared creative world. Every land, habitat and species is imagined by the community.'],
 ['Navigate','Scroll or use the magnifier to zoom. Drag to move. On a phone, use touch gestures. Select Explore to click an existing creation.'],
 ['Create','Try Auto Land or Draw Land. Select a land before adding ponds or rivers. Draw Ocean removes coastline; please experiment on your own lands.'],
 ['Document','Choose biomes, landscapes, plants and animals to build ecological stories. Open the Atlas Journal to browse records.'],
 ['Work together','Friends can grant Edit or Delete permission separately. Other members cannot normally change your work.'],
 ['Care for the Atlas','Report inappropriate creations using Atlas Tools. Moderators review reports. Deleted creations can be recovered from revision history.']
];
export default function LaunchCenter({items}:{items:AtlasItem[]}){
 const [open,setOpen]=useState(false),[page,setPage]=useState<Page>('guide'),[step,setStep]=useState(0);
 const [query,setQuery]=useState(''),[picked,setPicked]=useState<AtlasItem|null>(null);
 const [reason,setReason]=useState('Inappropriate content'),[details,setDetails]=useState('');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [history,setHistory]=useState<Revision[]>([]),[reports,setReports]=useState<Report[]>([]);
 const [moderator,setModerator]=useState(false);
 useEffect(()=>{const key='botany-atlas-guide-v24';if(!localStorage.getItem(key)){setOpen(true);setPage('guide');}},[]);
 useEffect(()=>{
  let active=true;
  supabase.auth.getUser().then(async ({data})=>{
   if(!data.user)return;
   const res=await supabase.from('atlas_moderators').select('enabled').eq('user_id',data.user.id).maybeSingle();
   if(active)setModerator(!res.error&&!!res.data?.enabled);
  });return()=>{active=false;};
 },[open]);
 const matches=useMemo(()=>query.trim()?items.filter(x=>`${x.name} ${x.kind} ${x.description||''}`.toLowerCase().includes(query.toLowerCase())).slice(0,60):items.slice(0,25),[items,query]);
 function finishGuide(){localStorage.setItem('botany-atlas-guide-v24','seen');setOpen(false);}
 function jump(item:AtlasItem){setPicked(item);if(Number.isFinite(item.x)&&Number.isFinite(item.y)){
  window.dispatchEvent(new CustomEvent('atlas-jump-to',{detail:{x:item.x,y:item.y}}));setOpen(false);
 }else setMessage('This record has no map location. Find it in the Atlas Journal.');}
 async function submitReport(){if(!picked){setMessage('Select a creation from Search first.');return;}
  setBusy(true);setMessage('');const {data:userData}=await supabase.auth.getUser();
  if(!userData.user){setMessage('Sign in first.');setBusy(false);return;}
  const result=await supabase.from('atlas_reports').insert({reporter_id:userData.user.id,record_kind:picked.kind,record_id:picked.id,reason,details:details.slice(0,1000)});
  setMessage(result.error?result.error.message:'Report sent privately to moderators. Thank you.');setBusy(false);
 }
 async function loadHistory(){setPage('history');setMessage('');const res=await supabase.from('atlas_revisions').select('id,kind,object_id,payload,creator_id,edited_by,action,recorded_at').order('recorded_at',{ascending:false}).limit(70);
 setHistory((res.data||[]) as Revision[]);if(res.error)setMessage(res.error.message);}
 async function restore(r:Revision){if(!window.confirm(`Restore this older ${r.kind} record? This may overwrite its current version.`))return;
  setBusy(true);const res=await supabase.rpc('atlas_restore_revision',{revision_id:r.id});setBusy(false);
  setMessage(res.error?res.error.message:'Restored. The shared map will update through Realtime.');if(!res.error)await loadHistory();}
 async function loadReports(){setPage('review');const res=await supabase.from('atlas_reports').select('id,record_kind,record_id,reason,details,status,created_at').order('created_at',{ascending:false}).limit(70);
 setReports((res.data||[]) as Report[]);setMessage(res.error?.message||'');}
 async function review(id:string,status:'reviewed'|'dismissed'){setBusy(true);const res=await supabase.rpc('atlas_review_report',{report_id:id,new_status:status});setBusy(false);if(res.error)setMessage(res.error.message);else await loadReports();}
 function choose(next:Page){setPage(next);setMessage('');if(next==='history')void loadHistory();if(next==='review')void loadReports();}
 return <>
  <button className="atlas-launch-trigger" type="button" onClick={()=>setOpen(true)}>Atlas Tools <span aria-hidden="true">⌕</span></button>
  {open&&<div className="atlas-launch-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
   <section role="dialog" aria-modal="true" aria-label="Atlas tools" className="atlas-launch-dialog">
    <header className="atlas-launch-head"><div><small>THE BOTANY SOCIETY · FIELD DESK</small><h2>Atlas Tools</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close Atlas Tools">×</button></header>
    <nav className="atlas-launch-tabs" aria-label="Atlas features">
     <button aria-current={page==='guide'?'page':undefined} onClick={()=>choose('guide')}>Guide</button>
     <button aria-current={page==='search'?'page':undefined} onClick={()=>choose('search')}>Search</button>
     <button aria-current={page==='report'?'page':undefined} onClick={()=>choose('report')}>Report</button>
     <button aria-current={page==='history'?'page':undefined} onClick={()=>choose('history')}>History</button>
     {moderator&&<button aria-current={page==='review'?'page':undefined} onClick={()=>choose('review')}>Review Reports</button>}
    </nav>
    <div className="atlas-launch-body">
    {page==='guide'&&<><small>FIELD GUIDE · {step+1} / {guide.length}</small><h3>{guide[step][0]}</h3><p>{guide[step][1]}</p><div className="atlas-launch-row"><button disabled={step===0} onClick={()=>setStep(s=>s-1)}>Previous</button>{step<guide.length-1?<button onClick={()=>setStep(s=>s+1)}>Next Page</button>:<button onClick={finishGuide}>Begin Exploring</button>}</div><button className="atlas-launch-subtle" onClick={finishGuide}>Skip guide</button></>}
    {page==='search'&&<><label>Find lands, districts, species, biomes and map objects<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search the atlas…" autoFocus/></label><div className="atlas-launch-list">{matches.length?matches.map(item=><div className="atlas-launch-item" key={`${item.kind}:${item.id}`}><div><strong>{item.name}</strong><small>{item.kind}</small></div><div className="atlas-launch-row"><button onClick={()=>jump(item)}>Locate</button><button onClick={()=>{setPicked(item);choose('report');}}>Report</button></div></div>):<p>No matching records yet.</p>}</div></>}
    {page==='report'&&<><h3>Report a shared creation</h3><p>Reports are only visible to the reporter and authorized moderators. Please describe the concern, not the person.</p>{picked?<p><strong>Selected:</strong> {picked.name} ({picked.kind}) <button onClick={()=>choose('search')}>Change</button></p>:<button onClick={()=>choose('search')}>Choose a creation from Search</button>}<label>Reason<select value={reason} onChange={e=>setReason(e.target.value)}><option>Inappropriate content</option><option>Harassment or hateful content</option><option>Spam or disruptive content</option><option>Privacy concern</option><option>Other concern</option></select></label><label>Details (optional)<textarea value={details} onChange={e=>setDetails(e.target.value)} maxLength={1000} rows={3}/></label><button disabled={busy||!picked} onClick={()=>void submitReport()}>Submit Report</button></>}
    {page==='history'&&<><h3>Revision Archive</h3><p>Shows recent prior versions and deletions of your creations. Active moderators can also restore community records. Restore carefully: it replaces the current version when one exists.</p><button onClick={()=>void loadHistory()}>Refresh History</button><div className="atlas-launch-list">{history.map(r=><div className="atlas-launch-item" key={r.id}><div><strong>{typeof r.payload?.name==='string'?r.payload.name:`${r.kind} · ${r.object_id}`}</strong><small>{r.kind} · {r.action} · {new Date(r.recorded_at).toLocaleString()}</small></div><button disabled={busy} onClick={()=>void restore(r)}>Restore</button></div>)}{!history.length&&<p>No revision snapshots yet. Future edits and deletions will appear here.</p>}</div></>}
    {page==='review'&&moderator&&<><h3>Member Reports</h3><p>Review reports before changing someone's work. Your existing moderation controls govern edits and deletions.</p><button onClick={()=>void loadReports()}>Refresh Reports</button><div className="atlas-launch-list">{reports.map(r=><div key={r.id} className="atlas-launch-item"><div><strong>{r.reason}</strong><small>{r.record_kind} · {r.record_id} · {r.status}</small><p>{r.details}</p></div><div className="atlas-launch-row"><button disabled={busy} onClick={()=>void review(r.id,'reviewed')}>Mark Reviewed</button><button disabled={busy} onClick={()=>void review(r.id,'dismissed')}>Dismiss</button></div></div>)}{!reports.length&&<p>No reports.</p>}</div></>}
    {message&&<p role="status" className="atlas-launch-notice">{message}</p>}
    </div>
   </section>
  </div>}
 </>;
}
