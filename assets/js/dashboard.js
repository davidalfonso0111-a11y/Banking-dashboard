'use strict';
const CATEGORIEEN = {
  'Boodschappen':['albert heijn','jumbo','lidl','aldi','picnic','plus'],
  'Wonen':['huur','hypotheek','energie','vattenfall','eneco','water','gemeente'],
  'Vervoer':['ns','shell','esso','tankstation','uber','ov','parkeer'],
  'Abonnementen':['netflix','spotify','disney','icloud','google one','adobe'],
  'Horeca & uit':['restaurant','cafe','café','bar','mcdonald','thuisbezorgd','uber eats'],
  'Zorg':['apotheek','tandarts','huisarts','zorg'], 'Salaris':['salaris','loon'], 'Overig':[]
};
const COINGECKO_IDS={BTC:'bitcoin',ETH:'ethereum',SOL:'solana',BNB:'binancecoin'};
const ETH_RPC='https://ethereum-rpc.publicnode.com';
const SYNC_MS=5*60*1000;
const neoSidebar=document.getElementById('neoSidebar');
neoSidebar.addEventListener('click',e=>{const button=e.target.closest('[data-nav]');if(button)showPage(button.dataset.nav);});
function syncNeoShell(){const open=!document.getElementById('appMain').hidden;neoSidebar.hidden=!open;document.body.classList.toggle('nb-app-open',open);}
new MutationObserver(syncNeoShell).observe(document.getElementById('appMain'),{attributes:true,attributeFilter:['hidden']});
syncNeoShell();
let currentPage='overzicht';
const pageTitles={overzicht:'Overzicht',rekeningen:'Rekeningen',wallets:'Wallets & crypto',transacties:'Uitgaven & inkomsten',instellingen:'Instellingen & back-up',documentatie:'Documentatie'};
const menuToggle=document.getElementById('menuToggle');
const dashboardMenu=document.getElementById('dashboardMenu');
function closeMenu(returnFocus=false){dashboardMenu.hidden=true;menuToggle.setAttribute('aria-expanded','false');menuToggle.setAttribute('aria-label','Navigatie openen');if(returnFocus)menuToggle.focus();}
menuToggle.addEventListener('click',()=>{const open=dashboardMenu.hidden;dashboardMenu.hidden=!open;menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Navigatie sluiten':'Navigatie openen');});
document.addEventListener('click',e=>{if(!e.target.closest('.navigation'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dashboardMenu.hidden)closeMenu(true);});
function showPage(page){
 if(!pageTitles[page])return;currentPage=page;
 document.querySelectorAll('[data-page]').forEach(el=>{el.hidden=!el.dataset.page.split(' ').includes(page);});
 const heading=document.getElementById('pageHeading');heading.textContent=pageTitles[page];
 document.querySelectorAll('[data-nav]').forEach(button=>{if(button.dataset.nav===page)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 if(page==='rekeningen'||page==='wallets'){
  const wallet=page==='wallets';document.getElementById('accountsHeading').textContent=pageTitles[page];
  [...accType.options].forEach(option=>{const cryptoType=['crypto','wallet'].includes(option.value);option.disabled=cryptoType!==wallet;option.hidden=option.disabled;});
  if(accType.selectedOptions[0].disabled)accType.value=wallet?'wallet':'bank';
  accType.dispatchEvent(new Event('change'));
  document.querySelectorAll('[data-wallet-only]').forEach(el=>{el.hidden=!wallet;});
  document.getElementById('status').hidden=!wallet;renderAccounts();
 }
 closeMenu();heading.focus();
}
dashboardMenu.addEventListener('click',e=>{const button=e.target.closest('[data-nav]');if(button)showPage(button.dataset.nav);});
let storageKey=null;
let data={accounts:[],tx:[]};
const save=()=>{if(storageKey)localStorage.setItem(storageKey,JSON.stringify(data));};
const systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){const preference=['light','dark','system'].includes(data.preferences?.theme)?data.preferences.theme:'light';const theme=preference==='system'?(systemTheme.matches?'dark':'light'):preference;document.documentElement.dataset.theme=theme;document.body.dataset.theme=theme;document.getElementById('themePreference').value=preference;}
document.getElementById('themePreference').addEventListener('change',e=>{data.preferences={...data.preferences,theme:e.target.value};save();applyTheme();});
systemTheme.addEventListener('change',applyTheme);applyTheme();
const eur=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n);
const isCrypto=a=>a.type==='crypto'||a.type==='wallet';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Math.round((n+Number.EPSILON)*100)/100;
const newId=()=>Math.max(Date.now(),...data.accounts.map(a=>a.id+1),...data.tx.map(t=>t.id+1));
function refreshAccountOptions(){const accounts=data.accounts.filter(a=>!isCrypto(a));for(const id of ['txAccount','txToAccount']){const el=document.getElementById(id),previous=el.value;el.replaceChildren(new Option(accounts.length?'Kies een rekening':'Voeg eerst een bank- of spaarrekening toe',''));accounts.forEach(a=>el.add(new Option(a.naam,String(a.id))));if(accounts.some(a=>String(a.id)===previous))el.value=previous;}}
const catSelect=document.getElementById('cat');
Object.keys(CATEGORIEEN).forEach(c=>catSelect.add(new Option(c,c)));
document.getElementById('txSoort').addEventListener('change',()=>{const transfer=document.getElementById('txSoort').value==='transfer';const target=document.getElementById('txToAccount');target.style.display=transfer?'':'none';target.required=transfer;catSelect.style.display=transfer?'none':'';});
function autoCat(omschr,soort){if(soort==='transfer')return 'Overig';const t=omschr.toLowerCase();for(const [cat,woorden]of Object.entries(CATEGORIEEN)){if(woorden.some(w=>t.includes(w)))return cat;}return 'Overig';}
document.getElementById('omschr').addEventListener('input',e=>{catSelect.value=autoCat(e.target.value,document.querySelector('#txForm [name=soort]').value);});
document.getElementById('datum').valueAsDate=new Date();
document.getElementById('maandFilter').value=new Date().toISOString().slice(0,7);
const accType=document.querySelector('#accForm [name=type]');
accType.addEventListener('change',()=>{const t=accType.value,crypto=t==='crypto',wallet=t==='wallet';document.getElementById('accCoin').style.display=crypto?'':'none';document.getElementById('accQty').style.display=crypto?'':'none';document.getElementById('accAdres').style.display=wallet?'':'none';document.getElementById('accSaldo').style.display=(crypto||wallet)?'none':'';});
document.getElementById('accForm').addEventListener('submit',e=>{
 e.preventDefault();if(!storageKey)return;const f=new FormData(e.target);
 if(f.get('type')==='wallet'){
  const adres=(f.get('adres')||'').trim();if(!/^0x[a-fA-F0-9]{40}$/.test(adres)){alert('Ongeldig EVM-adres. Gebruik 0x gevolgd door 40 hexadecimale tekens.');return;}
  data.accounts.push({id:newId(),naam:f.get('naam'),type:'wallet',adres,coin:'ETH',qty:0,prijs:0});save();e.target.reset();accType.dispatchEvent(new Event('change'));render();syncAll(true);return;
 }
 const acc={id:newId(),naam:f.get('naam'),type:f.get('type')};
 if(acc.type==='crypto'){acc.coin=(f.get('coin')||'').toUpperCase();acc.qty=parseFloat(f.get('hoeveelheid'))||0;acc.prijs=COINGECKO_IDS[acc.coin]?0:(parseFloat(prompt(`Huidige prijs van 1 ${acc.coin} in €?`))||0);if(!acc.coin||acc.qty<0||acc.prijs<0){alert('Vul een coin en niet-negatieve hoeveelheid en koers in.');return;}}
 else acc.saldo=parseFloat(f.get('saldo'))||0;
 data.accounts.push(acc);save();e.target.reset();accType.dispatchEvent(new Event('change'));render();if(COINGECKO_IDS[acc.coin])syncAll(true);
});
function accWaarde(a){return isCrypto(a)?a.qty*a.prijs:a.saldo;}
function renderAccounts(){
 refreshAccountOptions();const tb=document.getElementById('accList');const visibleAccounts=data.accounts.filter(a=>currentPage==='wallets'?isCrypto(a):currentPage==='rekeningen'?!isCrypto(a):true);
 tb.innerHTML=visibleAccounts.map(a=>`<tr><td>${esc(a.naam)}</td><td><span class="tag">${esc(a.type)}${a.coin?' · '+esc(a.coin):''}${a.type==='wallet'?' · '+esc(a.adres.slice(0,6))+'…'+esc(a.adres.slice(-4)):''}</span></td><td>${eur(accWaarde(a))}${isCrypto(a)?`<div class="note">${a.qty} × ${eur(a.prijs)}${COINGECKO_IDS[a.coin]?' (auto)':''}</div>`:''}</td><td class="row-actions">${a.type==='wallet'?'':`<button class="secondary" onclick="updateAcc(${a.id})">Bijwerken</button>`}<button class="danger" aria-label="Rekening verwijderen" onclick="delAcc(${a.id})">×</button></td></tr>`).join('')||'<tr><td colspan="4" class="note">Nog geen rekeningen toegevoegd.</td></tr>';
}
function updateAcc(id){const a=data.accounts.find(x=>x.id===id);if(!a||!storageKey)return;if(isCrypto(a)){const q=prompt(`Nieuwe hoeveelheid ${a.coin}?`,a.qty);if(q!==null){const value=Number(q);if(!Number.isFinite(value)||value<0)return;a.qty=value;}if(!COINGECKO_IDS[a.coin]){const p=prompt(`Nieuwe prijs per ${a.coin} in €?`,a.prijs);if(p!==null){const value=Number(p);if(!Number.isFinite(value)||value<0)return;a.prijs=value;}}}else{const s=prompt('Nieuw saldo in €?',a.saldo);if(s!==null){const value=Number(s);if(!Number.isFinite(value))return;a.saldo=value;}}save();render();}
function delAcc(id){if(!storageKey)return;if(data.tx.some(t=>t.accountId===id||t.toAccountId===id)){alert('Deze rekening heeft gekoppelde transacties. Verwijder die eerst (dat draait hun saldo-effect terug), of bewaar de rekening voor je historie.');return;}if(confirm('Rekening verwijderen?')){data.accounts=data.accounts.filter(a=>a.id!==id);save();render();}}
function setStatus(t){document.getElementById('status').textContent=t;}
let syncRunning=false;
async function syncAll(manual){
 if(!storageKey||syncRunning)return;
 const cryptos=data.accounts.filter(isCrypto);if(!cryptos.length){setStatus('Geen crypto-posities om te synchroniseren.');return;}
 const startKey=storageKey,snapshot=data;syncRunning=true;setStatus('Synchroniseren…');
 try{
  const ids=[...new Set(cryptos.map(a=>COINGECKO_IDS[a.coin]).filter(Boolean))];
  if(ids.length){const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=eur`);if(!r.ok)throw new Error('CoinGecko HTTP '+r.status);const p=await r.json();cryptos.forEach(a=>{const id=COINGECKO_IDS[a.coin];if(id&&Number.isFinite(p[id]?.eur))a.prijs=p[id].eur;});}
  for(const a of snapshot.accounts.filter(x=>x.type==='wallet')){const r=await fetch(ETH_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getBalance',params:[a.adres,'latest']})});if(!r.ok)throw new Error('RPC HTTP '+r.status);const j=await r.json();if(!j.result)throw new Error('Geen saldo ontvangen');a.qty=Number(BigInt(j.result))/1e18;}
  if(storageKey!==startKey||data!==snapshot)return;save();render();setStatus('Laatst gesynchroniseerd: '+new Date().toLocaleTimeString('nl-NL'));
 }catch(err){if(storageKey===startKey&&data===snapshot)setStatus('Sync mislukt: '+err.message+(manual?'':' (volgende poging over 5 min)'));}
 finally{syncRunning=false;}
}
document.getElementById('txForm').addEventListener('submit',e=>{
 e.preventDefault();if(!storageKey)return;const f=new FormData(e.target),amount=money(Number(f.get('bedrag')));
 const account=data.accounts.find(a=>a.id===Number(f.get('accountId'))&&!isCrypto(a));const transfer=f.get('soort')==='transfer';const target=transfer?data.accounts.find(a=>a.id===Number(f.get('toAccountId'))&&!isCrypto(a)):null;
 if(!account||!Number.isFinite(amount)||amount<=0){alert('Kies een rekening en een geldig positief bedrag.');return;}
 if(transfer&&(!target||target.id===account.id)){alert('Kies twee verschillende rekeningen.');return;}
 account.saldo=money(account.saldo+(f.get('soort')==='in'?amount:-amount));if(target)target.saldo=money(target.saldo+amount);
 data.tx.push({id:newId(),soort:f.get('soort'),bedrag:amount,omschrijving:f.get('omschrijving'),datum:f.get('datum'),categorie:transfer?'Overboeking':f.get('categorie'),accountId:account.id,...(target?{toAccountId:target.id}:{})});
 save();e.target.reset();document.getElementById('txSoort').dispatchEvent(new Event('change'));document.getElementById('datum').valueAsDate=new Date();render();
});
function delTx(id){const t=data.tx.find(t=>t.id===id);if(!storageKey||!t||!confirm('Transactie verwijderen? Het saldo-effect van een gekoppelde transactie wordt teruggedraaid.'))return;const account=data.accounts.find(a=>a.id===t.accountId);const target=data.accounts.find(a=>a.id===t.toAccountId);if(account)account.saldo=money(account.saldo+(t.soort==='in'?-t.bedrag:t.bedrag));if(target&&t.soort==='transfer')target.saldo=money(target.saldo-t.bedrag);data.tx=data.tx.filter(t=>t.id!==id);save();render();}
document.getElementById('maandFilter').addEventListener('change',render);
function renderTx(){const m=document.getElementById('maandFilter').value;const lijst=data.tx.filter(t=>!m||t.datum.startsWith(m)).sort((a,b)=>b.datum.localeCompare(a.datum));document.getElementById('txList').innerHTML=lijst.map(t=>`<tr><td>${esc(t.datum)}</td><td>${esc(t.omschrijving)}<div class="note">${esc(data.accounts.find(a=>a.id===t.accountId)?.naam||'Niet gekoppeld (bestaande transactie)')}${t.soort==='transfer'?' → '+esc(data.accounts.find(a=>a.id===t.toAccountId)?.naam||'Onbekend'):''}</div></td><td><span class="tag">${esc(t.categorie)}</span></td><td class="${t.soort==='transfer'?'':t.soort==='in'?'pos':'neg'}">${t.soort==='transfer'?'↔ ':t.soort==='in'?'+':'−'}${eur(t.bedrag)}</td><td class="row-actions"><button class="danger" aria-label="Transactie verwijderen" onclick="delTx(${t.id})">×</button></td></tr>`).join('')||'<tr><td colspan="5" class="note">Geen transacties in deze periode.</td></tr>';return lijst;}
function renderMainAccounts(){
 const groups=[{id:'overviewBankAccounts',accounts:data.accounts.filter(a=>a.type==='bank'),empty:'Nog geen zicht- of betaalrekeningen. Voeg bijvoorbeeld je ING-rekening toe via Rekeningen beheren.'},{id:'overviewSavingsAccounts',accounts:data.accounts.filter(a=>a.type==='spaar'),empty:'Nog geen spaarrekeningen toegevoegd.'},{id:'overviewWalletAccounts',accounts:data.accounts.filter(isCrypto),empty:'Nog geen wallets of crypto-posities toegevoegd.'}];
 for(const group of groups){const container=document.getElementById(group.id);container.replaceChildren();const accounts=[...group.accounts].sort((a,b)=>a.naam.localeCompare(b.naam,'nl',{sensitivity:'base',numeric:true}));if(!accounts.length){const empty=document.createElement('p');empty.className='note';empty.textContent=group.empty;container.append(empty);}
  for(const account of accounts){const row=document.createElement('div');row.className='overview-account';const info=document.createElement('div');info.className='overview-account-info';const name=document.createElement('strong');name.className='overview-account-name';name.textContent=account.naam;const note=document.createElement('div');note.className='note';if(!isCrypto(account))note.textContent=account.type==='spaar'?'Spaarrekening':'Zicht- / betaalrekening';else{note.textContent=`${account.qty} ${account.coin} · indicatieve waarde`;if(account.type==='wallet')note.textContent+=` · Ethereum: ${account.adres.slice(0,6)}…${account.adres.slice(-4)} · alleen ETH, geen tokens`;if(!account.prijs)note.textContent+=' · nog geen koers beschikbaar';}const value=document.createElement('div');value.className='overview-account-value';value.textContent=isCrypto(account)&&!account.prijs?'Koers ontbreekt':eur(accWaarde(account));const icon=document.createElement('span');icon.className='nb-account-icon';icon.setAttribute('aria-hidden','true');if(/\bing\b/i.test(account.naam)&&!isCrypto(account)){icon.classList.add('ing');icon.textContent='ING';}else icon.textContent=isCrypto(account)?'◇':account.type==='spaar'?'◴':'▣';const details=document.createElement('div');details.append(name,note);info.append(icon,details);row.append(info,value);container.append(row);}
 }
 const showWallets=data.preferences?.showWalletsOnOverview!==false;document.getElementById('showWalletsOnOverview').checked=showWallets;document.getElementById('overviewWalletSection').hidden=!showWallets;
}
document.getElementById('showWalletsOnOverview').addEventListener('change',e=>{data.preferences={...data.preferences,showWalletsOnOverview:e.target.checked};save();renderMainAccounts();});
function renderTotals(){const m=document.getElementById('maandFilter').value;const maand=data.tx.filter(t=>t.datum.startsWith(m));const inK=maand.filter(t=>t.soort==='in').reduce((s,t)=>s+t.bedrag,0);const uitK=maand.filter(t=>t.soort==='uit').reduce((s,t)=>s+t.bedrag,0);document.getElementById('inkMaand').textContent=eur(inK);document.getElementById('uitMaand').textContent=eur(uitK);const saldoEl=document.getElementById('saldoMaand');saldoEl.textContent=eur(inK-uitK);saldoEl.className='big '+(inK-uitK>=0?'pos':'neg');document.getElementById('totaal').textContent=eur(data.accounts.reduce((s,a)=>s+accWaarde(a),0));const perCat={};maand.filter(t=>t.soort==='uit').forEach(t=>perCat[t.categorie]=(perCat[t.categorie]||0)+t.bedrag);document.getElementById('catSum').innerHTML=Object.entries(perCat).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<tr><td>${esc(c)}</td><td style="text-align:right">${eur(v)}</td></tr>`).join('')||'<tr><td class="note">Geen uitgaven deze maand.</td></tr>';}
function exportCSV(){const lijst=renderTx();const rows=[['datum','omschrijving','categorie','soort','bedrag'],...lijst.map(t=>[t.datum,t.omschrijving,t.categorie,t.soort,t.bedrag])];const csv=rows.map(r=>r.map(v=>{let text=String(v);if(/^[=+@\-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}).join(';')).join('\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));Object.assign(document.createElement('a'),{href:url,download:'transacties.csv'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadJSON(object,name){const url=URL.createObjectURL(new Blob([JSON.stringify(object,null,2)],{type:'application/json'}));Object.assign(document.createElement('a'),{href:url,download:name}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportBackup(){downloadJSON({version:3,exportedAt:new Date().toISOString(),data},'dashboard-backup-'+new Date().toISOString().slice(0,10)+'.json');}
function validBackup(d){
 if(!d||!Array.isArray(d.accounts)||!Array.isArray(d.tx))return false;const ids=new Set();
 for(const a of d.accounts){if(!a||!Number.isSafeInteger(a.id)||a.id<0||ids.has(a.id)||typeof a.naam!=='string'||!['bank','spaar','crypto','wallet'].includes(a.type))return false;ids.add(a.id);if(isCrypto(a)){if(typeof a.coin!=='string'||!Number.isFinite(a.qty)||a.qty<0||!Number.isFinite(a.prijs)||a.prijs<0)return false;if(a.type==='wallet'&&!/^0x[a-fA-F0-9]{40}$/.test(a.adres))return false;}else if(!Number.isFinite(a.saldo))return false;}
 const txIds=new Set();for(const t of d.tx){if(!t||!Number.isSafeInteger(t.id)||t.id<0||txIds.has(t.id)||!['in','uit','transfer'].includes(t.soort)||!Number.isFinite(t.bedrag)||t.bedrag<=0||typeof t.omschrijving!=='string'||typeof t.categorie!=='string'||typeof t.datum!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(t.datum)||!Number.isFinite(Date.parse(t.datum)))return false;txIds.add(t.id);const linked=d.accounts.find(a=>a.id===t.accountId&&!isCrypto(a));if(t.accountId!==undefined&&!linked)return false;if(t.soort==='transfer'&&(!linked||t.toAccountId===t.accountId||!d.accounts.some(a=>a.id===t.toAccountId&&!isCrypto(a))))return false;if(t.soort!=='transfer'&&t.toAccountId!==undefined)return false;}return true;
}
document.getElementById('backupFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('Bestand is groter dan 10 MB.');const parsed=JSON.parse(await file.text());const restored=parsed.data||parsed;if(!validBackup(restored))throw new Error('Dit is geen geldige dashboard-back-up.');if(!confirm('Alle huidige gegevens vervangen? Download eerst een back-up als je die wilt bewaren.'))return;if(!storageKey)throw new Error('Log eerst in.');localStorage.setItem(storageKey,JSON.stringify(restored));data=restored;render();setStatus('Back-up hersteld. Saldi zijn overgenomen, niet opnieuw berekend.');}catch(err){alert('Herstellen mislukt: '+err.message);}finally{e.target.value='';}});
function render(){applyTheme();if(currentPage==='rekeningen'||currentPage==='wallets'){const allowed=currentPage==='wallets'?['wallet','crypto']:['bank','spaar'];if(!allowed.includes(accType.value))accType.value=allowed[0];accType.dispatchEvent(new Event('change'));}renderAccounts();renderTx();renderTotals();renderMainAccounts();}
render();
// End of complete dashboard module. Authentication is loaded afterwards in auth.js.
