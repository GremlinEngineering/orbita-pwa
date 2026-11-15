import {artGroup, artGroups, artIndex, artURL, clearSavedArt, savedArtCount, saveArt} from './art-library.js';
import {app, element, getJSON, message, offline, remember, rememberFiles, sameOrigin} from './site.js';
import {clock, heading, networkSignals, networkTitle, postDetail, section, signalDetail, signalKey,
    stationPost, stationSignal, stationSignals, worldScreens} from './world-screens.js';

const base = new URL('/game-worlds/orbita/', location.origin);
const world = value => sameOrigin(value, base, base.pathname);
const tabs = {
    watch:['Вахта','∿'], station:['Станция','◇'], flights:['Рейсы','↗'],
    people:['Люди','◉'], archive:['Архив','▤'], art:['Арты','▧']
};
const archives = {
    chapters:{title:'Роман',index:'chapters/index.json',rows:'chapters'},
    journal:{title:'Журнал',index:'journal/index.json',rows:'days'},
    radio:{title:'Радиопереговоры',index:'radio/index.json',rows:'days'},
    'crew-diary':{title:'Дневники экипажа',index:'crew-diary.json',rows:'days'}
};
const home = {type:'watch',id:''};
const parents = {
    post:'watch',signal:'watch',maps:'station',area:'station',crop:'station',radar:'station',contact:'station',systems:'station',
    'network-link':'station',equipment:'station',
    economy:'station',schedule:'station',about:'station',flight:'flights',destination:'flights',vessel:'flights',
    routes:'flights',observations:'flights',expedition:'flights',
    person:'people',command:'people',relationships:'people',diary:'archive',chapters:'archive',
    journal:'archive',radio:'archive','crew-diary':'archive','flight-archive':'archive','flight-day':'archive','offline-archive':'archive'
};
const safeId = /^[A-Za-z0-9_.@-]+$/;
const signalId = /^[A-Za-z0-9_.@-]+\/[^\u0000-\u001F\u007F]+$/;
const legacySignalId = /^(0|[1-9][0-9]*)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const nav = document.querySelector('#tabs');
const time = document.querySelector('#snapshot-clock');
const available = offline();
available.catch(error => message(error.message));
const docRequests = new Map();
let active = home, panel, snapshot, openArchive = 0, refreshRequest;

function formatRoute(target) {
    return '#' + target.type + (target.id ? '/' + encodeURIComponent(target.id) : '');
}

