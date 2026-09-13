import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from './server.mjs';

for(const shared of [true,false])test(`CRUD, persistent data and permissions (shared=${shared})`,async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'tracker-test-')),app=createApp({dataDir:dir,shared});
  app.addUser('alice','Alice','a-long-password-123');app.addUser('bob','Bob','b-long-password-123');
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  async function req(route,method='GET',data,cookie='',extra={}){return fetch(base+'/api/'+route,{method,headers:{'Content-Type':'application/json',cookie,...extra},...(data?{body:JSON.stringify(data)}:{})});}
  try{
    assert.equal((await req('applications')).status,401);
    assert.equal((await req('login','POST',{username:'alice',password:'wrong'})).status,401);
    const alice=(await req('login','POST',{username:'alice',password:'a-long-password-123'})).headers.get('set-cookie').split(';')[0];
    const bob=(await req('login','POST',{username:'bob',password:'b-long-password-123'})).headers.get('set-cookie').split(';')[0];
    assert.equal((await req('applications','POST',{},alice,{Origin:'https://evil.test'})).status,403);
    const item={company:'A <script>',role:'Frontend Engineer',status:'已投递',email:'alice@example.com',applied_on:'2026-09-13'};
    const {id}=await (await req('applications','POST',item,alice)).json();assert.ok(id);
    assert.equal((await req(`applications/${id}`,'PUT',{...item,status:'Offer',version:1},bob)).status,404);
    assert.equal((await req(`applications/${id}`,'DELETE',{},bob)).status,404);
    assert.equal((await req(`applications/${id}/events`,'GET',null,bob)).status,shared?200:404);
    assert.equal((await (await req('applications','GET',null,bob)).json()).items.length,shared?1:0);
    assert.equal((await req(`applications/${id}`,'PUT',{...item,status:'面试中',version:1},alice)).status,200);
    assert.equal((await req(`applications/${id}`,'PUT',{...item,status:'Offer',version:1},alice)).status,409);
    assert.equal((await req('applications','POST',{...item,url:'javascript:alert(1)'},alice)).status,400);
    assert.equal((await req('applications','POST',{...item,applied_on:'2026-02-31'},alice)).status,400);
    const events=await (await req(`applications/${id}/events`,'GET',null,alice)).json();assert.equal(events.events.length,2);
    const reopened=createApp({dataDir:dir});assert.equal(reopened.db.prepare('SELECT status FROM applications WHERE id=?').get(id).status,'面试中');reopened.db.close();
    assert.equal((await req(`applications/${id}`,'DELETE',{},alice)).status,200);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,0);
    await req('logout','POST',{},alice);assert.equal((await req('applications','GET',null,alice)).status,401);
  }finally{await new Promise(resolve=>app.server.close(resolve));app.db.close();rmSync(dir,{recursive:true,force:true});}
});
