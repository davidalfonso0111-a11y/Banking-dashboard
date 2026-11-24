'use strict';
const SUPABASE_URL='https://kawmgixplawbuzxagrdp.supabase.co';
const SUPABASE_KEY='sb_publishable_gEwRETB_aOdqEo4BhfFESg_ZscvGZ60';
const APP_URL='https://davidalfonso0111-a11y.github.io/Banking-dashboard/';
const SESSION_KEY='banking.supabase.session';
let authSession=null,pendingProfileSession=null,localDemoOpen=false,refreshBusy=false,authEpoch=0;
const authScreen=document.getElementById('authScreen'),appHeader=document.getElementById('appHeader'),appMain=document.getElementById('appMain'),profileScreen=document.getElementById('profileScreen');
const authMessage=text=>document.getElementById('authStatus').textContent=text;
async function authRequest(path,body,token,method='POST'){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(SUPABASE_URL+'/auth/v1/'+path,{method,signal:controller.signal,headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.msg||result.error_description||result.message||'Aanmelden mislukt ('+response.status+').');
  return result;
 }finally{clearTimeout(timeout);}
}
function showAuthMode(register){
 document.getElementById('registrationForm').hidden=!register;document.getElementById('loginForm').hidden=register;
 document.getElementById('authTitle').textContent=register?'Maak je account aan':'Welkom terug';
 document.getElementById('authIntro').textContent=register?'Maak eenmalig je profiel aan voor jouw financiële overzicht.':'Log in voor je rekeningen, wallets en geldstromen.';
 document.getElementById('showRegistration').setAttribute('aria-pressed',String(register));document.getElementById('showLogin').setAttribute('aria-pressed',String(!register));
}
function lockDashboard(){
 authEpoch++;authSession=null;pendingProfileSession=null;localDemoOpen=false;storageKey=null;
 sessionStorage.removeItem(SESSION_KEY);data={accounts:[],tx:[]};closeMenu();
 document.getElementById('confirmationScreen').hidden=true;profileScreen.hidden=true;appHeader.hidden=true;appMain.hidden=true;authScreen.hidden=false;render();
}
function showConfirmation(success,message){
 authScreen.hidden=true;appHeader.hidden=true;appMain.hidden=true;profileScreen.hidden=true;
 document.getElementById('confirmationScreen').hidden=false;
 document.getElementById('confirmationIcon').textContent=success?'✓':'!';
 document.getElementById('confirmationTitle').textContent=success?'Registratie voltooid':'Bevestigen niet gelukt';
 document.getElementById('confirmationMessage').textContent=message;
 document.getElementById('confirmationContinue').hidden=!success;document.getElementById('confirmationLogin').hidden=success;
 document.getElementById('confirmationTitle').focus();
}
async function enterDashboard(session){
 const epoch=authEpoch;
 if(!session?.access_token||!session?.refresh_token)throw new Error('Geen geldige sessie ontvangen.');
 const user=await authRequest('user',undefined,session.access_token,'GET');
 if(epoch!==authEpoch)return false;
 if(!user.email_confirmed_at)throw new Error('Bevestig eerst je e-mailadres.');
 sessionStorage.setItem(SESSION_KEY,JSON.stringify({refresh_token:session.refresh_token}));
 const profile=user.user_metadata||{};
 if(!profile.first_name||!profile.last_name||!profile.country){
  pendingProfileSession=session;authScreen.hidden=true;appHeader.hidden=true;appMain.hidden=true;document.getElementById('confirmationScreen').hidden=true;profileScreen.hidden=false;
  document.getElementById('profileFirst').value=profile.first_name||profile.given_name||'';
  document.getElementById('profileLast').value=profile.last_name||profile.family_name||'';
  document.getElementById('profileCountry').value=profile.country||'';document.getElementById('profileFirst').focus();return false;
 }
 authSession={...session,user};pendingProfileSession=null;profileScreen.hidden=true;storageKey='dashboardData:user:'+user.id;
 try{data=JSON.parse(localStorage.getItem(storageKey)||'{"accounts":[],"tx":[]}');}catch{data={accounts:[],tx:[]};}
 if(!validBackup(data))data={accounts:[],tx:[]};
 document.getElementById('sessionLabel').textContent='Ingelogd: '+user.email;
 document.getElementById('confirmationScreen').hidden=true;localDemoOpen=true;authScreen.hidden=true;appHeader.hidden=false;appMain.hidden=false;render();showPage('overzicht');
 if(data.accounts.some(isCrypto))syncAll();return true;
}
async function withAuthForm(form,action){
 const button=form.querySelector('button[type="submit"]');button.disabled=true;authMessage('Even wachten…');
 try{await action();}catch(err){authMessage(err.name==='AbortError'?'Verbinding duurt te lang. Probeer opnieuw.':err.message);}finally{button.disabled=false;}
}
document.getElementById('showRegistration').addEventListener('click',()=>showAuthMode(true));
document.getElementById('showLogin').addEventListener('click',()=>showAuthMode(false));
document.getElementById('registrationForm').addEventListener('submit',e=>{
 e.preventDefault();withAuthForm(e.target,async()=>{
  const f=new FormData(e.target),first=String(f.get('first_name')).trim(),last=String(f.get('last_name')).trim();
  if(f.get('password')!==f.get('password_confirm'))throw new Error('De wachtwoorden komen niet overeen.');
  if(!first||!last)throw new Error('Vul je voornaam en achternaam in.');
  const result=await authRequest('signup?redirect_to='+encodeURIComponent(APP_URL),{email:String(f.get('email')).trim(),password:f.get('password'),data:{first_name:first,last_name:last,country:f.get('country')}});
  e.target.reset();if(result.access_token)await enterDashboard(result);else{showAuthMode(false);authMessage('Als registratie mogelijk is, ontvang je een bevestigingsmail. Controleer ook je spammap.');}
 });
});
document.getElementById('loginForm').addEventListener('submit',e=>{e.preventDefault();withAuthForm(e.target,async()=>{const f=new FormData(e.target);await enterDashboard(await authRequest('token?grant_type=password',{email:String(f.get('email')).trim(),password:f.get('password')}));e.target.reset();});});
document.querySelectorAll('[data-provider]').forEach(button=>button.addEventListener('click',()=>{
 const url=new URL(SUPABASE_URL+'/auth/v1/authorize');url.searchParams.set('provider',button.dataset.provider);url.searchParams.set('redirect_to',APP_URL);authMessage('Doorsturen naar de aanmeldprovider…');location.assign(url.href);
}));
document.getElementById('resendConfirmation').addEventListener('click',async e=>{
 const input=document.getElementById('loginEmail');if(!input.reportValidity())return;e.target.disabled=true;
 try{await authRequest('resend',{type:'signup',email:input.value.trim(),options:{emailRedirectTo:APP_URL}});authMessage('Als je account nog bevestigd moet worden, ontvang je een nieuwe mail.');}catch(err){authMessage(err.message);}finally{e.target.disabled=false;}
});
document.getElementById('profileForm').addEventListener('submit',async e=>{
 e.preventDefault();const button=e.target.querySelector('[type="submit"]'),status=document.getElementById('profileStatus');button.disabled=true;
 try{const f=new FormData(e.target),first=String(f.get('first_name')).trim(),last=String(f.get('last_name')).trim();if(!first||!last||!pendingProfileSession)throw new Error('Vul je profiel in of meld je opnieuw aan.');const session=pendingProfileSession;await authRequest('user',{data:{first_name:first,last_name:last,country:f.get('country')}},session.access_token,'PUT');await enterDashboard(session);}catch(err){status.textContent=err.message;}finally{button.disabled=false;}
});
document.getElementById('profileCancel').addEventListener('click',()=>{lockDashboard();showAuthMode(false);});
document.getElementById('confirmationContinue').addEventListener('click',async e=>{
 e.target.disabled=true;try{if(!authSession?.refresh_token)throw new Error('Log opnieuw in.');await enterDashboard(await authRequest('token?grant_type=refresh_token',{refresh_token:authSession.refresh_token}));}catch(err){lockDashboard();showAuthMode(false);authMessage(err.message);}finally{e.target.disabled=false;}
});
document.getElementById('confirmationLogin').addEventListener('click',()=>{lockDashboard();showAuthMode(false);authMessage('Log in of vraag een nieuwe bevestigingsmail aan.');});
document.getElementById('closeLocalDemo').addEventListener('click',async()=>{
 const token=authSession?.access_token;lockDashboard();showAuthMode(false);authMessage('Uitgelogd.');
 if(token)try{await authRequest('logout',undefined,token);}catch{authMessage('Lokaal uitgelogd. De server kon niet worden bereikt.');}
});
async function restoreSession(){
 const fragment=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
 const callback=fragment.has('access_token')||fragment.has('error_description')||query.has('error_description');
 try{
  if(callback){const clean=new URL(location.href);clean.hash='';['error','error_code','error_description'].forEach(key=>clean.searchParams.delete(key));history.replaceState(null,'',clean.pathname+clean.search);const error=fragment.get('error_description')||query.get('error_description');if(error)throw new Error(error);
   authMessage('Aanmelding controleren…');const entered=await enterDashboard({access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token')});
   if(entered&&fragment.get('type')==='signup')showConfirmation(true,'Je e-mailadres is bevestigd en je profiel is compleet. Je kunt nu je dashboard openen.');return;
  }
  const stored=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(stored?.refresh_token)await enterDashboard(await authRequest('token?grant_type=refresh_token',{refresh_token:stored.refresh_token}));
 }catch(err){lockDashboard();showAuthMode(false);if(callback)showConfirmation(false,'Deze link is verlopen, al gebruikt of de verbinding is mislukt. '+err.message);else authMessage('Meld je opnieuw aan: '+err.message);}
}
restoreSession();
setInterval(async()=>{
 if(!localDemoOpen||!authSession||refreshBusy)return;refreshBusy=true;const epoch=authEpoch;
 try{const session=await authRequest('token?grant_type=refresh_token',{refresh_token:authSession.refresh_token});if(epoch!==authEpoch||!localDemoOpen)return;authSession={...session,user:authSession.user};sessionStorage.setItem(SESSION_KEY,JSON.stringify({refresh_token:session.refresh_token}));syncAll();}
 catch{if(epoch===authEpoch){lockDashboard();showAuthMode(false);authMessage('Sessie verlopen. Meld je opnieuw aan.');}}finally{refreshBusy=false;}
},SYNC_MS);