function readRoute() {
    const [type,id=''] = location.hash.slice(1).split('/');
    if (!Object.hasOwn(tabs,type) && !Object.hasOwn(parents,type) && type!=='settings') return home;
    try {
        const value=decodeURIComponent(id);
        return {type,id:safeId.test(value)||(type==='signal'&&signalId.test(value))?value:''};
    } catch { return {type,id:''}; }
}
function activeParent(target) {
    return Object.hasOwn(tabs,target.type) ? target.type : parents[target.type];
}
function showRoute(restore = false) {
    active=readRoute();
    render();
    if (restore && Number.isFinite(history.state?.scroll)) window.scrollTo(0,history.state.scroll);
    else window.scrollTo(0,0);
}
function go(target) {
    if (formatRoute(target)===formatRoute(active)) return;
    history.replaceState({...history.state,scroll:window.scrollY},'');
    history.pushState({orbita:true,scroll:0},'',formatRoute(target));
    showRoute();
}
function makeLink(name,target,className='',drawText=true) {
    const link=element('a',drawText?name:'',{href:formatRoute(target),class:className});
    link.addEventListener('click',event=>{
        if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0) return;
        event.preventDefault();
        go(target);
    });
    return link;
}
function resolveLink(input) {
    let url;
    try { url=new URL(input,base); } catch { return null; }
    if(url.origin!==location.origin || !url.pathname.startsWith(base.pathname)) return null;
    const params=url.searchParams;
    for(const [key,type] of [['person','person'],['crew','person'],['area','area'],['flight','flight'],['station','destination'],['vessel','vessel']]){
        if(safeId.test(params.get(key)??'')) return {type,id:params.get(key)};
    }
    const view=params.get('view');
    const id=params.get('id') ?? '';
    const network=params.get('network') ?? '';
    const segment=params.get('segment') ?? '';
    if(view==='networks'&&safeId.test(network)){
        return safeId.test(segment)?{type:'network-link',id:network+'.'+segment}:{type:'systems',id:network};
    }
    const named={person:'person',flight:'flight',station:'destination',vessel:'vessel',expedition:'expedition',
        relationships:'relationships',equipment:'equipment',area:'area',crop:'crop',network:'systems',post:'post'};
    if(Object.hasOwn(named,view)&&safeId.test(id)) return {type:named[view],id};
    const routes={radar:'radar',map:'maps',crew:'people',flights:'flights',radio:'radio',journal:'journal',history:'chapters',networks:'systems','about-world':'about'};
    return Object.hasOwn(routes,view)?{type:routes[view],id:''}:null;
}
function readDocument(path) {
    if(docRequests.has(path)) return docRequests.get(path);
    const key='orbita:doc:'+path;
    const url=path==='./deck-points.json'?new URL(path,location.href):world(path);
    const request=getJSON(url).then(async data=>{
        if(path!=='./deck-points.json') await remember(key,data).catch(()=>{});
        return data;
    }).catch(async error=>{
        const oldDay=/^(chapters|journal|radio|crew-diary)\/(\d{4}-\d{2}-\d{2})\.json$/.exec(path);
        const oldIndex=Object.entries(archives).find(([,spec])=>spec.index===path)?.[0];
        const oldKey=oldDay?'document:'+oldDay[1]+':'+oldDay[2]:oldIndex?'index:'+oldIndex:null;
        const copy=await remember(key).catch(()=>null)??(oldKey?await remember(oldKey).catch(()=>null):null);
        if(copy) return copy;
        docRequests.delete(path);
        throw error;
    });
    docRequests.set(path,request);
    return request;
}
function preference(key,fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function keep(key,value){ try { localStorage.setItem(key,JSON.stringify(value)); } catch {} }
function subscriptions(key){
    const values=preference(key,[]);
    return new Set(Array.isArray(values)?values.filter(value=>typeof value==='string'&&safeId.test(value)):[]);
}
const localDuty=preference('orbita.duty',{});
const dutyClock=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'numeric',hourCycle:'h23'});
const followKeys={person:'orbita.followed',flight:'orbita.followed-flights',systems:'orbita.followed-systems',
    post:'orbita.followed-posts',signal:'orbita.followed-signals'};
function signalSubscriptions(){
    const entries=preference(followKeys.signal,[]);
    return new Map(Array.isArray(entries)?entries.filter(row=>
        Array.isArray(row)&&row.length===2&&typeof row[0]==='string'&&signalId.test(row[0])&&typeof row[1]==='string') : []);
}
const follows=Object.fromEntries(Object.entries(followKeys).map(([type,key])=>
    [type,type==='signal'?signalSubscriptions():subscriptions(key)]));
const ui={
    link:makeLink,go,resolveLink,document:readDocument,crewFilter:'',crewQuery:'',
    portraits:new Set(),
    deckView:{scale:1,x:0,y:0,section:false},
    follows,
    dutyEnabled:localDuty.enabled===true, quietHours:localDuty.quiet===true,dutyEvents:[],
    isFollowed(type,id){ return follows[type].has(id); },
    toggleFollow(type,id,title){
        const set=follows[type];
        if(type==='signal'?!signalId.test(id):!safeId.test(id)) return;
        if(set.delete(id)) {
            this.dutyEvents=this.dutyEvents.filter(item=>item.type!==type||item.id!==id);
        } else if(type==='signal') set.set(id,title||'Сигнал станции');
        else set.add(id);
        keep(followKeys[type],[...set]);
    }
};
for(const [view,[label,icon]] of Object.entries(tabs)){
    const link=makeLink(label,{type:view,id:''},'',false);
    link.dataset.tab=view;
    link.append(element('span',icon,{class:'tab-icon','aria-hidden':'true'}),element('span',label));
    nav.append(link);
}
document.querySelector('.gear').onclick=event=>{
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
    event.preventDefault();
    go({type:'settings',id:''});
};
window.addEventListener('popstate',()=>showRoute(true));
window.addEventListener('hashchange',()=>{
    if(formatRoute(active)!==formatRoute(readRoute())) showRoute(true);
});
function connection() { document.body.toggleAttribute('data-offline',!navigator.onLine); }
window.addEventListener('online',connection);
window.addEventListener('offline',connection);
connection();

