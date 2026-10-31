import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_LOCATIONS, INITIAL_SERVICES, INITIAL_WORKERS } from '../data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.KAAMCONNECT_DB_PATH || path.join(here, 'kaamconnect.sqlite');
mkdirSync(path.dirname(dbPath), { recursive: true });
export const sqlite = new Database(dbPath);
sqlite.pragma('foreign_keys = OFF');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');

const migrationsDir = path.join(here, 'migrations');
const migrationFiles = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
for (const file of migrationFiles) {
  const versionMatch = file.match(/^(\d+)_/);
  const version = versionMatch ? parseInt(versionMatch[1], 10) : null;
  let applied = false;
  try {
    applied = Boolean(sqlite.prepare('SELECT version FROM schema_migrations WHERE version=?').get(version));
  } catch {
    applied = false;
  }
  if (!applied) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    sqlite.exec(sql);
    if (version) {
      sqlite.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?, datetime('now'))").run(version);
    }
  }
}

const now = new Date().toISOString();
const seed = sqlite.transaction(() => {
  for (const s of INITIAL_SERVICES) {
    sqlite.prepare('INSERT OR IGNORE INTO services(id,name,name_bn,name_hi,description,icon,active,metadata,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(s.id,s.name,s.nameBn||null,s.nameHi||null,s.tagline||null,s.iconName||null,1,JSON.stringify({ fairWageRange:s.fairWageRange, typicalResponseTime:s.typicalResponseTime, activeWorkersCount:s.activeWorkersCount }),now);
    for (const task of s.popularTasks || []) sqlite.prepare('INSERT OR IGNORE INTO service_tasks(id,service_id,name,name_bn,name_hi,description,base_price,active,metadata,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(task.id,s.id,task.name,task.nameBn||null,task.nameHi||null,task.description||null,Number(task.basePrice)||0,1,JSON.stringify({ estMinutes:task.estMinutes }),now);
  }
  for (const l of INITIAL_LOCATIONS) sqlite.prepare('INSERT OR IGNORE INTO locations(id,name,active,metadata) VALUES(?,?,1,?)').run(l.id,l.name,JSON.stringify(l));
  for (const w of INITIAL_WORKERS) {
    const trade = w.tradeId || w.trade_id || w.professionId;
    if (!trade) continue;
    const id = String(w.id || randomUUID());
    sqlite.prepare(`INSERT OR IGNORE INTO workers(id,legacy_id,trade_id,bio,profile_photo_url,locality,is_available,kyc_status,experience_years,jobs_completed,rating_average,rating_count,half_day_rate,daily_rate,metadata,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, String(w.id||id), String(trade), w.bio||w.description||null,w.profilePhotoUrl||w.avatar||null,w.locality||w.location||null,w.isAvailable===false?0:1,w.kycStatus||'verified',Number(w.experienceYears)||0,Number(w.jobsCompleted)||0,Number(w.rating)||0,Number(w.reviewCount)||0,Number(w.halfDayRate)||0,Number(w.dailyRate)||0,JSON.stringify({ ...w,isDemo:true }),w.createdAt||now,now);
    for (const skill of w.skills||[]) { const name=typeof skill==='string'?skill:skill.skill_name||skill.name; if(name) sqlite.prepare('INSERT OR IGNORE INTO worker_skills(id,worker_id,skill_name,created_at) VALUES(?,?,?,?)').run(randomUUID(),id,name,now); }
  }
});
seed();

const runtimePath=path.resolve(here,'..','runtime-data.json');
try {
  const runtime=JSON.parse(readFileSync(runtimePath,'utf8'));
  const marker='runtime-data-json-v1';
  if(!sqlite.prepare('SELECT 1 FROM import_migrations WHERE source=?').get(marker)){
    const migrate=sqlite.transaction(()=>{
      for(const w of runtime.workers||[]){
        const trade=String(w.tradeId||''); if(!sqlite.prepare('SELECT 1 FROM services WHERE id=?').get(trade))continue;
        const id=String(w.id||randomUUID()),tradeTitle=w.tradeTitle||sqlite.prepare('SELECT name FROM services WHERE id=?').get(trade)?.name;
        sqlite.prepare(`INSERT OR IGNORE INTO workers(id,legacy_id,trade_id,bio,profile_photo_url,locality,is_available,kyc_status,experience_years,jobs_completed,rating_average,rating_count,half_day_rate,daily_rate,metadata,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,id,trade,w.bio||null,w.avatar||null,w.locality||null,w.isAvailable===false?0:1,w.kycVerified?'verified':'pending',Number(w.experienceYears)||0,Number(w.completedJobs)||0,Number(w.rating)||0,Number(w.ratingCount)||0,Number(w.halfDayRate)||0,Number(w.dailyRate)||0,JSON.stringify({...w,tradeTitle,ownerId:w.ownerId||null,isDemo:true}),w.createdAt||now,now);
        const worker=sqlite.prepare('SELECT id FROM workers WHERE legacy_id=? OR id=?').get(id,id); if(worker)for(const skill of w.skills||[]){const name=typeof skill==='string'?skill:skill?.skill_name||skill?.name;if(name)sqlite.prepare('INSERT OR IGNORE INTO worker_skills(id,worker_id,skill_name,created_at) VALUES(?,?,?,?)').run(randomUUID(),worker.id,name,now);}
      }
      for(const b of runtime.bookings||[]){
        const worker=b.workerId?sqlite.prepare('SELECT id FROM workers WHERE legacy_id=? OR id=?').get(String(b.workerId),String(b.workerId)):null;
        if(!sqlite.prepare('SELECT 1 FROM services WHERE id=?').get(String(b.serviceId||'')))continue;
        if(b.taskId&&!sqlite.prepare('SELECT 1 FROM service_tasks WHERE id=?').get(String(b.taskId)))continue;
        sqlite.prepare(`INSERT OR IGNORE INTO bookings(id,legacy_id,customer_id,worker_id,service_id,task_id,booking_type,locality,address_details,estimated_price_min,estimated_price_max,final_price,payment_method,status,otp,metadata,created_at,updated_at)
          VALUES(?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(String(b.id||randomUUID()),String(b.id||''),worker?.id||null,String(b.serviceId),b.taskId||null,b.bookingType||'immediate',b.locality||null,b.addressDetails||null,Number(b.estimatedPriceMin)||null,Number(b.estimatedPriceMax)||null,Number(b.finalPrice)||null,b.paymentMethod||null,b.status||'pending',b.otp||null,JSON.stringify({customerId:b.customerId||null,customerName:b.customerName||null,customerPhone:b.customerPhone||null,serviceName:b.serviceName,taskName:b.taskName,source:'local demo migration'}),b.createdAt||now,now);
      }
      sqlite.prepare('INSERT INTO import_migrations(source,applied_at) VALUES(?,?)').run(marker,now);
    });migrate();
  }
} catch(error){if(error.code!=='ENOENT')throw error;}

sqlite.pragma('foreign_keys = ON');

const tables = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
const relationMap = {
 users: { users:'id' }, workers: { users:'user_id',worker_skills:'id' }, services:{ service_tasks:'id' }, service_tasks:{ services:'service_id' },
 bookings:{ services:'service_id',service_tasks:'task_id',workers:'worker_id',jobs:'job_id' }, jobs:{services:'service_id',service_tasks:'task_id',users:'customer_id'},
 job_offers:{workers:'worker_id',jobs:'job_id'}, conversations:{workers:'worker_id',users:'customer_id',jobs:'job_id',bookings:'booking_id'},
 messages:{quotations:'quotation_id'}, quotations:{messages:'id'}
};
const toJson = (value) => typeof value==='string' && /^[[{]/.test(value) ? (()=>{try{return JSON.parse(value)}catch{return value}})() : value;
const bindValue = (value) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value;
};
function relation(row, table, name, nested='*') {
  const fk=relationMap[table]?.[name]; if(!fk || !tables.has(name)) return name==='worker_skills'?[]:null;
  const target=name==='users'&&table==='users'?'id':fk;
  const value=row[target]; if(value==null) return null;
  let rows;
  if((table==='workers'&&name==='worker_skills') || (table==='services'&&name==='service_tasks')) rows=sqlite.prepare(`SELECT * FROM ${name} WHERE ${table==='workers'?'worker_id':'service_id'}=?`).all(value);
  else rows=sqlite.prepare(`SELECT * FROM ${name} WHERE id=?`).all(value);
  const mapped=rows.map(r=>inflate(r,name));
  if(nested && nested!=='*' && nested!=='id' && nested.includes('(')) return mapped.map(r=>expandRelations(r,name,nested));
  return (table==='workers'&&name==='worker_skills') || (table==='services'&&name==='service_tasks') ? mapped : mapped[0]||null;
}
function inflate(row,_table){const out={};for(const [k,v] of Object.entries(row))out[k]=toJson(v);return out;}
function expandRelations(row,table,selection){const out={...row};let depth=0,start=0;const parts=[];for(let i=0;i<selection.length;i++){if(selection[i]==='(')depth++;else if(selection[i]===')')depth--;else if(selection[i]===','&&depth===0){parts.push(selection.slice(start,i).trim());start=i+1;}}parts.push(selection.slice(start).trim());for(const part of parts){const m=part.match(/^([a-z_]+)(?:![\w]+)?\((.*)\)$/s);if(!m)continue;const [,name,nested]=m,value=relation(row,table,name,nested);out[name]=Array.isArray(value)?value.map(item=>expandRelations(item,name,nested)):value?expandRelations(value,name,nested):value;}return out;}

class Query {
  constructor(table){this.table=table;this.action='select';this.columns='*';this.filters=[];this.sort=[];this.max=null;this.values=null;this.conflict=null;this.want=false;this.singleMode=null;this.orFilter=null;}
  select(columns='*',options={}){this.columns=columns;this.want=true;this.wantCount=options?.count==='exact';this.head=options?.head===true;return this;}
  insert(values){this.action='insert';this.values=Array.isArray(values)?values:[values];return this;}
  upsert(values,opts={}){this.action='upsert';this.values=Array.isArray(values)?values:[values];this.conflict=opts.onConflict||'id';this.ignore=opts.ignoreDuplicates;return this;}
  update(values){this.action='update';this.values=values;return this;}
  delete(){this.action='delete';return this;}
  eq(k,v){this.filters.push([k,'=',v]);return this;} neq(k,v){this.filters.push([k,'<>',v]);return this;}
  gt(k,v){this.filters.push([k,'>',v]);return this;} gte(k,v){this.filters.push([k,'>=',v]);return this;} lt(k,v){this.filters.push([k,'<',v]);return this;} lte(k,v){this.filters.push([k,'<=',v]);return this;}
  in(k,values){this.filters.push([k,'IN',values]);return this;}
  or(expr){this.orFilter=expr;return this;}
  order(k,opts={}){this.sort.push([k,opts.ascending!==false]);return this;}
  limit(n){this.max=Number(n);return this;}
  single(){this.singleMode='single';return this;} maybeSingle(){this.singleMode='maybe';return this;}
  then(resolve,reject){return Promise.resolve().then(()=>this.run()).then(resolve,reject);}
  run(){try {
    if(!tables.has(this.table))throw new Error(`Unknown SQLite table ${this.table}`);
    const cols=new Set(sqlite.prepare(`PRAGMA table_info(${this.table})`).all().map(x=>x.name));
    const safe=(x)=>{if(!cols.has(x))throw new Error(`Unknown ${this.table} column ${x}`);return `"${x}"`;};
    const where=this.filters.map(([k,op,v])=>{const c=safe(k);if(op==='IN'){if(!v?.length)return '0';return `${c} IN (${v.map(()=>'?').join(',')})`;}return `${c} ${op} ?`;});
    const params=this.filters.flatMap(x=>x[1]==='IN'?(x[2]||[]).map(bindValue):[bindValue(x[2])]);
    if(this.orFilter){const terms=this.orFilter.split(',').map(term=>{const m=term.match(/^([\w]+)\.(eq|neq)\.(.*)$/);if(!m)throw new Error('Unsupported OR filter');return {sql:`${safe(m[1])} ${m[2]==='eq'?'=':'<>'} ?`,value:bindValue(m[3])};});where.push(`(${terms.map(t=>t.sql).join(' OR ')})`);params.push(...terms.map(t=>t.value));}
    const whereSql=where.length?` WHERE ${where.join(' AND ')}`:'';
    if(this.action==='select'){
      let sql=`SELECT * FROM ${this.table}${whereSql}`;
      if(this.sort.length)sql+=' ORDER BY '+this.sort.map(([k,a])=>`${safe(k)} ${a?'ASC':'DESC'}`).join(',');
      if(this.max!=null)sql+=' LIMIT '+Math.max(0,this.max);
      const count=this.wantCount?sqlite.prepare(`SELECT COUNT(*) AS count FROM ${this.table}${whereSql}`).get(...params).count:undefined;
      let rows=this.head?[]:sqlite.prepare(sql).all(...params).map(r=>{let o=inflate(r,this.table);return this.columns==='*'||this.columns.includes('*')||this.columns.includes('(')?expandRelations(o,this.table,this.columns):o;});
      if(this.singleMode==='single'){if(rows.length!==1)throw new Error(`Expected one ${this.table} record, got ${rows.length}`);rows=rows[0];} else if(this.singleMode==='maybe')rows=rows[0]||null;
      return {data:rows,error:null,count};
    }
    const write=sqlite.transaction(()=>{
      if(this.action==='delete'){const info=sqlite.prepare(`DELETE FROM ${this.table}${whereSql}`).run(...params);return {changes:info.changes,rows:[]};}
      const entries=Array.isArray(this.values)?this.values:[this.values]; let out=[];
      if(this.action==='insert'||this.action==='upsert'){
        for(let v of entries){v={...v}; if(cols.has('id')&&!v.id)v.id=randomUUID(); if(cols.has('created_at')&&!v.created_at)v.created_at=new Date().toISOString(); if(cols.has('updated_at')&&!v.updated_at)v.updated_at=v.created_at||new Date().toISOString(); if(cols.has('joined_at')&&!v.joined_at)v.joined_at=new Date().toISOString(); if(this.table==='quotations'&&v.total_estimate==null)v.total_estimate=Number(v.labour_cost||0)+Number(v.material_cost||0)+Number(v.travel_cost||0); if(this.table==='messages'&&!v.id)v.id=randomUUID();
          const fields=Object.keys(v).filter(k=>cols.has(k)); if(fields.length!==Object.keys(v).length)throw new Error('Invalid column in write'); const q=fields.map(()=>'?').join(',');let conflict=''; if(this.action==='upsert'){const keys=this.conflict.split(',').map(x=>x.trim());conflict=` ON CONFLICT(${keys.map(safe).join(',')}) ${this.ignore?'DO NOTHING':`DO UPDATE SET ${fields.filter(k=>!keys.includes(k)).map(k=>`${safe(k)}=excluded.${safe(k)}`).join(',')||`${safe(keys[0])}=excluded.${safe(keys[0])}`}`}`;}
          sqlite.prepare(`INSERT INTO ${this.table}(${fields.map(safe).join(',')}) VALUES(${q})${conflict}`).run(...fields.map(k=>bindValue(v[k])));
          let saved=cols.has('id')?sqlite.prepare(`SELECT * FROM ${this.table} WHERE id=?`).get(v.id):null;
          if(!saved&&this.action==='upsert'){const keys=this.conflict.split(',').map(x=>x.trim());saved=sqlite.prepare(`SELECT * FROM ${this.table} WHERE ${keys.map(k=>`${safe(k)}=?`).join(' AND ')} LIMIT 1`).get(...keys.map(k=>v[k]));}
          if(saved)out.push(saved);
        }
      }else{
        const fields=Object.keys(this.values).filter(k=>cols.has(k)); if(fields.length!==Object.keys(this.values).length)throw new Error('Invalid column in update');const setters=fields.map(k=>`${safe(k)}=?`).join(',');const info=sqlite.prepare(`UPDATE ${this.table} SET ${setters}${whereSql}`).run(...fields.map(k=>bindValue(this.values[k])),...params);if(info.changes)out=sqlite.prepare(`SELECT * FROM ${this.table}${whereSql}`).all(...params);
      }
      return {changes:out.length,rows:out};
    });
    const result=write(); let rows=result.rows.map(r=>inflate(r,this.table)); if(this.want&&typeof this.columns==='string'&&(this.columns.includes('(')))rows=rows.map(r=>expandRelations(r,this.table,this.columns));
    if(this.singleMode==='single'){if(!rows.length)throw new Error(`No ${this.table} record returned`);rows=rows[0];}else if(this.singleMode==='maybe')rows=rows[0]||null;
    return {data:rows,error:null,count:result.changes};
  }catch(error){return {data:null,error,count:0};}}
}
export const db={from:(table)=>new Query(table),rpc:(name,_args)=>Promise.resolve({data:null,error:new Error(`Unsupported SQLite operation ${name}`)})};
export const dbResult=async (query)=>query;
export const databaseReady=true;
