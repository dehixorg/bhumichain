import re
import os

types_file = "src/types/index.ts"
with open(types_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Add to types
if 'rakbaBigha?: number' not in content:
    content = content.replace('areaHectares: number;', 'areaHectares: number;\n  rakbaBigha?: number;\n  rakbaKatha?: number;\n  rakbaDhur?: number;\n  rakbaDecimal?: number;')

with open(types_file, 'w', encoding='utf-8') as f:
    f.write(content)

# Update UI rendering
def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    orig = content

    # In my-parcels
    content = content.replace('{Number(p?.areaHectares || 0).toFixed(4)} Ha', 
                              '{p?.rakbaBigha} Bigha, {p?.rakbaKatha} Katha')
    
    # In claim
    content = content.replace('formatArea(parcel.areaHectares)',
                              'parcel.rakbaBigha ? `${parcel.rakbaBigha} Bigha, ${parcel.rakbaKatha} Katha, ${parcel.rakbaDhur} Dhur` : `${parcel.areaHectares} Ha`')
                              
    # In officer dashboard
    content = content.replace('formatArea(item.areaHectares)', 
                              'item.rakbaBigha ? `${item.rakbaBigha} Bigha, ${item.rakbaKatha} Katha` : `${item.areaHectares} Ha`')
                              
    # In review page
    content = content.replace("['Area',         `${parcel.areaHectares} ha`]", 
                              "['Area',         parcel.rakbaBigha ? `${parcel.rakbaBigha} Bigha, ${parcel.rakbaKatha} Katha, ${parcel.rakbaDhur} Dhur` : `${parcel.areaHectares} Ha`]")

    # In auction
    content = content.replace('`${selected.areaHectares} hectares`', 
                              '`${selected.areaHectares} Ha`')
    
    # In EC
    content = content.replace('`${ec.areaHectares || 1.25} hectares`', 
                              '`${ec.areaHectares || 1.25} Ha`')

    if content != orig:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated " + filepath)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx'):
            replace_in_file(os.path.join(root, file))

print("Area UI update complete.")
