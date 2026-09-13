const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user,shared,statuses=[],items=[],users=[],owner='mine',editing=null;
async function api(route,method='GET',data){const r=await fetch(`./api/${route}`,{method,headers:method==='GET'?{}:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});const result=await r.json();if(!r.ok){if(r.status===401&&route!=='login'){ $('#workspace').hidden=true;$('#login').hidden=false; }throw Error(result.error||'请求失败，请重试');}return result;}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,3500);}
function date(value){return value?value.slice(0,10).replaceAll('-','.'):'未记录';}
function subset(){return items.filter(i=>owner==='all'||i.owner_id===(owner==='mine'?user.id:Number(owner)));}
function filtered(){let list=subset();const q=$('#search').value.toLowerCase().trim(),s=$('#status-filter').value;
  list=list.filter(i=>(!s||i.status===s)&&(!q||[i.company,i.role,i.email,i.city,i.job_code,i.notes].join(' ').toLowerCase().includes(q)));
  const sort=$('#sort').value;return list.sort((a,b)=>sort==='date'?b.applied_on.localeCompare(a.applied_on):sort==='next'?(a.next_on||'9999').localeCompare(b.next_on||'9999'):b.updated_at.localeCompare(a.updated_at));}
function render(){const list=filtered(),all=subset();$('#total').textContent=all.length;$('#count').textContent=`${list.length} 条记录`;
  $('#progress-stops').innerHTML=[['已投递',['已投递']],['测评中',['笔试 / 测评']],['面试中',['面试中']],['已获 Offer',['Offer']]].map(([label,ss])=>`<button class="stop" data-filter="${esc(ss[0])}"><strong>${all.filter(i=>ss.includes(i.status)).length}</strong><span><i></i>${label}</span></button>`).join('');
  $('#owners').innerHTML=[['mine','我的投递'],...(shared?[['all','全部记录'],...users.filter(u=>u.id!==user.id).map(u=>[u.id,u.name])]:[])].map(([id,name])=>`<button class="${String(owner)===String(id)?'active':''}" data-owner="${id}">${esc(name)}</button>`).join('');
  $('#empty').hidden=list.length>0;$('#records').hidden=!list.length;
  $('#records').innerHTML=`<table><thead><tr><th>公司 / 投递人</th><th>申请岗位</th><th class="email-col">投递邮箱</th><th>当前进度</th><th>投递日期</th></tr></thead><tbody>${list.map(i=>`<tr><td><div class="company-cell"><div class="logo">${esc(i.company.slice(0,2))}</div><div><button class="company-button" data-id="${i.id}">${esc(i.company)}</button><small>${esc(i.owner_name)}</small></div></div></td><td class="role-name">${esc(i.role)}<small>${esc(i.city||'城市待确认')}${i.job_code?' · '+esc(i.job_code):''}</small></td><td class="email-col email">${esc(i.email||'待确认')}</td><td class="status-col"><span class="badge" data-status="${esc(i.status)}">${esc(i.status)}</span></td><td class="date-col"><span class="date">${date(i.applied_on)}</span>${i.next_on?`<small>跟进 ${date(i.next_on)}</small>`:''}</td></tr>`).join('')}</tbody></table>`;
}
async function refresh(){const result=await api('applications');items=result.items;users=result.users;render();}
async function init(){try{const me=await api('me');({user,shared,statuses}=me);$('#login').hidden=!!user;$('#workspace').hidden=!user;if(!user)return;
  $('#user-name').textContent=user.name;$('#avatar').textContent=user.name.slice(0,1);$('#today').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
  $('#status-filter').innerHTML='<option value="">全部进度</option>'+statuses.map(s=>`<option>${esc(s)}</option>`).join('');
  $('[name=status]').innerHTML=statuses.map(s=>`<option>${esc(s)}</option>`).join('');await refresh();
}catch(e){$('#login').hidden=false;$('#login-error').textContent=e.message;}}
$('#login-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter||e.target.querySelector('button[type=submit],button.primary');button.disabled=true;$('#login-error').textContent='';try{await api('login','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();await init();}catch(e){$('#login-error').textContent=e.message;}finally{button.disabled=false;}};
$('#logout').onclick=async()=>{try{await api('logout','POST',{});items=[];owner='mine';$('#records').replaceChildren();await init();}catch(e){toast(e.message);}};
for(const id of ['search','status-filter','sort'])$('#'+id).addEventListener(id==='search'?'input':'change',render);
$('#owners').onclick=e=>{const b=e.target.closest('[data-owner]');if(b){owner=b.dataset.owner;render();}};
$('#progress-stops').onclick=e=>{const b=e.target.closest('[data-filter]');if(b){$('#status-filter').value=b.dataset.filter;render();}};
$('#nav-all').onclick=()=>{owner='mine';$('#search').value='';$('#status-filter').value='';render();};
async function openEditor(id){editing=id?items.find(i=>i.id===id):null;const form=$('#record-form');form.reset();$('#form-error').textContent='';const readOnly=editing&&editing.owner_id!==user.id;
  for(const e of form.querySelectorAll('input,select,textarea')){e.disabled=!!readOnly;e.value=editing?.[e.name]??(e.name==='status'?'已投递':'');}
  $('#editor-title').textContent=editing?`${editing.company} · ${readOnly?'查看记录':'投递详情'}`:'新增投递';$('#save').hidden=!!readOnly;$('#delete').hidden=!editing||readOnly;$('#history-wrap').hidden=!editing;$('#history').replaceChildren();$('#editor').showModal();
  if(editing){const current=editing.id;try{const r=await api(`applications/${current}/events`);if(editing?.id===current)$('#history').innerHTML=r.events.map(e=>`<li>${esc(e.note)}<time>${new Date(e.created_at).toLocaleString('zh-CN')}</time></li>`).join('');}catch(e){$('#form-error').textContent=e.message;}}
}
$('#add').onclick=$('#empty-add').onclick=()=>openEditor();$('#records').onclick=e=>{const b=e.target.closest('[data-id]');if(b)openEditor(Number(b.dataset.id));};
for(const b of document.querySelectorAll('.close'))b.onclick=()=>$('#editor').close();
$('#record-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter||$('#save');b.disabled=true;try{const data=Object.fromEntries(new FormData(e.target));if(editing)data.version=editing.version;await api(`applications${editing?'/'+editing.id:''}`,editing?'PUT':'POST',data);$('#editor').close();await refresh();toast('记录已保存');}catch(e){$('#form-error').textContent=e.message;}finally{b.disabled=false;}};
$('#delete').onclick=async()=>{if(!editing||!confirm(`确定删除“${editing.company}”这条投递及其历史记录？`))return;try{await api(`applications/${editing.id}`,'DELETE',{});$('#editor').close();await refresh();toast('记录已删除');}catch(e){$('#form-error').textContent=e.message;}};
$('#export').onclick=()=>{const keys=['company','role','email','city','status','applied_on','job_code','next_on','notes','owner_name'];const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const csv=[['公司','岗位','邮箱','城市','进度','投递日期','职位编号','下次跟进','备注','投递人'],...filtered().map(i=>keys.map(k=>i[k]))].map(r=>r.map(cell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='投递记录.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#password-button').onclick=()=>{$('#password-error').textContent='';$('#password-form').reset();$('#password-dialog').showModal();};$('#password-close').onclick=()=>$('#password-dialog').close();
$('#password-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await api('password','POST',Object.fromEntries(new FormData(e.target)));$('#password-dialog').close();toast('密码已修改');}catch(e){$('#password-error').textContent=e.message;}finally{e.submitter.disabled=false;}};
init();
