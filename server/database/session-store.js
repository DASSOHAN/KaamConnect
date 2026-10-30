import session from 'express-session';
import { sqlite } from './sqlite.js';

export class SQLiteSessionStore extends session.Store {
  get(sid, callback) {
    try { const row=sqlite.prepare('SELECT sess,expires FROM sessions WHERE sid=?').get(sid); if(!row){callback(null,null);return;} if(row.expires<Date.now()){sqlite.prepare('DELETE FROM sessions WHERE sid=?').run(sid);callback(null,null);return;} callback(null,JSON.parse(row.sess)); }
    catch(error){callback(error);}
  }
  set(sid,sessData,callback=()=>{}) {
    try { const expires=sessData.cookie?.expires?new Date(sessData.cookie.expires).getTime():Date.now()+86400000;sqlite.prepare('INSERT INTO sessions(sid,sess,expires) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expires=excluded.expires').run(sid,JSON.stringify(sessData),expires);callback(null); }
    catch(error){callback(error);}
  }
  destroy(sid,callback=()=>{}) { try{sqlite.prepare('DELETE FROM sessions WHERE sid=?').run(sid);callback(null);}catch(error){callback(error);} }
  touch(sid,sessData,callback=()=>{}) { this.set(sid,sessData,callback); }
  static cleanup(){sqlite.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());}
}
