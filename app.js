'use strict';
/* ===== HabitFlow: данные → логика → интерфейс ===== */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* --- Слой хранения (позже можно заменить на сервер) --- */
const KEY='habitflow.v1';
const Store={
  load(){try{const d=JSON.parse(localStorage.getItem(KEY));return d&&d.v===1?d:null}catch(e){return null}},
  save(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true}catch(e){return false}},
  clear(){try{localStorage.removeItem(KEY)}catch(e){}}
};
const blank=()=>({v:1,habits:[],tasks:[],log:{},awarded:{},xp:0,ach:{},set:{name:'',rOn:false,rTime:'20:00',rIds:[]},lastRem:''});
let S=(()=>{const b=blank(),d=Store.load()||{};const s={...b,...d,set:{...b.set,...(d.set||{})}};
  ['habits','tasks'].forEach(k=>{if(!Array.isArray(s[k]))s[k]=[]});['log','awarded','ach'].forEach(k=>{if(!s[k]||typeof s[k]!=='object')s[k]={}});
  if(typeof s.xp!=='number')s.xp=0;return s})();
const save=()=>{if(!Store.save(S))toast('Не удалось сохранить: хранилище браузера недоступно','err')};

/* --- Даты (неделя с понедельника) --- */
const pad=n=>String(n).padStart(2,'0'),uid=()=>Math.random().toString(36).slice(2,9);
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>ymd(new Date());
const parse=s=>{const[a,b,c]=s.split('-').map(Number);return new Date(a,b-1,c)};
const addD=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r};
const wd=d=>(d.getDay()+6)%7;
const wkStart=ds=>{const d=parse(ds);return ymd(addD(d,-wd(d)))};
const DN=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

