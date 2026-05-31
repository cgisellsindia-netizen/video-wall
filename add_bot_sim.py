import re

with open('G:/instamart-clone/video-wall-project/merged.html','r',encoding='utf-8') as f:
    h = f.read()

# Add Bot Simulation mode to dropdown
h = h.replace(
    '<option value="bot-test">Bot Detection Test (Real Browser)</option>',
    '<option value="bot-test">Bot Detection Test (Real Browser)</option>\n        <option value="bot-sim">Bot Simulation (Mimic APK)</option>'
)

# Add bot simulation code before the closing script tag
bot_code = '''
let botSimProxyIndex=0;

function getBotUA(profile){
  const uas={
    'multi-watch':'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/525.13 (KHTML, like Gecko) Chrome/0.A.B.C Safari/525.13',
    'old-chrome':'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
    'headless':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
    'android-webview':'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
    'real-desktop':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  return uas[profile]||uas['multi-watch'];
}

function injectBotScripts(iframe,profile){
  try{
    var doc=iframe.contentDocument||iframe.contentWindow.document;
    var script=doc.createElement('script');
    script.textContent='(function(){'+
      'window.AppInventor={getWebViewString:function(){return "";},setWebViewString:function(v){}};'+
      'Object.defineProperty(navigator,"webdriver",{get:function(){return ' + (profile==='headless'?'true':'false') + ';},configurable:true});'+
      'Object.defineProperty(navigator,"plugins",{get:function(){return [];},configurable:true});'+
      'Object.defineProperty(navigator,"languages",{get:function(){return [];},configurable:true});'+
      'window.outerWidth=0;window.outerHeight=0;'+
      '})();';
    doc.head.appendChild(script);
    log('Bot sim: injected signatures','warn');
  }catch(e){log('Bot sim inject error: '+e.message,'error');}
}

async function runBotSim(proxy,index){
  var targetUrl=document.getElementById('targetUrl').value.trim();
  var profile=document.getElementById('botProfile').value;
  var ua=getBotUA(profile);
  log('Bot Sim ['+profile+'] proxy '+(index+1)+' -> '+targetUrl,'warn');
  
  var grid=document.getElementById('grid');
  var tile=document.createElement('div');
  tile.className='tile working';
  tile.id='tile-'+index;
  tile.innerHTML='<div style="padding:10px"><div>Bot Sim Proxy '+(index+1)+'</div><div style="font-size:9px">UA: '+ua.substring(0,55)+'...</div><div id="bot-status-'+index+'">Loading...</div><div id="countdown-'+index+'" style="color:#e67e22"></div></div>';
  grid.appendChild(tile);
  
  var iframe=document.createElement('iframe');
  iframe.className='tile-frame';
  iframe.style.height='180px';
  iframe.sandbox='allow-scripts allow-same-origin allow-presentation';
  
  iframe.onload=function(){
    tile.querySelector('#bot-status-'+index).textContent='Injecting bot sigs...';
    setTimeout(function(){injectBotScripts(iframe,profile);},500);
    tile.querySelector('#bot-status-'+index).textContent='Running '+ (profile==='headless'?'30':'45') +'s timer...';
    
    var seconds=profile==='headless'?30:45;
    var cd=document.getElementById('countdown-'+index);
    var iv=setInterval(function(){
      seconds--;
      if(cd)cd.textContent=seconds+'s remaining';
      if(seconds<=0)clearInterval(iv);
    },1000);
    
    setTimeout(function(){
      tile.style.transition='opacity 0.5s';
      tile.style.opacity='0';
      setTimeout(function(){if(tile.parentNode)tile.parentNode.removeChild(tile);},500);
      log('Bot Sim proxy '+(index+1)+' completed','success');
    },profile==='headless'?30000:45000);
  };
  
  iframe.src=targetUrl;
  tile.appendChild(iframe);
}
'''

# Replace closing script tag
h = h.replace('</script>', bot_code + '</script>')

# Update testOneProxy to catch bot-sim mode
h = h.replace(
    'if(globalMode==="bot-test"){await runBotTest(proxy,index);return true;}',
    'if(globalMode==="bot-test"){await runBotTest(proxy,index);return true;}if(globalMode==="bot-sim"){await runBotSim(proxy,index);return true;}'
)

with open('G:/instamart-clone/video-wall-project/merged.html','w',encoding='utf-8') as f:
    f.write(h)
print('Bot simulation mode added')

