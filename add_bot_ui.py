import re

with open('G:/instamart-clone/video-wall-project/merged.html','r',encoding='utf-8') as f:
    h = f.read()

# Add Bot Profile selector after Mode selector
old_mode = '''      <label>Mode</label>
      <select id="mode">
        <option value="iframe" selected>Embedded iframe (old player)</option>
        <option value="video">Direct video tag</option>
        <option value="test-only">Test only (no tiles)</option>
      </select>'''

new_mode = '''      <label>Mode</label>
      <select id="mode">
        <option value="iframe" selected>Embedded iframe (old player)</option>
        <option value="video">Direct video tag</option>
        <option value="test-only">Test only (no tiles)</option>
        <option value="bot-test">Bot Detection Test (Real Browser)</option>
      </select>
      <label>Bot Profile</label>
      <select id="botProfile">
        <option value="naive" selected>Naive Bot (Easy Detect)</option>
        <option value="stealth">Stealth Bot (UA Spoof)</option>
        <option value="human">Human Sim (Headed Browser)</option>
      </select>'''

h = h.replace(old_mode, new_mode)

# Add bot test result display styles
old_style_end = '''.log-line.warn { color: var(--warn); }'''
new_style = '''.log-line.warn { color: var(--warn); }
.bot-result { background: #1a1d2a; border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin: 8px 0; }
.bot-result .bot-title { color: var(--accent); font-weight: bold; margin-bottom: 6px; }
.bot-result .bot-signal { display: inline-block; background: #2a2d3a; padding: 2px 8px; border-radius: 4px; margin: 2px; font-size: 11px; }
.bot-result .bot-signal.bad { background: #3a1a1a; color: var(--error); }
.bot-result .bot-signal.good { background: #1a3a1a; color: var(--success); }'''

h = h.replace(old_style_end, new_style)

# Add bot test function before closing script tag
old_clear = '''function clearAll(){running=false;document.getElementById("grid").innerHTML="";document.getElementById("logs").innerHTML="";updateStats(0,0,0,0);document.getElementById("testBtn").disabled=false;}'''

new_clear = old_clear + '''
async function runBotTest(proxy,index){
  var targetUrl=document.getElementById("targetUrl").value.trim();
  var profile=document.getElementById("botProfile").value;
  log("Bot test ["+profile+"] via proxy "+(index+1)+" -> "+targetUrl,"warn");
  try{
    var res=await fetch("/api/bot-test",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({proxy:proxy,targetUrl:targetUrl,profile:profile})
    });
    var data=await res.json();
    if(!data.ok){
      log("Bot test proxy "+(index+1)+" error: "+data.error,"error");
      return;
    }
    var grid=document.getElementById("grid");
    var tile=document.createElement("div");
    tile.className="tile working";
    tile.innerHTML='<div class="bot-result"><div class="bot-title">Proxy '+(index+1)+' | Profile: '+profile+'</div><div>Page: '+data.pageTitle+'</div><div>Blocked: '+(data.blocked?"YES":"NO")+' | Captcha: '+(data.captcha?"YES":"NO")+' | Bot: '+(data.botDetected?"DETECTED":"CLEAN")+'</div><div>Video Loaded: '+(data.videoLoaded?"YES":"NO")+' | Playing: '+(data.videoPlaying?"YES":"NO")+'</div><div>Load Time: '+data.loadTime+'ms</div><div>Signals: '+(data.signals||[]).map(function(s){return '<span class="bot-signal '+(s.indexOf("block")>=0||s.indexOf("error")>=0||s.indexOf("captcha")>=0?"bad":"good")+'">'+s+'</span>'}).join("")+'</div></div>';
    grid.appendChild(tile);
    log("Bot test proxy "+(index+1)+" -> "+(data.botDetected?"DETECTED":"PASSED")+(data.videoPlaying?" | VIDEO PLAYING":""),data.botDetected?"error":"success");
  }catch(err){
    log("Bot test proxy "+(index+1)+" failed: "+err.message,"error");
  }
}'''

h = h.replace(old_clear, new_clear)

# Modify testOneProxy to handle bot-test mode
old_test = '''async function testOneProxy(targetUrl,proxy,index){  try{    const res=await fetch("/api/test",{      method:"POST",headers:{"Content-Type":"application/json"},      body:JSON.stringify({targetUrl:targetUrl,proxy:proxy})    });    const data=await res.json();    if(data.ok){      createTile(proxy,index);      updateTileSuccess(index,data.proxy,data.statusCode,targetUrl);    }else{      log("Proxy "+proxy+" FAILED: "+(data.error||"Error"),"error");    }    return data.ok;  }catch(e){    log("Proxy "+proxy+" FAILED: "+e.message,"error");    return false;  }}'''

new_test = '''async function testOneProxy(targetUrl,proxy,index){  try{    if(globalMode==="bot-test"){      await runBotTest(proxy,index);      return true;    }    const res=await fetch("/api/test",{      method:"POST",headers:{"Content-Type":"application/json"},      body:JSON.stringify({targetUrl:targetUrl,proxy:proxy})    });    const data=await res.json();    if(data.ok){      createTile(proxy,index);      updateTileSuccess(index,data.proxy,data.statusCode,targetUrl);    }else{      log("Proxy "+proxy+" FAILED: "+(data.error||"Error"),"error");    }    return data.ok;  }catch(e){    log("Proxy "+proxy+" FAILED: "+e.message,"error");    return false;  }}'''

h = h.replace(old_test, new_test)

with open('G:/instamart-clone/video-wall-project/merged.html','w',encoding='utf-8') as f:
    f.write(h)
print('Bot test UI added to merged.html')

