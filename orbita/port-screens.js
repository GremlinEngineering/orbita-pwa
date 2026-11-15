import {element} from './site.js';

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const archiveIndex = 'flight-archive/index.json';
const units = (amount, unit) => Number.isFinite(amount) ? amount+' '+unit : '';

export function portScreens({ui,snapshot,panel,headline,section,row,ref,withDoc,noRows,facts,persons,personName,personRow,
    areaName,places,flight,flightsList,flightRow,flightDetail,array,join,when,phase,cargoRows,references}){
    const {station,flights}=snapshot;
    const crew=Object.keys(persons).filter(id=>persons[id].group==='crew')
        .sort((a,b)=>personName(a).localeCompare(personName(b),'ru'));
    const stationName=id=>array(flights.stations).find(stop=>stop.id===id)?.name||id;

    function expandable(parent,label){
        const details=element('details','',{class:'stack expansion'});
        details.append(element('summary',label));
        parent.append(details);
        return details;
    }
    function archivedDates(parent,id,record){
        const dates=array(record?.days).filter(day=>dayPattern.test(day)).sort().reverse();
        if(!dates.length) return false;
        const history=expandable(parent,'История рейса · '+dates.length);
        history.open=true;
        dates.forEach(day=>row(history,day,'Отметки и люди на борту',ref('flight-day',day+'.'+id)));
        return true;
    }
    function flightHistory(parent,id){
        withDoc(archiveIndex,parent,index=>archivedDates(parent,id,index.flights?.[id]));
    }
    function archive(id=''){
        headline(id?'История рейса':'Архив рейсов');
        withDoc(archiveIndex,panel,index=>{
            if(id){
                const previous=index.flights?.[id];
                if(!previous) return noRows(panel,'Рейс не найден в архиве');
                panel.querySelector('h2').textContent=previous.name||id;
                row(panel,'Радиопереговоры рейса','Записи открытого канала',ref('radio',id));
                archivedDates(panel,id,previous);
                return;
            }
            const records=Object.entries(index.flights??{}).sort(([,a],[,b])=>(array(b.days).at(-1)||'').localeCompare(array(a.days).at(-1)||''));
            const search=element('input','',{type:'search',placeholder:'Позывной или номер рейса','aria-label':'Поиск по архиву рейсов'});
            const results=element('div','',{class:'rows'});
            panel.append(search,results);
            function draw(){
                const query=search.value.trim().toLocaleLowerCase('ru');
                results.replaceChildren();
                for(const [flightId,info] of records){
                    if(!join(info.name,flightId).toLocaleLowerCase('ru').includes(query)) continue;
                    row(results,info.name||flightId,join(array(info.days).at(-1),flightId),ref('flight-archive',flightId));
                }
                if(!results.children.length) noRows(results,'Рейсов не найдено');
            }
            search.oninput=draw;
            draw();
        });
    }
    function flightDay(combined){
        const day=combined.slice(0,10), id=combined.slice(11);
        headline('История рейса',day);
        if(!dayPattern.test(day)||combined[10]!=='.'||!id) return noRows(panel,'Дата или рейс не определены');
        withDoc('flight-archive/'+day+'.json',panel,doc=>{
            const item=array(doc.flights).find(row=>row.id===id);
            if(!item) return noRows(panel,'Отметок за выбранный день нет');
            withDoc(archiveIndex,panel,index=>{
                panel.querySelector('h2').textContent=index.flights?.[id]?.name||flight(id)?.ship||id;
            });
            for(const [key,label] of [['originId','Откуда'],['destinationId','Куда']]){
                if(item[key]) row(panel,stationName(item[key]),label,ref('destination',item[key]));
            }
            if(item.place&&places[item.place]) row(panel,areaName(item.place),'Причал',ref('area',item.place));
            facts(panel,[['Груз принят',when(item.received)],['Возвращение',when(item.returnedAt)]]);
            expeditionDetails(panel,item);
            const onboard=array(item.onboard);
            if(onboard.length) {
                const staff=section(panel,'На борту');
                for(const member of onboard){
                    if(persons[member.id]) personRow(staff,member.id);
                    else if(member.name) row(staff,member.name,'На борту',ref('person',member.id));
                }
            }
            const events=section(panel,'Отметки рейса');
            for(const entry of array(item.events)){
                row(events,entry.text||entry.title,when(entry.at),entry.journalId?ref('journal',day):null);
                references(events,entry.references);
            }
            if(!array(item.events).length) noRows(events);
            row(panel,'Вахтенный журнал',day,ref('journal',day));
        });
    }
    function expeditionList(){
        headline('Экспедиции','Действующие караваны и резерв');
        const active=section(panel,'Действующие экспедиции');
        for(const item of flightsList.filter(item=>item.service==='expedition')) flightRow(active,item);
        if(!flightsList.some(item=>item.service==='expedition')) noRows(active,'Действующих экспедиций нет');
        const pending=flights.nextExpedition;
        if(pending?.id) row(panel,pending.ship||pending.id,join('Резервный караван',pending.destination),ref('expedition',pending.id));
        const surveyed=array(flights.chartedRoutes);
        if(surveyed.length){
            const routes=section(panel,'Обследованные маршруты');
            for(const item of surveyed) row(routes,item.name||item.id,join(when(item.surveyedAt),units(item.outboundHours,'ч')),
                item.expeditionId?ref('expedition',item.expeditionId):null);
        }
    }
    function expedition(id){
        if(!id) return expeditionList();
        const underway=flight(id);
        if(underway) return flightDetail(id);
        const reserve=flights.nextExpedition;
        if(reserve?.id!==id) return archive(id);
        headline(reserve.ship||id,'Резервный караван');
        expeditionDetails(panel,reserve);
    }
    function expeditionDetails(parent,item){
        if (!item.fieldwork && !item.mission && !array(item.ships).length && !item.manifest) return;
        const part=section(parent,'Экспедиция');
        facts(part,[['Цель',item.destination],['Задача',item.mission],['До конца участка',units(item.remainingHours,'ч')],
            ['Расчётное прибытие',when(item.destinationEta)],['Расчётное возвращение',when(item.returnEta)]]);
        if(item.destinationId) row(part,item.destination||item.destinationId,'Паспорт пункта назначения',ref('destination',item.destinationId));
        if(item.manifest) cargoRows(part,item.manifest);
        if(item.fieldwork){
            const work=section(part,'Материалы экспедиции');
            if(item.fieldwork.title) work.append(element('p',item.fieldwork.title));
            facts(work,[['Разбор',item.fieldwork.status==='analyzed'?'Завершён':'Ожидается'],['Когда',when(item.fieldwork.at)]]);
            if(persons[item.fieldwork.worker]) personRow(work,item.fieldwork.worker,'Кто разбирал материалы');
            if(places[item.fieldwork.place]) row(work,areaName(item.fieldwork.place),'Место разбора',ref('area',item.fieldwork.place));
        }
        if(array(item.ships).length){
            const ships=section(part,'Борта каравана');
            for(const ship of item.ships) row(ships,ship.name||ship.callsign||ship.id,'Карточка борта',ref('vessel',ship.id));
        }
    }
    function routes(){
        headline('Схема маршрутов','Пункты назначения и позиции бортов по срезу');
        const legs=section(panel,'Участки маршрутов');
        const nodes=new Set();
        for(const leg of array(flights.legs)){
            if(!leg.from||!leg.to) continue;
            nodes.add(leg.from); nodes.add(leg.to);
            const path=element('article','',{class:'stack route-leg'});
            const ends=element('div','',{class:'route-ends'});
            ends.append(ui.link(stationName(leg.from),ref('destination',leg.from)),element('span','→',{'aria-hidden':'true'}),
                ui.link(stationName(leg.to),ref('destination',leg.to)));
            path.append(ends);
            if(Number.isFinite(leg.hours)) path.append(element('small',units(leg.hours,'ч')));
            const moving=flightsList.filter(item=>item.position?.from===leg.from&&item.position?.to===leg.to);
            for(const item of moving){
                const percent=Number.isFinite(item.position.progress)?Math.min(100,Math.max(0,Math.round(100*item.position.progress))):null;
                if(percent!==null){
                    const line=element('div','',{class:'transit'});
                    const marker=ui.link('◆',ref('flight',item.id),'transit-marker');
                    marker.title=join(item.ship,percent+'%');
                    marker.setAttribute('aria-label',marker.title);
                    marker.style.left=percent+'%';
                    line.append(marker);
                    path.append(line);
                }
                flightRow(path,item);
            }
            legs.append(path);
        }
        if(!nodes.size) noRows(legs,'Участки маршрутов ещё не опубликованы');
        const stops=section(panel,'Пункты назначения');
        withDoc('stations.json',stops,data=>{
            for(const item of array(data.stations)) row(stops,item.name||item.id,item.statusLabel,ref('destination',item.id));
        });
    }
    function observations(){
        headline('Наблюдения','Внешняя обстановка у станции');
        const reports=section(panel,'Текущие контакты');
        for(const item of array(station.contacts)) row(reports,item.vesselName||item.report||phase(item.kind),phase(item.stage),
            item.vesselId?ref('vessel',item.vesselId):null);
        if(!array(station.contacts).length) noRows(reports);
        const log=section(panel,'Журнал наблюдений');
        for(const item of [...array(flights.contacts)].reverse()) row(log,item.title||item.report,join(when(item.at),phase(item.stage)),
            item.flightId?ref('flight',item.flightId):null);
        if(!array(flights.contacts).length) noRows(log);
    }
    function passport(parent,item){
        const physics=item.celestialBody?.physics??{};
        facts(parent,[['Диаметр',units(physics.diameterKm,'км')],['Ускорение',units(physics.gravityMps2,'м/с²')],['Давление',units(physics.surfacePressureBar,'бар')]]);
        const p=item.passport;
        if(!p) return;
        const form=section(parent,'Паспорт пункта');
        const {identity={},capacity={},condition={},layout={},staffing={},resources={}}=p;
        facts(form,[['Оператор',identity.operator],['Код',identity.code],['Компоновка',layout.kind],['Возраст',units(condition.ageYears,'лет')],
            ['Износ',units(condition.wearPercent,'%')],['Места ожидания',capacity.waitingPlaces],['Пассажирские капсулы',capacity.passengerBeds],
            ['Койки персонала',capacity.crewBeds],['Причалы',capacity.berths],['Грузовые склады',units(capacity.cargoTonnes,'т')],['Медпункт',units(capacity.medicalBeds,'мест')]]);
        if(array(layout.modules).length){
            const count=new Map();
            for(const module of layout.modules){
                const label=join(module.title?.replace(/ \d+$/,''),array(module.dimensionsM).length?module.dimensionsM.join(' × ')+' м':'');
                count.set(label,(count.get(label)||0)+1);
            }
            const modules=expandable(form,'Состав комплекса');
            for(const [label,total] of count) row(modules,label,units(total,'шт.'),null);
        }
        if(Object.keys(staffing).length){
            const details=expandable(form,'Службы и смены');
            facts(details,[['Штат',units(staffing.total,'чел.')]]);
            for(const role of array(staffing.roles)) row(details,role.role,join(units(role.people,'чел.'),
                array(role.windows).map(hours=>hours.map(hour=>String(hour).padStart(2,'0')+':00').join('–')).join(', ')),null);
        }
        if(Object.keys(resources).length){
            const resourcesTable=expandable(form,'Запасы и энергия');
            facts(resourcesTable,[['Энергоснабжение',resources.power?.source],['Установленная мощность',units(resources.power?.installedKw,'кВт')],
                ['Автономность',units(resources.reserveDays,'суток')],['Продовольствие',units(resources.foodKg,'кг')],['Вода',units(resources.waterLitres,'л')]]);
        }
    }
    function relationships(id){
        headline('Связи экипажа',persons[id]?.name);
        if(!crew.length) return noRows(panel,'Экипаж пока не опубликован');
        const select=element('select','',{'aria-label':'Член экипажа'});
        for(const person of crew) select.append(element('option',personName(person),{value:person}));
        const from=crew.includes(id)?id:crew[0];
        select.value=from;
        select.onchange=()=>ui.go(ref('relationships',select.value));
        panel.append(select,ui.link('Открыть досье',ref('person',from),'action'));
        const controls=element('div','',{class:'controls'});
        const graph=element('div','',{class:'relations-graph','aria-label':'Граф связей'});
        const detail=element('article','',{class:'stack'});
        panel.append(controls,graph,detail);
        const relation=(a,b)=>array(persons[a]?.relationships).find(edge=>edge.person===b);
        const edges=crew.filter(peer=>peer!==from).map(peer=>{
            const out=relation(from,peer), back=relation(peer,from);
            return {peer,out,back,conflict:[out,back].some(item=>item?.conflict||item?.feelings?.includes('недолюбливает')),
                friend:[out,back].some(item=>item?.mutualFriend||item?.feelings?.includes('считает другом'))};
        }).filter(edge=>edge.out||edge.back);
        function showEdge(edge){
            detail.replaceChildren();
            if(!edge) return;
            for(const [a,b,record] of [[from,edge.peer,edge.out],[edge.peer,from,edge.back]]){
                detail.append(element('h3',personName(a)+' → '+personName(b)),element('p',array(record?.feelings).join(', ')||'Связь не зафиксирована'));
                if(record?.basis) detail.append(element('p',record.basis));
                if(record?.latest?.reason) detail.append(element('small',join(when(record.latest.at),record.latest.reason)));
            }
            detail.append(ui.link('Досье · '+personName(edge.peer),ref('person',edge.peer),'action'),
                ui.link('Связи · '+personName(edge.peer),ref('relationships',edge.peer),'action'));
            for(const button of graph.querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.dataset.id===edge.peer));
        }
        function draw(filter){
            const visible=edges.filter(edge=>!filter||edge[filter]);
            graph.replaceChildren(element('strong',personName(from),{class:'relation-center'}));
            const peers=element('div','',{class:'relation-peers'});
            for(const edge of visible){
                const className=edge.conflict?'level-critical':edge.friend?'relation-friend':'';
                const button=element('button',personName(edge.peer),{type:'button',class:className,'data-id':edge.peer});
                button.onclick=()=>showEdge(edge);
                peers.append(button);
            }
            graph.append(peers);
            for(const button of controls.children) button.setAttribute('aria-pressed',String(button.dataset.filter===filter));
            showEdge(visible[0]);
            detail.hidden=!visible.length;
            if(!visible.length) noRows(peers,'В этой категории связей нет');
        }
        for(const [id,label] of [['','Все связи'],['friend','Дружба'],['conflict','Конфликты']]){
            const button=element('button',label,{type:'button','data-filter':id});
            button.onclick=()=>draw(id);
            controls.append(button);
        }
        draw('');
    }
    return {archive,flightHistory,flightDay,expedition,expeditionDetails,routes,observations,passport,relationships};
}
