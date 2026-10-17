import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from './supabase';

// One independently secured database row per map object. This avoids last-writer-wins
// replacement of the entire planet when two members change different objects.
const KINDS = ['lands','districts','plants','biomes','features','waters','labels','creatures','relations','depthPatches','occurrences','climates'] as const;
type Kind = typeof KINDS[number];
type Item = Record<string, unknown>;
type WorldShape = Record<string, unknown>;
type Row = { kind:string; object_id:string; payload:Item; creator_id:string; created_at?:string; updated_at?:string };
const idFor = (kind: Kind, item:Item, key?:string) => kind === 'occurrences'
  ? `${item.districtId}::${item.plantId}` : kind === 'climates' ? key! : String(item.id);
const rowKey = (kind:string,id:string) => `${kind}|${id}`;
function flatten<T extends WorldShape>(world:T):Map<string,{kind:Kind;object_id:string;payload:Item}>{
  const result = new Map<string,{kind:Kind;object_id:string;payload:Item}>();
  for(const kind of KINDS){
    if(kind==='climates') {
      const climates=(world.climates||{}) as Record<string,Item>;
      for(const [id,value] of Object.entries(climates)) result.set(rowKey(kind,id),{kind,object_id:id,payload:value});
    } else {
      for(const value of ((world[kind]||[]) as Item[])) {
        const id=idFor(kind,value);
        result.set(rowKey(kind,id),{kind,object_id:id,payload:value});
      }
    }
  }
  return result;
}
function fromRows<T extends WorldShape>(empty:()=>T, rows:Row[]):T {
  const world=empty();
  for(const row of rows){
    const kind=row.kind as Kind;
    if(!KINDS.includes(kind)) continue;
    if(kind==='climates') (world.climates as Record<string,Item>)[row.object_id]=row.payload;
    else ((world[kind] as Item[])||[]).push(row.payload);
  }
  return world;
}
function changeOne<T extends WorldShape>(prev:T, row:Row, remove:boolean):T {
  const kind=row.kind as Kind;
  if(!KINDS.includes(kind))return prev;
  if(kind==='climates'){
    const climates={...(prev.climates as Record<string,Item>)};
    if(remove) delete climates[row.object_id]; else climates[row.object_id]=row.payload;
    return {...prev,climates};
  }
  const before=(prev[kind]||[]) as Item[];
  const index=before.findIndex(item=>idFor(kind,item)===row.object_id);
  const after=before.slice();
  if(remove){if(index>=0)after.splice(index,1);}
  else if(index>=0)after[index]=row.payload;
  else after.push(row.payload);
  return {...prev,[kind]:after};
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

export function useSharedAtlas<T extends WorldShape>(empty:()=>T, loadLegacy:()=>T):[
  T,Dispatch<SetStateAction<T>>,{
    ready:boolean; saving:boolean;connected:boolean;error:string;legacyCount:number;remoteRevision:number;
    importLegacy:()=>Promise<void>;importFile:(file:File)=>Promise<void>;refresh:()=>Promise<void>;
  }
]{
  const [data,setRaw]=useState<T>(empty);
  const [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const [connected,setConnected]=useState(false);
  const [error,setError]=useState('');
  const oldWorld=useRef<T>(loadLegacy());
  const [legacyCount,setLegacyCount]=useState(()=>flatten(oldWorld.current).size);
  const base=useRef(new Map<string,Row>());
  const dataRef=useRef(data); dataRef.current=data;
  const userRef=useRef('');
  const flushing=useRef(false);
  const queuedRemote=useRef(false);
  const syncReady=useRef(false);
  const importRunning=useRef(false);
  const [changeToken,setChangeToken]=useState(0);
  const [remoteRevision,setRemoteRevision]=useState(0);

  // All normal atlas handlers still use setData. Block edits/deletes to other
  // creators' objects in the UI as well as enforcing ownership in PostgreSQL.
  const setData:Dispatch<SetStateAction<T>>=useCallback(action=>{
    setRaw(previous=>{
      const proposed=typeof action==='function'?(action as (p:T)=>T)(previous):action;
      if(!syncReady.current)return previous;
      const old=flatten(previous), next=flatten(proposed);
      for(const [key,record] of old){
        const owner=base.current.get(key)?.creator_id;
        if(owner && owner!==userRef.current && !same(record.payload,next.get(key)?.payload)){
          setError('This object belongs to another member. Only its creator may change or remove it.');
          return previous;
        }
      }
      return proposed;
    });
  },[]);

  const refresh=useCallback(async()=>{
    if(flushing.current){queuedRemote.current=true;return;}
    // Do not discard pending local changes during reconnection.
    if(syncReady.current){
      const local=flatten(dataRef.current);
      if(local.size!==base.current.size || [...local].some(([key,row])=>!same(row.payload,base.current.get(key)?.payload))){queuedRemote.current=true;return;}
    }
    const all:Row[]=[];
    for(let start=0;;start+=500){
      const {data:page,error:failure}=await supabase.from('atlas_records').select('kind,object_id,payload,creator_id,created_at,updated_at').order('created_at',{ascending:true}).order('object_id').range(start,start+499);
      if(failure){setError(`Cannot load shared atlas: ${failure.message}. Run the setup SQL before using this version.`);return;}
      const rows=(page||[]) as Row[];
      all.push(...rows);
      if(rows.length<500)break;
    }
    base.current=new Map(all.map(row=>[rowKey(row.kind,row.object_id),row]));
    // Only use the database as the initial source, never silently upload the
    // old local world or delete online objects to match an empty cache.
    setRaw(fromRows(empty,all));
    setRemoteRevision(v=>v+1);
    syncReady.current=true;
    setReady(true);
    setError('');
  },[empty]);

  useEffect(()=>{
    let disposed=false;
    supabase.auth.getUser().then(({data:{user},error:failure})=>{
      if(disposed)return;
      if(failure||!user){setError('Sign in to access the shared atlas.');return;}
      userRef.current=user.id;
      void refresh();
    });
    const channel=supabase.channel('atlas-live-records')
      .on('postgres_changes',{event:'*',schema:'public',table:'atlas_records'},payload=>{
        const row=(payload.eventType==='DELETE'?payload.old:payload.new) as Partial<Row>;
        if(!row?.kind||!row?.object_id){void refresh();return;}
        const key=rowKey(row.kind,row.object_id);
        // Defer events while local changes are being persisted, then reconcile.
        if(flushing.current || !syncReady.current){queuedRemote.current=true;return;}
        if(payload.eventType==='DELETE'){
          base.current.delete(key);
          setRaw(previous=>changeOne(previous,row as Row,true));
          setRemoteRevision(v=>v+1);
        }else if(row.payload){
          base.current.set(key,row as Row);
          setRaw(previous=>changeOne(previous,row as Row,false));
          setRemoteRevision(v=>v+1);
        }else void refresh();
      })
      .subscribe(status=>{if(!disposed){setConnected(status==='SUBSCRIBED');if(status==='SUBSCRIBED'&&syncReady.current)void refresh();}});
    const onOnline=()=>{void refresh();};
    window.addEventListener('online',onOnline);
    return ()=>{disposed=true;window.removeEventListener('online',onOnline);void supabase.removeChannel(channel);};
  },[refresh]);

  useEffect(()=>{if(ready)setChangeToken(n=>n+1);},[data,ready]);
  useEffect(()=>{
    if(!ready||importRunning.current)return;
    const timer=window.setTimeout(()=>{void flush();},400);
    return ()=>window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[changeToken,ready]);

  async function flush(){
    if(flushing.current||!syncReady.current||!userRef.current)return;
    const current=flatten(dataRef.current);
    const original=base.current;
    const operations:[string,'put'|'delete',{kind:Kind;object_id:string;payload:Item}|null][]=[];
    for(const [key,row] of current){
      const prev=original.get(key);
      if(!prev || !same(prev.payload,row.payload))operations.push([key,'put',row]);
    }
    for(const [key,row] of original)if(!current.has(key))operations.push([key,'delete',{kind:row.kind as Kind,object_id:row.object_id,payload:row.payload}]);
    if(!operations.length)return;
    flushing.current=true;setSaving(true);setError('');
    let failed=false;
    for(const [key,verb,item] of operations){
      if(!item)continue;
      const previous=base.current.get(key);
      if(previous && previous.creator_id!==userRef.current){
        setError('Cannot modify another member’s record. The shared atlas will be refreshed.');failed=true;break;
      }
      let failure;
      if(verb==='delete'){
        ({error:failure}=await supabase.from('atlas_records').delete().eq('kind',item.kind).eq('object_id',item.object_id));
      }else if(previous){
        ({error:failure}=await supabase.from('atlas_records').update({payload:item.payload}).eq('kind',item.kind).eq('object_id',item.object_id));
      }else{
        ({error:failure}=await supabase.from('atlas_records').insert({kind:item.kind,object_id:item.object_id,payload:item.payload,creator_id:userRef.current}));
      }
      if(failure){setError(`Save failed for ${item.kind}: ${failure.message}. Please retry.`);failed=true;break;}
      if(verb==='delete')base.current.delete(key);
      else base.current.set(key,{...item,creator_id:userRef.current});
    }
    flushing.current=false;setSaving(false);
    if(failed){return;}
    // If the member continued editing during the previous save, flush those
    // latest changes before applying deferred incoming server events.
    const latest=flatten(dataRef.current);
    const outstanding=latest.size!==base.current.size || [...latest].some(([key,row])=>!same(row.payload,base.current.get(key)?.payload));
    if(outstanding){setChangeToken(n=>n+1);return;}
    if(queuedRemote.current){queuedRemote.current=false;void refresh();}
  }

  async function importFile(file:File){
    if(!syncReady.current||!userRef.current)return;
    let parsed:unknown;
    try{parsed=JSON.parse(await file.text());}
    catch {setError('Choose a valid JSON backup file.');return;}
    const candidate=(parsed as {atlas?:unknown})?.atlas || parsed;
    if(!candidate || typeof candidate!=='object' || !Array.isArray((candidate as {lands?:unknown}).lands)){
      setError('This file does not contain a Botany World Atlas backup.');return;
    }
    const objects=[...flatten(candidate as T).values()];
    if(!window.confirm(`Import ${objects.length} records into the shared planet? Existing online records will not be replaced. Only import creations you own.`))return;
    importRunning.current=true;setSaving(true);setError('');
    let successes=0;
    for(const item of objects){
      if(base.current.has(rowKey(item.kind,item.object_id)))continue;
      const {error:failure}=await supabase.from('atlas_records').insert({...item,creator_id:userRef.current});
      if(failure){setError(`Imported ${successes} records before encountering an error: ${failure.message}`);break;}
      successes++;base.current.set(rowKey(item.kind,item.object_id),{...item,creator_id:userRef.current});
    }
    importRunning.current=false;setSaving(false);
    setRaw(fromRows(empty,[...base.current.values()]));
  }
  const importLegacy=useCallback(async()=>{
    if(!window.confirm('Import your earlier browser-saved world into the shared online planet? Existing online creations will be preserved. Import only content you own.'))return;
    if(!syncReady.current||!userRef.current)return;
    importRunning.current=true;setSaving(true);setError('');
    const entries=[...flatten(oldWorld.current).values()];
    const available=entries.filter(row=>!base.current.has(rowKey(row.kind,row.object_id)));
    for(const item of available){
      const {error:failure}=await supabase.from('atlas_records').insert({...item,creator_id:userRef.current});
      if(failure){setError(`Import stopped: ${failure.message}. Already imported records were preserved.`);break;}
      base.current.set(rowKey(item.kind,item.object_id),{...item,creator_id:userRef.current});
    }
    // The original offline localStorage record remains unchanged.
    setLegacyCount(0);
    importRunning.current=false;setSaving(false);
    setRaw(fromRows(empty,[...base.current.values()]));
  },[refresh]);

  return [data,setData,{ready,saving,connected,error,legacyCount,remoteRevision,importLegacy,importFile,refresh}];
}
