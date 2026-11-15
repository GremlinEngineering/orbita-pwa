import {element} from './site.js';
import {artURL} from './art-library.js';
import {portScreens} from './port-screens.js';

const array = value => Array.isArray(value) ? value : [];
const text = value => ['string','number'].includes(typeof value) ? String(value) : '';
const join = (...values) => values.map(text).filter(Boolean).join(' · ');
export const clock = value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value ?? '') ? value.slice(11,16) : '';
const when = value => clock(value) ? value.slice(8,10) + '.' + value.slice(5,7) + ' ' + clock(value) : '';
const unit = (value, suffix) => Number.isFinite(value)?join(value)+(suffix?' '+suffix:''):'';
const phaseNames = {
    berth:'У причала', inbound:'На подходе', approach:'Сближение', outbound:'На вылете', holding:'Ожидание',
    planned:'Запланирован', scheduled:'По расписанию', delayed:'Задержан', received:'Принят', completed:'Завершён', ready:'Готов',
    active:'Активен', limited:'Ограничен', closed:'Закрыт', free:'Свободен', occupied:'Занят',
    inFlight:'В пути', surveyPreparing:'Подготовка', surveying:'Обследование', surveyProject:'Проект',
    civil:'Гражданский борт', patrol:'Патруль', departure:'Отходит', cargo:'Грузовой рейс', expedition:'Экспедиция',
    running:'Работает', damaged:'Повреждена', isolated:'Изолирована', reserve:'Резерв', maintenance:'Обслуживание',
    observation:'Наблюдение', observed:'Наблюдение', pass:'Пролёт', flyby:'Пролёт'
};
const phase = value => phaseNames[value] ?? text(value);
const membership = person => person.group === 'crew' ? 'Экипаж' : person.group === 'guest' ? 'Гость' : '';
const windows = value => array(value).filter(pair=>Array.isArray(pair)&&pair.length===2)
    .map(pair=>pair.map(n=>String(n).padStart(2,'0')+':00').join('–')).join(', ');
const safeArt = value => typeof value === 'string' && /^[a-z0-9_-]+[/][a-z0-9_./-]+\.(?:webp|svg|png|jpe?g)$/i.test(value)
    && !value.split('/').some(part => part === '.' || part === '..');
const lightModes = {
    work:'Рабочее',dim:'Приглушённое',night:'Ночное',exterior:'Наружный участок',
    greenhouseNight:'Ночной режим',grow:'Досветка для роста',reserve:'Резервное'
};
const cropModes = {lost:'Урожай погиб',ready:'Готово к сбору',seedling:'Всходы',growing:'Рост'};
const screenModes = {off:'Выключен',idle:'В режиме ожидания',game:'Игра',film:'Фильм',series:'Сериал'};
const dockModes = {full:'Заряжен',charging:'Заряжается','waiting-power':'Ждёт питания',
    faulted:'Неисправен',away:'На задании','waiting-route':'Ждёт прохода'};
const tradeReasons = {window:'Окно доставки прошло',reserve:'Зелень оставили для кухни',
    shelfLife:'Партия не выдержит срок доставки',price:'Цена не покрывает отправку'};
const repairLabels = {equipment_restored:'Техника восстановлена',equipment_commissioned:'Техника введена в работу',
    network_restored:'Линия восстановлена',cabin_personalized:'Обстановка обновлена',
    expedition_analysis:'Материалы экспедиции разобраны'};
const cropStage = state => cropModes[state?.mode] ?? text(state?.mode);
const cropPercent = state => Number.isFinite(state?.percent) && state.percent>=0 && state.percent<=100 ? unit(state.percent,'%') : '';
const networkEntries = data => Object.entries(data?.networks ?? {}).map(([key,item])=>[item.id||key,item]);
const networkLabel = (data,id,item) => item?.title||item?.label||data?.names?.[id]||id;

export const networkTitle = (data,id) => networkLabel(data,id,networkEntries(data).find(([key])=>key===id)?.[1]);
export const stationSignals = station => array(station?.stationStatus?.signals);
export const networkSignals = (station,id) => stationSignals(station).filter(item=>item.network===id);
export const signalKey = item => (item.network||'signal')+'/'+(item.segment||item.title);
export const stationSignal = (station,id) => stationSignals(station).find(item=>signalKey(item)===id);
export const stationPost = (station,id) => array(station?.watch).find(item=>item.id===id);
const signalLevels={critical:'Авария',warning:'Предупреждение',info:'Сообщение',normal:'Норма'};
export const signalDetail = (item,title) => join(signalLevels[item.level]??item.level,title,item.detail);
export function postDetail(station,post) {
    if(!post) return 'Пост недоступен';
    if(!post.person) return 'Пост свободен';
    return join('На посту '+(station.people?.[post.person]?.name||post.person),post.relief?'Подмена':'');
}

