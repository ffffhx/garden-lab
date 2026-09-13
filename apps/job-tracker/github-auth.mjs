import {randomBytes,createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');

export function githubAuth(db,{secure=false,publicUrl=process.env.PUBLIC_URL||'http://127.0.0.1:8796/',brokerUrl=process.env.GARDEN_AUTH_URL||'https://124-221-36-36.anyip.dev:8443/garden-api/',verifyUrl=process.env.GARDEN_VERIFY_URL||'https://124-221-36-36.anyip.dev:8443/garden-api/api/auth/me',fetchIdentity}={}){
  db.exec(`CREATE TABLE IF NOT EXISTS github_accounts(user_id INTEGER PRIMARY KEY REFERENCES users(id),github_id TEXT UNIQUE NOT NULL,login TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS login_states(state TEXT PRIMARY KEY,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tracker_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  if(!db.prepare("SELECT 1 FROM tracker_meta WHERE key='github-only'").get()){
    db.exec("BEGIN; DELETE FROM sessions; INSERT INTO tracker_meta VALUES('github-only','1'); COMMIT;");
  }
  const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
  const redirect=(res,to)=>{res.writeHead(303,{Location:to,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();};
  return async function(req,res,url,route){
    if(req.method!=='GET'||!['/api/auth/github','/api/auth/callback'].includes(route))return false;
    if(route==='/api/auth/github'){
      const state=randomBytes(32).toString('hex');
      db.prepare('DELETE FROM login_states WHERE expires<?').run(Date.now());
      db.prepare('INSERT INTO login_states VALUES(?,?)').run(hash(state),Date.now()+600000);
      res.setHeader('Set-Cookie',cookie('tracker_oauth',state,600));
      const callback=new URL('api/auth/callback',publicUrl);callback.searchParams.set('state',state);
      const start=new URL('api/auth/github/start',brokerUrl);start.searchParams.set('returnTo',callback.href);
      redirect(res,start.href);return true;
    }
    const state=url.searchParams.get('state')||'',bound=(req.headers.cookie||'').match(/(?:^|;\s*)tracker_oauth=([a-f0-9]{64})(?:;|$)/)?.[1];
    res.setHeader('Set-Cookie',cookie('tracker_oauth','',0));
    const fail=reason=>{const target=new URL(publicUrl);target.searchParams.set('login_error',reason);redirect(res,target.href);return true;};
    if(!bound||state!==bound||!db.prepare('DELETE FROM login_states WHERE state=? AND expires>? RETURNING state').get(hash(state),Date.now()))return fail('state');
    try{
      const token=url.searchParams.get('garden_token');if(!token||token.length>8192)return fail('identity');
      const identity=fetchIdentity?await fetchIdentity(token):await(async()=>{
        const r=await fetch(verifyUrl,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000),redirect:'error'});
        if(!r.ok)throw Error('Verification failed');return r.json();
      })();
      if(!identity.authenticated||!/^github:\d+$/.test(identity.user?.userId||''))return fail('identity');
      const account=db.prepare('SELECT user_id FROM github_accounts WHERE github_id=?').get(identity.user.userId);
      if(!account)return fail('not_allowed');
      const sid=randomBytes(32).toString('hex');
      db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(sid),account.user_id,Date.now()+30*86400000);
      res.setHeader('Set-Cookie',[cookie('tracker_oauth','',0),cookie('tracker_session',sid,30*86400)]);
      redirect(res,publicUrl);return true;
    }catch{return fail('unavailable');}
  };
}
