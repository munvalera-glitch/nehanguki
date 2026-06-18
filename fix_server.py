with open("server.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if 'const images = [];' in line and lines[i+1].strip().startswith('if (b.images && Array.isArray(b.images)) {') and lines[i+4].strip().startswith('const parts = imgObj.data.split(') and i > 3085:
        skip = True
    
    if skip and 'py.on("close", code => {' in line and lines[i+4].strip() == '});' and lines[i+5].strip() == '// 3. Generate Schedule of Stay (Word Document) using template':
        skip = False
        continue # skip the `});` line
    elif skip and lines[i].strip() == '});' and 'py.on("close", code => {' in lines[i-4]:
        skip = False
        continue
    
    if not skip:
        new_lines.append(line)

with open("server.js", "w", encoding="utf-8") as f:
    f.writelines(new_lines)