export function heading(parent, name, detail) {
    parent.append(element('h2', name));
    if (detail) parent.append(element('p', detail, {class:'meta muted'}));
}
export function section(parent, title) {
    const body = element('div','',{class:'stack'});
    body.append(element('h3',title));
    parent.append(body);
    return body;
}
function picture(path, name, cls) {
    path = text(path).replace(/^\.\//,'');
    if (!safeArt(path)) return null;
    const image = element('img','',{src:artURL(path),alt:name,loading:'lazy',class:cls});
    image.addEventListener('error',()=> { image.closest('figure')?.setAttribute('hidden',''); image.hidden = true; },{once:true});
    return image;
}
function plate(parent, path, label, cls='') {
    const image = path==='network-section.svg' ? element('img','',{src:path,alt:label}) : picture(path,label,'');
    if (!image) return;
    const figure = element('figure','',{class:'plate '+cls});
    figure.append(image,element('figcaption',label));
    parent.append(figure);
}
function facts(parent, values, cls='facts') {
    const grid = element('div','',{class:cls});
    for (const [label,value] of values) {
        if (!text(value)) continue;
        const cell = element('div');
        cell.append(element('small',label),element('strong',text(value)));
        grid.append(cell);
    }
    if (grid.childElementCount) parent.append(grid);
}
function noRows(parent, value='Нет записей') { parent.append(element('p',value,{class:'muted'})); }
function bodyText(parent, paragraphs) {
    for (const value of array(paragraphs)) if (text(value)) parent.append(element('p',text(value)));
}
function singlePicture(path, name) { return picture(path,name,'avatar'); }

function deckMap(parent, graphic, view) {
    const controls=element('div','',{class:'controls'});
    const frame=element('div','',{class:'deck-viewport',tabindex:'0',role:'region','aria-label':'План палубы'});
    const smaller=element('button','Уменьшить',{type:'button'});
    const larger=element('button','Увеличить',{type:'button'});
    const reset=element('button','Сбросить масштаб',{type:'button'});
    controls.append(smaller,larger,reset);
    frame.append(graphic);
    parent.append(controls,frame);

    function draw() {
        graphic.style.width=(view.scale*100)+'%';
        frame.classList.toggle('zoomed',view.scale>1);
        smaller.disabled=reset.disabled=view.scale===1;
        larger.disabled=view.scale===4;
    }
    function zoom(scale,fromX=frame.clientWidth/2,fromY=frame.clientHeight/2,toX=fromX,toY=fromY) {
        if(!frame.isConnected) return;
        const previous=view.scale;
        const x=frame.scrollLeft, y=frame.scrollTop;
        view.scale=Math.max(1,Math.min(4,scale));
        draw();
        const ratio=view.scale/previous;
        frame.scrollLeft=(x+fromX)*ratio-toX;
        frame.scrollTop=(y+fromY)*ratio-toY;
    }
    smaller.onclick=()=>zoom(view.scale/1.5);
    larger.onclick=()=>zoom(view.scale*1.5);
    reset.onclick=()=>zoom(1);
    draw();
    frame.scrollLeft=view.x*graphic.offsetWidth;
    frame.scrollTop=view.y*graphic.offsetHeight;
    frame.onscroll=()=>{
        if(!frame.isConnected||!graphic.offsetWidth) return;
        view.x=frame.scrollLeft/graphic.offsetWidth;
        view.y=frame.scrollTop/graphic.offsetHeight;
    };

    const pointers=new Map();
    let moved=false;
    function gesture() {
        const [first,second]=pointers.values();
        if(!second) return first;
        return {x:(first.x+second.x)/2,y:(first.y+second.y)/2,distance:Math.hypot(first.x-second.x,first.y-second.y)};
    }
    frame.onpointerdown=event=>{
        if(event.button!==0 || pointers.size===2) return;
        if(!pointers.size) moved=false;
        pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    };
    frame.onpointermove=event=>{
        if(!pointers.has(event.pointerId)) return;
        const before=gesture();
        if(pointers.size===1&&!moved&&(view.scale===1||Math.hypot(event.clientX-before.x,event.clientY-before.y)<5)) return;
        pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        const after=gesture();
        if(!frame.hasPointerCapture(event.pointerId)) frame.setPointerCapture(event.pointerId);
        moved=true;
        const bounds=frame.getBoundingClientRect();
        const ratio=before.distance&&after.distance?after.distance/before.distance:1;
        zoom(view.scale*ratio,before.x-bounds.left,before.y-bounds.top,after.x-bounds.left,after.y-bounds.top);
    };
    function release(event){ pointers.delete(event.pointerId); }
    frame.onpointerup=frame.onpointercancel=release;
    frame.onlostpointercapture=event=>{ if(event.target===frame) release(event); };
    frame.onpointerleave=event=>{ if(!frame.hasPointerCapture(event.pointerId)) release(event); };
    frame.addEventListener('click',event=>{
        if(moved&&event.detail) { event.preventDefault(); event.stopPropagation(); }
    },true);
}

export function worldScreens(ui, snapshot, panel) {
    const {station, radar, flights} = snapshot;
    const people = station.people ?? {};
    const places = station.places ?? {};
    const areas = array(station.workAreas);
    const greenhouse = station.access?.lighting?.greenhouse;
    const greenhouseArea = greenhouse?.area || 'garden';
    const crops = array(greenhouse?.cells).filter(cell=>typeof cell.id==='string'&&/^[A-Za-z0-9_.@-]+$/.test(cell.id));
    const cropStates = station.access?.overlayState?.crops;
    const flightsList = [...array(flights.local),...array(flights.long)];
    const personName = id => people[id]?.name || text(id);
    const areaName = id => places[id] || areas.find(row=>row.id===id)?.title || text(id);
    const flight = id => flightsList.find(item=>item.id===id);
    const ref = (type,id='') => ({type,id});
    const peoplePath = id => ui.portraits.has(id) ? 'portraits/'+id+'.webp' : '';
    const headline = (title,meta='') => heading(panel,title,meta);

    function row(parent,title,detail,target,{image='', className=''}={}) {
        const item = target ? ui.link(title,target,'row '+className,false) : element('div','',{class:'row '+className});
        const avatar = singlePicture(image,'');
        if (avatar) item.append(avatar);
        const content = element('span','',{class:'copy'});
        content.append(element('strong',title));
        if (detail) content.append(element('small',detail));
        item.append(content);
        if (target) item.append(element('span','›',{class:'arrow','aria-hidden':'true'}));
        parent.append(item);
    }
    function personRow(parent,id,detail='') {
        if (!people[id]) return;
        const p = people[id];
        row(parent,personName(id),detail || join(p.role,p.onboard ? p.place : 'Вне станции'),ref('person',id),{image:peoplePath(id)});
    }
    function following(parent,type,id,inactive,title){
        const button=element('button','',{type:'button',class:'follow'});
        function draw(){
            const selected=ui.isFollowed(type,id);
            button.textContent=selected?'Наблюдение включено':inactive;
            button.setAttribute('aria-pressed',String(selected));
        }
        button.onclick=()=>{ui.toggleFollow(type,id,title);draw();};
        draw();
        parent.append(button);
    }
    function cargoRows(parent,manifest){
        for(const [key,title] of [['outbound','План снабжения'],['inbound','Ожидаемый обратный груз']]){
            if(array(manifest[key]).length) bodyText(section(parent,title),manifest[key]);
        }
    }
    function flightRow(parent,item) {
        const dest = item.destination || item.destinationId;
        row(parent,item.ship || item.label || item.id,join(phase(item.status),item.place && areaName(item.place),when(item.plannedArrival),dest),ref('flight',item.id));
    }
    function withDoc(path,parent,draw) {
        ui.document(path).then(draw).catch(error => noRows(parent,error.message));
    }
    function rich(parent, nodes) {
        const allowed = {paragraph:'p',heading:'h4',strong:'strong',emphasis:'em',list_item:'li',blockquote:'blockquote',code:'code'};
        function render(item) {
            if (typeof item === 'string') return document.createTextNode(item);
            if (!item || typeof item !== 'object') return document.createTextNode('');
            if (item.type==='text') return document.createTextNode(text(item.text));
            const children = array(item.children).map(render);
            let node;
            if (item.type==='link') {
                const target=ui.resolveLink(item.href);
                node=target ? ui.link('',target,'',false) : element('span');
            } else {
                node=element(item.type==='list' ? item.ordered ? 'ol' : 'ul' : allowed[item.type] || 'span');
            }
            node.append(...children);
            return node;
        }
        const block=element('div','',{class:'stack rich'});
        block.append(...array(nodes).map(render));
        parent.append(block);
    }
    function references(parent, refs) {
        for (const item of array(refs)) {
            if (item.type==='person' && people[item.id]) personRow(parent,item.id);
            if (item.type==='area' && places[item.id]) row(parent,areaName(item.id),'Отсек',ref('area',item.id));
            if (item.type==='flight' && flight(item.id)) flightRow(parent,flight(item.id));
        }
    }
    function watch() {
        const onboard=Object.values(people).filter(p=>p.onboard);
        const postsCount=array(station.watch).length;
        const plural=new Intl.PluralRules('ru').select(postsCount);
        headline('Текущая вахта',join(postsCount+' '+({one:'пост',few:'поста'}[plural]??'постов'),onboard.length+' человек на борту'));
        const dashboard=element('div','',{class:'watch-layout'});
        const primary=element('div','',{class:'stack'});
        const secondary=element('div','',{class:'stack'});
        dashboard.append(primary,secondary);
        panel.append(dashboard);
        const lead=array(station.watch).find(post=>post.id===station.watchLead);
        if (lead && people[lead.person]) {
            const card=element('div','',{class:'lead'});
            personRow(card,lead.person,join('Старший вахты',lead.title,lead.place));
            primary.append(card);
        }
        const signals=section(primary,'Сигналы станции');
        const signalsList=stationSignals(station);
        if (!signalsList.length) noRows(signals,'Активных сигналов нет');
        for(const item of signalsList){
            row(signals,item.title,signalDetail(item),ref('signal',signalKey(item)),{className:'level-'+item.level});
        }
        const next = flights.next?.arrival;
        if (next?.id && flight(next.id)) {
            const arrival=section(primary,'Ближайший рейс');
            row(arrival,next.ship||next.id,join(phase(next.status),next.plannedAt&&'План '+when(next.plannedAt),next.estimatedAt&&'Прогноз '+when(next.estimatedAt)),ref('flight',next.id));
        }
        if (Object.values(ui.follows).some(set=>set.size)) {
            const followed=section(secondary,'Под наблюдением');
            for (const id of ui.follows.person) personRow(followed,id);
            for(const id of ui.follows.flight){
                const item=flight(id);
                if(item) flightRow(followed,item);
                else row(followed,id,'Архив рейса',ref('flight-archive',id));
            }
            for(const id of ui.follows.systems){
                const signalTitles=networkSignals(station,id).map(item=>item.title).filter(Boolean);
                row(followed,networkTitle(station.infrastructure,id),signalTitles.join(' · ')||'Активных сигналов нет',ref('systems',id));
            }
            for(const id of ui.follows.post){
                const post=stationPost(station,id);
                row(followed,post?.title||id,postDetail(station,post),ref('post',id));
            }
            for(const [id,title] of ui.follows.signal){
                const item=stationSignal(station,id);
                row(followed,item?.title||title,item?signalDetail(item):'Сигнал снят',ref('signal',id));
            }
        }
        if(ui.dutyEnabled&&ui.dutyEvents.length){
            const notices=section(secondary,'Оповещения дежурства');
            for(const item of ui.dutyEvents) row(notices,item.title,item.detail,ref(item.type,item.id));
        }
        const posts=section(primary,'Вахтенные посты');
        for (const post of array(station.watch)) {
            row(posts,post.title,join(personName(post.person)||'Пост свободен',post.place,post.relief?'Подмена':''),ref('post',post.id));
        }
        const quick=section(secondary,'По станции');
        row(quick,'Радар порта','Контакты и причалы',ref('radar'));
        row(quick,'График дежурств','Смены по отсекам',ref('schedule'));
        row(quick,'Радиопереговоры','Открытый канал порта',ref('radio'));
        const recent=section(secondary,'Последние события');
        withDoc('port-summary.json',recent,doc=>{
            for (const item of array(doc.events).slice(0,6)) {
                const date=(item.at??'').slice(0,10);
                row(recent,item.text||item.title,clock(item.at),date ? ref('journal',date) : null);
                references(recent,item.references);
            }
        });
    }
    function post(id) {
        const info=stationPost(station,id);
        if(!info){
            headline('Пост недоступен');
            if(ui.isFollowed('post',id)) following(panel,'post',id,'Наблюдать за постом');
            return;
        }
        headline(info.title,info.place);
        following(panel,'post',id,'Наблюдать за постом');
        if(info.person&&people[info.person]) personRow(panel,info.person,info.relief?'На посту · подмена':'На посту');
        else noRows(panel,postDetail(station,info));
        if (info.area) row(panel,areaName(info.area),'Отсек',ref('area',info.area));
        const roster=section(panel,'Специалисты поста');
        array(info.specialists).forEach(person=>personRow(roster,person));
    }
    function signal(id) {
        const item=stationSignal(station,id);
        if(!item){
            headline(ui.follows.signal.get(id)||'Сигнал снят',ui.isFollowed('signal',id)?'Сигнал снят':'');
            if(ui.isFollowed('signal',id)) following(panel,'signal',id,'Наблюдать сигнал');
            return;
        }
        headline(item.title,signalDetail(item));
        following(panel,'signal',id,'Наблюдать сигнал',item.title);
        if (item.area) row(panel,areaName(item.area),'Отсек',ref('area',item.area));
        if (item.network) row(panel,'Инженерные сети',item.segment,item.segment?
            ref('network-link',item.network+'.'+item.segment):ref('systems',item.network));
        if (!item.area && !item.network) row(panel,'Резервы станции','Состояние и прогноз',ref('economy'));
    }
    function crew() {
        headline('Экипаж и гости',Object.keys(people).length+' человек в реестре');
        const controls=element('div','',{class:'controls'});
        const search=element('input','',{type:'search',placeholder:'Имя, должность или отсек','aria-label':'Поиск по экипажу'});
        const roles=element('div','',{class:'controls'});
        const list=element('div','',{class:'rows'});
        controls.append(search);
        panel.append(controls,roles,list);
        let filter=ui.crewFilter;
        function draw() {
            const query=search.value.trim().toLocaleLowerCase('ru');
            const matches=Object.entries(people).filter(([id,p])=>
                (!filter || filter==='onboard' && p.onboard || filter===p.group)
                && join(p.name,p.role,p.place,id).toLocaleLowerCase('ru').includes(query));
            matches.sort(([,a],[,b])=>String(a.name).localeCompare(String(b.name),'ru'));
            list.replaceChildren();
            if (!matches.length) noRows(list,'Люди не найдены');
            matches.forEach(([id])=>personRow(list,id));
            for (const button of roles.children) button.setAttribute('aria-pressed',String(button.dataset.kind===filter));
        }
        for (const [id,label] of [['','Все'],['crew','Экипаж'],['guest','Гости'],['onboard','На борту']]) {
            const button=element('button',label,{type:'button','data-kind':id});
            button.onclick=()=>{ ui.crewFilter=filter=id; draw(); };
            roles.append(button);
        }
        row(panel,'Командная структура','Роли и подчинение',ref('command'));
        row(panel,'Связи экипажа','Отношения, причины и изменения',ref('relationships'));
        search.value=ui.crewQuery;
        search.oninput=()=>{ ui.crewQuery=search.value; draw(); };
        draw();
    }
    function person(id) {
        const p=people[id];
        if (!p){
            headline('Досье экипажа');
            withDoc('object-links.json',panel,data=>{
                const entry=data.people?.[id];
                if(!entry) return noRows(panel,'Досье на человека не опубликовано');
                panel.querySelector('h2').textContent=entry.name||id;
                if(entry.role) panel.append(element('p',entry.role,{class:'muted'}));
                plate(panel,peoplePath(id),entry.name||id,'portrait');
                for(const vessel of array(entry.vesselIds)) row(panel,vessel,'Борт',ref('vessel',vessel));
                if(entry.homeId) row(panel,'Приписка',entry.homeId,ref('destination',entry.homeId));
            });
            return;
        }
        headline(p.name,join(p.role,membership(p),p.onboard?'На борту':'Вне станции'));
        plate(panel,peoplePath(id),p.name,'portrait');
        following(panel,'person',id,'Наблюдать');
        if (p.locationArea) row(panel,areaName(p.locationArea),'Текущее местоположение',ref('area',p.locationArea));
        if (p.serviceArea && p.serviceArea!==p.locationArea) row(panel,areaName(p.serviceArea),'Место службы',ref('area',p.serviceArea));
        facts(panel,[['Задача',p.task?.title ?? p.task],['Возраст',p.age],['Каюта',p.cabin?.id],
            ['Смена',windows(p.workWindows)]]);
        if (p.cabin?.layout?.image) plate(panel,'rooms/'+p.cabin.layout.image,p.cabin.layout.title || 'Каюта');
        if (array(p.biography).length) bodyText(section(panel,'Биография'),p.biography);
        const dossier=element('div','',{class:'stack'});
        panel.append(dossier);
        withDoc('dossiers.json',dossier,data=>{
            if (array(data.profiles?.[id]).length) rich(section(dossier,'Досье'),data.profiles[id]);
        });
        if (array(p.relationships).length) {
            const links=section(panel,'Связи');
            for (const related of p.relationships) personRow(links,related.person,join(array(related.feelings).join(', '),related.basis));
        }
        if(p.group==='crew') row(panel,'Граф связей','Исходящие и входящие отношения',ref('relationships',id));
        const diaryLink=element('div','',{class:'stack'});
        panel.append(diaryLink);
        ui.document('crew-diary.json').then(index=>{
            if(array(index.days).some(day=>array(day.people).includes(id))) row(diaryLink,'Личный дневник','Опубликованные записи',ref('diary',id));
        }).catch(()=>{});
    }
    function stationIndex() {
        headline('Станция','Орбитальный порт Империи');
        row(panel,'План палубы','Отсеки и причалы',ref('maps'));
        row(panel,'Радар порта','Ближняя зона',ref('radar'));
        row(panel,'Инженерные сети','Состояние контуров',ref('systems'));
        row(panel,'Оборудование','Реестр установок и иллюстрации',ref('equipment'));
        row(panel,'График дежурств','Плановые смены',ref('schedule'));
        row(panel,'Экономика порта','Сводка и резервы',ref('economy'));
        row(panel,'О мире','Станция и её история',ref('about'));
        const rooms=section(panel,'Отсеки');
        Object.keys(places).forEach(id=>row(rooms,areaName(id),id===greenhouseArea&&crops.length?'Карточки культур':'',ref('area',id)));
    }
    function maps() {
        headline('Схемы станции');
        const choices=element('div','',{class:'controls'});
        const layout=element('div','',{class:'stack'});
        panel.append(choices,layout);
        const planButton=element('button','План палубы',{type:'button'});
        const sectionButton=element('button','Разрез станции',{type:'button'});
        choices.append(planButton,sectionButton);
        function show(sectionMode) {
            ui.deckView.section=sectionMode;
            layout.replaceChildren();
            planButton.setAttribute('aria-pressed',String(!sectionMode));
            sectionButton.setAttribute('aria-pressed',String(sectionMode));
            const graphic=element('div','',{class:sectionMode?'plate':'map-stage'});
            graphic.append(element('img','',{src:sectionMode?'network-section.svg':'map-plan.svg',class:'map',
                alt:sectionMode?'Разрез станции':'План палубы',draggable:'false'}));
            if(sectionMode){
                layout.append(graphic);
                return;
            }
            deckMap(layout,graphic,ui.deckView);
            const pins=element('div','',{class:'map-pins'});
            graphic.append(pins);
            withDoc('./deck-points.json',pins,points=>{
                for (const [id,[x,y]] of Object.entries(points)) {
                    if (!['A','B','C','control','infirmary','school','garden','quarters','utilities','galley'].includes(id)||!places[id]) continue;
                    const pin=ui.link(id.length===1?id:areaName(id).slice(0,2),ref('area',id),'map-pin');
                    pin.title=areaName(id);
                    pin.setAttribute('aria-label',areaName(id));
                    pin.style.left=((x-120)/5.7)+'%';
                    pin.style.top=((y-173)/5.76)+'%';
                    pins.append(pin);
                }
            });
            const access=section(layout,'Все отсеки');
            Object.keys(places).forEach(id=>row(access,areaName(id),'',ref('area',id)));
        }
        planButton.onclick=()=>show(false);
        sectionButton.onclick=()=>show(true);
        show(ui.deckView.section);
    }
    function roomDetails(id,access,layout) {
        const live=access.overlayState;
        const screen=access.roomScreens?.[id];
        const bag=layout?.baggage, cargo=layout?.cargo, docks=layout?.docks;
        const freight=Array.isArray(cargo)?array(live?.cargo):[];
        const reading=[
            ['Освещение',lightModes[access.lighting?.rooms?.[id]]??text(access.lighting?.rooms?.[id])],
            ['Экран кают-компании',screen&&join(screenModes[screen.mode]??screen.mode,screen.title)],
            ['Багажные ячейки',Array.isArray(bag)&&Array.isArray(live?.baggage)&&live.baggage.length+' из '+bag.length],
            ['Партии на приёмке',Array.isArray(cargo)&&Array.isArray(live?.cargo)&&freight.length]
        ];
        if(Array.isArray(docks)){
            for(const dock of array(live?.docks)){
                reading.push([dock.title||'Дрон',join(Number.isFinite(dock.dock)?'Док '+dock.dock:'',dockModes[dock.status]??dock.status)]);
            }
        }
        for(const event of array(access.recentRepairs?.[id])){
            if(Object.hasOwn(repairLabels,event.kind)) reading.push([repairLabels[event.kind],join(event.title,when(event.at))]);
        }
        const trade=id===greenhouseArea ? access.gardenTrade : null;
        if(!reading.some(([,value])=>text(value))&&!freight.length&&!trade) return;
        const details=section(panel,'Состояние отсека');
        facts(details,reading);
        for(const lot of freight){
            row(details,lot.title||'Партия груза','Груз на приёмке',lot.flight?ref('flight',lot.flight):null);
        }
        if(trade){
            const detail=join(trade.accept?unit(trade.grams,'г'):tradeReasons[trade.reason],
                Number.isFinite(trade.reserve)?'Резерв кухни '+unit(trade.reserve,'г'):'',when(trade.at));
            row(details,trade.accept?'Зелень передана на рейс':'Поставка зелени не согласована',
                detail,trade.flight?ref('flight',trade.flight):null);
        }
    }
    function roomIndicators(room,access,layout){
        const state=access.overlayState;
        function mark(box,status){
            if(!Array.isArray(box)||box.length!==4||!box.every(Number.isFinite)) return;
            const [x,y,width,height]=box;
            const item=element('span','',{class:'room-indicator','data-tone':status,'aria-hidden':'true'});
            Object.assign(item.style,{left:x+'%',top:y+'%',width:width+'%',height:height+'%'});
            room.append(item);
        }
        if(Array.isArray(state?.baggage)){
            array(layout?.baggage).forEach((box,index)=>mark(box,state.baggage.includes(index+1)?'busy':'normal'));
        }
        if(Array.isArray(state?.cargo)){
            array(layout?.cargo).forEach((box,index)=>mark(box,index<state.cargo.length?'busy':'normal'));
        }
        for(const dock of array(state?.docks)){
            mark(layout?.docks?.[dock.dock-1],dock.status==='faulted'?'fault':text(dock.status).startsWith('waiting')?'busy':'normal');
        }
    }
    function area(id) {
        if (!places[id]) return noRows(panel,'Отсек недоступен в текущем срезе');
        const work=areas.find(item=>item.id===id);
        const access=station.access??{};
        const state=array(access?.areas).find(area=>area.id===id);
        headline(areaName(id),state?.purpose);
        const roomAsset=access?.roomImages?.[id];
        const layout=access.roomOverlays?.[roomAsset];
        const image=roomAsset && picture('rooms/'+roomAsset,areaName(id),'');
        if(image){
            const graphic=element('figure','',{class:'plate room-image'});
            const room=element('div','',{class:'room-plot'});
            room.append(image);
            if(layout) roomIndicators(room,access,layout);
            for(const point of array(access.roomHotspots?.[roomAsset])){
                if(point.from!==id||!places[point.to]||![point.x,point.y,point.w,point.h].every(Number.isFinite)) continue;
                const marker=ui.link(point.code||'›',ref('area',point.to),'room-door');
                marker.setAttribute('aria-label',areaName(point.to));
                marker.title=areaName(point.to);
                marker.style.left=point.x+'%';
                marker.style.top=point.y+'%';
                marker.style.width=point.w+'%';
                marker.style.height=point.h+'%';
                room.append(marker);
            }
            graphic.append(room);
            panel.append(graphic);
        }
        roomDetails(id,access,layout);
        if(id===greenhouseArea && crops.length){
            const cells=section(panel,'Ячейки оранжереи');
            for(const cell of crops){
                const state=cropStates?.[cell.id];
                row(cells,join(cell.id,cell.crop),join(cropStage(state),cropPercent(state)),ref('crop',cell.id));
            }
        }
        const here=section(panel,'Сейчас в отсеке');
        const present=Object.entries(people).filter(([,p])=>p.onboard && p.locationArea===id);
        if (!present.length) noRows(here,'В текущем срезе людей нет');
        present.forEach(([person])=>personRow(here,person));
        if (array(work?.scheduled).length) {
            const shift=section(panel,'По графику');
            work.scheduled.forEach(person=>personRow(shift,person));
        }
        const traffic=flightsList.filter(item=>item.place===id && ['berth','holding','approach','inbound'].includes(item.status));
        if (traffic.length) traffic.forEach(item=>flightRow(panel,item));
        const paths=section(panel,'Соседние отсеки');
        withDoc('topology.json',paths,data=>{
            const adjacent=new Map();
            for (const edge of [...array(data.plan?.ringLinks),...array(data.plan?.links)]) {
                const peer=edge.from===id?edge.to:edge.to===id?edge.from:null;
                if (peer && places[peer] && !adjacent.has(peer)) adjacent.set(peer,edge);
            }
            for (const [peer,edge] of adjacent) row(paths,areaName(peer),join(edge.minutes && edge.minutes+' мин',edge.label),ref('area',peer));
            if (!adjacent.size) noRows(paths,'Связи отсека не опубликованы');
        });
    }
    function crop(id) {
        const cell=crops.find(item=>item.id===id);
        if(!cell){
            headline('Оранжерея');
            noRows(panel,'Ячейка недоступна в текущем срезе');
            return;
        }
        const state=cropStates?.[id];
        headline(cell.crop||'Культура', 'Ячейка '+id);
        const image=cell.image && picture('rooms/'+cell.image,cell.crop||'Ячейка '+id,'');
        if(image){
            const figure=element('figure','',{class:'plate'});
            const room=element('div','',{class:'room-plot'});
            room.append(image);
            const points=array(station.access?.roomOverlays?.[cell.image]?.crop);
            if(state?.mode&&points.length>=3&&points.every(point=>
                Array.isArray(point)&&point.length===2&&point.every(value=>Number.isFinite(value)&&value>=0&&value<=100))){
                const overlay=element('div','',{class:'crop-overlay','data-state':state.mode,'aria-hidden':'true'});
                overlay.style.clipPath='polygon('+points.map(([x,y])=>x+'% '+y+'%').join(', ')+')';
                room.append(overlay);
            }
            figure.append(room);
            panel.append(figure);
        }
        facts(panel,[
            ['Состояние',cropStage(state)||'Нет данных'],
            ['Рост',cropPercent(state)],
            ['Освещение',lightModes[cell.mode]??text(cell.mode)],
            ['Полив',typeof cell.irrigated==='boolean'?(cell.irrigated?'Есть':'Нет'):'']
        ]);
        row(panel,'Все ячейки оранжереи','',ref('area',greenhouseArea));
    }
    function traffic() {
        headline('Рейсы','Ближние и дальние маршруты');
        row(panel,'Схема маршрутов','Пункты назначения и позиции бортов',ref('routes'));
        row(panel,'Экспедиции','Действующие караваны и резерв',ref('expedition'));
        row(panel,'Наблюдения','Внешняя обстановка у станции',ref('observations'));
        row(panel,'Радар порта','Контакты и причалы',ref('radar'));
        row(panel,'Радиопереговоры','Сообщения по рейсам',ref('radio'));
        row(panel,'Архив рейсов','Рейсы по позывному и дате',ref('flight-archive'));
        const local=section(panel,'Ближние рейсы');
        const long=section(panel,'Дальние рейсы');
        array(flights.local).forEach(item=>flightRow(local,item));
        array(flights.long).filter(item=>item.service!=='expedition').forEach(item=>flightRow(long,item));
        if (!flightsList.length) noRows(local);
        const routes=section(panel,'Пункты назначения');
        withDoc('stations.json',routes,data=>{
            for (const item of array(data.stations)) if (item.id) row(routes,item.name||item.title||item.id,item.description,ref('destination',item.id));
        });
    }
    function flightDetail(id) {
        const item=flight(id);
        if (!item) return ops.archive(id);
        headline(item.ship||item.id,join(phase(item.status),phase(item.service)));
        following(panel,'flight',id,'Наблюдать рейс');
        const timeline=section(panel,'План и отметки');
        const next=flights.next?.arrival;
        facts(timeline,[['Пункт отправления',item.origin||item.originId],['Назначение',item.destination||item.destinationId],
            ['План прибытия',when(item.plannedArrival)],['Прогноз прибытия',when(item.estimatedArrival||(next?.id===id?next.estimatedAt:''))],
            ['Подход',when(item.approach)],['Прибытие',when(item.arrival)],['План отправления',when(item.plannedDeparture)],
            ['Прогноз отправления',when(item.estimatedDeparture)],['Фактическое отправление',when(item.departure)],
            ['До цели',when(item.destinationEta)],['Прибытие к цели',when(item.destinationArrival)],['Груз принят',when(item.received)],
            ['Возвращение',when(item.returnedAt||item.returnEta)],['Положение',item.position?.label],['Груз',item.cargo?.title]]);
        if(item.position) row(panel,'Позиция на схеме маршрутов',item.position.label,ref('routes'));
        if(item.cargo?.finalPlace && places[item.cargo.finalPlace]) row(panel,areaName(item.cargo.finalPlace),'Место монтажа',ref('area',item.cargo.finalPlace));
        if(item.report||item.note||item.reason) panel.append(element('p',item.report||item.note||item.reason));
        if (item.place && places[item.place]) row(panel,areaName(item.place),'Причал рейса',ref('area',item.place));
        if (item.vesselId) row(panel,item.ship||item.vesselId,'Карточка борта',ref('vessel',item.vesselId));
        if (item.destinationId && item.destinationId!=='station') row(panel,item.destination||item.destinationId,'Пункт назначения',ref('destination',item.destinationId));
        if (item.clearance?.personId) personRow(panel,item.clearance.personId,'Выдал разрешение');
        const crewIds=array(item.crew).map(member=>typeof member==='string'?member:member.id).filter(id=>people[id]);
        if (crewIds.length) crewIds.forEach(id=>personRow(panel,id));
        if (array(item.freight).length) for (const cargo of item.freight) row(panel,cargo.title||cargo.id,join(cargo.kg&&cargo.kg+' кг',phase(cargo.status)),null);
        if(item.service==='expedition') ops.expeditionDetails(panel,item);
        row(panel,'Радиопереговоры рейса','Отфильтрованный архив',ref('radio',id));
        ops.flightHistory(panel,id);
    }
    function radarScreen() {
        headline('Радар порта',join(phase(radar.sensor),when(radar.hour)));
        const filters=element('div','',{class:'controls'});
        const display=element('div','',{class:'radar','aria-label':'Схема ближней зоны'});
        const rows=element('div','',{class:'rows'});
        panel.append(filters,display,rows);
        const source=item=>item.source==='traffic'?'traffic':'observed';
        function draw(filter) {
            display.replaceChildren(element('span','Орбита',{class:'radar-center'}));
            rows.replaceChildren();
            const contacts=array(radar.contacts).filter(item=>!filter||source(item)===filter);
            contacts.forEach((item,i)=>{
                const title=item.label||item.ship||item.id;
                const resolved=item.flight&&flight(item.flight);
                const target=resolved?ref('flight',resolved.id):ref('contact',item.id);
                row(rows,title,join(phase(item.phase),item.area&&areaName(item.area)),target);
                if(i>=18) return;
                const marker=ui.link(String(i+1),target,'radar-dot');
                marker.setAttribute('aria-label',title);
                const angle=(i*2.3999632297+Math.PI/5), radius=i<7?25:40;
                marker.style.left=(50+radius*Math.cos(angle))+'%';
                marker.style.top=(50+radius*Math.sin(angle))+'%';
                display.append(marker);
            });
            if(!contacts.length) noRows(rows,'Контактов нет');
            for(const button of filters.children) button.setAttribute('aria-pressed',String(button.dataset.kind===filter));
        }
        for(const [key,name] of [['','Все'],['traffic','Рейсы'],['observed','Наблюдения']]){
            const filter=element('button',name,{type:'button','data-kind':key});
            filter.onclick=()=>draw(key);
            filters.append(filter);
        }
        draw('');
        const docks=section(panel,'Причалы');
        const contactRef=item=>item.flight&&flight(item.flight)?ref('flight',item.flight):item.vesselId?ref('vessel',item.vesselId):null;
        for(const dock of array(radar.sectors)){
            row(docks,areaName(dock.id),join(phase(dock.state),dock.reason,when(dock.until)),ref('area',dock.id));
            for(const item of array(dock.flights)) row(docks,item.label||item.flight,'У причала',contactRef(item));
        }
        const plan=radar.berthPlan;
        const interval=row=>[when(row.from),when(row.until)].filter(Boolean).join(' — ');
        if(array(plan?.areas).length){
            const horizon=section(panel,'График причалов · 24 часа');
            horizon.append(element('p',interval(plan),{class:'muted meta'}));
            const windowNames={berthed:'Занято',arrival:'Окно захода',planned:'По плану',departure:'Окно отхода',limited:'Ограничение',closed:'Закрыто'};
            for(const berth of plan.areas){
                const column=section(horizon,areaName(berth.id));
                for(const item of array(berth.windows)){
                    row(column,item.label||'Окно',join(windowNames[item.kind]||phase(item.kind),interval(item),item.until?'':'Окончание уточняется',item.reason,item.detail),contactRef(item));
                }
                for(const item of array(berth.waiting)){
                    row(column,item.label||'Борт',join('Ожидает',when(item.estimatedArrival),item.reason),contactRef(item));
                }
                for(const conflict of array(berth.conflicts)) row(column,'Пересечение окон',join(interval(conflict),array(conflict.labels).join(' / ')),null,{className:'level-warning'});
                if(!array(berth.windows).length&&!array(berth.waiting).length&&!array(berth.conflicts).length) noRows(column,'Окон и очереди нет');
            }
        }
        if(array(radar.forecast).length){
            const meteor=section(panel,'Метеопотоки');
            for(const item of radar.forecast) row(meteor,item.title||({leonids:'Леониды',perseids:'Персеиды',geminids:'Геминиды'}[item.id]??item.id),when(item.at),null);
        }
    }
    function contact(id) {
        const item=array(radar.contacts).find(x=>x.id===id);
        if(!item) return noRows(panel,'Контакт вышел из ближней зоны');
        headline(item.label||item.id,join(phase(item.phase),item.area&&areaName(item.area),when(item.at)));
        if(item.area && places[item.area]) row(panel,areaName(item.area),'Зона контакта',ref('area',item.area));
        if(item.vesselId) row(panel,'Карточка борта',item.vesselId,ref('vessel',item.vesselId));
    }
    function destination(id) {
        headline('Пункт назначения');
        withDoc('stations.json',panel,data=>{
            const item=array(data.stations).find(x=>x.id===id);
            if(!item) return noRows(panel,'Пункт назначения не опубликован');
            panel.querySelector('h2').textContent=item.name||item.title||id;
            if(item.description) panel.append(element('p',item.description));
            const path=item.view?.image||item.image;
            if(path) plate(panel,path,item.name||id);
            ops.passport(panel,item);
            if(item.project?.expedition) row(panel,'Экспедиция пункта','Караван и материалы',ref('expedition',item.project.expedition));
            if(id==='station') row(panel,'План палубы','Отсеки и причалы станции',ref('maps'));
            flightsList.filter(f=>f.destinationId===id||f.originId===id).forEach(f=>flightRow(panel,f));
            withDoc('object-links.json',panel,links=>{
                const connections=links.stations?.[id];
                for(const vesselId of array(connections?.vesselIds)) row(panel,links.vessels?.[vesselId]?.name||vesselId,'Приписанный борт',ref('vessel',vesselId));
                if(array(connections?.personIds).length){
                    const staff=section(panel,'Люди');
                    for(const personId of connections.personIds) personRow(staff,personId);
                }
            });
        });
    }
    function vessel(id) {
        const candidate=Array.isArray(flights.vessels)?flights.vessels.find(item=>item.id===id):flights.vessels?.[id];
        headline(candidate?.name||flightsList.find(item=>item.vesselId===id)?.ship||id,'Карточка борта');
        if(candidate?.description) panel.append(element('p',candidate.description));
        if(candidate?.image) plate(panel,candidate.image,candidate.name||id);
        if(candidate?.equipmentId) row(panel,'Досье техники','Характеристики и виды',ref('equipment',candidate.equipmentId));
        if(candidate?.baseId) row(panel,'Порт приписки',candidate.baseId,ref('destination',candidate.baseId));
        const registry=section(panel,'Экипаж и смены');
        withDoc('equipment.json',registry,data=>{
            const ship=array(data.ships).find(row=>row.id===id);
            const crew=array(ship?.shifts).length?ship.shifts:array(ship?.crew);
            if(ship?.image) plate(registry,ship.image.includes('/')?ship.image:'equipment/'+ship.image,ship.name||id);
            if(crew.length){
                for(const member of crew){
                    const title=member.name||personName(member.id);
                    const detail=join(member.role,member.window&&windows([member.window]));
                    if(people[member.id]) personRow(registry,member.id,detail);
                    else if(member.id) row(registry,title,detail,ref('person',member.id));
                }
            } else {
                for(const person of array(candidate?.personIds)) personRow(registry,person);
                if(!array(candidate?.personIds).length) noRows(registry,'Экипаж пока не опубликован');
            }
        });
        for(const item of flightsList.filter(item=>item.vesselId===id)) flightRow(panel,item);
    }
    function schedule() {
        headline('График дежурств');
        withDoc('schedule.json',panel,data=>{
            for(const [id,roster] of Object.entries(data.areas??{})){
                row(panel,areaName(id),'Отсек',ref('area',id));
                for(const person of array(roster.people)) personRow(panel,person.id,join(person.role,windows(person.windows)));
            }
        });
    }
    function command() {
        headline('Командная структура');
        withDoc('command.json',panel,data=>{
            function branch(target,item){
                if(!item || typeof item!=='object') return;
                const group=element('details');
                const id=item.holder||item.personId||item.person;
                group.append(element('summary',join(item.title||item.role||item.id,personName(id))));
                if(id) personRow(group,id);
                if(item.mandate) group.append(element('p',item.mandate));
                for(const member of array(item.members)) personRow(group,member);
                for(const sub of array(item.children||item.reports)) branch(group,sub);
                target.append(group);
            }
            array(data.tree?.roots).forEach(item=>branch(panel,item));
        });
    }
    function networkDocument(draw) {
        ui.document('networks.json').catch(error=>{
            if(station.infrastructure?.networks) return station.infrastructure;
            throw error;
        }).then(data=>{
            if(station.releaseId&&data.releaseId&&data.releaseId!==station.releaseId&&station.infrastructure?.networks){
                return station.infrastructure;
            }
            return data;
        }).then(draw).catch(error=>noRows(panel,error.message));
    }
    function systems(id) {
        headline(id?'Инженерный контур':'Системы и резервы');
        if(!id) plate(panel,'network-section.svg','Разрез инженерных систем');
        networkDocument(data=>{
            for(const [itemId,net] of networkEntries(data)) {
                if(id&&id!==itemId) continue;
                const title=networkLabel(data,itemId,net);
                if(!id){
                    row(panel,title,join(net.unit,phase(net.status),ui.isFollowed('systems',itemId)?'Под наблюдением':''),ref('systems',itemId));
                    continue;
                }
                panel.querySelector('h2').textContent=title;
                following(panel,'systems',itemId,'Наблюдать систему');
                const alerts=section(panel,'Сигналы');
                for(const signal of networkSignals(station,itemId)){
                    row(alerts,signal.title,signalDetail(signal),ref('signal',signalKey(signal)),{className:'level-'+signal.level});
                }
                if(alerts.children.length===1) noRows(alerts,'Активных сигналов нет');
                const links=array(net.links||net.edges||net.segments);
                const nodes=new Map(array(net.nodes).map(node=>[node.id,node]));
                const nodeRows=section(panel,'Узлы');
                for(const node of nodes.values()){
                    const report=[['Подача',node.supply],['Доставлено',node.delivered],['Потребность',node.demand]]
                        .map(([label,value])=>unit(value,net.unit)?label+' '+unit(value,net.unit):'');
                    row(nodeRows,node.label||node.name||node.id,join(node.placeName,...report),places[node.place]?ref('area',node.place):null);
                }
                const edgeRows=section(panel,'Линии');
                for(const edge of links){
                    const from=nodes.get(edge.from),to=nodes.get(edge.to);
                    row(edgeRows,edge.title||join(from?.label||areaName(edge.from),to?.label||areaName(edge.to))||edge.id,
                        join(phase(edge.status||edge.state),unit(edge.flow,net.unit),unit(edge.observedWear,'%')),edge.id?ref('network-link',itemId+'.'+edge.id):null);
                }
                if(!links.length) noRows(edgeRows,'Участки контура не опубликованы');
                return;
            }
            if(id){
                if(ui.isFollowed('systems',id)) following(panel,'systems',id,'Наблюдать систему');
                noRows(panel,'Контур недоступен в текущем срезе');
            } else {
                const reserves=section(panel,'Резервы');
                for(const item of array(station.stationStatus?.reserves)){
                    row(reserves,item.title||item.id,join(unit(item.amount,item.unit),Number.isFinite(item.currentHours)?'До резерва '+unit(item.currentHours,'ч'):''),null);
                }
                if(reserves.children.length===1) noRows(reserves,'Резервы не опубликованы');
                const drones=section(panel,'Служебные дроны');
                for(const item of array(station.access?.drones)) row(drones,item.title||item.id,join(phase(item.status),areaName(item.place),unit(item.cycles,'циклов')),
                    places[item.place]?ref('area',item.place):null);
                if(drones.children.length===1) noRows(drones,'Данные о дронах не опубликованы');
            }
        });
    }
    function networkLink(key){
        headline('Линия сети');
        const split=key.indexOf('.');
        if(split===-1) return noRows(panel,'Линия не выбрана');
        const networkId=key.slice(0,split), segmentId=key.slice(split+1);
        networkDocument(data=>{
            const network=networkEntries(data).find(([id])=>id===networkId)?.[1];
            const edge=array(network?.links||network?.edges||network?.segments).find(item=>item.id===segmentId);
            if(!edge) return noRows(panel,'Линия пока не опубликована');
            panel.querySelector('h2').textContent=edge.title||edge.label||edge.id;
            const nUnit=network.unit;
            const stamp=value=>{
                if(!Number.isFinite(value)||!Number.isFinite(data.hour)) return '';
                const source=Date.parse(station.hour);
                if(!Number.isFinite(source)) return '';
                const date=new Date(source+(value-data.hour)*3600000);
                return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'}).format(date);
            };
            facts(panel,[['Состояние',phase(edge.status||edge.state)],['Поток',unit(edge.flow,nUnit)],['Лимит',unit(edge.capacity,nUnit)],
                ['Износ по осмотру',unit(edge.observedWear,'%')],['Следующий осмотр',stamp(edge.nextInspection)],['Обслуживание',stamp(edge.serviceDue)]]);
            for(const area of new Set([edge.fromPlace,edge.place])) if(places[area]) row(panel,areaName(area),'Узел линии',ref('area',area));
            if(edge.registry||edge.equipment) row(panel,'Оборудование линии','Досье установки',ref('equipment',edge.registry||edge.equipment));
            for(const decision of array(data.decisions).filter(item=>item.net===networkId&&item.segment===segmentId)){
                const block=section(panel,'Решение по линии');
                const actions={repair:'Ремонт',inspect:'Осмотр',isolate:'Изоляция',reserve:'Переключение на резерв',wait:'Ожидание'};
                facts(block,[['Действие',actions[decision.action]||phase(decision.action)],['Начало',stamp(decision.start)],['Прогноз окончания',stamp(decision.end)],
                    ['Вероятность завершить в срок',unit(decision.forecast?.onTime,'%')]]);
                if(decision.authority?.actor) personRow(block,decision.authority.actor,'Кто принял решение');
            }
        });
    }
    function equipment(id) {
        headline(id?'Оборудование':'Реестр оборудования');
        withDoc('equipment.json',panel,data=>{
            for(const item of array(data.items)){
                if(id && id!==item.id) continue;
                if(!id){ row(panel,item.title||item.id,item.className,ref('equipment',item.id)); continue; }
                panel.querySelector('h2').textContent=item.title||item.id;
                bodyText(panel,[item.summary,item.operation]);
                for(const art of array(item.images)) plate(panel,'equipment/'+art.file,item.title||item.id);
            }
        });
    }
    function economy() {
        headline('Экономика порта');
        const info=station.portEconomy??{};
        facts(panel,[['Состояние',phase(info.status)],['Расчётный баланс',info.balanceEstimate],['Прогноз на 24 ч',info.forecast24h]]);
        for(const [key,value] of Object.entries(station.stationStatus?.reserves??{})) {
            if(text(value)) row(panel,key,text(value),null);
        }
        const closed=section(panel,'Закрытые дни');
        withDoc('economy.json',closed,data=>{
            for(const day of [...array(data.days)].reverse()){
                row(closed,day.date||day.day,join(Number.isFinite(day.received)?'Поступило '+day.received:'',Number.isFinite(day.paid)?'Выплачено '+day.paid:'',
                    Number.isFinite(day.hours)?day.hours+' ч':''),day.journal?ref('journal',day.date||day.day):null);
            }
            if(!array(data.days).length) noRows(closed,'Данные закрытых дней пока недоступны');
        });
    }
    function about() {
        headline('О мире');
        withDoc('editorial.json',panel,data=>rich(panel,data.sections?.world));
    }
    const ops=portScreens({ui,snapshot,panel,headline,section,row,ref,withDoc,noRows,facts,persons:people,personName,personRow,
        areaName,places,flight,flightsList,flightRow,flightDetail,array,join,when,phase,cargoRows,references});
    return {watch,post,signal,people:crew,person,station:stationIndex,maps,area,crop,flights:traffic,flight:flightDetail,
        radar:radarScreen,contact,destination,vessel,schedule,command,systems,equipment,economy,about,
        routes:ops.routes,observations:ops.observations,expedition:ops.expedition,relationships:ops.relationships,
        'flight-archive':ops.archive,'flight-day':ops.flightDay,'network-link':networkLink};
}
