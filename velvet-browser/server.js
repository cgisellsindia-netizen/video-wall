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
  ctx=await browser.newContext({viewport:{width:390,height:730},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'en-IN',timezoneId:'Asia/Kolkata',acceptDownloads:false});
  ctx.on('page',async p=>{if(p!==page)await p.close().catch(()=>{})});
  page=await ctx.newPage();
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
case 'tap':{const x=Number(data.x),y=Number(data.y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>390||y>730)throw Error('Invalid coordinates');await p.mouse.click(x,y);break}
case 'type':{const t=String(data.text||'');if(t.length>1500)throw Error('Input too long');await p.keyboard.insertText(t);break}
case 'key':{const k=String(data.key||'');if(!['Enter','Backspace','Tab','Escape','ArrowUp','ArrowDown'].includes(k))throw Error('Unsupported key');await p.keyboard.press(k);break}
case 'scroll':{const amount=Number(data.amount)||350;await p.mouse.wheel(0,Math.max(-1100,Math.min(1100,amount)));break}
case 'home':await p.goto('https://www.facebook.com/messages/',{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});break;
case 'reset':await restartBrowser();break;
default:throw Error('Unsupported action')}
return {ok:true,url:p.url(),title:(await p.title().catch(()=>''))}}
const srv=http.createServer(async(req,res)=>{
try{
const path=new URL(req.url,'http://localhost').pathname;
if(path==='/health'){return send(res,200,{ok:true,service:'Velvet private browser',configured:true})}
if(path==='/'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self' 'unsafe-inline' data: blob:; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors https://velvet-ai-live.onrender.com"});return res.end(html)}
if(!authorized(req))return send(res,401,{error:'Access key required'});
if(path==='/api/check')return send(res,200,{ok:true});
if(path==='/api/frame'&&req.method==='GET'){const buf=await queue(()=>retryOnce(async()=>{const p=await init();return p.screenshot({type:'jpeg',quality:55,timeout:12000})}));res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(buf)}
if(path==='/api/action'&&req.method==='POST'){const data=await body(req);return send(res,200,await queue(()=>retryOnce(()=>action(data))))}
if(path==='/api/conversation'&&req.method==='GET'){const result=await queue(()=>retryOnce(async()=>{const p=await init();const url=p.url();const chatPage=/facebook\\.com\\/(messages|t\\/)|messenger\\.com\\/t\\//i.test(url);if(!chatPage)return {ready:false,reason:'Open a Messenger conversation first'};return await p.evaluate(()=>{const main=document.querySelector('[role="main"]')||document.querySelector('main');if(!main)return {ready:false,reason:'Conversation area not found'};const root=main.querySelector('[role="log"]')||main.querySelector('[aria-label*="Messages"]')||main;const nodes=[...root.querySelectorAll('[dir="auto"],[role="row"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>=0&&r.top<=innerHeight&&el.children.length<5});const parts=[];for(const n of nodes){const v=(n.innerText||'').trim();if(v.length<2||v.length>600||parts[parts.length-1]===v||/^(Like|Reply|More|Forward|React|Seen|Delivered|Send|Search|Home|Chats|People|Menu)$/i.test(v))continue;parts.push(v)}const visible=parts.slice(-18);return {ready:visible.length>0,lines:visible,reason:visible.length?'':'No visible messages found'}})}));return send(res,200,result)}
if(path==='/api/visible'&&req.method==='GET'){const text=await queue(()=>retryOnce(async()=>{const p=await init();return await p.evaluate(()=>{const main=document.querySelector('[role="main"]')||document.body;return (main?.innerText||'').slice(-8000)})}));return send(res,200,{text})}
send(res,404,{error:'Not found'})
}catch(e){send(res,500,{error:String(e.message||'Browser unavailable').slice(0,160)})}
});
srv.listen(PORT,'0.0.0.0',()=>console.log('Velvet private browser listening on '+PORT));
process.on('SIGTERM',async()=>{try{await browser?.close()}catch{}process.exit(0)});
