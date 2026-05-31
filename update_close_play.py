import re

with open('merged.html','r',encoding='utf-8') as f:
    h = f.read()

# 1. Add cache-buster to buildEmbedUrl YouTube
old_yt = 'var url="https://www.youtube.com/embed/"+youtubeId+"?autoplay=1&mute=1&playsinline=1&rel=0";if(loop){url+="&loop=1&playlist="+youtubeId;}return url;'
new_yt = 'var url="https://www.youtube.com/embed/"+youtubeId+"?autoplay=1&mute=1&playsinline=1&rel=0&_cb="+Date.now();if(loop){url+="&loop=1&playlist="+youtubeId;}return url;'
h = h.replace(old_yt, new_yt)

# 2. Add cache-buster to Vimeo
old_vimeo = 'var url="https://player.vimeo.com/video/"+vimeoId+"?autoplay=1&muted=1&autopause=0";if(loop){url+="&loop=1";}return url;'
new_vimeo = 'var url="https://player.vimeo.com/video/"+vimeoId+"?autoplay=1&muted=1&autopause=0&_cb="+Date.now();if(loop){url+="&loop=1";}return url;'
h = h.replace(old_vimeo, new_vimeo)

# 3. Modify scheduleIframeReload to close tile after first play
old_schedule = 'function scheduleIframeReload(index,iframe,targetUrl,sourceType,currentProxy){\n  var reloadMs=45000;\n  var loopCount=parseInt(iframe.getAttribute("data-loop-count")||"0",10);\n  var timer=setTimeout(function(){\n    var tile=document.getElementById("tile-"+index);\n    if(!tile||!tile.classList.contains("working")){clearTimeout(timer);return;}\n    loopCount++;\n    iframe.setAttribute("data-loop-count",loopCount);\n    var badge=iframe.parentElement.querySelector(".tile-proxy-badge");\n    if(loopCount<3){\n      // Do NOT reload iframe - let YouTube/Vimeo loop internally via loop=1 parameter\n      if(!badge){\n        badge=document.createElement("div");badge.className="tile-proxy-badge";iframe.parentElement.appendChild(badge);\n      }\n      badge.textContent="loop "+loopCount+"/3";\n      log("Tile "+(index+1)+" keeping proxy (loop "+loopCount+"/3)","warn");\n      scheduleIframeReload(index,iframe,targetUrl,sourceType,currentProxy);\n    }else{\n      loopCount=0;iframe.setAttribute("data-loop-count","0");\n      var newProxy=pickNextProxy();\n      var newEmbed=buildEmbedUrl(targetUrl,sourceType,true);\n      if(!newEmbed){clearTimeout(timer);return;}\n      var badgeNum=newProxy?((proxyRoundRobin-1+proxyPool.length)%proxyPool.length+1):"";\n      iframe.src=newProxy?wrapUrlThroughProxy(newEmbed,newProxy):newEmbed;\n      if(!badge){\n        badge=document.createElement("div");badge.className="tile-proxy-badge";iframe.parentElement.appendChild(badge);\n      }\n      badge.textContent=newProxy?("proxy "+badgeNum+"/"+proxyPool.length):"no proxy";\n      log("Tile "+(index+1)+" reloaded with new proxy after 3 loops","warn");\n      scheduleIframeReload(index,iframe,targetUrl,sourceType,newProxy);\n    }\n  },reloadMs);\n}'

new_schedule = 'function scheduleIframeReload(index,iframe,targetUrl,sourceType,currentProxy){\n  var reloadMs=45000;\n  var timer=setTimeout(function(){\n    var tile=document.getElementById("tile-"+index);\n    if(!tile||!tile.classList.contains("working")){clearTimeout(timer);return;}\n    tile.style.display="none";\n    iframe.src="about:blank";\n    log("Tile "+(index+1)+" closed after first play (session cleared)","warn");\n  },reloadMs);\n}'

h = h.replace(old_schedule, new_schedule)

# 4. Add Clear Data button
old_actions = '<button class="secondary" onclick="toggleFailed()" id="toggleBtn">Show Failed</button>\n    <button class="secondary" onclick="toggleAutoRefresh()" id="autoRefreshBtn" style="background:#e67e22">Auto Refresh: OFF</button>'
new_actions = '<button class="secondary" onclick="toggleFailed()" id="toggleBtn">Show Failed</button>\n    <button class="secondary" onclick="toggleAutoRefresh()" id="autoRefreshBtn" style="background:#e67e22">Auto Refresh: OFF</button>\n    <button class="secondary" onclick="clearAllData()" style="background:#c0392b">Clear All Data</button>'
h = h.replace(old_actions, new_actions)

# 5. Add clearAllData function
old_fetch = 'async function fetchAllFreeProxies(){'
new_fetch = 'function clearAllData(){\n  document.getElementById("grid").innerHTML="";\n  document.getElementById("logs").innerHTML="";\n  document.getElementById("proxies").value="";\n  document.getElementById("targetUrl").value="";\n  document.getElementById("fileLabel").textContent="Click to upload proxy list";\n  updateStats(0,0,0,0);\n  proxyPool=[];\n  proxyRoundRobin=0;\n  workingTileQueue=[];\n  if(staggerTimer){clearTimeout(staggerTimer);staggerTimer=null;}\n  running=false;\n  document.getElementById("testBtn").disabled=false;\n  log("All data cleared","warn");\n}\n\nasync function fetchAllFreeProxies(){'

h = h.replace(old_fetch, new_fetch)

with open('merged.html','w',encoding='utf-8') as f:
    f.write(h)
print('Done')

