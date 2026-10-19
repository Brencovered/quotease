/* Shared price list for the planners: the business's own material_items, matched to takeoff lines and picked by hand. */
(function(){
'use strict';
let ITEMS=[];
const STOP=new Set(['and','with','or','the','per','each','for','of','mm','a','to','in','lm','sqm','m2','supply','install','incl','including','x','m','ea','lot','set','kit','new','pack','box']);
const norm=s=>String(s||'').toLowerCase().replace(/×/g,'x').replace(/[^a-z0-9.\s]/g,' ').replace(/\s+/g,' ').trim();
const toks=s=>norm(s).split(' ').filter(t=>t.length>=2&&!STOP.has(t));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money=v=>'$'+(+v||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2});
/* Which of a business's trades a takeoff section draws on first. */
const SEC_TRADES={build:['carpenter','builder'],floor:['concreter','builder'],roof:['roofer'],line:['plasterer','carpenter'],finish:['tiler','flooring','carpenter'],elec:['electrician'],plumb:['plumber'],paint:['painter'],outdoor:['carpenter','landscaper','concreter','builder'],frame:['carpenter','builder'],clad:['roofer','carpenter'],slab:['concreter'],doors:['carpenter','builder']};
/* The unit a price list item is sold in, read from its name ("per sqm", "per LM", "per m3"). */
function unitOf(label){const l=String(label||'').toLowerCase();if(/(per|\/)\s*(sqm|sq\.?\s?m|m2|m²|square met)/.test(l)||/\(per sqm\)/.test(l))return 'm²';if(/(per|\/)\s*(m3|m³|cubic)/.test(l))return 'm³';if(/(per|\/)\s*(lm|l\.m\.|lin(eal|ear)? ?m|metre|meter|m\b)/.test(l))return 'm';return 'ea';}
/* Measured lines (m, m², m³) only take items sold the same way; counted lines (each, packs, bags) take items sold each. */
function baseUnit(u){return /^(m|m²|m³)$/.test(u)?u:'ea';}
function set(list){injectCss();ITEMS=(Array.isArray(list)?list:[]).map(x=>({id:String(x.id||x.label||''),n:String(x.label||''),l:norm(x.label),t:String(x.trade||''),s:String(x.supplier||''),p:+x.unit_cost||0,u:unitOf(x.label)})).filter(x=>x.n&&x.p>0&&!/^\[coming soon\]/i.test(x.n));ITEMS.forEach(x=>{x.tk=new Set(toks(x.n));});}
function has(){return ITEMS.length>0;}
function byId(id){return id?ITEMS.find(x=>x.id===id)||null:null;}
function tradesFor(sec){return SEC_TRADES[sec]||[];}
/* Score every item against the line's own match phrases and words; take the best clear match. */
function match(row){if(!ITEMS.length)return null;const phrases=(row.match||[]).map(norm).filter(Boolean);const words=[...new Set(toks([row.item,row.size].join(' ')))];const pref=tradesFor(row.sec);
  // the line's head noun ("jamb" in "External door jamb set") must be in the item unless one of the line's own phrases matched
  const stem=w=>w.replace(/(es|s)$/,'');const head=toks(row.item).filter(w=>/[a-z]/.test(w)&&!/^(cm|mm|kg|l|m2|m3)$/.test(w)&&!/^\d/.test(w)).map(stem).pop();
  const units=new Set([baseUnit(row.unit)].concat(Object.keys(row.alt||{})));let best=null,bs=0;ITEMS.forEach(it=>{if(!units.has(it.u))return;let s=0,ph=false;phrases.forEach((p,i)=>{if(it.l.includes(p)){s=Math.max(s,12-i);ph=true;}});if(!ph&&head&&![...it.tk].some(t=>stem(t)===head))return;let ov=0;words.forEach(w=>{if(it.tk.has(w))ov++;});s+=ov*2;if(pref.includes(it.t))s+=4;
    if(s>bs||(s===bs&&best&&it.n.length<best.n.length)){bs=s;best=it;}});
  return bs>=8?best:null;}
/* ---------- picker ---------- */
let css=false;
function injectCss(){if(css)return;css=true;const st=document.createElement('style');st.textContent=`.pbov{position:fixed;inset:0;background:rgba(15,20,25,.45);z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:6vh 12px 12px;}
.pbm{background:var(--panel,#fff);color:var(--text,#1f2a33);border-radius:14px;width:min(560px,100%);max-height:84vh;display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.3);overflow:hidden;}
.pbm header{padding:14px 16px 8px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--line,#ddd);}
.pbm header b{font-size:15px;}.pbm header small{color:var(--muted,#667);font-size:12.5px;}
.pbm input{border:1px solid var(--line,#ccc);border-radius:8px;padding:9px 11px;font-size:14px;background:var(--field,#fff);color:inherit;width:100%;box-sizing:border-box;}
.pbm .pbtr{display:flex;gap:6px;flex-wrap:wrap;}
.pbm ul{list-style:none;margin:0;padding:6px;overflow:auto;}
.pbm li button{display:grid;grid-template-columns:1fr auto;gap:2px 10px;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:8px;cursor:pointer;color:inherit;font:inherit;}
.pbm li button:hover,.pbm li button:focus{background:color-mix(in srgb,var(--accent,#f2b705) 18%,transparent);outline:none;}
.pbm li .pn{font-weight:600;font-size:13.5px;}.pbm li .pp{font-weight:700;font-variant-numeric:tabular-nums;font-size:13.5px;}
.pbm li .ps{grid-column:1/-1;color:var(--muted,#667);font-size:12px;}
.pbm footer{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:10px 14px;border-top:1px solid var(--line,#ddd);flex-wrap:wrap;}
.pbm .pbempty{padding:18px;color:var(--muted,#667);font-size:13px;}
.pbm .chip.on{background:var(--chip-on,#1f2a33);color:var(--chip-on-ink,#fff);}
.pbl{display:flex;justify-content:space-between;align-items:baseline;gap:8px;width:100%;margin-top:5px;border:1px solid color-mix(in srgb,var(--ok,#1a7f37) 35%,var(--line,#ddd));background:color-mix(in srgb,var(--ok,#1a7f37) 7%,transparent);border-radius:6px;padding:4px 8px;font:inherit;font-size:12px;text-align:left;cursor:pointer;color:var(--text,#1f2a33);}
.pbl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
.pbl em{font-style:normal;color:var(--ok,#1a7f37);font-weight:700;white-space:nowrap;}
.pbl.none{border-style:dashed;border-color:var(--line,#ccc);background:none;color:var(--muted,#667);justify-content:flex-start;}
.pbnote a{color:inherit;font-weight:700;}
.mrow{grid-template-columns:minmax(0,1fr) auto;}.mi{min-width:0;}.mi small.badc{display:block;color:var(--bad,#b3261e);}`;document.head.appendChild(st);}
/* opts: {title, query, sec, current, allowClear, onPick(item|null)} */
function pick(opts){injectCss();opts=opts||{};const pref=tradesFor(opts.sec);const trades=[...new Set(ITEMS.map(x=>x.t).filter(Boolean))].sort((a,b)=>(pref.includes(b)?1:0)-(pref.includes(a)?1:0)||a.localeCompare(b));
  let trade=pref.find(t=>trades.includes(t))||'';
  const ov=document.createElement('div');ov.className='pbov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Pick from your price list');
  ov.innerHTML=`<div class="pbm"><header><b>${esc(opts.title||'Pick from your price list')}</b><small>Your own material prices. Search by name or supplier.</small><input type="search" placeholder="Search your price list" value="${esc(opts.query||'')}" aria-label="Search your price list"><div class="pbtr"><button class="chip" data-tr="">All trades</button>${trades.map(t=>`<button class="chip" data-tr="${esc(t)}">${esc(t[0].toUpperCase()+t.slice(1))}</button>`).join('')}</div></header><ul></ul><footer><span>${opts.allowClear?'<button class="btn" data-clear="1">Not in my list</button>':''}</span><span><a class="btn" href="/settings/materials" target="_top" style="text-decoration:none">Edit my price list</a> <button class="primary" data-close="1">Close</button></span></footer></div>`;
  document.body.appendChild(ov);const inp=ov.querySelector('input');const ul=ov.querySelector('ul');
  const render=()=>{ov.querySelectorAll('[data-tr]').forEach(b=>b.classList.toggle('on',b.dataset.tr===trade));const q=toks(inp.value);
    let list=ITEMS.filter(it=>(!trade||it.t===trade)&&q.every(w=>it.l.includes(w)||norm(it.s).includes(w)));
    if(q.length)list.sort((a,b)=>a.n.length-b.n.length);else list.sort((a,b)=>a.n.localeCompare(b.n));
    const more=list.length>80;list=list.slice(0,80);
    ul.innerHTML=list.length?list.map(it=>`<li><button data-id="${esc(it.id)}"${opts.current===it.id?' aria-current="true"':''}><span class="pn">${esc(it.n)}${opts.current===it.id?' ✓':''}</span><span class="pp">${money(it.p)}</span><span class="ps">${esc([it.t&&it.t[0].toUpperCase()+it.t.slice(1),it.s].filter(Boolean).join(' · '))}</span></button></li>`).join('')+(more?'<li class="pbempty">Showing the first 80. Type more to narrow it down.</li>':''):`<li class="pbempty">${ITEMS.length?'Nothing matches. Try fewer words, or All trades.':'Your price list is empty. Add your materials and prices, and they price these lines automatically.'}</li>`;};
  const close=()=>{ov.remove();document.removeEventListener('keydown',onKey);};
  const onKey=e=>{if(e.key==='Escape')close();};document.addEventListener('keydown',onKey);
  ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-close]')){close();return;}const tb=e.target.closest('[data-tr]');if(tb){trade=tb.dataset.tr;render();return;}
    if(e.target.closest('[data-clear]')){close();if(opts.onPick)opts.onPick(null);return;}const b=e.target.closest('[data-id]');if(b){const it=byId(b.dataset.id);close();if(it&&opts.onPick)opts.onPick(it);}});
  inp.addEventListener('input',render);render();setTimeout(()=>{inp.focus();inp.select();},30);}
window.SSPB={set,has,byId,match,pick,tradesFor,money,unitOf,baseUnit};
})();
