with open('G:/instamart-clone/video-wall-project/merged.html','r',encoding='utf-8') as f:
    h = f.read()

# Find and replace the bot-test option to add bot-sim after it
old = '<option value="bot-test">Real Browser (bot detection test)</option>'
new = '<option value="bot-test">Real Browser (bot detection test)</option>\n        <option value="bot-sim">Bot Simulation (mimic APK behavior)</option>'

if old in h:
    h = h.replace(old, new)
    print('Dropdown fixed')
else:
    print('Old text not found, checking...')
    # Show what's actually there
    import re
    matches = re.findall(r'<option value="[^"]+">[^<]+</option>', h)
    for m in matches[-10:]:
        print(repr(m))

with open('G:/instamart-clone/video-wall-project/merged.html','w',encoding='utf-8') as f:
    f.write(h)

