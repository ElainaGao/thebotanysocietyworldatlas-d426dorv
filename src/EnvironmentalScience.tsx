import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from './supabase';
import './EnvironmentalScience.css';

type Species = {id:string;name:string;landId:string;biomeId?:string;description:string;habitat:string;kind:'plant'|'creature';group?:string};
type Brief = {id:string;name:string;landId?:string};
type Link = {id:string;landId:string;sourceId:string;targetId:string;kind:string};
type Climate = {rainfall:number;temperature:number;elevation:number;salinity:string;currents:string;depth:string};
type Category = 'geology'|'season'|'traits'|'range'|'event'|'research';
type RecordRow = {id:string;creator_id:string;category:Category;scope_id:string;scope_name:string;subject_id:string|null;title:string;details:string;meta:Record<string,string>;created_at:string};
type Props={scopeId:string;scopeName:string;scopeType:string;parentLandId:string;climate?:Climate;plants:Species[];creatures:Species[];biomes:Brief[];lands:Brief[];relations:Link[]};
const sections: {id:string;label:string}[]=[{id:'environment',label:'Environment & Seasons'},{id:'species',label:'Species & Distribution'},{id:'health',label:'Ecosystem Indicators'},{id:'history',label:'Environmental History & Research'},{id:'encyclopedia',label:'World Encyclopedia'}];
const blank = {title:'',details:'',subjectId:'',extra:'',season:'Spring'};
function environmentalGuide(c?:Climate){
  if(!c)return 'Choose a land to view its saved Local Climate & Oceanography values.';
  const temp=c.temperature<=0?'cold':c.temperature>=25?'warm':'temperate';
  const moisture=c.rainfall<300?'dry':c.rainfall>=1800?'very wet':'intermediate rainfall';
  return `Existing climate: ${c.temperature}°C (${temp}), ${c.rainfall} mm/year (${moisture}), elevation ${c.elevation} m, salinity ${c.salinity}. These are descriptive cues, not a physical climate prediction.`;
}
export default function EnvironmentalScience({scopeId,scopeName,scopeType,parentLandId,climate,plants,creatures,biomes,lands,relations}:Props){
  const [tab,setTab]=useState('environment');
  const [rows,setRows]=useState<RecordRow[]>([]);
  const [userId,setUserId]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [draft,setDraft]=useState(blank);
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [focused,setFocused]=useState<string>('');
  const allSpecies=useMemo(()=>[...plants,...creatures], [plants,creatures]);
  const visibleSpecies=useMemo(()=>allSpecies.filter(s=>s.landId===scopeId||s.biomeId===scopeId||(!!parentLandId && s.landId===parentLandId)),[allSpecies,scopeId,parentLandId]);
  const scopeRows=useMemo(()=>rows.filter(r=>r.scope_id===scopeId),[rows,scopeId]);
  const latestTraits=useMemo(()=>{const m=new Map<string,RecordRow>();for(const r of rows.filter(x=>x.category==='traits'&&x.subject_id))if(!m.has(r.subject_id!))m.set(r.subject_id!,r);return m;},[rows]);
  const scopeSpeciesIds=new Set(visibleSpecies.map(s=>s.id));
  const scopedLinks=relations.filter(l=>(l.landId===scopeId||l.landId===parentLandId)&&scopeSpeciesIds.has(l.sourceId)&&scopeSpeciesIds.has(l.targetId));
  const reload=useCallback(async()=>{
    const {data,error:err}=await supabase.from('atlas_science_records').select('*').order('created_at',{ascending:false}).limit(1500);
    if(err)setError(`Scientific records unavailable: ${err.message}. Check SETUP_SCIENCE.sql.`);
    else {setRows((data||[]) as RecordRow[]);setError('');}
    setReady(true);
  },[]);
  useEffect(()=>{
    let active=true;
    void supabase.auth.getUser().then(({data})=>{if(active)setUserId(data.user?.id||'');});
    void reload();
    const channel=supabase.channel('atlas-science-live').on('postgres_changes',{event:'*',schema:'public',table:'atlas_science_records'},()=>{void reload()}).subscribe();
    return()=>{active=false;void supabase.removeChannel(channel);};
  },[reload]);
  function reset(){setEditing(null);setDraft(blank);}
  async function save(e:FormEvent,category:Category){
    e.preventDefault();if(!scopeId||!userId||!draft.title.trim()||busy)return;
    const extraKey=category==='season'?'season':category==='event'?'date':category==='research'?'status':category==='geology'?'soil':category==='traits'?'adaptations':'range';
    const payload={category,scope_id:scopeId,scope_name:scopeName,subject_id:(category==='traits'||category==='range')?draft.subjectId||null:null,title:draft.title.trim().slice(0,150),details:draft.details.trim().slice(0,5000),meta:{[extraKey]:category==='season'?draft.season:draft.extra.trim().slice(0,500)}};
    if((category==='traits'||category==='range')&&!draft.subjectId){setError('Select an existing species first.');return;}
    setBusy(true);setError('');
    const result=editing?await supabase.from('atlas_science_records').update(payload).eq('id',editing).eq('creator_id',userId):await supabase.from('atlas_science_records').insert({...payload,creator_id:userId});
    if(result.error)setError(result.error.message);else{reset();await reload();}
    setBusy(false);
  }
  async function remove(row:RecordRow){
    if(row.creator_id!==userId||!window.confirm(`Delete “${row.title}”?`))return;
    const {error:err}=await supabase.from('atlas_science_records').delete().eq('id',row.id).eq('creator_id',userId);
    if(err)setError(err.message);else await reload();
  }
  function edit(row:RecordRow){if(row.creator_id!==userId)return;setEditing(row.id);setDraft({title:row.title,details:row.details,subjectId:row.subject_id||'',extra:Object.values(row.meta||{})[0]||'',season:row.meta?.season||'Spring'});setTab(row.category==='traits'||row.category==='range'?'species':row.category==='event'||row.category==='research'?'history':'environment');}
  const sourceTitle=(category:Category)=>category==='geology'?'Geology & Soil':category==='season'?'Seasonal Observation':category==='traits'?'Species Traits':category==='range'?'Distribution / Migration':category==='event'?'Historical Event':'Research Question';
  function records(category:Category){return <div className="science-records">{scopeRows.filter(r=>r.category===category).map(r=><article className="science-item" key={r.id}><strong>{r.title}</strong>{r.subject_id&&<small> · {allSpecies.find(s=>s.id===r.subject_id)?.name||'Species unavailable'}</small>}<p>{r.details}</p>{Object.entries(r.meta||{}).map(([k,v])=>v&&<small key={k}>{k}: {v} </small>)}{r.creator_id===userId&&<div className="science-actions"><button type="button" onClick={()=>edit(r)}>Edit</button><button type="button" onClick={()=>void remove(r)}>Delete</button></div>}</article>)}{!scopeRows.some(r=>r.category===category)&&<p className="science-muted">No {sourceTitle(category).toLowerCase()} records for this location yet.</p>}</div>}
  function form(category:Category){return <form className="science-form" onSubmit={e=>void save(e,category)}><h4>{editing?`Edit ${sourceTitle(category)}`:`Record ${sourceTitle(category)}`}</h4>{(category==='traits'||category==='range')&&<label>Existing organism<select required value={draft.subjectId} onChange={e=>setDraft(d=>({...d,subjectId:e.target.value}))}><option value="">Choose a registered organism</option>{visibleSpecies.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}<label>Title<input required maxLength={150} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} placeholder={category==='event'?'A historic volcanic eruption':category==='geology'?'Basaltic bedrock and acidic soil':category==='research'?'Why do these flowers bloom here?':'Name of observation'}/></label>{category==='season'?<label>Season<select value={draft.season} onChange={e=>setDraft(d=>({...d,season:e.target.value}))}>{['Spring','Summer','Autumn','Winter','Wet season','Dry season','Other'].map(s=><option key={s}>{s}</option>)}</select></label>:<label>{category==='event'?'In-world date / era':category==='geology'?'Soil characteristics':category==='traits'?'Adaptations / reproduction / lifespan / conservation status':category==='research'?'Status (hypothesis, investigating, supported, disputed)':category==='range'?'Distribution or migration pattern':'Additional detail'}<input value={draft.extra} maxLength={500} onChange={e=>setDraft(d=>({...d,extra:e.target.value}))}/></label>}<label>{category==='research'?'Hypothesis, evidence and observations':category==='range'?'Habitat and seasonal movement details':category==='traits'?'Diet, traits, lifecycle and habitat requirements':'Description'}<textarea rows={3} value={draft.details} maxLength={5000} onChange={e=>setDraft(d=>({...d,details:e.target.value}))}/></label><div className="science-actions"><button disabled={busy||!userId} type="submit">{busy?'Saving…':editing?'Save Changes':'Add Record'}</button>{editing&&<button type="button" onClick={reset}>Cancel</button>}</div></form>}
  return <section className="atlas-panel science-studio" aria-label="Environmental Science Studio"><p className="panel-kicker">THE NATURAL HISTORY ARCHIVE</p><h2>Environmental Science</h2><p className="science-muted">Connected scientific observations, not a second climate editor, species register or journal.</p><nav className="science-tabs" aria-label="Environmental science categories">{sections.map(t=><button type="button" key={t.id} className={tab===t.id?'selected':''} onClick={()=>{setTab(t.id);reset();setFocused('');}}>{t.label}</button>)}</nav>{error&&<p role="alert" className="science-error">{error}</p>}{!ready&&<p>Loading scientific records…</p>}
  {tab==='encyclopedia'?<><h3>World Encyclopedia</h3><p>Uses the existing Plant and Wildlife Registers. Selecting an entry does not create duplicate species.</p><label>Search organism name, habitat or group<input value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="science-encyclopedia">{allSpecies.filter(s=>`${s.name} ${s.habitat} ${s.group||''}`.toLowerCase().includes(search.toLowerCase())).slice(0,150).map(s=><article key={s.id} className="science-item"><button type="button" onClick={()=>setFocused(focused===s.id?'':s.id)}><strong>{s.name}</strong> · {s.kind==='plant'?'Plant, fungus or alga':s.group||'Wildlife'}</button>{focused===s.id&&<><p>{s.description||'No description recorded.'}</p><p>Habitat: {s.habitat||'Not specified'}</p><p>Origin: {lands.find(l=>l.id===s.landId)?.name||biomes.find(b=>b.id===s.biomeId)?.name||'Open ocean'}</p>{latestTraits.get(s.id)&&<p>Additional traits: {latestTraits.get(s.id)!.details}</p>}<p>Distribution records: {rows.filter(r=>r.category==='range'&&r.subject_id===s.id).map(r=>r.scope_name).join(', ')||'Not recorded yet'}</p></>}</article>)}</div></>:!scopeId?<p>Select a land, district or aquatic biome to work with its ecology. The global encyclopedia remains accessible without a selection.</p>:<><p><strong>Selected {scopeType}:</strong> {scopeName}</p>
    {tab==='environment'&&<><h3>Local Climate, Geology & Seasonal Ecology</h3><p>{environmentalGuide(climate)}</p><p className="science-muted">Edit temperature, rainfall and ocean conditions in the existing <strong>Local Climate & Oceanography</strong> panel. This section adds soil/geological observations and seasonal changes without duplicating those controls.</p>{records('geology')}{form('geology')}{records('season')}{form('season')}</>}
    {tab==='species'&&<><h3>Species Profiles & Ranges</h3><p>Use registered plants and creatures; the existing Ecological Relationships food web remains the source for interactions.</p>{records('traits')}{form('traits')}{records('range')}{form('range')}</>}
    {tab==='health'&&<><h3>Ecosystem Record Completeness</h3><p className="science-muted">Educational indicators based on entries—not a real biodiversity or conservation health score.</p><div className="science-metrics"><span><strong>{visibleSpecies.length}</strong> registered organisms</span><span><strong>{new Set(visibleSpecies.map(s=>s.kind)).size}</strong> represented registers</span><span><strong>{scopedLinks.length}</strong> recorded relationships</span><span><strong>{scopeRows.filter(r=>r.category==='geology').length}</strong> geological observations</span><span><strong>{scopeRows.filter(r=>r.category==='season').length}</strong> seasonal observations</span></div><p>{scopedLinks.length===0?'Tip: add ecological relationships in the existing Organism Register to document interactions.':'The relationship network is available in Ecological Relationships → Interactive Food Web.'}</p><p>Documented climate: {environmentalGuide(climate)}</p></>}
    {tab==='history'&&<><h3>Environmental Timeline</h3>{records('event')}{form('event')}<h3>Scientific Questions & Evidence</h3><p>Collaborative hypotheses reference this ecosystem; they do not overwrite the private personal journal.</p>{records('research')}{form('research')}</>}
  </>}</section>;
}
