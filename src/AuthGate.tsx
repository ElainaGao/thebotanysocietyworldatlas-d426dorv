import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import { supabase } from './supabase';
import './AuthGate.css';
import LiveCommunity from './LiveCommunity';
import FriendsPanel from './FriendsPanel';

type Mode = 'signin' | 'signup';

export default function AuthGate() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState('Explorer');
  const [cursorColor, setCursorColor] = useState('#678c70');
  const [editingProfile, setEditingProfile] = useState(false);
  const [username,setUsername] = useState<string|null>(null);
  const [usernameDraft,setUsernameDraft] = useState('');

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session?.user.id) {
      setEditingProfile(false);
      setUsername(null);
      return () => { active = false; };
    }
    supabase.from('profiles').select('display_name,cursor_color,username').eq('id', session.user.id).maybeSingle()
      .then(({ data, error: profileError }) => {
        if (!active) return;
        if (profileError) { setError(profileError.message); return; }
        if (data) {
          setProfileName(data.display_name || 'Explorer');
          setCursorColor(data.cursor_color || '#678c70');
          setUsername(data.username || '');
        } else setUsername('');
      });
    return () => { active = false; };
  }, [session?.user.id]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        setMessage(data.session
          ? 'Account created. Welcome to the Atlas!'
          : 'Check your email for a confirmation link, then return here to sign in.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete the request.');
    } finally { setBusy(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setBusy(true); setError(''); setMessage('');
    const { error: updateError } = await supabase.from('profiles').update({
      display_name: profileName.trim().slice(0, 60) || 'Explorer',
      cursor_color: cursorColor,
    }).eq('id', session.user.id);
    if (updateError) setError(updateError.message);
    else { setEditingProfile(false); setMessage('Profile saved.'); }
    setBusy(false);
  }

  async function claimUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const chosen=usernameDraft.trim();
    if(!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(chosen)){
      setError('Username must be 3–24 characters, start with a letter, and contain only letters, numbers or underscores.');return;
    }
    setBusy(true);setError('');
    const {error:failure}=await supabase.from('profiles').update({username:chosen}).eq('id',session.user.id).is('username',null);
    if(failure){
      setError(failure.code==='23505'?'That username is already taken. Choose another.':failure.message);
    }else{
      const {data}=await supabase.from('profiles').select('username').eq('id',session.user.id).single();
      if(data?.username)setUsername(data.username);
      else setError('Unable to claim username. Please try again.');
    }
    setBusy(false);
  }

  async function signOut() {
    setBusy(true); setError('');
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    setBusy(false);
  }

  if (loading) return <div className="atlas-auth-screen"><p>Opening the explorers' register…</p></div>;

  if (!session) {
    return (
      <main className="atlas-auth-screen">
        <section className="atlas-auth-card">
          <div className="atlas-auth-topline">THE BOTANY SOCIETY · MEMBERS' ARCHIVE</div>
          <h1>World Atlas</h1>
          <p className="atlas-auth-intro">A world of imagined landscapes, ecology, and living discoveries.</p>
          <div className="atlas-auth-switch">
            <button type="button" className={mode === 'signin' ? 'current' : ''} onClick={() => {setMode('signin'); setError(''); setMessage('');}}>Sign In</button>
            <button type="button" className={mode === 'signup' ? 'current' : ''} onClick={() => {setMode('signup'); setError(''); setMessage('');}}>Create Account</button>
          </div>
          <form onSubmit={submitAuth} className="atlas-auth-form">
            <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
            <label>Password<input type="password" minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required value={password} onChange={e => setPassword(e.target.value)}/></label>
            <button disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signin' ? 'Enter the Atlas' : 'Register as an Explorer'}</button>
          </form>
          {error && <p role="alert" className="atlas-auth-error">{error}</p>}
          {message && <p role="status" className="atlas-auth-message">{message}</p>}
          <p className="atlas-auth-footnote">Members only · Atlas geography is shared; personal notes remain private on this device.</p>
        </section>
      </main>
    );
  }

  if(username===null)return <div className="atlas-auth-screen"><p>Loading your explorer profile…</p></div>;
  if(!username)return <main className="atlas-auth-screen"><section className="atlas-auth-card">
    <div className="atlas-auth-topline">THE BOTANY SOCIETY · EXPLORER IDENTITY</div>
    <h1>Choose your username</h1>
    <p>Your unique @username lets other explorers find and add you. It cannot be changed after claiming it. Your display name can still change.</p>
    <form onSubmit={claimUsername} className="atlas-auth-form">
      <label>Unique username<input required minLength={3} maxLength={24} autoComplete="off" placeholder="ForestExplorer" value={usernameDraft} onChange={e=>setUsernameDraft(e.target.value)}/></label>
      <button type="submit" disabled={busy}>{busy?'Checking…':'Claim username & enter atlas'}</button>
    </form>
    {error&&<p role="alert" className="atlas-auth-error">{error}</p>}
    <button type="button" disabled={busy} onClick={signOut}>Sign out</button>
  </section></main>;
  return (
    <>
      <header className="atlas-member-bar">
        <span className="atlas-member-identity"><span className="atlas-member-dot" style={{ background: cursorColor }} /> {profileName} <span className="atlas-member-caption">· @{username}</span></span>
        <div className="atlas-member-actions" data-friends-header="true">
          <FriendsPanel userId={session.user.id} />
          <button type="button" onClick={() => {setEditingProfile(v => !v); setMessage('');}}>My Profile</button>
          <button type="button" disabled={busy} onClick={signOut}>Sign Out</button>
        </div>
      </header>
      {editingProfile && (
        <section className="atlas-profile-editor">
          <form onSubmit={saveProfile}>
            <label>Display name<input maxLength={60} required value={profileName} onChange={e => setProfileName(e.target.value)}/></label>
            <label>Cursor color <input type="color" value={cursorColor} onChange={e => setCursorColor(e.target.value)}/></label>
            <button type="submit" disabled={busy}>Save Profile</button>
            <button type="button" onClick={() => setEditingProfile(false)}>Cancel</button>
          </form>
        </section>
      )}
      {error && <p role="alert" className="atlas-auth-banner">{error}</p>}
      {message && <p role="status" className="atlas-auth-banner">{message}</p>}
      <App />
      <LiveCommunity userId={session.user.id} name={profileName} color={cursorColor} />
    </>
  );
}
