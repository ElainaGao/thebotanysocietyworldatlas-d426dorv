import {useEffect,useState} from 'react';
import {supabase} from './supabase';

type Credit={creator_username:string;editor_username:string;was_edited:boolean};
export default function CreatorCredit({kind,id,revision=0}:{kind:string;id:string;revision?:number}){
 const [credit,setCredit]=useState<Credit|null>(null);
 useEffect(()=>{
  let active=true;
  setCredit(null);
  void supabase.rpc('atlas_record_credit',{record_kind:kind,record_id:id}).then(({data,error})=>{
   if(!active)return;
   if(!error&&Array.isArray(data)&&data.length)setCredit(data[0] as Credit);
  });
  return ()=>{active=false;};
 },[kind,id,revision]);
 if(!credit)return null;
 return <p style={{fontSize:12,color:'#73634c',margin:'5px 0 10px',fontStyle:'italic'}}>
  Created by @{credit.creator_username}
  {credit.was_edited&&<> · Last edited by @{credit.editor_username}</>}
 </p>;
}
