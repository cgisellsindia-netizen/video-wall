'use strict';
const http=require('http');
const fs=require('fs');
const crypto=require('crypto');
const {chromium}=require('playwright');
const PORT=Number(process.env.PORT)||10000;
const ACCESS_KEY=process.env.VELVET_BROWSER_KEY;
if(!ACCESS_KEY||ACCESS_KEY.length<20){console.error('VELVET_BROWSER_KEY is required (20+ chars).');process.exit(1)}
const html=fs.readFileSync(__dirname+'/index.html');
let browser=null,ctx=null,page=null,booting=null,op=Promise.resolve();
function closedError(e){return /closed|crash|disconnected|target page|browser has been closed/i.test(String(e&&e.message||e))}
async function restartBrowser(){const old=browser;browser=null;ctx=null;page=null;booting=null;if(old)await old.close().catch(()=>{});return init()}
async function retryOnce(fn){try{return await fn()}catch(e){if(!closedError(e))throw e;console.warn('Recovering closed Chromium session:',String(e.message).slice(0,110));await restartBrowser();return fn()}}
function queue(fn){const p=op.then(fn);op=p.catch(()=>{});return p}
function authorized(req){const supplied=req.headers.authorization||'';const expected='Bearer '+ACCESS_KEY;const a=Buffer.from(supplied),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
async function init(){
 if(page&&!page.isClosed()&&browser&&browser.isConnected())return page;
 if(booting)return booting;
 booting=(async()=>{
  if(!browser||!browser.isConnected()){browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check']});browser.on('disconnected',()=>{console.warn('Chromium disconnected; next operation will recreate session');browser=null;page=null;ctx=null})}
  if(ctx)await ctx.close().catch(()=>{});
  ctx=await browser.newContext({viewport:{width:390,height:730},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'en-IN',timezoneId:'Asia/Kolkata',acceptDownloads:false});
  // Do not close a 'page' event here: Chromium emits it before newPage() resolves.
  // Closing it at this point destroys our own first tab.
  page=await ctx.newPage();
  page.on('close',()=>{if(page&&page.isClosed())page=null});
  page.on('dialog',d=>d.dismiss().catch(()=>{}));
  page.on('framenavigated',frame=>{if(frame!==page.mainFrame())return;const url=frame.url();if(url&&url!=='about:blank'&&!allowed(url))page.goto('https://www.facebook.com/messages/').catch(()=>{})});
  await page.goto('https://www.facebook.com/messages/',{waitUntil:'domcontentloaded',timeout:40000}).catch(()=>{});
  return page
 })().finally(()=>{booting=null});
 return booting
}
function allowed(url){try{const u=new URL(url);return u.protocol==='https:'&&/^(facebook\.com|[a-z0-9-]+\.facebook\.com|messenger\.com|[a-z0-9-]+\.messenger\.com|meta\.com|[a-z0-9-]+\.meta\.com)$/.test(u.hostname)}catch{return false}}
async function body(req){let b='';for await(const chunk of req){b+=chunk;if(b.length>12000)throw Error('Request too long')}return b?JSON.parse(b):{}}
function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'null'});res.end(JSON.stringify(obj))}
async function action(data){const p=await init();switch(data.action){
case 'tap':{const x=Number(data.x),y=Number(data.y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>390||y>730)throw Error('Invalid coordinates');await p.touchscreen.tap(x,y);break}
case 'swipe':{const amount=Math.max(-900,Math.min(900,Number(data.amount)||0));if(!Number.isFinite(amount))throw Error('Invalid swipe');await p.evaluate(y=>window.scrollBy({top:y,behavior:'instant'}),amount);break}
case 'test':{await p.goto('about:blank');await p.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:20px system-ui;background:#172238;color:white;padding:24px}button{background:#d8bb7c;color:#191522;font-size:24px;border:0;border-radius:16px;padding:26px;width:100%;margin-top:30px}#count{font-size:30px;margin-top:24px}</style><h2>Velvet Touch Test</h2><p>Tap the big button below using your phone. If the count goes up, remote touch is working.</p><button onclick="document.querySelector(\'#count\').textContent=String(Number(document.querySelector(\'#count\').textContent)+1)">TAP HERE</button><div>Tap count: <span id="count">0</span></div>');break}
case 'type':{const t=String(data.text||'');if(t.length>1500)throw Error('Input too long');await p.keyboard.insertText(t);break}
case 'textEdit':{const kind=String(data.kind||'');if(kind==='backspace')await p.keyboard.press('Backspace');else if(kind==='enter')await p.keyboard.press('Enter');else if(kind==='text'){const t=String(data.text||'');if(t.length>200)throw Error('Text chunk too long');if(t)await p.keyboard.insertText(t)}else throw Error('Unsupported edit');break}
case 'key':{const k=String(data.key||'');if(!['Enter','Backspace','Tab','Escape','ArrowUp','ArrowDown'].includes(k))throw Error('Unsupported key');await p.keyboard.press(k);break}
case 'scroll':{const amount=Number(data.amount)||350;await p.mouse.wheel(0,Math.max(-1100,Math.min(1100,amount)));break}
case 'home':await p.goto('https://www.facebook.com/messages/',{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});break;
case 'reset':await restartBrowser();break;
default:throw Error('Unsupported action')}
const focused=await p.evaluate(()=>{const e=document.activeElement;return !!e&&(e.matches('input:not([type=hidden]),textarea,[contenteditable="true"],[role="textbox"]')||e.isContentEditable)}).catch(()=>false);
return {ok:true,action:data.action,focused,url:p.url(),title:(await p.title().catch(()=>'')),x:data.action==='tap'?Number(data.x):undefined,y:data.action==='tap'?Number(data.y):undefined}}
const srv=http.createServer(async(req,res)=>{
try{
const path=new URL(req.url,'http://localhost').pathname;
if(path==='/health'){return send(res,200,{ok:true,service:'Velvet private browser',configured:true,browserConnected:!!(browser&&browser.isConnected()),pageOpen:!!(page&&!page.isClosed())})}
if(path==='/'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self' 'unsafe-inline' data: blob:; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors https://velvet-ai-live.onrender.com"});return res.end(html)}
if(!authorized(req))return send(res,401,{error:'Access key required'});
if(path==='/api/check')return send(res,200,{ok:true});
if(path==='/api/frame'&&req.method==='GET'){const buf=await queue(()=>retryOnce(async()=>{const p=await init();return p.screenshot({type:'jpeg',quality:88,timeout:15000,scale:'device'})}));res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(buf)}
if(path==='/api/action'&&req.method==='POST'){const data=await body(req);return send(res,200,await queue(()=>retryOnce(()=>action(data))))}
if(path==='/api/conversation'&&req.method==='GET'){const result=await queue(()=>retryOnce(async()=>{const p=await init();const url=p.url();const chatPage=(url.includes('facebook.com/messages')||url.includes('messenger.com/t/'));if(!chatPage)return {ready:false,reason:'Open a Messenger conversation first'};return await p.evaluate(()=>{const main=document.querySelector('[role="main"]')||document.querySelector('main');if(!main)return {ready:false,reason:'Conversation area not found'};const root=main.querySelector('[role="log"]')||main.querySelector('[aria-label*="Messages"]')||main;const nodes=[...root.querySelectorAll('[dir="auto"],[role="row"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>=0&&r.top<=innerHeight&&el.children.length<5});const parts=[];for(const n of nodes){const v=(n.innerText||'').trim();if(v.length<2||v.length>600||parts[parts.length-1]===v||/^(Like|Reply|More|Forward|React|Seen|Delivered|Send|Search|Home|Chats|People|Menu)$/i.test(v))continue;parts.push(v)}const visible=parts.slice(-18);return {ready:visible.length>0,lines:visible,reason:visible.length?'':'No visible messages found'}})}));return send(res,200,result)}
if(path==='/api/profile-insights'&&req.method==='GET'){const result=await queue(()=>retryOnce(async()=>{const p=await init();const u=p.url();if(!allowed(u))return {ready:false,reason:'Only supported Facebook or Messenger pages can be analyzed'};return await p.evaluate(()=>{const root=document.querySelector('[role="main"]')||document.querySelector('main')||document.body;const rectVisible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight};const headerCandidates=[...root.querySelectorAll('header,[role="banner"],[role="heading"],h1,h2,[aria-label]')].filter(rectVisible).filter(el=>el.getBoundingClientRect().top<240);let status='Unknown';for(const el of headerCandidates){const label=((el.getAttribute('aria-label')||'')+' '+(el.innerText||'')).trim().slice(0,250);if(/\\bactive now\\b/i.test(label)){status='Active now (visible indicator)';break}const m=label.match(/\\bactive (\\d+\\s*(?:m|min|minutes?|h|hours?)) ago\\b/i);if(m){status='Last active '+m[1]+' ago (visible indicator)';break}}const candidates=[...root.querySelectorAll('h1,h2,[role="heading"],[dir="auto"],p,span')].filter(rectVisible).filter(el=>el.children.length<3);const lines=[];for(const el of candidates){const t=(el.innerText||'').trim();if(t.length<5||t.length>350||lines.includes(t))continue;lines.push(t);if(lines.length>=45)break}return {ready:true,status,lines:lines.slice(0,45),source:'Visible Facebook/Messenger page only; labels may be incomplete'}})}));return send(res,200,result)}
if(path==='/api/targets'&&req.method==='GET'){const targets=await queue(()=>retryOnce(async()=>{const p=await init();return p.evaluate(()=>[...document.querySelectorAll('input:not([type="hidden"]),textarea,[contenteditable="true"],[role="textbox"]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>10&&r.height>10&&r.bottom>0&&r.top<innerHeight&&r.left<innerWidth&&r.right>0}).slice(0,35).map(e=>{const r=e.getBoundingClientRect();return {x:Math.max(0,r.left),y:Math.max(0,r.top),w:r.width,h:r.height,password:e.getAttribute('type')==='password'}}))}));return send(res,200,{targets})}
if(path==='/api/visible'&&req.method==='GET'){const text=await queue(()=>retryOnce(async()=>{const p=await init();return await p.evaluate(()=>{const main=document.querySelector('[role="main"]')||document.body;return (main?.innerText||'').slice(-8000)})}));return send(res,200,{text})}
send(res,404,{error:'Not found'})
}catch(e){send(res,500,{error:String(e.message||'Browser unavailable').slice(0,160)})}
});
srv.listen(PORT,'0.0.0.0',()=>console.log('Velvet private browser listening on '+PORT));
process.on('SIGTERM',async()=>{try{await browser?.close()}catch{}process.exit(0)});
