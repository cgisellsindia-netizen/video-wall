import fitz

path = r'C:\Users\USER\Desktop\PRODUCT_BOUCHER_CGI _CCTV_CAMERAS_INDIA_2025.pdf'
doc = fitz.open(path)

with open(r'D:\instamart-clone\brochure_text.txt', 'w', encoding='utf-8') as out:
    out.write(f'Total pages: {len(doc)}\n\n')
    for i in range(len(doc)):
        text = doc[i].get_text()
        out.write(f'=== PAGE {i+1} ===\n')
        out.write(text)
        out.write('\n\n')

print('Done')
