import re
import os

gen_path = '/Users/arpitchauhan/Desktop/bhumichain/data/synthetic-parcels/generate_parcels.py'
seed_path = '/Users/arpitchauhan/Desktop/bhumichain/scripts/seed-district.js'

with open(gen_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace geography
content = content.replace('Gautam Buddha Nagar (Noida)', 'Patna')
content = content.replace('Noida', 'Patna')
content = content.replace('GBN', 'PAT')
content = content.replace('Dadri tehsil', 'Phulwari Sharif anchal')
content = content.replace('"Dadri"', '"Phulwari Sharif"')
content = content.replace('"DAD"', '"PHU"')
content = content.replace('UP-GBN', 'BR-PAT')
content = content.replace('Uttar Pradesh', 'Bihar')
content = content.replace('DLPI-UP-DAD', 'DLPI-BR-PHU')
content = content.replace('noida_parcels', 'patna_parcels')
content = content.replace('Bhumidhari', 'Raiyati')
content = content.replace('Sirdar', 'Gair Mazarua')
content = content.replace('Lekhpal', 'Karmachari')
content = content.replace('khasraNo', 'khesraNo')
content = content.replace('khataNo', 'jamabandiNo')
content = content.replace('UP_FIRST_NAMES', 'BIHAR_FIRST_NAMES')
content = content.replace('UP_SURNAMES', 'BIHAR_SURNAMES')

# Bounding box for Patna
content = content.replace('28.45', '25.55')
content = content.replace('28.70', '25.65')
content = content.replace('77.40', '85.05')
content = content.replace('77.75', '85.25')

with open(gen_path, 'w', encoding='utf-8') as f:
    f.write(content)

with open(seed_path, 'r', encoding='utf-8') as f:
    seed_content = f.read()

seed_content = seed_content.replace('noida_parcels', 'patna_parcels')
seed_content = seed_content.replace('tehsildar', 'circle_officer')
seed_content = seed_content.replace('DLPI-UP-DAD', 'DLPI-BR-PHU')

with open(seed_path, 'w', encoding='utf-8') as f:
    f.write(seed_content)

print("Updated seed data scripts for Bihar.")
