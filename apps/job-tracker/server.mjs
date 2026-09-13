import {githubAuth} from './github-auth.mjs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
export const statuses = ['待核实','待投递','已投递','简历筛选','笔试 / 测评','面试中','Offer','已拒绝','已结束'];
const hash = value => createHash('sha256').update(value).digest('hex');
export function createApp({dataDir = process.env.DATA_DIR || path.join(root,'data'), shared = process.env.SHARING !== 'private', secure = process.env.COOKIE_SECURE === 'true', authOptions = {}} = {}) {
  mkdirSync(dataDir, {recursive:true});
  const db = new DatabaseSync(path.join(dataDir,'tracker.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS applications(id INTEGER PRIMARY KEY,owner_id INTEGER NOT NULL REFERENCES users(id),company TEXT NOT NULL,role TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',city TEXT NOT NULL DEFAULT '',status TEXT NOT NULL,applied_on TEXT NOT NULL DEFAULT '',job_code TEXT NOT NULL DEFAULT '',url TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',next_on TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,status TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);`);
  function addUser(username,name) {
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(username) || !name.trim()) throw Error('Invalid username or name');
    return db.prepare('INSERT INTO users(username,name,password) VALUES(?,?,?)').run(username,name,'').lastInsertRowid;
  }
  const handleGithub = githubAuth(db,{secure,...authOptions});
  const json = (res,code,data) => {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  function validate(input) {
    const out={};
    for (const key of ['company','role','email','city','status','applied_on','job_code','url','notes','next_on']) {
      if (input[key] !== undefined && typeof input[key] !== 'string') throw Error('字段格式不正确');
      out[key]=(input[key]||'').trim();
      if(out[key].length>(key==='notes'?5000:500)) throw Error('输入内容过长');
    }
    if(!out.company||!out.role||!statuses.includes(out.status)) throw Error('请填写公司、岗位和有效进度');
    if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw Error('邮箱格式不正确');
    if(out.url) {const u=new URL(out.url);if(!['http:','https:'].includes(u.protocol)) throw Error('职位链接只支持 http 或 https');}
    for(const key of ['applied_on','next_on']) if(out[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(out[key])||new Date(out[key]).toISOString().slice(0,10)!==out[key])) throw Error('日期格式不正确');
    return out;
  }
  function save(owner,input,id) {
    const item=validate(input), now=new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      if(id) {
        const old=db.prepare('SELECT * FROM applications WHERE id=? AND owner_id=?').get(id,owner);
        if(!old) throw Object.assign(Error('记录不存在或无权修改'),{code:404});
        if(input.version!==old.version) throw Object.assign(Error('记录已被更新，请刷新后重试'),{code:409});
        db.prepare(`UPDATE applications SET ${Object.keys(item).map(k=>`${k}=?`).join(',')},updated_at=?,version=version+1 WHERE id=?`).run(...Object.values(item),now,id);
        db.prepare('INSERT INTO events(application_id,status,note,created_at) VALUES(?,?,?,?)').run(id,item.status,old.status===item.status?'更新了投递信息':`${old.status} → ${item.status}`,now);
      } else {
        id=Number(db.prepare(`INSERT INTO applications(owner_id,${Object.keys(item).join(',')},updated_at) VALUES(${Array(Object.keys(item).length+2).fill('?').join(',')})`).run(owner,...Object.values(item),now).lastInsertRowid);
        db.prepare('INSERT INTO events(application_id,status,note,created_at) VALUES(?,?,?,?)').run(id,item.status,'创建记录',now);
      }
      db.exec('COMMIT');return id;
    } catch(e) {db.exec('ROLLBACK');throw e;}
  }
  async function body(req) {
    let size=0; const chunks=[];
    for await(const c of req){size+=c.length;if(size>32768)throw Object.assign(Error('请求内容过大'),{code:413});chunks.push(c);}
    try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw Error('请求格式不正确');}
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url=new URL(req.url,'http://localhost'), route=url.pathname.replace(/^\/applications(?=\/|$)/,'')||'/';
      if(await handleGithub(req,res,url,route))return;
      if(route==='/health')return json(res,200,{ok:true});
      if(!route.startsWith('/api/')) {
        const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
        if(req.method!=='GET'||!files[route])return json(res,404,{error:'页面不存在'});
        res.setHeader('Content-Type',route.endsWith('.js')?'text/javascript; charset=utf-8':route.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');
        res.setHeader('Cache-Control','no-cache');return res.end(readFileSync(path.join(root,'public',files[route])));
      }
      if(!['GET','HEAD'].includes(req.method)) {
        if(!req.headers['content-type']?.startsWith('application/json')||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'请求来源无效'});
        if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'请求来源无效'});
      }
      const token=(req.headers.cookie||'').match(/(?:^|;\s*)tracker_session=([a-f0-9]+)/)?.[1];
      const user=token?db.prepare('SELECT u.id,u.username,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(hash(token),Date.now()):null;
      const cookie=(value,age)=>`tracker_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
      if(route==='/api/login'||route==='/api/password')return json(res,410,{error:'请使用 GitHub 登录'});
      if(route==='/api/me'&&req.method==='GET')return json(res,200,{user,shared,statuses});
      if(!user)return json(res,401,{error:'请先登录'});
      if(route==='/api/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));res.setHeader('Set-Cookie',cookie('',0));return json(res,200,{ok:true});}
      if(route==='/api/applications'&&req.method==='GET') {
        const rows=db.prepare(`SELECT a.*,u.name AS owner_name FROM applications a JOIN users u ON u.id=a.owner_id ${shared?'':'WHERE a.owner_id=?'} ORDER BY a.updated_at DESC,a.id DESC`).all(...(shared?[]:[user.id]));
        return json(res,200,{items:rows,users:db.prepare(`SELECT id,name FROM users ${shared?'':'WHERE id=?'}`).all(...(shared?[]:[user.id]))});
      }
      if(route==='/api/applications'&&req.method==='POST')return json(res,201,{id:save(user.id,await body(req))});
      const match=route.match(/^\/api\/applications\/(\d+)(\/events)?$/);
      if(match){const id=Number(match[1]);
        if(match[2]&&req.method==='GET') {
          const row=db.prepare('SELECT owner_id FROM applications WHERE id=?').get(id);
          if(!row||(!shared&&row.owner_id!==user.id))return json(res,404,{error:'记录不存在'});
          return json(res,200,{events:db.prepare('SELECT * FROM events WHERE application_id=? ORDER BY id DESC').all(id)});
        }
        if(!match[2]&&req.method==='PUT')return json(res,200,{id:save(user.id,await body(req),id)});
        if(!match[2]&&req.method==='DELETE'){
          const result=db.prepare('DELETE FROM applications WHERE id=? AND owner_id=?').run(id,user.id);
          return json(res,result.changes?200:404,result.changes?{ok:true}:{error:'记录不存在或无权修改'});
        }
      }
      json(res,404,{error:'接口不存在'});
    }catch(e){const code=Number.isInteger(e.code)?e.code:typeof e.code==='string'?500:400;json(res,code,{error:code===500?'服务暂时不可用':e.message});}
  });
  return {server,db,addUser,save};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const app=createApp();
  if(process.argv[2]==='add-user') {app.addUser(process.argv[3],process.argv[4],process.env.NEW_PASSWORD||'');console.log('用户已创建');app.db.close();}
  else if(process.argv[2]==='bind-github') {
    const username=process.argv[3],login=process.argv[4];
    if(!/^[a-zA-Z0-9-]{1,39}$/.test(login||''))throw Error('Invalid GitHub username');
    const response=await fetch('https://api.github.com/users/'+login,{headers:{'User-Agent':'GardenLab-Tracker'},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('GitHub account lookup failed');
    const identity=await response.json(),user=app.db.prepare('SELECT id FROM users WHERE username=?').get(username);
    if(!user||!Number.isSafeInteger(identity.id)||identity.type!=='User')throw Error('Invalid account');
    app.db.prepare('INSERT INTO github_accounts VALUES(?,?,?)').run(user.id,'github:'+identity.id,identity.login);
    console.log('GitHub account linked:',username,identity.login);app.db.close();
  }
  else if(process.argv[2]==='import') {
    const user=app.db.prepare('SELECT id FROM users WHERE username=?').get(process.argv[3]);if(!user)throw Error('用户不存在');
    for(const item of JSON.parse(readFileSync(process.argv[4],'utf8'))){if(!app.db.prepare('SELECT id FROM applications WHERE owner_id=? AND company=? AND role=?').get(user.id,item.company,item.role))app.save(user.id,item);}
    console.log('导入完成');app.db.close();
  }else {
    app.server.listen(Number(process.env.PORT||8796),process.env.HOST||'127.0.0.1',()=>console.log(`Application tracker: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||8796}`));
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.server.close(()=>{app.db.close();process.exit(0);}));
  }
}
