import os

auth_js_path = '/Users/arpitchauhan/Desktop/bhumichain/backend/api-gateway/src/middleware/auth.js'
with open(auth_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("PATWARI:          'patwari'", "KARMACHARI:       'karmachari'")
content = content.replace("CIRCLE_INSPECTOR: 'circle_inspector'", "ANCHAL_NIRIKSHAK: 'anchalNirikshak'")
content = content.replace("TEHSILDAR:        'tehsildar'", "ANCHAL_ADHIKARI:  'anchalAdhikari'")

content = content.replace("'patwari', 'circle_inspector'", "'karmachari', 'anchalNirikshak'")
content = content.replace("'tehsildar'", "'anchalAdhikari'")
content = content.replace("'patwari'", "'karmachari'")
content = content.replace("'circle_inspector'", "'anchalNirikshak'")

with open(auth_js_path, 'w', encoding='utf-8') as f:
    f.write(content)

# We must also replace the requireRole usages in the routes
def replace_in_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        data = f.read()
    for old, new in replacements:
        data = data.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(data)

routes_dir = '/Users/arpitchauhan/Desktop/bhumichain/backend/api-gateway/src/routes'
for fname in os.listdir(routes_dir):
    if fname.endswith('.js'):
        replace_in_file(os.path.join(routes_dir, fname), [
            ("ROLES.PATWARI", "ROLES.KARMACHARI"),
            ("ROLES.CIRCLE_INSPECTOR", "ROLES.ANCHAL_NIRIKSHAK"),
            ("ROLES.TEHSILDAR", "ROLES.ANCHAL_ADHIKARI"),
            ("'patwari'", "'karmachari'"),
            ("'circle_inspector'", "'anchalNirikshak'"),
            ("'tehsildar'", "'anchalAdhikari'")
        ])

print("Updated API Gateway roles.")