/* --- Справочники --- */
const TYPES={daily:'Каждый день',days:'По дням недели',weekly:'Недельная цель',measure:'Измеримая'};
const CATS=['Здоровье','Спорт','Учёба','Работа','Дом','Разум','Другое'];
const COLORS=['#4f7a5e','#7a9e7e','#b8843f','#5f87a3','#9a6f8f','#c0584c'];
const PRI={1:'Низкий',2:'Средний',3:'Высокий'};
const IC={today:'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
habits:'M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3',
tasks:'M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9',
calendar:'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
stats:'M4 20V10M10 20V4M16 20v-8M22 20H2',
awards:'M12 15a6 6 0 100-12 6 6 0 000 12zM8.2 13.9L7 22l5-3 5 3-1.2-8.1',
settings:'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
check:'M5 12l5 5 9-10',plus:'M12 5v14M5 12h14',edit:'M4 20h4L19 9l-4-4L4 16v4z',flame:'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
clock:'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z',trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',left:'M15 6l-6 6 6 6',right:'M9 6l6 6-6 6',lock:'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3'};
const ic=k=>`<svg class="i" viewBox="0 0 24 24"><path d="${IC[k]}"/></svg>`;
const NAV=[['today','Сегодня'],['habits','Привычки'],['tasks','Задачи'],['calendar','Календарь'],['stats','Статистика'],['awards','Награды'],['settings','Настройки']];

/* --- Бизнес-логика --- */
// Версия расписания на дату: при редактировании старые настройки сохраняются в h.hist, история не переписывается.
const sc=(h,ds)=>(h.hist||[]).find(e=>ds<=e.until)||h;
const val=(h,ds)=>+S.log[h.id+'|'+ds]||0;
const done=(h,ds)=>sc(h,ds).type==='measure'?val(h,ds)>=sc(h,ds).target:val(h,ds)>0;
const due=(h,ds)=>{if(h.archived||ds<h.created)return false;const s=sc(h,ds);return s.type==='days'?s.days.includes(wd(parse(ds))):true};
const weekCount=(h,ds)=>{const w=parse(wkStart(ds));let n=0;for(let i=0;i<7;i++)if(done(h,ymd(addD(w,i))))n++;return n};
// В знаменатель дня попадает только то, что запланировано на эту дату (недельная цель — пока не выполнена).
const scheduled=(h,ds)=>{if(h.archived||ds<h.created)return false;return sc(h,ds).type==='weekly'?(weekCount(h,ds)<sc(h,ds).goal||done(h,ds)):due(h,ds)};
/* ПРАВИЛА XP: привычка +10 при достижении цели дня; задача +15; достижение +20 (разово).
   Повторное нажатие XP не даёт (awarded[ключ]); отмена возвращает ровно начисленное; пропуск XP не отнимает. */
function sync(k,isDone,xp){if(isDone&&!S.awarded[k]){S.awarded[k]=xp;S.xp+=xp}else if(!isDone&&S.awarded[k]){S.xp=Math.max(0,S.xp-S.awarded[k]);delete S.awarded[k]}}
function setVal(h,ds,v){const k=h.id+'|'+ds;if(v>0)S.log[k]=v;else delete S.log[k];sync(k,done(h,ds),10)}
const toggleH=(h,ds)=>setVal(h,ds,val(h,ds)>0?0:1);
const lvlOf=xp=>Math.floor(Math.sqrt(xp/50))+1;
// Серии: обычные — по запланированным дням (сегодняшний день не рвёт серию, пока не закончился); недельные — по неделям.
function streaks(h){const t=today();let run=0,best=0;
  if(h.type==='weekly'||(h.hist||[]).some(e=>e.type==='weekly')){const cw=wkStart(t);for(let w=parse(wkStart(h.created));ymd(w)<=cw;w=addD(w,7)){const ds=ymd(w);if(weekCount(h,ds)>=sc(h,ds).goal){run++;best=Math.max(best,run)}else if(ds!==cw)run=0}return{cur:run,best}}
  for(let d=parse(h.created);ymd(d)<=t;d=addD(d,1)){const ds=ymd(d);if(!due(h,ds)&&!h.archived)continue;if(done(h,ds)){run++;best=Math.max(best,run)}else if(ds!==t)run=0}return{cur:run,best}}
function rate(a,b){let tot=0,dn=0;for(let d=parse(a);ymd(d)<=b;d=addD(d,1)){const ds=ymd(d);for(const h of S.habits)if(scheduled(h,ds)){tot++;if(done(h,ds))dn++}}return{tot,dn,p:tot?Math.round(dn/tot*100):0}}
function gstats(){let total=0;for(const k in S.log){const[i,d]=k.split('|'),h=S.habits.find(x=>x.id===i);if(h&&done(h,d))total++}return{total,tasks:S.tasks.filter(t=>t.done).length,best:Math.max(0,...S.habits.map(h=>streaks(h).best))}}
const ACH=[{id:'first',n:'Первый шаг',d:'Выполнить первую привычку',t:x=>x.total>=1},{id:'rec',n:'Личный рекорд',d:'Серия из 2 дней или больше',t:x=>x.best>=2},{id:'s7',n:'Неделя подряд',d:'Серия 7 дней',t:x=>x.best>=7},{id:'s30',n:'Месяц регулярности',d:'Серия 30 дней',t:x=>x.best>=30},{id:'t10',n:'Деловой человек',d:'Выполнить 10 задач',t:x=>x.tasks>=10},{id:'c100',n:'Сотня',d:'100 выполнений привычек',t:x=>x.total>=100}];
function after(){const l0=lvlOf(S.xp);const st=gstats();ACH.forEach(a=>{if(!S.ach[a.id]&&a.t(st)){S.ach[a.id]=today();S.xp+=20;toast('Достижение: '+a.n,'gold')}});
  if(lvlOf(S.xp)>l0)toast('Новый уровень: '+lvlOf(S.xp),'gold');save();render()}

/* --- Интерфейс: утилиты --- */
const state={route:'today',view:'list',cal:{y:new Date().getFullYear(),m:new Date().getMonth(),sel:today()},period:30,tf:'all',tp:'all',q:'',anim:true};
function toast(m,t='ok'){const e=document.createElement('div');e.className='toast '+t;e.textContent=m;$('#toasts').appendChild(e);setTimeout(()=>e.remove(),3300)}
const modal=h=>{const m=$('#modal');m.hidden=false;m.innerHTML=`<div class="back" data-a="close"></div><div class="sheet" role="dialog" aria-modal="true">${h}</div>`};
const closeM=()=>{$('#modal').hidden=true;$('#modal').innerHTML=''};
const fmtD=ds=>ds?parse(ds).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'без срока';
const bar=(p,c)=>`<div class="bar" ${c?`style="--c:${c}"`:''}><b style="width:${p}%"></b></div>`;
const empty=(t,s,btn)=>`<div class="card empty">${ic('habits')}<h2 style="margin:0">${t}</h2><p class="mut">${s}</p>${btn||''}</div>`;

function chk(h,ds){const dn=done(h,ds),v=val(h,ds),c=`style="--c:${h.color}"`;
  if(sc(h,ds).type==='measure')return `<button class="chk ${dn?'on':v?'part':''}" ${c} data-a="meas" data-id="${h.id}" data-d="${ds}" aria-label="Ввести значение">${dn?ic('check'):'<span>'+(v||'+')+'</span>'}</button>`;
  return `<button class="chk ${dn?'on':''}" ${c} data-a="tg" data-id="${h.id}" data-d="${ds}" aria-label="Отметить">${dn?ic('check'):''}</button>`}
function sub(h,ds){const s=sc(h,ds);return s.type==='measure'?`${val(h,ds)}/${s.target} ${esc(h.unit)}`:s.type==='weekly'?`${weekCount(h,ds)}/${s.goal} на неделе`:s.type==='days'?s.days.map(i=>DN[i]).join(', '):'каждый день'}
function hItem(h,ds){const st=streaks(h);return `<div class="item ${done(h,ds)?'dn':''}" style="--c:${h.color}">${chk(h,ds)}<div class="grow"><b>${esc(h.name)}</b><small>${esc(h.cat)} · ${sub(h,ds)}</small></div>${st.cur?`<span class="tag" title="Серия">${st.cur}</span>`:''}<button class="ib" data-a="editH" data-id="${h.id}" aria-label="Изменить">${ic('edit')}</button></div>`}
function tItem(t){const late=!t.done&&t.due&&t.due<today();return `<div class="item ${t.done?'dn':''}"><button class="chk ${t.done?'on':''}" data-a="tt" data-id="${t.id}" aria-label="Выполнить">${t.done?ic('check'):''}</button><div class="grow"><b>${esc(t.title)}</b><small class="${late?'late':''}">${fmtD(t.due)} · ${PRI[t.pri]}${t.desc?' · '+esc(t.desc):''}</small></div>${t.done?'':`<button class="ib" data-a="postT" data-id="${t.id}" title="Перенести на день">${ic('clock')}</button>`}<button class="ib" data-a="editT" data-id="${t.id}" aria-label="Изменить">${ic('edit')}</button><button class="ib" data-a="delT" data-id="${t.id}" aria-label="Удалить">${ic('trash')}</button></div>`}

/* --- Страницы --- */
function rToday(){const t=today(),hs=S.habits.filter(h=>scheduled(h,t)),ts=S.tasks.filter(x=>(!x.done&&(!x.due||x.due<=t))||(x.done&&x.doneAt===t));
  const tot=hs.length+ts.length,dn=hs.filter(h=>done(h,t)).length+ts.filter(x=>x.done).length,p=tot?Math.round(dn/tot*100):0;
  const hr=new Date().getHours(),g=hr<5?'Доброй ночи':hr<12?'Доброе утро':hr<18?'Добрый день':'Добрый вечер',nm=S.set.name?', '+esc(S.set.name):'';
  const lv=lvlOf(S.xp),b=50*(lv-1)**2,n=50*lv**2,lp=Math.round((S.xp-b)/(n-b)*100),best=Math.max(0,...S.habits.map(h=>streaks(h).cur));
  return `<div class="top"><div><h1>${g}${nm}</h1><span class="mut">${new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</span></div><button class="btn" data-a="addMenu">${ic('plus')}Добавить</button></div>
  <div class="grid g2"><div class="card"><div class="big">${p}%</div><p class="mut" style="margin:8px 0">Выполнено ${dn} из ${tot} · осталось ${tot-dn}</p>${bar(p)}</div>
  <div class="card"><b>Уровень ${lv}</b> <small>${S.xp} XP</small><div style="margin:10px 0">${bar(lp)}</div><small>До следующего уровня: ${n-S.xp} XP · лучшая серия сейчас: ${best}</small></div></div>
  ${!S.habits.length&&!S.tasks.length?empty('Начните с первой привычки','Добавьте привычку или задачу — прогресс появится здесь.','<button class="btn" data-a="addH">Создать привычку</button>'):`<h2>Привычки</h2>${hs.length?hs.map(h=>hItem(h,t)).join(''):'<p class="mut">На сегодня привычек нет.</p>'}<h2>Задачи</h2>${ts.length?ts.map(tItem).join(''):'<p class="mut">Задач на сегодня нет.</p>'}`}`}

function hFiltered(){const q=state.q.toLowerCase();return S.habits.filter(h=>!h.archived&&h.name.toLowerCase().includes(q))}
function prog(h){const t=today(),s=sc(h,t);if(s.type==='measure')return Math.min(100,Math.round(val(h,t)/s.target*100));if(s.type==='weekly')return Math.min(100,Math.round(weekCount(h,t)/s.goal*100));const w=wkStart(t);let a=0,d=0;for(let i=0;i<7;i++){const ds=ymd(addD(parse(w),i));if(ds<=t&&due(h,ds)){a++;if(done(h,ds))d++}}return a?Math.round(d/a*100):0}
function rHabits(){const V={list:'Список',table:'Таблица',cards:'Карточки',calendar:'Календарь',stats:'Статистика'},t=today();let body='';const hs=hFiltered();
  if(state.view==='calendar')body=rCal();else if(state.view==='stats')body=rStats();
  else if(!S.habits.length)body=empty('Пока нет привычек','Создайте первую — например, «Пить воду» или «Читать 20 страниц».','<button class="btn" data-a="addH">Создать привычку</button>');
  else if(state.view==='list'){const cats=[...new Set(hs.map(h=>h.cat))];body=cats.map(c=>`<h2>${esc(c)}</h2>`+hs.filter(h=>h.cat===c).map(h=>hItem(h,t)).join('')).join('')||'<p class="mut">Ничего не найдено.</p>'}
  else if(state.view==='cards')body=`<div class="grid g3">${hs.map(h=>{const p=prog(h),st=streaks(h);return `<div class="card" style="--c:${h.color}"><div style="display:flex;justify-content:space-between;align-items:center">${chk(h,t)}<button class="ib" data-a="editH" data-id="${h.id}" aria-label="Изменить">${ic('edit')}</button></div><b style="display:block;margin-top:10px">${esc(h.name)}</b><small>${esc(h.cat)} · ${sub(h,t)}</small><div style="margin:12px 0 6px">${bar(p,h.color)}</div><small>${p}% · серия ${st.cur}, рекорд ${st.best}</small></div>`}).join('')}</div>`;
  else if(state.view==='table'){const w=parse(wkStart(t)),days=[...Array(7)].map((_,i)=>ymd(addD(w,i)));body=`<div class="card scroll"><table><tr><th>Привычка</th>${days.map((d,i)=>`<th>${DN[i]}<br><small>${+d.slice(8)}</small></th>`).join('')}<th>Цель</th></tr>${hs.map(h=>`<tr><td><b>${esc(h.name)}</b></td>${days.map(d=>`<td style="${d>t||d<h.created||!scheduled(h,d)&&!done(h,d)?'opacity:.35':''}">${chk(h,d)}</td>`).join('')}<td><small>${sub(h,t)}</small></td></tr>`).join('')}</table></div>`}
  const arch=S.habits.filter(h=>h.archived);
  return `<div class="top"><div><h1>Привычки</h1><span class="mut">Все представления используют общие данные</span></div><button class="btn" data-a="addH">${ic('plus')}Новая</button></div>
  <div class="tools"><div class="tabs">${Object.entries(V).map(([k,v])=>`<button class="${state.view===k?'on':''}" data-a="view" data-v="${k}">${v}</button>`).join('')}</div>${['list','table','cards'].includes(state.view)?`<input style="max-width:220px" placeholder="Поиск" value="${esc(state.q)}" data-in="q">`:''}</div>${body}
  ${arch.length&&state.view==='list'?`<h2>Архив</h2>${arch.map(h=>`<div class="item"><div class="grow"><b>${esc(h.name)}</b><small>История сохранена</small></div><button class="btn ghost" data-a="unarch" data-id="${h.id}">Вернуть</button></div>`).join('')}`:''}`}

function tMatch(t){const T=today(),f=state.tf;if(state.tp!=='all'&&t.pri!=+state.tp)return false;
  return f==='all'||(f==='active'&&!t.done)||(f==='done'&&t.done)||(f==='overdue'&&!t.done&&t.due&&t.due<T)||(f==='today'&&!t.done&&t.due===T)||(f==='future'&&!t.done&&t.due>T)}
function rTasks(){const ts=S.tasks.filter(tMatch).sort((a,b)=>a.done-b.done||(a.due||'9')<(b.due||'9')?-1:1);
  return `<div class="top"><div><h1>Задачи</h1><span class="mut">Разовые дела со сроком и приоритетом</span></div><button class="btn" data-a="addT">${ic('plus')}Новая</button></div>
  <div class="tools"><select style="max-width:190px" data-in="tf">${[['all','Все'],['active','Активные'],['overdue','Просроченные'],['today','На сегодня'],['future','Будущие'],['done','Завершённые']].map(([k,v])=>`<option value="${k}" ${state.tf===k?'selected':''}>${v}</option>`).join('')}</select>
  <select style="max-width:190px" data-in="tp"><option value="all">Любой приоритет</option>${[3,2,1].map(k=>`<option value="${k}" ${state.tp==k?'selected':''}>${PRI[k]}</option>`).join('')}</select></div>
  ${ts.length?ts.map(tItem).join(''):empty('Задач нет','Добавьте задачу или измените фильтр.','<button class="btn" data-a="addT">Создать задачу</button>')}`}

function dayStat(ds){const hs=S.habits.filter(h=>ds>=h.created&&(sc(h,ds).type==='weekly'?done(h,ds):due(h,ds)));if(!hs.length)return'';const d=hs.filter(h=>done(h,ds)).length;return d===hs.length?'full':d?'part':ds<today()?'miss':''}
function rCal(){const{y,m,sel}=state.cal,t=today(),first=new Date(y,m,1),off=wd(first),n=new Date(y,m+1,0).getDate();let cells=DN.map(d=>`<div class="h">${d}</div>`).join('')+'<div class="day x"></div>'.repeat(off);
  for(let i=1;i<=n;i++){const ds=`${y}-${pad(m+1)}-${pad(i)}`;cells+=`<button class="day ${dayStat(ds)} ${ds===sel?'sel':''} ${ds===t?'td':''}" data-a="sel" data-d="${ds}">${i}</button>`}
  const hs=S.habits.filter(h=>sel>=h.created&&(h.archived?false:scheduled(h,sel)||done(h,sel))),ts=S.tasks.filter(x=>x.due===sel);
  return `<div class="card"><div class="top" style="margin-bottom:10px"><b style="font-size:18px">${MONTHS[m]} ${y}</b><div><button class="ib" data-a="mon" data-n="-1" aria-label="Назад" style="display:inline-grid">${ic('left')}</button><button class="ib" data-a="mon" data-n="1" aria-label="Вперёд" style="display:inline-grid">${ic('right')}</button></div></div><div class="cal">${cells}</div><p><small>Тёмная ячейка — всё выполнено, светлая — частично, розовая — пропуск.</small></p></div>
  <h2>${fmtD(sel)}</h2>${hs.map(h=>hItem(h,sel)).join('')+ts.map(tItem).join('')||'<p class="mut">На этот день ничего не запланировано.</p>'}`}

function rStats(){const t=today(),P=state.period,from=ymd(addD(parse(t),-(P-1))),w=rate(ymd(addD(parse(t),-6)),t),mo=rate(ymd(addD(parse(t),-29)),t),st=gstats();
  const days=[...Array(P)].map((_,i)=>ymd(addD(parse(from),i))),bw=Math.max(3,Math.floor(600/P)-2);
  const bars=`<svg viewBox="0 0 ${P*(bw+2)} 100" width="100%" height="140" preserveAspectRatio="none">${days.map((d,i)=>{const r=rate(d,d).p;return `<rect x="${i*(bw+2)}" y="${100-Math.max(r,2)}" width="${bw}" height="${Math.max(r,2)}" rx="2" fill="${r?'#4f7a5e':'#e4e2da'}"><title>${fmtD(d)}: ${r}%</title></rect>`}).join('')}</svg>`;
  const hm=[...Array(16*7)].map((_,i)=>{const ds=ymd(addD(parse(wkStart(t)),i-15*7)),r=ds<=t?rate(ds,ds):{tot:0,p:0};return `<rect x="${Math.floor(i/7)*16}" y="${i%7*16}" width="13" height="13" rx="3" fill="${r.tot?'#4f7a5e':'#e4e2da'}" opacity="${r.tot?.25+r.p/133:1}"><title>${fmtD(ds)}: ${r.tot?r.p+'%':'нет данных'}</title></rect>`}).join('');
  return `<div class="tools"><div class="tabs">${[7,30,90].map(p=>`<button class="${P===p?'on':''}" data-a="period" data-v="${p}">${p} дн.</button>`).join('')}</div></div>
  <div class="grid g2"><div class="card"><div class="big">${w.p}%</div><small>за неделю (${w.dn}/${w.tot})</small></div><div class="card"><div class="big">${mo.p}%</div><small>за 30 дней (${mo.dn}/${mo.tot})</small></div><div class="card"><div class="big">${st.total}</div><small>всего выполнений привычек</small></div><div class="card"><div class="big">${st.best}</div><small>лучшая серия</small></div></div>
  <h2>Динамика по дням</h2><div class="card">${S.habits.length?bars:'<p class="mut">Нет данных</p>'}</div>
  <h2>Тепловая карта (16 недель)</h2><div class="card scroll"><svg viewBox="0 0 256 110" width="100%" style="min-width:300px">${hm}</svg></div>
  <h2>Прогресс привычек</h2>${S.habits.filter(h=>!h.archived).map(h=>{const r=rate2(h,from,t),s=streaks(h);return `<div class="card" style="margin-bottom:8px"><b>${esc(h.name)}</b> <small>серия ${s.cur} · рекорд ${s.best} · выполнений ${r.dn}</small><div style="margin-top:8px">${bar(r.p,h.color)}</div></div>`}).join('')||'<p class="mut">Нет привычек.</p>'}`}
function rate2(h,a,b){let tot=0,dn=0;for(let d=parse(a);ymd(d)<=b;d=addD(d,1)){const ds=ymd(d);if(scheduled(h,ds)){tot++;if(done(h,ds))dn++}}return{tot,dn,p:tot?Math.round(dn/tot*100):0}}

function rAwards(){const lv=lvlOf(S.xp);return `<div class="top"><div><h1>Достижения</h1><span class="mut">Уровень ${lv} · ${S.xp} XP</span></div></div>
  <div class="hint" style="margin-bottom:14px">XP: привычка +10, задача +15, достижение +20. Повторные нажатия XP не дают, отмена возвращает начисленное.</div>
  <div class="grid g3">${ACH.map(a=>{const g=S.ach[a.id];return `<div class="card ach ${g?'got':''}">${ic(g?'awards':'lock')}<b style="display:block">${g?a.n:'Скрытое достижение'}</b><small>${a.d}${g?' · '+fmtD(g):''}</small></div>`}).join('')}</div>`}

function rSettings(){const r=S.set,np='Notification' in window?Notification.permission:'unsupported',ns={unsupported:'Не поддерживается в этом браузере',default:'Разрешение ещё не запрошено',granted:'Разрешены',denied:'Запрещены в настройках браузера'}[np];
  const items=[...S.habits.filter(h=>!h.archived).map(h=>[h.id,h.name]),...S.tasks.filter(t=>!t.done).map(t=>[t.id,t.title])];
  return `<div class="top"><div><h1>Настройки</h1></div></div>
  <div class="card"><label>Ваше имя (необязательно)<input data-set="name" value="${esc(r.name)}" maxlength="30"></label></div>
  <h2>Напоминания</h2><div class="card rem"><label><input type="checkbox" data-set="rOn" ${r.rOn?'checked':''}>Включить напоминание</label><label style="display:block">Время<input type="time" data-set="rTime" value="${r.rTime}" style="max-width:140px"></label>
  <p><small>Что напоминать (если ничего не выбрано — всё невыполненное):</small></p>${items.map(([id,n])=>`<label><input type="checkbox" data-set="rId" value="${id}" ${r.rIds.includes(id)?'checked':''}>${esc(n)}</label>`).join('')||'<small>Пока нечего выбирать</small>'}
  <p>Статус уведомлений браузера: <b>${ns}</b></p>${np==='default'?'<button class="btn ghost" data-a="notif">Разрешить уведомления</button>':''}
  <p class="hint">Напоминания работают, пока приложение открыто. Для закрытого приложения нужны push-уведомления через сервер — в этой версии их нет.</p></div>
  <h2>Данные</h2><div class="card"><p class="hint">Данные хранятся только в этом браузере на этом устройстве. Mac и Android не синхронизируются: у каждого устройства свои данные. Очистка данных сайта в браузере удалит их — делайте экспорт.</p><div class="acts"><button class="btn ghost" data-a="exp">Экспорт в JSON</button><button class="btn ghost" data-a="imp">Импорт из JSON</button><button class="btn bad" data-a="reset">Сбросить все данные</button></div></div>`}

const ROUTES={today:rToday,habits:rHabits,tasks:rTasks,calendar:()=>`<div class="top"><div><h1>Календарь</h1></div></div>`+rCal(),stats:()=>`<div class="top"><div><h1>Статистика</h1><span class="mut">Считается по вашим выполнениям; разовые задачи не входят</span></div></div>`+rStats(),awards:rAwards,settings:rSettings};
function render(){$('#nav').innerHTML=`<div class="logo"><i>${ic('check').replace('class="i"','class="i" style="stroke:#fff;width:16px;height:16px"')}</i>HabitFlow</div>`+NAV.map(([k,n])=>`<button class="nb ${state.route===k?'on':''}" data-a="go" data-v="${k}" ${state.route===k?'aria-current="page"':''}>${ic(k)}${n}</button>`).join('');
  const keep=window.scrollY;$('#main').innerHTML=`<div class="${state.anim?'enter':''}">${ROUTES[state.route]()}</div>`;state.anim=false;window.scrollTo(0,keep)}

/* --- Формы --- */
function habitForm(h){const n=!h;h=h||{type:'daily',color:COLORS[0],cat:CATS[0],days:[0,1,2,3,4],goal:3,target:10,unit:''};
  modal(`<h2 style="margin-top:0">${n?'Новая привычка':'Редактировать привычку'}</h2><form data-form="habit" data-id="${h.id||''}" data-t="${h.type}">
  <label>Название<input name="name" required maxlength="60" value="${esc(h.name)}"></label><label>Описание<input name="desc" maxlength="140" value="${esc(h.desc)}"></label>
  <div class="row2"><label>Категория<select name="cat">${CATS.map(c=>`<option ${c===h.cat?'selected':''}>${c}</option>`).join('')}</select></label><label>Тип<select name="type" data-in="ftype">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${k===h.type?'selected':''}>${v}</option>`).join('')}</select></label></div>
  <div class="f-days days">${DN.map((d,i)=>`<label><input type="checkbox" name="day" value="${i}" ${h.days.includes(i)?'checked':''}>${d}</label>`).join('')}</div>
  <label class="f-goal">Цель: выполнений в неделю (1–7)<input type="number" name="goal" min="1" max="7" value="${h.goal}"></label>
  <div class="f-meas row2"><label>Цель на день<input type="number" name="target" min="0.1" step="any" value="${h.target}"></label><label>Единица (стр., мин, л)<input name="unit" maxlength="12" value="${esc(h.unit)}"></label></div>
  <div class="sw">${COLORS.map((c,i)=>`<input type="radio" name="color" id="c${i}" value="${c}" ${c===h.color?'checked':''}><label for="c${i}" style="--c:${c}" aria-label="Цвет"></label>`).join('')}</div>
  <div class="acts"><button class="btn" type="submit">Сохранить</button><button class="btn ghost" type="button" data-a="close">Отмена</button>${n?'':`<button class="btn ghost" type="button" data-a="arch" data-id="${h.id}">В архив</button><button class="btn bad" type="button" data-a="delH" data-id="${h.id}">Удалить</button>`}</div></form>`)}
function taskForm(t){const n=!t;t=t||{pri:2,due:today()};modal(`<h2 style="margin-top:0">${n?'Новая задача':'Редактировать задачу'}</h2><form data-form="task" data-id="${t.id||''}">
  <label>Название<input name="title" required maxlength="80" value="${esc(t.title)}"></label><label>Описание<input name="desc" maxlength="140" value="${esc(t.desc)}"></label>
  <div class="row2"><label>Срок<input type="date" name="due" value="${t.due||''}"></label><label>Приоритет<select name="pri">${[3,2,1].map(k=>`<option value="${k}" ${t.pri==k?'selected':''}>${PRI[k]}</option>`).join('')}</select></label></div>
  <div class="acts"><button class="btn" type="submit">Сохранить</button><button class="btn ghost" type="button" data-a="close">Отмена</button></div></form>`)}
function saveHabit(f,id){const d=new FormData(f),o={name:d.get('name').trim(),desc:d.get('desc').trim(),cat:d.get('cat'),type:d.get('type'),color:d.get('color')||COLORS[0],days:[...f.querySelectorAll('[name=day]:checked')].map(x=>+x.value),goal:Math.max(1,Math.min(7,+d.get('goal')||1)),target:Math.max(.1,+d.get('target')||1),unit:d.get('unit').trim()};
  if(!o.name)return toast('Введите название','err');if(o.type==='days'&&!o.days.length)return toast('Выберите хотя бы один день','err');
  if(id){const h=S.habits.find(x=>x.id===id),y=ymd(addD(new Date(),-1));
    if((['type','goal','target'].some(k=>h[k]!==o[k])||h.days.join()!==o.days.join())&&h.created<=y&&!(h.hist||[]).some(e=>e.until===y))(h.hist=h.hist||[]).push({until:y,type:h.type,days:h.days,goal:h.goal,target:h.target});
    Object.assign(h,o)}else S.habits.push({id:uid(),created:today(),archived:false,...o});
  closeM();toast('Привычка сохранена');after()}
function saveTask(f,id){const d=new FormData(f),o={title:d.get('title').trim(),desc:d.get('desc').trim(),due:d.get('due'),pri:+d.get('pri')};if(!o.title)return toast('Введите название','err');
  if(id)Object.assign(S.tasks.find(x=>x.id===id),o);else S.tasks.push({id:uid(),done:false,doneAt:'',...o});closeM();toast('Задача сохранена');after()}
function askVal(h,ds){const s=sc(h,ds);modal(`<h2 style="margin-top:0">${esc(h.name)}</h2><form data-form="val" data-id="${h.id}" data-d="${ds}"><label>Сколько выполнено (${esc(h.unit)}), цель ${s.target}<input type="number" name="v" min="0" step="any" value="${val(h,ds)||''}" autofocus></label><div class="acts"><button class="btn" type="submit">Сохранить</button><button class="btn ghost" type="button" data-a="close">Отмена</button></div></form>`)}

/* --- События --- */
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el)return;const a=el.dataset.a,id=el.dataset.id,H=()=>S.habits.find(x=>x.id===id),T=()=>S.tasks.find(x=>x.id===id);
  switch(a){
   case'go':state.route=el.dataset.v;state.anim=true;render();break;
   case'view':state.view=el.dataset.v;state.anim=true;render();break;
   case'period':state.period=+el.dataset.v;render();break;
   case'close':closeM();break;
   case'addMenu':modal(`<h2 style="margin-top:0">Что добавить?</h2><div class="acts"><button class="btn" data-a="addH">Привычку</button><button class="btn ghost" data-a="addT">Задачу</button></div>`);break;
   case'addH':habitForm();break;case'editH':habitForm(H());break;case'addT':taskForm();break;case'editT':taskForm(T());break;
   case'tg':{const h=H();toggleH(h,el.dataset.d);after();const b=document.querySelector(`[data-a=tg][data-id="${id}"][data-d="${el.dataset.d}"]`);if(b&&done(h,el.dataset.d))b.classList.add('pop');break}
   case'meas':askVal(H(),el.dataset.d);break;
   case'tt':{const t=T();t.done=!t.done;t.doneAt=t.done?today():'';sync('t|'+t.id,t.done,15);after();break}
   case'postT':{const t=T();t.due=ymd(addD(t.due?parse(t.due):new Date(),1));toast('Срок перенесён на '+fmtD(t.due));after();break}
   case'delT':if(confirm('Удалить задачу?')){S.tasks=S.tasks.filter(x=>x.id!==id);toast('Задача удалена');after()}break;
   case'delH':if(confirm('Удалить привычку вместе с историей? Это нельзя отменить. (Чтобы сохранить историю, лучше архивировать.)')){S.habits=S.habits.filter(x=>x.id!==id);Object.keys(S.log).forEach(k=>{if(k.startsWith(id+'|'))delete S.log[k]});closeM();toast('Привычка удалена');after()}break;
   case'arch':H().archived=true;closeM();toast('Привычка в архиве, история сохранена');after();break;
   case'unarch':H().archived=false;toast('Привычка возвращена');after();break;
   case'mon':{const c=state.cal,d=new Date(c.y,c.m+ +el.dataset.n,1);c.y=d.getFullYear();c.m=d.getMonth();render();break}
   case'sel':state.cal.sel=el.dataset.d;render();break;
   case'notif':if(!('Notification' in window))return toast('Браузер не поддерживает уведомления','err');Notification.requestPermission().then(p=>{toast(p==='granted'?'Уведомления разрешены':'Уведомления не разрешены',p==='granted'?'ok':'err');render()});break;
   case'exp':{const b=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),l=document.createElement('a');l.href=URL.createObjectURL(b);l.download='habitflow-'+today()+'.json';l.click();setTimeout(()=>URL.revokeObjectURL(l.href),2000);toast('Файл экспортирован');break}
   case'imp':$('#file').click();break;
   case'reset':if(confirm('Удалить ВСЕ данные HabitFlow на этом устройстве?')&&confirm('Последнее подтверждение: данные будут удалены безвозвратно. Продолжить?')){Store.clear();S=blank();toast('Данные сброшены');render()}break;
  }});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-form]');if(!f)return;e.preventDefault();const k=f.dataset.form;
  if(k==='habit')saveHabit(f,f.dataset.id);else if(k==='task')saveTask(f,f.dataset.id);
  else if(k==='val'){const h=S.habits.find(x=>x.id===f.dataset.id);setVal(h,f.dataset.d,Math.max(0,+new FormData(f).get('v')||0));closeM();after()}});
document.addEventListener('input',e=>{const el=e.target;if(el.dataset.in==='q'){state.q=el.value;const p=el.selectionStart;render();const n=$('[data-in=q]');if(n){n.focus();n.setSelectionRange(p,p)}}});
document.addEventListener('change',e=>{const el=e.target,r=S.set;
  if(el.dataset.in==='tf'){state.tf=el.value;render()}else if(el.dataset.in==='tp'){state.tp=el.value;render()}else if(el.dataset.in==='ftype')el.closest('form').dataset.t=el.value;
  else if(el.dataset.set){const k=el.dataset.set;if(k==='name')r.name=el.value.trim();else if(k==='rTime')r.rTime=el.value||'20:00';else if(k==='rOn'){r.rOn=el.checked;toast(el.checked?'Напоминание включено':'Напоминание выключено')}
    else if(k==='rId')r.rIds=[...document.querySelectorAll('[data-set=rId]:checked')].map(x=>x.value);save()}});
$('#file').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const rd=new FileReader();
  rd.onload=()=>{try{const d=JSON.parse(rd.result);const ok=d&&d.v===1&&Array.isArray(d.habits)&&Array.isArray(d.tasks)&&d.log&&typeof d.log==='object'&&typeof d.xp==='number'&&d.habits.every(h=>h&&h.id&&h.name&&TYPES[h.type]&&h.created&&Array.isArray(h.days))&&d.tasks.every(t=>t&&t.id&&t.title);
    if(!ok)throw 0;if(!confirm('Импорт заменит все текущие данные. Продолжить?'))return;const b=blank();S={...b,...d,set:{...b.set,...(d.set||{})},awarded:d.awarded||{},ach:d.ach||{}};save();toast('Данные импортированы');render()}catch(x){toast('Файл не похож на экспорт HabitFlow','err')}};
  rd.onerror=()=>toast('Не удалось прочитать файл','err');rd.readAsText(f)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)closeM()});

/* --- Напоминания (только при открытой вкладке) --- */
function tick(){const r=S.set,t=today();if(!r.rOn||S.lastRem===t)return;const n=new Date();if(pad(n.getHours())+':'+pad(n.getMinutes())<r.rTime)return;
  const it=[...S.habits.filter(h=>scheduled(h,t)&&!done(h,t)).map(h=>({id:h.id,n:h.name})),...S.tasks.filter(x=>!x.done&&x.due&&x.due<=t).map(x=>({id:x.id,n:x.title}))].filter(i=>!r.rIds.length||r.rIds.includes(i.id));
  S.lastRem=t;save();if(!it.length)return;const body='Осталось: '+it.slice(0,4).map(i=>i.n).join(', ')+(it.length>4?' и ещё '+(it.length-4):'');toast(body);
  if('Notification' in window&&Notification.permission==='granted'){try{new Notification('HabitFlow',{body})}catch(x){}}}
setInterval(tick,20000);

render();tick();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
