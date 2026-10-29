import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import './SocialInbox.css';

type Connection={username:string;other_id:string;requester_id:string;recipient_id:string;status:string};
type DM={id:string;sender_id:string;recipient_id:string;body:string;created_at:string};
type Chat={id:string;user_id:string;display_name:string;body:string;created_at:string};
const time=(iso:string)=>new Date(iso).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
export default function SocialInbox({userId}:{userId:string}) {
 const [friends,setFriends]=useState<Connection[]>([]);
 const [pending,setPending]=useState<Connection[]>([]);
 const [messages,setMessages]=useState<DM[]>([]);
 const [selected,setSelected]=useState('');
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState('');
 const [error,setError]=useState('');
 const [sending,setSending]=useState(false);
 const [unreadChat,setUnreadChat]=useState(0);
 const [unreadRequests,setUnreadRequests]=useState(0);
 const [unreadDM,setUnreadDM]=useState(0);
 const chatBaseline=useRef<string | null>(null);
 const requestBaseline=useRef<Set<string>|null>(null);
 const openRef=useRef(false);
 const selectedRef=useRef('');
 openRef.current=open; selectedRef.current=selected;
 const chosen=friends.find(f=>f.other_id===selected);
 const lastChatKey=`atlas-seen-chat-${userId}`;
 const lastRequestKey=`atlas-seen-requests-${userId}`;
 const lastDMKey=`atlas-seen-dm-${userId}`;
 const refreshFriends=useCallback(async()=>{
   const {data,error:failure}=await supabase.rpc('list_atlas_connections');
   if(failure){setError(failure.message);return;}
   const cs=(data||[]) as Connection[];
   const accepted=cs.filter(c=>c.status==='accepted');
   const requests=cs.filter(c=>c.status==='pending'&&c.recipient_id===userId);
   setFriends(accepted);setPending(requests);
   const ids=new Set(requests.map(c=>`${c.requester_id}:${c.recipient_id}`));
   if(requestBaseline.current!==null){
    const newIds=[...ids].filter(id=>!requestBaseline.current!.has(id));
    if(newIds.length && !openRef.current) setUnreadRequests(n=>n+newIds.length);
   }
   requestBaseline.current=ids;
   if(selectedRef.current&&!accepted.some(c=>c.other_id===selectedRef.current)){
     setSelected('');setMessages([]);setUnreadDM(0);
   }
 },[userId]);
 const refreshDM=useCallback(async(peer:string)=>{
   const {data,error:failure}=await supabase.from('atlas_direct_messages')
    .select('id,sender_id,recipient_id,body,created_at')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${userId})`)
    .order('created_at',{ascending:false}).limit(100);
   if(failure){setError(`DM unavailable: ${failure.message}`);return;}
   setMessages(((data||[]) as DM[]).reverse());
 },[userId]);
 const checkAlerts=useCallback(async()=>{
  const [{data:chat,error:chatError},{data:dms,error:dmError}]=await Promise.all([
   supabase.from('atlas_chat').select('id,user_id,display_name,body,created_at').order('created_at',{ascending:false}).limit(50),
   supabase.from('atlas_direct_messages').select('id,sender_id,recipient_id,body,created_at').eq('recipient_id',userId).order('created_at',{ascending:false}).limit(100)
  ]);
  if(chatError){setError(chatError.message);return;}
  if(dmError){setError(dmError.message);return;}
  const ch=(chat||[]) as Chat[];
  const last=localStorage.getItem(lastChatKey)||new Date().toISOString();
  if(chatBaseline.current!==null){
    setUnreadChat(ch.filter(m=>m.user_id!==userId&&m.created_at>last).length);
  }
  chatBaseline.current=ch[0]?.id||'empty';
  const seenDM=localStorage.getItem(lastDMKey)||new Date().toISOString();
  setUnreadDM(((dms||[]) as DM[]).filter(m=>m.created_at>seenDM).length);
 },[userId,lastChatKey,lastDMKey]);
 useEffect(()=>{
  // Existing chat history is not treated as a flood of new notifications.
  if(!localStorage.getItem(lastChatKey))localStorage.setItem(lastChatKey,new Date().toISOString());
  if(!localStorage.getItem(lastDMKey))localStorage.setItem(lastDMKey,new Date().toISOString());
  void refreshFriends();void checkAlerts();
  const events=supabase.channel(`atlas-social-alerts-${userId}`)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'atlas_chat'},()=>void checkAlerts())
   .on('postgres_changes',{event:'*',schema:'public',table:'atlas_friendships'},()=>void refreshFriends())
   .on('postgres_changes',{event:'*',schema:'public',table:'atlas_direct_messages'},()=>{
     void checkAlerts();if(selectedRef.current)void refreshDM(selectedRef.current);
   }).subscribe();
  const periodic=window.setInterval(()=>{void refreshFriends();void checkAlerts();if(selectedRef.current)void refreshDM(selectedRef.current);},15000);
  const focus=()=>{void refreshFriends();void checkAlerts();};
  window.addEventListener('focus',focus);
  return ()=>{window.clearInterval(periodic);window.removeEventListener('focus',focus);void supabase.removeChannel(events);};
 },[userId,refreshFriends,checkAlerts,refreshDM,lastChatKey,lastDMKey]);
 useEffect(()=>{if(selected)void refreshDM(selected);else setMessages([]);},[selected,refreshDM]);
 function acknowledge(){
  setUnreadChat(0);setUnreadRequests(0);setUnreadDM(0);
  localStorage.setItem(lastChatKey,new Date().toISOString());
  localStorage.setItem(lastRequestKey,new Date().toISOString());
  localStorage.setItem(lastDMKey,new Date().toISOString());
 }
 async function send(e:FormEvent){
  e.preventDefault();const body=draft.trim();if(!chosen||!body||sending)return;
  setSending(true);setError('');
  const {error:failure}=await supabase.from('atlas_direct_messages').insert({sender_id:userId,recipient_id:chosen.other_id,body:body.slice(0,500)});
  if(failure)setError(failure.message);else{setDraft('');void refreshDM(chosen.other_id);}
  setSending(false);
 }
 return <div className="atlas-social-root">
  <button className="atlas-social-toggle" onClick={()=>{setOpen(v=>!v);if(!open)acknowledge();}} type="button">
   Inbox {(unreadChat+Math.max(unreadRequests,pending.length)+unreadDM)>0?`(${unreadChat+Math.max(unreadRequests,pending.length)+unreadDM})`:''}
  </button>
  {open&&<section className="atlas-social-panel" aria-label="Notifications and friend messages">
    <header><strong>Explorer's Postbox</strong><button type="button" onClick={()=>setOpen(false)}>Close</button></header>
    <div className="atlas-social-alerts">
     <p><b>Atlas chat:</b> {unreadChat>0?`${unreadChat} unread messages`:'No unread messages'} · Open the existing Atlas Chat to reply.</p>
     <p><b>Friend requests:</b> {pending.length>0?`${pending.length} awaiting approval — open Friends to respond.`:'No requests pending.'}</p>
     <p><b>Direct messages:</b> Private to accepted friends · newest 100 retained.</p>
    </div>
    <label>Conversation <select value={selected} onChange={e=>{setSelected(e.target.value);setUnreadDM(0);localStorage.setItem(lastDMKey,new Date().toISOString());}}>
     <option value="">Choose a friend</option>{friends.map(f=><option key={f.other_id} value={f.other_id}>@{f.username}</option>)}
    </select></label>
    {chosen?<><div className="atlas-social-messages" aria-live="polite">
      {messages.length===0&&<p>No letters exchanged yet.</p>}
      {messages.map(m=><article key={m.id} className={m.sender_id===userId?'is-mine':''}>
       <b>{m.sender_id===userId?'You':`@${chosen.username}`}</b> <small>{time(m.created_at)}</small><p>{m.body}</p>
      </article>)}
     </div><form onSubmit={send}><textarea aria-label="Direct message" maxLength={500} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a private message…"/><button disabled={!draft.trim()||sending} type="submit">Send message</button></form></>:<p className="atlas-social-empty">Add and accept a friend request to exchange private messages.</p>}
    {error&&<p className="atlas-social-error" role="alert">{error}</p>}
    <footer>Unfriending removes the conversation from both accounts. Unfriending creates no alert.</footer>
   </section>}
 </div>;
}
