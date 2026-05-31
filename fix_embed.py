import re

with open('G:/instamart-clone/video-wall-project/merged.html','r',encoding='utf-8') as f:
    h = f.read()

# 1. Add cache-buster to buildEmbedUrl for YouTube
old_yt = 'var url="https://www.youtube.com/embed/"+youtubeId+"?autoplay=1&mute=1&playsinline=1&rel=0";if(loop){url+="&loop=1&playlist="+youtubeId;}return url;'
new_yt = 'var url="https://www.youtube.com/embed/"+youtubeId+"?autoplay=1&mute=1&playsinline=1&rel=0&_cb="+Date.now();if(loop){url+="&loop=1&playlist="+youtubeId;}return url;'
h = h.replace(old_yt, new_yt)

# 2. Add cache-buster to Vimeo
old_vimeo = 'var url="https://player.vimeo.com/video/"+vimeoId+"?autoplay=1&muted=1&autopause=0";if(loop){url+="&loop=1";}return url;'
new_vimeo = 'var url="https://player.vimeo.com/video/"+vimeoId+"?autoplay=1&muted=1&autopause=0&_cb="+Date.now();if(loop){url+="&loop=1";}return url;'
h = h.replace(old_vimeo, new_vimeo)

# 3. Replace scheduleIframeReload to REMOVE tile after first play
old_schedule = '''function scheduleIframeReload(index,iframe,targetUrl,sourceType,currentProxy){
  var reloadMs=45000;
  var loopCount=parseInt(iframe.getAttribute("data-loop-count")||"0",10);
  var timer=setTimeout(function(){
    var tile=document.getElementById("tile-"+index);
    if(!tile||!tile.classList.contains("working")){clearTimeout(timer);return;}
    loopCount++;
    iframe.setAttribute("data-loop-count",loopCount);
    var badge=iframe.parentElement.querySelector(".tile-proxy-badge");
    if(loopCount<3){
      // Do NOT reload iframe - let YouTube/Vimeo loop internally via loop=1 parameter
      if(!badge){
        badge=document.createElement("div");badge.className="tile-proxy-badge";iframe.parentElement.appendChild(badge);
      }
      badge.textContent="loop "+loopCount+"/3";
      log("Tile "+(index+1)+" keeping proxy (loop "+loopCount+"/3)","warn");
      scheduleIframeReload(index,iframe,targetUrl,sourceType,currentProxy);
    }else{
      loopCount=0;iframe.setAttribute("data-loop-count","0");
      var newProxy=pickNextProxy();
      var newEmbed=buildEmbedUrl(targetUrl,sourceType,true);
      if(!newEmbed){clearTimeout(timer);return;}
      var badgeNum=newProxy?((proxyRoundRobin-1+proxyPool.length)%proxyPool.length+1):"";
      iframe.src=newProxy?wrapUrlThroughProxy(newEmbed,newProxy):newEmbed;
      if(!badge){
        badge=document.createElement("div");badge.className="tile-proxy-badge";iframe.parentElement.appendChild(badge);
      }
      badge.textContent=newProxy?("proxy "+badgeNum+"/"+proxyPool.length):"no proxy";
      log("Tile "+(index+1)+" reloaded with new proxy after 3 loops","warn");
      scheduleIframeReload(index,iframe,targetUrl,sourceType,newProxy);
    }
  },reloadMs);
}'''

new_schedule = '''function scheduleIframeReload(index,iframe,targetUrl,sourceType,currentProxy){
  // After video plays once (~45s), remove tile to clear session
  var playMs=45000;
  setTimeout(function(){
    var tile=document.getElementById("tile-"+index);
    if(tile){
      tile.style.transition="opacity 0.5s";
      tile.style.opacity="0";
      setTimeout(function(){if(tile.parentNode)tile.parentNode.removeChild(tile);},500);
      log("Tile "+(index+1)+" removed after first play - session cleared","success");
    }
  },playMs);
}'''

h = h.replace(old_schedule, new_schedule)

# 4. Update iframe creation in processStaggerQueue to use sandbox
old_iframe1 = '''    var iframe=document.createElement("iframe");
    iframe.className="tile-frame";
    iframe.src=item.embedUrl;
    iframe.allow="autoplay; fullscreen; picture-in-picture";
    iframe.referrerPolicy="strict-origin-when-cross-origin";
    iframe.setAttribute("allowfullscreen","true");
    iframe.setAttribute("title","Proxy "+(item.index+1)+" source");'''

new_iframe1 = '''    var iframe=document.createElement("iframe");
    iframe.className="tile-frame";
    iframe.src=item.embedUrl;
    iframe.allow="autoplay; fullscreen; picture-in-picture";
    iframe.referrerPolicy="no-referrer";
    iframe.setAttribute("allowfullscreen","true");
    iframe.setAttribute("title","Proxy "+(item.index+1)+" source");
    iframe.setAttribute("sandbox","allow-scripts allow-same-origin allow-presentation");'''

h = h.replace(old_iframe1, new_iframe1)

# 5. Update iframe creation in updateTileSuccess
old_iframe2 = '''    var iframe=document.createElement("iframe");
    iframe.className="tile-frame";
    iframe.src=embedUrl;
    iframe.allow="autoplay; fullscreen; picture-in-picture";
    iframe.referrerPolicy="strict-origin-when-cross-origin";
    iframe.setAttribute("allowfullscreen","true");
    iframe.setAttribute("title","Proxy "+(index+1)+" source");'''

new_iframe2 = '''    var iframe=document.createElement("iframe");
    iframe.className="tile-frame";
    iframe.src=embedUrl;
    iframe.allow="autoplay; fullscreen; picture-in-picture";
    iframe.referrerPolicy="no-referrer";
    iframe.setAttribute("allowfullscreen","true");
    iframe.setAttribute("title","Proxy "+(index+1)+" source");
    iframe.setAttribute("sandbox","allow-scripts allow-same-origin allow-presentation");'''

h = h.replace(old_iframe2, new_iframe2)

with open('G:/instamart-clone/video-wall-project/merged.html','w',encoding='utf-8') as f:
    f.write(h)

print('Done: cache-buster, sandbox, auto-remove tile after first play')

