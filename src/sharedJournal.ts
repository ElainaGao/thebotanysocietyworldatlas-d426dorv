import { useCallback,useEffect,useRef,useState } from 'react';
import type { Dispatch,SetStateAction } from 'react';
import {supabase} from './supabase';

type Entry={id:string;[key:string]:unknown};
type Journal={terms:Entry[];notes:Entry[]};
type JournalRow={id:string;kind:'term'|'note';creator_id:string;payload:Entry};
function flatten(book:Journal){return new Map<string,{id:string;kind:'term'|'note';payload:Entry}>([
  ...book.terms.map(t=>['term:'+t.id,{kind:'term' as const,id:t.id,payload:t}] as const),
  ...book.notes.map(n=>['note:'+n.id,{kind:'note' as const,id:n.id,payload:n}] as const)
]);}
const key=(r:JournalRow)=>r.kind+':'+r.id;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function apply<B extends Journal>(book:B,row:JournalRow,remove:boolean):B {
  const field=row.kind==='term'?'terms':'notes';
  const filtered=book[field].filter(x=>x.id!==row.id);
  if(!remove)filtered.push(row.payload);
  return {...book,[field]:filtered};
}
export function useSharedJournal<B extends Journal>(legacyRead:()=>B):[B,Dispatch<SetStateAction<B>>,{ready:boolean;error:string;legacyCount:number;remoteRevision:number;importLegacy:()=>Promise<void>;importFile:(file:File)=>Promise<void>}] {
  const [book, setRaw] = useState<B>(() => ({ terms: [], notes: [] } as unknown as B));
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const localRef=useRef(legacyRead());
  const [legacyCount,setLegacyCount]=useState(()=>localRef.current.terms.length+localRef.current.notes.length);
  const userId=useRef('');
  const baseline=useRef(new Map<string,JournalRow>());
  const bookRef=useRef(book);bookRef.current=book;
  const busy=useRef(false);
  const readyRef=useRef(false);
  const queued=useRef(false);
  const [rev,setRev]=useState(0);
  const [remoteRevision,setRemoteRevision]=useState(0);
  const setBook:Dispatch<SetStateAction<B>>=useCallback(update=>{
    setRaw(old=>{
      const next=typeof update==='function'?(update as (b:B)=>B)(old):update;
      if(!readyRef.current)return old;
      const before=flatten(old),after=flatten(next);
      for(const [k,v] of before){
        const creator=baseline.current.get(k)?.creator_id;
        if(creator && creator!==userId.current && !same(v.payload,after.get(k)?.payload)){
          setError('Only the creator may edit or delete a custom dictionary term.');
          return old;
        }
      }
      return next;
    });
  },[]);
  const refresh=useCallback(async()=>{
    if(busy.current){queued.current=true;return;}
    if(readyRef.current){
      const current=flatten(bookRef.current);
      if(current.size!==baseline.current.size||[...current].some(([k,v])=>!same(v.payload,baseline.current.get(k)?.payload))){queued.current=true;return;}
    }
    const all:JournalRow[]=[];
    for(let start=0;;start+=500){
      const {data, error:e}=await supabase.from('atlas_journal').select('id,kind,creator_id,payload').order('id').range(start,start+499);
      if(e){setError('Journal sync unavailable: '+e.message);return;}
      all.push(...(data||[]) as JournalRow[]);
      if(!data||data.length<500)break;
    }
    baseline.current=new Map(all.map(r=>[key(r),r]));
    setRaw({terms:all.filter(r=>r.kind==='term').map(r=>r.payload),notes:all.filter(r=>r.kind==='note').map(r=>r.payload)} as B);
    readyRef.current=true;setReady(true);setError('');setRemoteRevision(v=>v+1);
  },[]);
  useEffect(()=>{
    let mounted=true;
    supabase.auth.getUser().then(({data:{user}})=>{if(mounted&&user){userId.current=user.id;void refresh();}});
    const channel=supabase.channel('atlas-journal-live').on('postgres_changes',{event:'*',schema:'public',table:'atlas_journal'},change=>{
      const row=(change.eventType==='DELETE'?change.old:change.new) as Partial<JournalRow>;
      if(!row?.id||!row?.kind){void refresh();return;}
      if(busy.current){queued.current=true;return;}
      if(change.eventType==='DELETE'){baseline.current.delete(key(row as JournalRow));setRaw(old=>apply(old,row as JournalRow,true));setRemoteRevision(v=>v+1);}
      else if(row.payload){baseline.current.set(key(row as JournalRow),row as JournalRow);setRaw(old=>apply(old,row as JournalRow,false));setRemoteRevision(v=>v+1);}
      else void refresh();
    }).subscribe(status=>{if(status==='SUBSCRIBED'&&readyRef.current)void refresh();});
    const onOnline=()=>{void refresh();};window.addEventListener('online',onOnline);
    return ()=>{mounted=false;window.removeEventListener('online',onOnline);void supabase.removeChannel(channel);};
  },[refresh]);
  useEffect(()=>{if(ready)setRev(n=>n+1);},[book,ready]);
  useEffect(()=>{
    if(!ready)return;
    const timer=window.setTimeout(()=>void flush(),450);
    return ()=>clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ready,rev]);
  async function flush(){
    if(busy.current||!readyRef.current||!userId.current)return;
    const latest=flatten(bookRef.current),old=baseline.current;
    const jobs:[string,'put'|'delete',{id:string;kind:'term'|'note';payload:Entry}][]=[];
    for(const [k,v] of latest)if(!old.has(k)||!same(v.payload,old.get(k)?.payload))jobs.push([k,'put',v]);
    for(const [k,v] of old)if(!latest.has(k))jobs.push([k,'delete',v]);
    if(!jobs.length)return;
    busy.current=true;
    for(const [k,verb,v] of jobs){
      const previous=baseline.current.get(k);
      if(previous&&previous.creator_id!==userId.current){setError('Only the creator may edit this record.');busy.current=false;return;}
      let failure;
      if(verb==='delete')({error:failure}=await supabase.from('atlas_journal').delete().eq('id',v.id).eq('kind',v.kind));
      else if(previous)({error:failure}=await supabase.from('atlas_journal').update({payload:v.payload}).eq('id',v.id).eq('kind',v.kind));
      else ({error:failure}=await supabase.from('atlas_journal').insert({...v,creator_id:userId.current}));
      if(failure){setError('Journal save failed: '+failure.message);busy.current=false;return;}
      if(verb==='delete')baseline.current.delete(k);else baseline.current.set(k,{...v,creator_id:userId.current});
    }
    busy.current=false;setError('');
    const current=flatten(bookRef.current);
    if(current.size!==baseline.current.size||[...current].some(([k,v])=>!same(v.payload,baseline.current.get(k)?.payload)))setRev(n=>n+1);
    else if(queued.current){queued.current=false;void refresh();}
  }
  async function importFile(file:File){
    if(!readyRef.current||!userId.current)return;
    let parsed:unknown;
    try{parsed=JSON.parse(await file.text());}catch{setError('Choose a valid JSON journal backup.');return;}
    const candidate=((parsed as {journal?:unknown})?.journal||parsed) as Partial<Journal>;
    if(!candidate || !Array.isArray(candidate.terms) || !Array.isArray(candidate.notes)){
      setError('This backup does not contain a journal with terms and notes.');return;
    }
    const entries=[...flatten(candidate as Journal).values()];
    if(!window.confirm(`Import ${entries.length} custom terms and notes? Existing online entries will be preserved.`))return;
    busy.current=true;setError('');
    for(const [k,v] of flatten(candidate as Journal)){
      if(baseline.current.has(k))continue;
      const {error:e}=await supabase.from('atlas_journal').insert({...v,creator_id:userId.current});
      if(e){setError('Journal import stopped: '+e.message);break;}
      baseline.current.set(k,{...v,creator_id:userId.current});
    }
    busy.current=false;
    const all=[...baseline.current.values()];
    setRaw({terms:all.filter(r=>r.kind==='term').map(r=>r.payload),notes:all.filter(r=>r.kind==='note').map(r=>r.payload)} as B);
  }
  const importLegacy=useCallback(async()=>{
    if(!window.confirm('Import previous custom dictionary terms and private notes from this browser? Existing online records will not be replaced.'))return;
    if(!readyRef.current||!userId.current)return;
    busy.current=true;
    for(const [k,v] of flatten(localRef.current)){
      if(baseline.current.has(k))continue;
      const {error:e}=await supabase.from('atlas_journal').insert({...v,creator_id:userId.current});
      if(e){setError('Journal import stopped: '+e.message);break;}
      baseline.current.set(k,{...v,creator_id:userId.current});
    }
    setLegacyCount(0);busy.current=false;
    const all=[...baseline.current.values()];
    setRaw({terms:all.filter(r=>r.kind==='term').map(r=>r.payload),notes:all.filter(r=>r.kind==='note').map(r=>r.payload)} as B);
  },[refresh]);
  return [book,setBook,{ready,error,legacyCount,remoteRevision,importLegacy,importFile}];
}
