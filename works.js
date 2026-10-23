
const FEED='https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom';
const PROVINCES='Álava|Albacete|Alicante|Almería|Asturias|Ávila|Badajoz|Barcelona|Bizkaia|Burgos|Cáceres|Cádiz|Cantabria|Castellón|Ceuta|Ciudad Real|Córdoba|Cuenca|Gipuzkoa|Girona|Granada|Guadalajara|Huelva|Huesca|Illes Balears|Jaén|La Rioja|Las Palmas|León|Lleida|Lugo|Madrid|Málaga|Melilla|Murcia|Navarra|Ourense|Palencia|Pontevedra|Salamanca|Santa Cruz de Tenerife|Segovia|Sevilla|Soria|Tarragona|Teruel|Toledo|Valencia|Valladolid|Zamora|Zaragoza|A Coruña'.split('|');
function decode(s){return String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<!\[CDATA\[|\]\]>/g,'').trim()}
function tag(s,name){const m=s.match(new RegExp('<(?:[\\w.-]+:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?'+name+'>','i'));return m?decode(m[1].replace(/<[^>]+>/g,' ')):''}
function section(s,name){const m=s.match(new RegExp('<(?:[\\w.-]+:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?'+name+'>','i'));return m?m[1]:''}
function classify(s){if(/rehabilita|reforma|restauraci[oó]n|eficiencia energ[eé]tica|impermeabilizaci[oó]n|cubierta|fachada/i.test(s))return 'rehabilitacion';if(/carretera|autov[ií]a|ferrovi|puente|t[uú]nel|saneamiento|depuradora|abastecimiento|canalizaci[oó]n|urbanizaci[oó]n|hidr[aá]ulic|puerto|viaducto/i.test(s))return 'civil';return 'edificacion'}
exports.handler=async(event)=>{
try{
const q=event.queryStringParameters||{};const min=Math.max(0,Number(q.min)||500000);
const response=await fetch(FEED,{headers:{'Accept':'application/atom+xml,application/xml,text/xml'},signal:AbortSignal.timeout(8500)});
if(!response.ok)throw Error('La fuente oficial devolvió HTTP '+response.status);
const xml=await response.text();if(!xml.includes('<entry')&&!xml.includes(':entry'))throw Error('El formato oficial recibido no contiene entradas ATOM');
const entries=[...xml.matchAll(/<(?:[\w.-]+:)?entry(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?entry>/gi)].map(m=>m[1]);
const result=[],seen=new Set();
for(const e of entries){
const title=tag(e,'title')||tag(e,'Name');const id=tag(e,'id');
const body=section(e,'ContractFolderStatus')||e;
const procurement=section(body,'ProcurementProject')||body;
const budget=section(procurement,'BudgetAmount')||section(body,'BudgetAmount');
const amountStr=tag(budget,'TaxExclusiveAmount');
const amount=Number(amountStr.replace(',','.'));
if(!Number.isFinite(amount)||amount<min||!amountStr)continue;
const contractType=tag(procurement,'TypeCode');
const combined=(title+' '+tag(procurement,'Name')+' '+tag(procurement,'Description')).trim();
if(!/obra|works|construcci[oó]n|rehabilita|reforma|carretera|ferrovi|edificaci[oó]n|saneamiento|infraestructura/i.test(combined)&&contractType!=='3')continue;
const location=section(procurement,'RealizedLocation')||section(body,'RealizedLocation');
const locationText=(tag(location,'CityName')+' '+tag(location,'CountrySubentity')+' '+tag(location,'Name')+' '+tag(procurement,'Description'));
const province=PROVINCES.find(p=>locationText.toLocaleLowerCase('es').includes(p.toLocaleLowerCase('es')));
if(!province||q.province&&province!==q.province)continue;
const type=classify(combined);if(q.type&&type!==q.type)continue;
const linkMatch=e.match(/<link\b[^>]*href=["']([^"']+)["']/i);
const url=linkMatch?decode(linkMatch[1]):id.startsWith('http')?id:'';
if(!/^https:\/\//i.test(url))continue;
const key=id||url;if(seen.has(key))continue;seen.add(key);
result.push({title:title.slice(0,240),province,amount,type,stage:'Consultar expediente',published:tag(e,'updated').slice(0,10)||tag(e,'published').slice(0,10),url});
}
result.sort((a,b)=>b.amount-a.amount);
return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=0, s-maxage=900'},body:JSON.stringify({items:result.slice(0,100),scanned:entries.length,checkedAt:new Date().toISOString(),scope:'Primera página del feed ATOM oficial; no exhaustivo'})};
}catch(err){return {statusCode:503,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:err.message})}}
};