const refresh=element('button','Обновить данные',{type:'button'});
refresh.onclick=()=>void loadSnapshot(true);
function artStorage(parent){
    const storage=section(parent,'Хранилище');
    const count=element('p','Проверяю сохранённые арты…',{class:'muted','aria-live':'polite'});
    const controls=element('div','',{class:'controls'});
    const remove=element('button','Удалить скачанные арты',{type:'button',disabled:''});
    controls.append(makeLink('Открыть арты',{type:'art',id:''},'action'),remove);
    storage.append(count,controls);
    async function update(){
        try{
            const total=await savedArtCount();
            count.textContent=total?'Скачано артов · '+total:'Скачанных артов нет';
            remove.disabled=!total||!!artTransfer||artDeleting;
        } catch{
            count.textContent='Хранилище артов недоступно';
            remove.disabled=true;
        }
    }
    remove.onclick=()=>{
        const dialog=element('dialog','',{class:'stack','aria-label':'Удалить скачанные арты'});
        const cancel=element('button','Отмена',{type:'button',autofocus:''});
        const confirm=element('button','Удалить',{type:'button'});
        const actions=element('div','',{class:'controls'});
        actions.append(cancel,confirm);
        dialog.append(element('p','Удалить все скачанные иллюстрации с этого устройства?'),actions);
        cancel.onclick=()=>dialog.close();
        confirm.onclick=async()=>{
            if(artTransfer||artDeleting) return;
            artDeleting=true;
            remove.disabled=true;
            dialog.close();
            try{
                await clearSavedArt();
                message('Скачанные арты удалены');
            } catch(error){ message(error.message); }
            finally{
                artDeleting=false;
                if(active.type==='art') void art().catch(error=>message(error.message));
                if(active.type==='settings') render();
            }
        };
        dialog.addEventListener('close',()=>dialog.remove(),{once:true});
        document.body.append(dialog);
        dialog.showModal();
    };
    void update();
}
function settings(){
    heading(panel,'Настройки');
    panel.append(refresh);
    const update=element('button','Проверить обновление приложения',{type:'button'});
    update.onclick=async()=>{
        update.disabled=true;
        try{
            const registration=await navigator.serviceWorker.getRegistration();
            if(!registration) throw Error('Сервис обновления пока недоступен');
            const before=navigator.serviceWorker.controller;
            await registration.update();
            if(registration.installing||registration.waiting||navigator.serviceWorker.controller!==before){
                const relaunch=element('button','Перезапустить приложение',{type:'button'});
                relaunch.onclick=()=>location.reload();
                update.after(relaunch);
                message('Новая версия загружается. После установки перезапустите коммуникатор.');
            } else message('Установлена актуальная версия');
        } catch(error){ message(error.message); }
        finally{ update.disabled=false; }
    };
    panel.append(update);
    const duty=element('section','',{class:'stack'});
    duty.append(element('h3','Дежурство'));
    for(const [key,label] of [['dutyEnabled','Режим дежурства'],['quietHours','Тихие часы · 22:00–08:00']]){
        const control=element('button',label,{type:'button','aria-pressed':String(ui[key])});
        control.onclick=()=>{
            ui[key]=!ui[key];
            keep('orbita.duty',{enabled:ui.dutyEnabled,quiet:ui.quietHours});
            control.setAttribute('aria-pressed',String(ui[key]));
        };
        duty.append(control);
    }
    duty.append(element('p','Изменения по подпискам появляются на вахте, пока коммуникатор открыт.',{class:'muted'}));
    if(follows.systems.size){
        const systems=section(duty,'Инженерные подписки');
        for(const id of follows.systems){
            systems.append(makeLink(networkTitle(snapshot?.station.infrastructure,id),{type:'systems',id},'row'));
        }
    }
    if(follows.post.size||follows.signal.size){
        const subjects=section(duty,'Подписки на посты и сигналы');
        for(const id of follows.post){
            subjects.append(makeLink(stationPost(snapshot?.station,id)?.title||id,{type:'post',id},'row'));
        }
        for(const [id,title] of follows.signal){
            subjects.append(makeLink(stationSignal(snapshot?.station,id)?.title||title,{type:'signal',id},'row'));
        }
    }
    panel.append(duty);
    artStorage(panel);
    panel.append(makeLink('Офлайн-архив',{type:'offline-archive',id:''},'action'));
    const install=element('button','Установка и хранилище',{type:'button'});
    install.onclick=()=>{
        document.querySelector('#install-info details').open=true;
        document.querySelector('#install-info').scrollIntoView();
    };
    panel.append(install);
}
function render(){
    if(snapshot&&active.type==='signal'&&legacySignalId.test(active.id)){
        const item=stationSignals(snapshot.station)[Number(active.id)];
        active={type:'signal',id:item?signalKey(item):''};
        history.replaceState(history.state,'',formatRoute(active));
    }
    ++openArchive;
    document.querySelector('dialog[open]')?.close();
    app.replaceChildren();
    panel=element('section','',{class:'stack',id:'view'});
    app.append(panel);
    for(const link of nav.querySelectorAll('a')){
        if(link.dataset.tab===activeParent(active)) link.setAttribute('aria-current','page');
        else link.removeAttribute('aria-current');
    }
    time.textContent=snapshot ? snapshot.station.hour.slice(0,10).split('-').reverse().join('.')+' · '+clock(snapshot.station.hour)+' МСК' : 'Ожидание среза';
    if(!Object.hasOwn(tabs,active.type) || active.id){
        const back=element('button','‹ Назад',{class:'back',type:'button'});
        back.onclick=()=>history.state?.orbita ? history.back() : go({type:activeParent(active)||'watch',id:''});
        panel.append(back);
    }
    if(active.type==='art') {
        void art().catch(error=>message(error.message));
    } else if(active.type==='archive'){
        heading(panel,'Архив станции');
        for(const [id,config] of Object.entries(archives)) panel.append(makeLink(config.title,{type:id,id:''},'action'));
        panel.append(makeLink('Архив рейсов',{type:'flight-archive',id:''},'action'),
            makeLink('Офлайн-архив',{type:'offline-archive',id:''},'action'));
    } else if(active.type==='offline-archive'){
        void offlineArchive(panel).catch(error=>message(error.message));
    } else if(archives[active.type]){
        void archive(active.type,active.id).catch(error=>message(error.message));
    } else if(active.type==='diary') {
        const id=active.id;
        heading(panel,'Личный дневник',snapshot?.station.people?.[id]?.name);
        const body=element('div','',{class:'stack'});
        panel.append(body);
        if(id) void renderDocument('diary/'+id+'.json',body,'diary',openArchive).catch(error=>message(error.message));
    } else if(active.type==='settings'){
        settings();
    } else if(snapshot){
        worldScreens(ui,snapshot,panel)[active.type]?.(active.id);
    } else {
        heading(panel,'Связь со станцией', navigator.onLine?'Загрузка среза…':'Первый срез ещё не загружен');
        panel.append(refresh);
    }
}
function dutyChange(previous,next){
    if(!ui.dutyEnabled||!previous) return;
    const hour=Number(dutyClock.format(new Date()));
    if(ui.quietHours&&(hour>=22||hour<8)) return;
    const updates=[];
    for(const id of follows.person){
        const before=previous.station.people?.[id], person=next.station.people?.[id];
        if(!person||!before) continue;
        if(person.locationArea!==before.locationArea||person.onboard!==before.onboard||person.mode!==before.mode){
            updates.push({type:'person',id,title:person.name||id,detail:person.onboard?person.place:'Вне станции'});
        }
    }
    const board=value=>[...value.flights.local,...(Array.isArray(value.flights.long)?value.flights.long:[])];
    const before=new Map(board(previous).map(item=>[item.id,item]));
    const after=new Map(board(next).map(item=>[item.id,item]));
    for(const id of follows.flight){
        const old=before.get(id), current=after.get(id);
        if(current&&(old?.status!==current.status||old?.place!==current.place||old?.estimatedArrival!==current.estimatedArrival)){
            const place=next.station.places?.[current.place];
            const eta=clock(current.estimatedArrival);
            updates.push({type:'flight',id,title:current.ship||id,detail:[place,eta?'Прогноз '+eta:''].filter(Boolean).join(' · ')||'Рейс обновился'});
        }
    }
    for(const id of follows.post){
        const before=stationPost(previous.station,id), after=stationPost(next.station,id);
        if(!before&&!after) continue;
        if(before&&after&&(before.person||'')===(after.person||'')&&Boolean(before.relief)===Boolean(after.relief)) continue;
        updates.push({type:'post',id,title:after?.title||before?.title||id,detail:postDetail(next.station,after)});
    }
    for(const [id,title] of follows.signal){
        const before=stationSignal(previous.station,id), after=stationSignal(next.station,id);
        if(!before&&!after) continue;
        if(before&&after&&before.level===after.level&&before.detail===after.detail&&before.title===after.title) continue;
        updates.push({type:'signal',id,title:after?.title||before?.title||title,detail:after?signalDetail(after):'Сигнал снят'});
    }
    const signature=signals=>signals.map(({level,title,detail,segment,area,incident})=>
        JSON.stringify([level,title,detail,segment,area,incident])).sort().join('\n');
    for(const id of follows.systems){
        const before=networkSignals(previous.station,id), after=networkSignals(next.station,id);
        if(signature(before)===signature(after)) continue;
        const detail=after.map(signal=>signalDetail(signal,signal.title)).filter(Boolean);
        updates.push({type:'systems',id,title:networkTitle(next.station.infrastructure,id),
            detail:after.length?(detail.join(' / ')||'Сигналы контура изменились'):'Активных сигналов нет'});
    }
    ui.dutyEvents=[...updates,...ui.dutyEvents].slice(0,12);
}
async function loadSnapshot(manual=false){
    if(refreshRequest) return;
    const key=Symbol();
    refreshRequest=key;
    refresh.disabled=true;
    try{
        const [station,radar,flights]=await Promise.all(['current-station.json','radar.json','flights.json'].map(name=>getJSON(world(name))));
        if(typeof station.hour!=='string'||!station.people||!Array.isArray(station.watch)||!Array.isArray(radar.contacts)||!Array.isArray(flights.local)
            ||station.hour!==radar.hour||station.hour!==flights.hour
            ||(station.releaseId&&radar.releaseId&&station.releaseId!==radar.releaseId)
            ||(station.releaseId&&flights.releaseId&&station.releaseId!==flights.releaseId)){
            throw Error('Данные станции обновляются. Показан последний готовый срез.');
        }
        const changed=!snapshot || (snapshot.station.releaseId??snapshot.station.hour)!==(station.releaseId??station.hour);
        if(changed || manual) {
            const next={station,radar,flights};
            if(changed) dutyChange(snapshot,next);
            let renamed=false;
            for(const [id,title] of follows.signal){
                const current=stationSignal(station,id)?.title;
                if(current&&current!==title){
                    follows.signal.set(id,current);
                    renamed=true;
                }
            }
            if(renamed) keep(followKeys.signal,[...follows.signal]);
            snapshot=next;
            await remember('watch',snapshot).catch(()=>{});
            docRequests.clear();
            if(active.type!=='art'&&!archives[active.type]&&active.type!=='diary') render();
        }
        if(changed || manual || !navigator.onLine) {
            message(navigator.onLine?'Срез сохранён на устройстве':'Открыт сохранённый срез');
        }
    } catch(error){
        message(snapshot?'Открыт последний согласованный срез':error.message);
    } finally{
        if(refreshRequest===key) refreshRequest=null;
        refresh.disabled=false;
    }
}
async function offlineArchive(target){
    heading(target,'Офлайн-архив');
    const store=await caches.open(new URL('./',location.href).pathname+':saved');
    const files=new Set();
    for(const request of await store.keys()){
        const key=decodeURIComponent(new URL(request.url).pathname.split('/').at(-1));
        if(key.startsWith('orbita:doc:')) files.add(key.slice('orbita:doc:'.length));
        const legacy=/^document:(chapters|journal|radio|crew-diary):(\d{4}-\d{2}-\d{2})$/.exec(key);
        if(legacy) files.add(legacy[1]+'/'+legacy[2]+'.json');
    }
    const entries=[];
    for(const file of files){
        if(/^diary\/[A-Za-z0-9_.@-]+\.json$/.test(file)){
            const id=file.slice(6,-5);
            entries.push(makeLink('Дневник · '+(snapshot?.station.people?.[id]?.name||id),{type:'diary',id},'row'));
        }
        const doc=/^(chapters|journal|radio|crew-diary|flight-archive)\/(\d{4}-\d{2}-\d{2})\.json$/.exec(file);
        if(!doc) continue;
        const [,route,date]=doc;
        if(route==='flight-archive'){
            const data=await remember('orbita:doc:'+file);
            for(const row of arrayRows(data,'flights')) if(safeId.test(row.id??'')) entries.push(makeLink('Рейс '+row.id+' · '+date,{type:'flight-day',id:date+'.'+row.id},'row'));
        } else entries.push(makeLink(archives[route].title+' · '+date,{type:route,id:date},'row'));
    }
    if(entries.length) target.append(...entries);
    else target.append(element('p','Откройте выпуск журнала, главы или записи, чтобы сохранить их на устройстве.',{class:'muted'}));
}

