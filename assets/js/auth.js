'use strict';
const SUPABASE_URL='https://kawmgixplawbuzxagrdp.supabase.co';
const SUPABASE_KEY='sb_publishable_gEwRETB_aOdqEo4BhfFESg_ZscvGZ60';
const APP_URL='https://davidalfonso0111-a11y.github.io/Banking-dashboard/';
const SESSION_KEY='banking.supabase.session';
let authSession=null,pendingProfileSession=null,localDemoOpen=false,refreshBusy=false,authEpoch=0;
const authScreen=document.getElementById('authScreen'),appHeader=document.getElementById('appHeader'),appMain=document.getElementById('appMain'),profileScreen=document.getElementById('profileScreen');
const authMessage=text=>document.getElementById('authStatus').textContent=text;
// Add contact fields to the existing split-file interface before attaching handlers.
function addContactFields(form,prefix){
 const fields=[['Address','address_line','Straat en huisnummer *','address-line1','text',200],['PostalCode','postal_code','Postcode *','postal-code','text',20],['City','city','Gemeente / stad *','address-level2','text',100],['Phone','phone_number','Telefoonnummer met landcode *','tel','tel',30]];
 const anchor=form.querySelector('[name="email"]')?.previousElementSibling||form.querySelector('[type="submit"]');
 for(const [suffix,name,title,autocomplete,type,max] of fields){
  if(form.querySelector('[name="'+name+'"]'))continue;
  const label=document.createElement('label'),input=document.createElement('input');
  input.id=prefix+suffix;input.name=name;input.type=type;input.autocomplete=autocomplete;input.required=true;input.maxLength=max;
  label.htmlFor=input.id;label.textContent=title;if(type==='tel')input.placeholder='Bijv. +32470123456';
  form.insertBefore(label,anchor);form.insertBefore(input,anchor);
 }
}
addContactFields(document.getElementById('registrationForm'),'register');addContactFields(document.getElementById('profileForm'),'profile');
function contactFromForm(f){
 const address_line=String(f.get('address_line')||'').trim(),postal_code=String(f.get('postal_code')||'').trim(),city=String(f.get('city')||'').trim(),phone_number=String(f.get('phone_number')||'').replace(/[\s().-]/g,'');
 if(!address_line||!postal_code||!city)throw new Error('Vul je straat, huisnummer, postcode en gemeente in.');
 if(!/^\+[1-9]\d{6,14}$/.test(phone_number))throw new Error('Gebruik een telefoonnummer met landcode, bijvoorbeeld +32470123456.');
 return {address_line,postal_code,city,phone_number};
}
function profileData(f){
 const first_name=String(f.get('first_name')||'').trim(),last_name=String(f.get('last_name')||'').trim(),country=String(f.get('country')||'');
 if(!first_name||!last_name||!country)throw new Error('Vul je naam en land in.');
 return {first_name,last_name,country,...contactFromForm(f)};
}
async function authRequest(path,body,token,method='POST'){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(SUPABASE_URL+'/auth/v1/'+path,{method,signal:controller.signal,headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.msg||result.error_description||result.message||'Aanmelden mislukt ('+response.status+').');return result;
 }finally{clearTimeout(timeout);}
}
function showAuthMode(register){
 document.getElementById('registrationForm').hidden=!register;document.getElementById('loginForm').hidden=register;
 document.getElementById('authTitle').textContent=register?'Maak je account aan':'Welkom terug';document.getElementById('authIntro').textContent=register?'Maak eenmalig je profiel aan voor jouw financiële overzicht.':'Log in voor je rekeningen, wallets en geldstromen.';
 document.getElementById('showRegistration').setAttribute('aria-pressed',String(register));document.getElementById('showLogin').setAttribute('aria-pressed',String(!register));
}
function lockDashboard(){
 authEpoch++;authSession=null;pendingProfileSession=null;localDemoOpen=false;storageKey=null;sessionStorage.removeItem(SESSION_KEY);data={accounts:[],tx:[]};closeMenu();
 document.getElementById('confirmationScreen').hidden=true;profileScreen.hidden=true;appHeader.hidden=true;appMain.hidden=true;authScreen.hidden=false;render();
}
function showConfirmation(success,message){
 authScreen.hidden=true;appHeader.hidden=true;appMain.hidden=true;profileScreen.hidden=true;document.getElementById('confirmationScreen').hidden=false;
 document.getElementById('confirmationIcon').textContent=success?'✓':'!';document.getElementById('confirmationTitle').textContent=success?'Registratie voltooid':'Bevestigen niet gelukt';document.getElementById('confirmationMessage').textContent=message;
 document.getElementById('confirmationContinue').hidden=!success;document.getElementById('confirmationLogin').hidden=success;document.getElementById('confirmationTitle').focus();
}
async function enterDashboard(session){
 const epoch=authEpoch;if(!session?.access_token||!session?.refresh_token)throw new Error('Geen geldige sessie ontvangen.');
 const user=await authRequest('user',undefined,session.access_token,'GET');if(epoch!==authEpoch)return false;if(!user.email_confirmed_at)throw new Error('Bevestig eerst je e-mailadres.');
 sessionStorage.setItem(SESSION_KEY,JSON.stringify({refresh_token:session.refresh_token}));const profile=user.user_metadata||{};
 if(!profile.first_name||!profile.last_name||!profile.country||!profile.address_line||!profile.postal_code||!profile.city||!/^\+[1-9]\d{6,14}$/.test(profile.phone_number||'')){
  pendingProfileSession=session;authScreen.hidden=true;appHeader.hidden=true;appMain.hidden=true;document.getElementById('confirmationScreen').hidden=true;profileScreen.hidden=false;
  document.getElementById('profileFirst').value=profile.first_name||profile.given_name||'';document.getElementById('profileLast').value=profile.last_name||profile.family_name||'';document.getElementById('profileCountry').value=profile.country||'';
  for(const name of ['address_line','postal_code','city','phone_number'])document.getElementById('profileForm').elements.namedItem(name).value=profile[name]||'';
  document.getElementById('profileFirst').focus();return false;
 }
 authSession={...session,user};pendingProfileSession=null;profileScreen.hidden=true;storageKey='dashboardData:user:'+user.id;
 try{data=JSON.parse(localStorage.getItem(storageKey)||'{"accounts":[],"tx":[]}');}catch{data={accounts:[],tx:[]};}if(!validBackup(data))data={accounts:[],tx:[]};
 document.getElementById('sessionLabel').textContent='Ingelogd: '+user.email;document.getElementById('confirmationScreen').hidden=true;localDemoOpen=true;authScreen.hidden=true;appHeader.hidden=false;appMain.hidden=false;render();showPage('overzicht');if(data.accounts.some(isCrypto))syncAll();return true;
}
async function withAuthForm(form,action){
 const button=form.querySelector('button[type="submit"]');button.disabled=true;authMessage('Even wachten…');try{await action();}catch(err){authMessage(err.name==='AbortError'?'Verbinding duurt te lang. Probeer opnieuw.':err.message);}finally{button.disabled=false;}
}
document.getElementById('showRegistration').addEventListener('click',()=>showAuthMode(true));document.getElementById('showLogin').addEventListener('click',()=>showAuthMode(false));
document.getElementById('registrationForm').addEventListener('submit',e=>{
 e.preventDefault();withAuthForm(e.target,async()=>{
  const f=new FormData(e.target);if(f.get('password')!==f.get('password_confirm'))throw new Error('De wachtwoorden komen niet overeen.');
  const result=await authRequest('signup?redirect_to='+encodeURIComponent(APP_URL),{email:String(f.get('email')).trim(),password:f.get('password'),data:profileData(f)});
  e.target.reset();if(result.access_token)await enterDashboard(result);else{showAuthMode(false);authMessage('Als registratie mogelijk is, ontvang je een bevestigingsmail. Controleer ook je spammap.');}
 });
});
document.getElementById('loginForm').addEventListener('submit',e=>{e.preventDefault();withAuthForm(e.target,async()=>{const f=new FormData(e.target);await enterDashboard(await authRequest('token?grant_type=password',{email:String(f.get('email')).trim(),password:f.get('password')}));e.target.reset();});});
document.querySelectorAll('[data-provider]').forEach(button=>button.addEventListener('click',()=>{const url=new URL(SUPABASE_URL+'/auth/v1/authorize');url.searchParams.set('provider',button.dataset.provider);url.searchParams.set('redirect_to',APP_URL);authMessage('Doorsturen naar de aanmeldprovider…');location.assign(url.href);}));
document.getElementById('resendConfirmation').addEventListener('click',async e=>{
 const input=document.getElementById('loginEmail');if(!input.reportValidity())return;e.target.disabled=true;
 try{await authRequest('resend?redirect_to='+encodeURIComponent(APP_URL),{type:'signup',email:input.value.trim()});authMessage('Als je account nog bevestigd moet worden, ontvang je een nieuwe mail.');}catch(err){authMessage(err.message);}finally{e.target.disabled=false;}
});
document.getElementById('profileForm').addEventListener('submit',async e=>{
 e.preventDefault();const button=e.target.querySelector('[type="submit"]'),status=document.getElementById('profileStatus');button.disabled=true;
 try{if(!pendingProfileSession)throw new Error('Meld je opnieuw aan.');const session=pendingProfileSession;await authRequest('user',{data:profileData(new FormData(e.target))},session.access_token,'PUT');await enterDashboard(session);}catch(err){status.textContent=err.message;}finally{button.disabled=false;}
});
document.getElementById('profileCancel').addEventListener('click',()=>{lockDashboard();showAuthMode(false);});
document.getElementById('confirmationContinue').addEventListener('click',async e=>{e.target.disabled=true;try{if(!authSession?.refresh_token)throw new Error('Log opnieuw in.');await enterDashboard(await authRequest('token?grant_type=refresh_token',{refresh_token:authSession.refresh_token}));}catch(err){lockDashboard();showAuthMode(false);authMessage(err.message);}finally{e.target.disabled=false;}});
document.getElementById('confirmationLogin').addEventListener('click',()=>{lockDashboard();showAuthMode(false);authMessage('Log in of vraag een nieuwe bevestigingsmail aan.');});
document.getElementById('closeLocalDemo').addEventListener('click',async()=>{const token=authSession?.access_token;lockDashboard();showAuthMode(false);authMessage('Uitgelogd.');if(token)try{await authRequest('logout',undefined,token);}catch{authMessage('Lokaal uitgelogd. De server kon niet worden bereikt.');}});
async function restoreSession(){
 const fragment=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search),callback=fragment.has('access_token')||fragment.has('error_description')||query.has('error_description');
 try{
  if(callback){const clean=new URL(location.href);clean.hash='';['error','error_code','error_description'].forEach(key=>clean.searchParams.delete(key));history.replaceState(null,'',clean.pathname+clean.search);const error=fragment.get('error_description')||query.get('error_description');if(error)throw new Error(error);
   authMessage('Aanmelding controleren…');const entered=await enterDashboard({access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token')});if(entered&&fragment.get('type')==='signup')showConfirmation(true,'Je e-mailadres is bevestigd en je profiel is compleet. Je kunt nu je dashboard openen.');return;
  }
  const stored=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(stored?.refresh_token)await enterDashboard(await authRequest('token?grant_type=refresh_token',{refresh_token:stored.refresh_token}));
 }catch(err){lockDashboard();showAuthMode(false);if(callback)showConfirmation(false,'Bevestiging niet voltooid. Probeer in te loggen of vraag een nieuwe bevestigingsmail aan. '+err.message);else authMessage('Meld je opnieuw aan: '+err.message);}
}
// Wallet UI is created here so existing index.html does not need replacing.
(()=>{
 if(document.getElementById('sendCryptoForm'))return;
 const section=document.createElement('section');section.className='card';section.dataset.page='wallets';section.hidden=true;
 section.innerHTML='<h2>Crypto versturen</h2><p class="note">Alleen ETH op Ethereum Mainnet. Je browserwallet beheert je sleutels en vraagt afzonderlijk goedkeuring. Gebruik geen seed phrase of private key.</p><button type="button" id="connectSendWallet">Browserwallet verbinden</button><p id="sendWalletStatus" class="note" role="status" aria-live="polite">Nog geen wallet verbonden.</p><form id="sendCryptoForm"><label for="sendRecipient">Ontvangstadres</label><input id="sendRecipient" placeholder="0x…" maxlength="42" autocomplete="off" spellcheck="false" required><label for="sendAmount">Bedrag in ETH</label><input id="sendAmount" inputmode="decimal" placeholder="Bijv. 0,01" autocomplete="off" required><button id="sendCryptoButton" type="submit" disabled>Controleren en openen in wallet</button></form><p class="note">Netwerkkosten komen bovenop het bedrag. Betalingen zijn doorgaans onomkeerbaar. Nog geen tokens, andere netwerken of WalletConnect voor een losse mobiele app. Een ingediende transactie is niet automatisch bevestigd.</p>';
 appMain.append(section);
 let provider=null,address=null,busy=false,version=0;
 const connect=document.getElementById('connectSendWallet'),send=document.getElementById('sendCryptoButton'),status=document.getElementById('sendWalletStatus'),form=document.getElementById('sendCryptoForm');
 function reset(message){version++;address=null;send.disabled=true;status.textContent=message;}
 connect.addEventListener('click',async()=>{
  if(busy||appMain.hidden||!authSession)return;busy=true;connect.disabled=true;const epoch=authEpoch;
  try{
   const p=window.ethereum;if(!p?.request)throw new Error('Geen browserwallet gevonden. Gebruik een compatibele extensie of walletbrowser.');
   if(provider!==p){provider=p;if(p.on){p.on('accountsChanged',()=>reset('Account gewijzigd. Verbind opnieuw.'));p.on('chainChanged',()=>reset('Netwerk gewijzigd. Verbind opnieuw op Ethereum Mainnet.'));p.on('disconnect',()=>reset('Walletverbinding verbroken.'));}}
   const attempt=version,accounts=await p.request({method:'eth_requestAccounts'}),chain=await p.request({method:'eth_chainId'});
   if(epoch!==authEpoch||appMain.hidden||attempt!==version)throw new Error('Verbinding gewijzigd. Probeer opnieuw.');
   if(chain!=='0x1')throw new Error('Selecteer Ethereum Mainnet in je wallet.');if(!/^0x[a-fA-F0-9]{40}$/.test(accounts?.[0]||''))throw new Error('Geen geldig walletaccount ontvangen.');
   address=accounts[0];send.disabled=false;status.textContent='Verbonden: '+address+' · Ethereum Mainnet';
  }catch(err){reset(err.message||'Verbinden mislukt.');}finally{busy=false;connect.disabled=false;}
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||appMain.hidden||!authSession)return;busy=true;send.disabled=true;connect.disabled=true;const epoch=authEpoch,attempt=version,from=address;
  try{
   if(!provider||!from)throw new Error('Verbind eerst je wallet.');const to=document.getElementById('sendRecipient').value.trim(),amount=document.getElementById('sendAmount').value.trim().replace(',','.');
   if(!/^0x[a-fA-F0-9]{40}$/.test(to)||/^0x0{40}$/i.test(to))throw new Error('Gebruik een geldig Ethereum-adres, niet het nuladres. ENS wordt niet ondersteund.');
   if(amount.length>80||!/^\d+(?:\.\d{1,18})?$/.test(amount))throw new Error('Gebruik een positief bedrag met maximaal 18 decimalen.');
   const [whole,fraction='']=amount.split('.'),wei=BigInt(whole)*10n**18n+BigInt(fraction.padEnd(18,'0'));if(wei<=0n)throw new Error('Bedrag moet groter dan nul zijn.');
   const chain=await provider.request({method:'eth_chainId'}),accounts=await provider.request({method:'eth_accounts'});
   if(epoch!==authEpoch||appMain.hidden||attempt!==version||chain!=='0x1'||accounts?.[0]?.toLowerCase()!==from.toLowerCase())throw new Error('Account, netwerk of sessie gewijzigd. Verbind opnieuw.');
   if(!confirm('Controleer je betaling:\n\nEthereum Mainnet\nVan: '+from+'\nNaar: '+to+'\nBedrag: '+amount+' ETH\n\nNetwerkkosten komen daar bovenop. Controleer alle gegevens opnieuw in je wallet. Doorgaan?')){status.textContent='Geannuleerd. Geen betaalverzoek verstuurd.';return;}
   status.textContent='Controleer het betaalverzoek in je wallet. Je kunt het goedkeuren of afwijzen.';
   const hash=await provider.request({method:'eth_sendTransaction',params:[{from,to,value:'0x'+wei.toString(16)}]});
   if(epoch===authEpoch&&!appMain.hidden){status.textContent='Transactie ingediend, nog niet bevestigd. Hash: '+String(hash)+'. Controleer je wallet voor de status.';form.reset();}
  }catch(err){if(epoch===authEpoch&&!appMain.hidden)status.textContent=err.code===4001?'Verzoek afgewezen in je wallet.':'Niet voltooid: '+(err.message||'Onbekende fout. Controleer je wallet voordat je opnieuw probeert.');}
  finally{busy=false;connect.disabled=false;send.disabled=!address||appMain.hidden;}
 });
 new MutationObserver(()=>{if(appMain.hidden)reset('Verbind je wallet opnieuw na inloggen.');}).observe(appMain,{attributes:true,attributeFilter:['hidden']});
})();
restoreSession();
setInterval(async()=>{
 if(refreshBusy)return;const previous=authSession||pendingProfileSession;if(!previous?.refresh_token)return;refreshBusy=true;const epoch=authEpoch;
 try{const session=await authRequest('token?grant_type=refresh_token',{refresh_token:previous.refresh_token});if(epoch!==authEpoch)return;sessionStorage.setItem(SESSION_KEY,JSON.stringify({refresh_token:session.refresh_token}));if(pendingProfileSession)pendingProfileSession=session;else{authSession={...session,user:previous.user};if(localDemoOpen)syncAll();}}
 catch{if(epoch===authEpoch){lockDashboard();showAuthMode(false);authMessage('Je sessie kon niet worden vernieuwd. Log opnieuw in.');}}finally{refreshBusy=false;}
},4*60*1000);
