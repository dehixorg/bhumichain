import re

filepath = "src/lib/mockBackend.ts"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace khataNo with jamabandiNo as the primary key
# We will just change the key "khataNo:" to "jamabandiNo:"
content = re.sub(r'khataNo:\s*(\'\d+\')', r'jamabandiNo: \1', content)

# 2. Add Area calculations
def replace_area(match):
    full_match = match.group(0)
    area = float(match.group(1))
    
    # Dummy conversion for demo: 1 hectare = 4 bighas, 1 bigha = 20 katha, 1 katha = 20 dhur
    # Just hardcode a few specific values so it looks right
    if area == 1.2:
        return f"areaHectares: {area},\n    rakbaBigha: 4,\n    rakbaKatha: 16,\n    rakbaDhur: 0,\n    rakbaDecimal: 296"
    elif area == 0.025:
        return f"areaHectares: {area},\n    rakbaBigha: 0,\n    rakbaKatha: 1,\n    rakbaDhur: 10,\n    rakbaDecimal: 6"
    elif area == 2.4:
        return f"areaHectares: {area},\n    rakbaBigha: 9,\n    rakbaKatha: 12,\n    rakbaDhur: 0,\n    rakbaDecimal: 593"
    elif area == 0.04:
        return f"areaHectares: {area},\n    rakbaBigha: 0,\n    rakbaKatha: 3,\n    rakbaDhur: 4,\n    rakbaDecimal: 10"
    elif area == 0.8:
        return f"areaHectares: {area},\n    rakbaBigha: 3,\n    rakbaKatha: 4,\n    rakbaDhur: 0,\n    rakbaDecimal: 197"
    else:
        return f"areaHectares: {area},\n    rakbaBigha: 5,\n    rakbaKatha: 0,\n    rakbaDhur: 0,\n    rakbaDecimal: 250"

content = re.sub(r'areaHectares:\s*([0-9.]+)', replace_area, content)

# 3. Add Bihar specific hierarchy fields
def add_bihar_hierarchy(match):
    # This matches "tehsilCode: '...', district: '...',"
    # We want to add zila, anchal, halka, rajaswaGram
    return match.group(0) + "\n    zila: 'Patna',\n    anchal: 'Phulwari Sharif',\n    halka: '3',\n    rajaswaGram: 'Kurji',\n    revenueThanaNo: '142',"

# We match `state:\s*'Bihar',` and append underneath
content = re.sub(r'state:\s*\'Bihar\',', add_bihar_hierarchy, content)

# 4. Fix mutations notes
content = content.replace("Bihar Revenue Code Sec 33", "Bihar Land Mutation Act 2011 Sec 12(1)")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated mockBackend.ts with Bihar data model.")