async function archive(route,id){
    const revision=openArchive;
    const spec=archives[route];
    const parent=panel;
    heading(parent,spec.title,route==='radio'&&id&&!datePattern.test(id)?'Сообщения по выбранному рейсу':'');
    const index=await readDocument(spec.index).catch(error=>{
        if(datePattern.test(id)) return {[spec.rows]:[{date:id}]};
        throw error;
    });
    if(revision!==openArchive) return;
    const flight=route==='radio'&&id&&!datePattern.test(id)?id:'';
    const options=arrayRows(index,spec.rows).filter(row=>{
        const date=row.date||row.day;
        return datePattern.test(date)&&(!flight||!Array.isArray(row.flights)||row.flights.includes(flight));
    });
    if(datePattern.test(id) && !options.some(row=>(row.date||row.day)===id)) options.unshift({date:id});
    const controls=element('div','',{class:'controls'});
    const date=element('select','',{'aria-label':'Дата записи'});
    const body=element('div','',{class:'stack reader'});
    parent.append(controls,body);
    for(const row of options) date.append(element('option',row.title?row.title+' · '+(row.date||row.day):(row.date||row.day),{value:row.date||row.day}));
    if(!options.length){ parent.append(element('p','Публикаций пока нет',{class:'muted'})); return; }
    controls.append(date);
    if(options.some(row=>(row.date||row.day)===id)) date.value=id;
    async function choose(){
        const day=date.value;
        body.replaceChildren(element('p','Загрузка записи…',{class:'muted'}));
        await renderDocument(route+'/'+day+'.json',body,route,revision,flight);
    }
    date.onchange=()=>void choose().catch(error=>message(error.message));
    await choose();
}
function arrayRows(doc,key){ return Array.isArray(doc)?doc:Array.isArray(doc?.[key])?doc[key]:[]; }
async function renderDocument(path,body,route,revision,flight=''){
    const request=Symbol();
    body.request=request;
    const doc=await readDocument(path);
    const audioIndex=route==='radio'?await readDocument('radio/audio/index.json').catch(()=>null):null;
    if(revision!==openArchive||body.request!==request) return;
    body.replaceChildren(element('h3',doc.title||doc.date||doc.day||'Записи'));
    const saved=element('button','Сохранить запись офлайн',{type:'button'});
    saved.onclick=async()=>{
        try { await available; await remember('orbita:doc:'+path,doc); message('Запись сохранена'); }
        catch(error){ message(error.message); }
    };
    body.append(saved);
    const rows=['scenes','entries','notes'].map(key=>arrayRows(doc,key)).find(list=>list.length)?.filter(item=>!flight||item.flight===flight) ?? [];
    const links = {person:'person',area:'area',flight:'flight',vessel:'vessel',station:'destination',post:'post',expedition:'expedition',equipment:'equipment'};
    for(const entry of rows){
        const card=element('article','',{class:'stack'});
        const name=entry.title||entry.vessel?.name||clock(entry.at);
        if(name) card.append(element('h4',name));
        for(const value of String(entry.text||entry.line||entry.detail||'').split(/\n+/).filter(Boolean)) card.append(element('p',value));
        for(const line of arrayRows(entry,'messages')){
            const sentence=line.text||line.line;
            if(sentence) card.append(element('p',(line.from?.name?line.from.name+' · ':'')+sentence));
        }
        for(const note of arrayRows(entry,'notes')){
            const sentence=note.text||note.action||note.line;
            if(sentence) card.append(element('p',(note.name?note.name+' · ':'')+sentence));
        }
        const referenced=[...arrayRows(entry,'references'),entry.counterpart,entry.vessel,entry.post].filter(Boolean);
        for(const item of referenced){
            if(Object.hasOwn(links,item.type) && safeId.test(item.id??'')){
                const label=item.name||snapshot?.station.people?.[item.id]?.name||snapshot?.station.places?.[item.id]||item.id;
                card.append(makeLink(label,{type:links[item.type],id:item.id},'action'));
            }
        }
        const recording=arrayRows(audioIndex,'entries').find(item=>item.id===entry.id&&(item.language==='ru'||!item.language));
        if(recording && /^[a-z0-9_-]+\.(wav|mp3|ogg)$/i.test(recording.file)){
            const url=world('radio/audio/'+recording.file);
            const saveAudio=element('button','Сохранить аудио офлайн',{type:'button'});
            saveAudio.onclick=async()=>{
                saveAudio.disabled=true;
                try{ await available; await rememberFiles([url]); message('Аудиозапись сохранена'); }
                catch(error){ message(error.message); }
                finally{ saveAudio.disabled=false; }
            };
            card.append(element('audio','',{src:url,controls:'',preload:'none','aria-label':'Запись радиообмена'}),saveAudio);
        }
        body.append(card);
    }
    if(!rows.length) body.append(element('p','Записей пока нет',{class:'muted'}));
}
let artTransfer, artFamily='', artDeleting=false;
function showImage(path, title) {
    const viewer=element('dialog','',{'aria-label':title,class:'stack'});
    const done=element('button','Закрыть',{type:'button'});
    done.onclick=()=>viewer.close();
    viewer.append(done,element('img','',{src:artURL(path),alt:title}),element('p',title));
    viewer.addEventListener('close',()=>viewer.remove(),{once:true});
    document.body.append(viewer);
    viewer.showModal();
}
async function art() {
    const revision = openArchive;
    let entries = await artIndex(false);
    if (revision !== openArchive) return;
    const collection = element('div', '', {class: 'gallery'});
    const families = element('select', '', {'aria-label': 'Подборка артов'});
    const actions = element('div', '', {class: 'controls'});
    const all = element('button', 'Скачать или обновить все арты');
    const group = element('button', 'Сохранить подборку');
    const cancel = element('button', 'Остановить загрузку');
    const progress = element('p', '', {role: 'status', class: 'muted'});
    actions.append(all, group, cancel);
    function choices() {
        const selection = artFamily;
        families.replaceChildren(element('option', 'Все арты', {value: ''}));
        for (const name of artGroups(entries)) families.append(element('option', name, {value: name}));
        if (Array.from(families.options).some(option => option.value === selection)) families.value = selection;
    }
    function render() {
        const selected = artGroup(entries, families.value);
        collection.replaceChildren(...selected.map(({path}) => {
            const item = element('figure');
            const name = path.split('/').pop().split('.')[0].replaceAll('-', ' ');
            const open=element('button','',{type:'button','aria-label':name});
            open.append(element('img', '', {src: artURL(path), alt: '', loading: 'lazy'}),element('span',name,{class:'art-label'}));
            open.onclick=()=>showImage(path,name);
            item.append(open);
            return item;
        }));
        group.disabled = !families.value || !!artTransfer || artDeleting;
        all.disabled = !!artTransfer || artDeleting;
        cancel.hidden = !artTransfer;
    }
    families.onchange = () => { artFamily=families.value; render(); };
    cancel.onclick = () => artTransfer?.abort();
    async function download(selection) {
        if (artTransfer || artDeleting) return;
        const controller = new AbortController();
        artTransfer = controller;
        render();
        try {
            await available;
            entries = await artIndex(true);
            if (controller.signal.aborted) return;
            choices();
            const selected = artGroup(entries, selection);
            progress.textContent = `Проверяю ${selected.length} файлов…`;
            const status = await saveArt(selected, controller.signal, ({done, saved, unchanged}) => {
                progress.textContent = `${done} / ${selected.length} · скачано ${saved} · без изменений ${unchanged}`;
            });
            if (status.removed.length && !controller.signal.aborted) {
                const gone = new Set(status.removed);
                entries = entries.filter(row => !gone.has(row.path));
                await remember('art-index', {versioned: false, rows: entries});
            }
            if (controller.signal.aborted) message('Загрузка остановлена. Готовые арты сохранены.');
            else if (status.errors.length) {
                const first = status.errors[0];
                message(`Скачано ${status.saved}, без изменений ${status.unchanged}, недоступно ${status.errors.length}. ${first.path} · ${first.reason}`);
            }
            else message(`Офлайн-арты готовы · скачано ${status.saved} · без изменений ${status.unchanged}`);
        } catch (error) {
            controller.abort();
            message(error.name === 'QuotaExceededError' ? 'Не хватает места. Готовые арты сохранены.' : error.message);
        } finally {
            artTransfer = null;
            if (active.type === 'art') void art().catch(error => message(error.message));
            if (active.type === 'settings') render();
        }
    }
    all.onclick = () => { void download(''); };
    group.onclick = () => { void download(families.value); };
    panel.replaceChildren(element('h2', 'Арты станции'), families, actions, progress, collection);
    choices();
    render();
}


const seed=await getJSON(new URL('published-art.json',location.href)).catch(()=>({}));
for(const path of Object.keys(seed)) {
    const portrait=/^portraits\/([A-Za-z0-9_.@-]+)\.webp$/.exec(path);
    if(portrait) ui.portraits.add(portrait[1]);
}
void readDocument('portraits/index.json').then(ids=>{
    if(Array.isArray(ids)) for(const id of ids) if(typeof id==='string'&&safeId.test(id)) ui.portraits.add(id);
}).catch(()=>{});
snapshot=await remember('watch').catch(()=>null);
showRoute(true);
void loadSnapshot();
window.addEventListener('online',()=>void loadSnapshot());
window.setInterval(()=>{
    if(navigator.onLine && document.visibilityState==='visible') void loadSnapshot();
},60000);
