import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import './FriendsPanel.css';

type Explorer = {id:string; username:string; display_name:string; cursor_color:string};
type Connection = Explorer & {requester_id:string;recipient_id:string;status:string;other_id:string};
type Grant = {owner_id:string;friend_id:string;can_edit:boolean;can_delete:boolean};
export default function FriendsPanel({userId}:{userId:string}){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [results,setResults]=useState<Explorer[]>([]);
 const [connections,setConnections]=useState<Connection[]>([]);
 const [grants,setGrants]=useState<Grant[]>([]);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [onlineIds,setOnlineIds]=useState<Set<string>>(()=>new Set());
 const reload=useCallback(async()=>{
  const [people, permissions]=await Promise.all([
    supabase.rpc('list_atlas_connections'),
    supabase.from('atlas_friend_grants').select('owner_id,friend_id,can_edit,can_delete').or(`owner_id.eq.${userId},friend_id.eq.${userId}`)
  ]);
  if(people.error) setError(people.error.message);
  else setConnections((people.data||[]) as Connection[]);
  if(permissions.error) setError(permissions.error.message);
  else setGrants((permissions.data||[]) as Grant[]);
 },[userId]);
 useEffect(()=>{void reload();const ch=supabase.channel(`friends-list-${userId}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'atlas_friendships'},()=>void reload())
  .on('postgres_changes',{event:'*',schema:'public',table:'atlas_friend_grants'},()=>void reload())
  .subscribe();return()=>{void supabase.removeChannel(ch);};},[reload,userId]);
 async function search(e:FormEvent){e.preventDefault();setError('');
  const q=query.trim().replace(/^@/,''); if(q.length<2){setError('Enter at least two letters.');return;}
  const {data,error:failure}=await supabase.rpc('find_atlas_explorers',{search_name:q});
  if(failure)setError(failure.message);else setResults(((data||[]) as Explorer[]).filter(x=>x.id!==userId));
 }
 async function act(action:()=>PromiseLike<{error:{message:string}|null}>,success:string){setBusy(true);setError('');setMessage('');
  const {error:failure}=await action();if(failure)setError(failure.message);else{setMessage(success);await reload();}setBusy(false);
 }
 function send(id:string){void act(()=>supabase.from('atlas_friendships').insert({requester_id:userId,recipient_id:id,status:'pending'}),'Friend request sent.');}
 function accept(c:Connection){void act(()=>supabase.from('atlas_friendships').update({status:'accepted'}).eq('requester_id',c.requester_id).eq('recipient_id',c.recipient_id),'Friend request accepted.');}
 function unfriend(c:Connection){if(!window.confirm(c.status==='accepted'?`Unfriend @${c.username}? All shared permissions stop immediately.`:`Cancel your request involving @${c.username}?`))return;
  void act(()=>supabase.from('atlas_friendships').delete().eq('requester_id',c.requester_id).eq('recipient_id',c.recipient_id),'Connection removed.');}
 function toggle(c:Connection,field:'can_edit'|'can_delete',enabled:boolean){
  const current=grants.find(g=>g.owner_id===userId&&g.friend_id===c.other_id);
  void act(()=>supabase.from('atlas_friend_grants').upsert({owner_id:userId,friend_id:c.other_id,can_edit:field==='can_edit'?enabled:current?.can_edit||false,can_delete:field==='can_delete'?enabled:current?.can_delete||false},{onConflict:'owner_id,friend_id'}),enabled?'Permission granted.':'Permission revoked.');
 }
 // Ephemeral Supabase Presence: green while connected, gray otherwise.
 useEffect(()=>{
  const channel=supabase.channel('atlas-explorers-presence-v1',{config:{presence:{key:userId}}});
  const refresh=()=>{
   const members=channel.presenceState();
   setOnlineIds(new Set(Object.keys(members).filter(id=>members[id]?.length>0)));
  };
  channel.on('presence',{event:'sync'},refresh)
   .on('presence',{event:'join'},refresh)
   .on('presence',{event:'leave'},refresh)
   .subscribe(async status=>{if(status==='SUBSCRIBED')await channel.track({online_at:new Date().toISOString()});});
  return ()=>{void channel.untrack();void supabase.removeChannel(channel);};
 },[userId]);
 const friends=connections.filter(c=>c.status==='accepted');
 const incoming=connections.filter(c=>c.status==='pending'&&c.recipient_id===userId);
 const outgoing=connections.filter(c=>c.status==='pending'&&c.requester_id===userId);
 const existing=new Set(connections.map(c=>c.other_id));
 return <div className="atlas-friends">
  <button type="button" className="atlas-friends-open" onClick={()=>{setOpen(v=>!v);void reload();}}>Friends {incoming.length>0?`(${incoming.length} requests)`:''}</button>
  {open&&<section className="atlas-friends-panel" aria-label="Friends and permissions">
   <header><strong>Explorers' Circle</strong><button type="button" onClick={()=>setOpen(false)}>✕</button></header>
   <form onSubmit={search} className="atlas-friend-search"><label>Find a member by username</label><div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Username" maxLength={24}/><button type="submit">Search</button></div></form>
   {results.length>0&&<div className="atlas-friend-section"><h4>Search results</h4>{results.map(p=><div key={p.id} className="atlas-friend-person"><span><b>@{p.username}</b><small>{p.display_name}</small></span><button disabled={busy||existing.has(p.id)} onClick={()=>send(p.id)}>{existing.has(p.id)?'Connected / pending':'Add friend'}</button></div>)}</div>}
   {incoming.length>0&&<div className="atlas-friend-section"><h4>Requests awaiting you</h4>{incoming.map(c=><div key={c.other_id} className="atlas-friend-person"><b>@{c.username}</b><button disabled={busy} onClick={()=>accept(c)}>Accept</button><button disabled={busy} onClick={()=>unfriend(c)}>Decline</button></div>)}</div>}
   {outgoing.length>0&&<div className="atlas-friend-section"><h4>Requests sent</h4>{outgoing.map(c=><div key={c.other_id} className="atlas-friend-person"><span>@{c.username} · Pending</span><button disabled={busy} onClick={()=>unfriend(c)}>Cancel</button></div>)}</div>}
   <div className="atlas-friend-section"><h4>Friends ({friends.length})</h4>{friends.length===0&&<p>No friends yet. Search by username to invite someone.</p>}
    {friends.map(c=>{const out=grants.find(g=>g.owner_id===userId&&g.friend_id===c.other_id);const inbound=grants.find(g=>g.owner_id===c.other_id&&g.friend_id===userId);
     return <div key={c.other_id} className="atlas-friend-entry"><div className="atlas-friend-person"><span><b>@{c.username}</b> <span className={`atlas-presence-text ${onlineIds.has(c.other_id)?'is-online':'is-offline'}`}>({onlineIds.has(c.other_id)?'Online':'Offline'})</span></span><button disabled={busy} onClick={()=>unfriend(c)}>Unfriend</button></div>
      <div className="atlas-friend-checks"><p>Allow this friend to change <b>my creations</b>:</p><label><input type="checkbox" checked={out?.can_edit||false} disabled={busy} onChange={e=>toggle(c,'can_edit',e.target.checked)}/> Edit</label><label><input type="checkbox" checked={out?.can_delete||false} disabled={busy} onChange={e=>toggle(c,'can_delete',e.target.checked)}/> Delete</label><small>Their permission for you: {inbound?.can_edit?'Edit ✓':'Edit ✗'} · {inbound?.can_delete?'Delete ✓':'Delete ✗'}</small></div>
     </div>;})}
   </div>
   {error&&<p className="atlas-friends-error" role="alert">{error}</p>}{message&&<p className="atlas-friends-message">{message}</p>}
   <footer>Permissions are individual. Unfriending immediately disables access in both directions.</footer>
  </section>}
 </div>;
}
