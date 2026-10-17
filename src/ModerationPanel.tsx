import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import './ModerationPanel.css';

type Moderator = {user_id:string;username:string;display_name:string;is_founder:boolean;enabled:boolean};
type Explorer = {id:string;username:string;display_name:string;cursor_color:string};

export default function ModerationPanel({ userId }: { userId: string }) {
  const [roster,setRoster]=useState<Moderator[]>([]);
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [found,setFound]=useState<Explorer[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [isModerator,setIsModerator]=useState<boolean|null>(null);
  const me=roster.find(m=>m.user_id===userId);

  const refresh=useCallback(async()=>{
    setReady(false);
    // Start with a direct, RLS-protected lookup of the signed-in member.
    // If the public RPC is temporarily missing or fails, founder/moderator
    // controls must not disappear without an explanation.
    const own = await supabase.from('atlas_moderators')
      .select('user_id,is_founder,enabled')
      .eq('user_id',userId).maybeSingle();
    if (own.error) {
      setIsModerator(null);
      setError(`Unable to verify moderation access: ${own.error.message}`);
      setReady(true);
      return;
    }
    if (!own.data) {
      setIsModerator(false);
      setRoster([]);
      setError('');
      setReady(true);
      return;
    }
    setIsModerator(true);
    const result=await supabase.rpc('atlas_moderator_roster');
    if(result.error){
      // Show the button and diagnostic instead of silently returning null.
      setError(`Could not load moderator list: ${result.error.message}`);
      setRoster([{user_id:userId,username:'You',display_name:'',
        is_founder:Boolean(own.data.is_founder),enabled:Boolean(own.data.enabled)}]);
    }else{
      setError('');
      const list=(result.data||[]) as Moderator[];
      setRoster(list.some(m=>m.user_id===userId)?list:[...list,{
        user_id:userId,username:'You',display_name:'',
        is_founder:Boolean(own.data.is_founder),enabled:Boolean(own.data.enabled)}]);
    }
    setReady(true);
  },[userId]);
  useEffect(()=>{
    void refresh();
    const channel=supabase.channel(`moderators-panel-${userId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'atlas_moderators'},()=>{void refresh();})
      .subscribe();
    // Re-check after a role is revoked, including when Realtime is unavailable.
    const onFocus = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30000);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  },[refresh,userId]);

  async function toggle(){
    if(!me)return;
    setBusy(true);setError('');
    const {error:failure}=await supabase.rpc('atlas_set_moderation_enabled',{desired:!me.enabled});
    if(failure)setError(failure.message);
    await refresh();setBusy(false);
  }
  async function search(){
    setBusy(true);setError('');
    const {data,error:failure}=await supabase.rpc('find_atlas_explorers',{search_name:query.trim()});
    if(failure)setError(failure.message);
    setFound((data||[]) as Explorer[]);setBusy(false);
  }
  async function assign(id:string,username:string,enable:boolean){
    if(!me?.enabled)return;
    const question=enable?`Appoint @${username} as a moderator? They will be able to edit/delete any shared creation and appoint/remove ordinary moderators.`:`Remove moderator status from @${username}?`;
    if(!window.confirm(question))return;
    setBusy(true);setError('');
    const {error:failure}=await supabase.rpc('atlas_assign_moderator',{target:id,make_moderator:enable});
    if(failure)setError(failure.message);
    else setFound([]);
    await refresh();setBusy(false);
  }
  // Ordinary members have no moderation controls or diagnostic badges.
  if (ready && isModerator === false) return null;
  // Only display a verification problem for an account whose role could not be checked.
  if (!ready || !me) return <div className="atlas-mod-root">
    <button type="button" className="atlas-mod-trigger" onClick={()=>{void refresh();}}>
      {error ? 'Moderation · Retry' : 'Moderation · Loading…'}
    </button>
    {error && <span className="atlas-mod-error" role="alert">{error}</span>}
  </div>;
  return <div className="atlas-mod-root">
    <button type="button" className="atlas-mod-trigger" onClick={()=>setOpen(v=>!v)}>Moderation{me.is_founder?' · Founder':''}</button>
    {error && !open && <span className="atlas-mod-error" role="alert">{error}</span>}
    {open&&<section className="atlas-mod-panel" aria-label="Atlas moderation panel">
      <header><strong>Atlas Moderation</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Close moderation panel">×</button></header>
      <p>{me.is_founder?'Protected founder account':'Appointed moderator'} · <strong>{me.enabled?'Moderation ON':'Moderation OFF'}</strong></p>
      <label className="atlas-mod-toggle"><input type="checkbox" checked={me.enabled} onChange={()=>{void toggle();}} disabled={busy}/> Enable my moderation powers</label>
      <p className="atlas-mod-explain">When enabled, you may edit or delete shared map creations without friendship permission. The original creator stays recorded. Turning this off does not remove your moderator appointment.</p>
      <h4>Current moderators</h4>
      {roster.map(m=><div key={m.user_id} className="atlas-mod-person">
        <span>@{m.username} {m.is_founder?'(Founder)':m.enabled?'(On)':'(Off)'}</span>
        {!m.is_founder && m.user_id!==userId && me.enabled&&<button disabled={busy} type="button" onClick={()=>{void assign(m.user_id,m.username,false);}}>Remove role</button>}
      </div>)}
      <h4>Appoint a member</h4>
      <form className="atlas-mod-search" onSubmit={e=>{e.preventDefault();void search();}}>
        <input aria-label="Search username" placeholder="Search @username" value={query} onChange={e=>setQuery(e.target.value.replace(/^@/,''))} required minLength={2}/>
        <button disabled={busy||!me.enabled} type="submit">Search</button>
      </form>
      {found.filter(p=>!roster.some(m=>m.user_id===p.id)).map(p=><div key={p.id} className="atlas-mod-person">
        <span>@{p.username} <small>{p.display_name}</small></span>
        <button disabled={busy||!me.enabled} type="button" onClick={()=>{void assign(p.id,p.username,true);}}>Make moderator</button>
      </div>)}
      {error&&<p role="alert" className="atlas-mod-error">{error}</p>}
      <footer>Moderation controls affect shared atlas objects, not private journals. Other moderators cannot remove the founder.</footer>
    </section>}
  </div>;
}
