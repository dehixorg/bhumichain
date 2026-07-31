import os
import re

directories_to_search = [
    'backend',
    'frontend',
    'blockchain',
    'data',
    'scripts'
]

exclude_dirs = {'.git', 'node_modules', '.next', 'fabric-samples'}
exclude_files = {'remove_hashing.py', 'package-lock.json', 'yarn.lock'}

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Skipping {filepath} (unreadable)")
        return

    original_content = content

    # Replace variations
    content = content.replace('aadhaarHash', 'aadhaarNumber')
    content = content.replace('AadhaarHash', 'AadhaarNumber')
    content = content.replace('aadhaar_hash', 'aadhaar_number')
    content = content.replace('deceasedHash', 'deceasedAadhaar')

    # Remove crypto.createHash logic
    if 'computeAadhaarHash' in content:
        # We replace the body of computeAadhaarHash to just return the number
        content = re.sub(
            r"function computeAadhaarHash\s*\([^\)]*\)\s*\{[\s\S]*?\}",
            "function computeAadhaarNumber(aadhaarNumber) {\n  return aadhaarNumber;\n}",
            content
        )
        content = content.replace('computeAadhaarHash', 'computeAadhaarNumber')

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root_dir in directories_to_search:
    if not os.path.exists(root_dir):
        continue
    for root, dirs, files in os.walk(root_dir):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file in exclude_files:
                continue
            # Only text files
            if not any(file.endswith(ext) for ext in ['.js', '.ts', '.tsx', '.go', '.py', '.json', '.md']):
                continue
            replace_in_file(os.path.join(root, file))

print("Done replacing.")
