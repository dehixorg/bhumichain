import os
import re

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    replacements = [
        (r'\bKhatauni\b', 'Jamabandi'),
        (r'\bkhatauni\b', 'jamabandi'),
        (r'\bKHATAUNI\b', 'JAMABANDI'),
        (r'\bkhasraNo\b', 'khesraNo'),
        (r'\bKhasra\b', 'Khesra'),
        (r'\bkhasra\b', 'khesra'),
        (r'\bBhumidhari\b', 'Raiyati'),
        (r'\bbhumidhari\b', 'raiyati'),
        (r'\bSirdar\b', 'Gair Mazarua'),
        (r'\bTehsildar\b', 'Circle Officer'),
        (r'\btehsildar\b', 'circle_officer'),
        (r'\bTehsil\b', 'Anchal'),
        (r'\btehsil\b', 'anchal'),
        (r'\bPatwari\b', 'Karmachari'),
        (r'\bpatwari\b', 'karmachari'),
        (r'\bLekhpal\b', 'Karmachari'),
        (r'\bUttar Pradesh\b', 'Bihar'),
        (r'\bUP\b', 'Bihar'), # Word boundary only
        (r'\bNoida\b', 'Phulwari Sharif'),
        (r'\bDadri\b', 'Phulwari Sharif'),
        (r'\bDAD\b', 'PHU'),
        (r'\bGautam Buddha Nagar\b', 'Patna'),
    ]

    for pattern, replacement in replacements:
        if pattern == r'\bUP\b':
            content = re.sub(r'\bUP\b', replacement, content)
        else:
            content = re.sub(pattern, replacement, content)

    # Some manual fixes for the API route issue
    content = content.replace("Mutation (Dakhil Kharij)", "Dakhil-Kharij")
    
    # Specific mutations replacements in UI
    content = content.replace(">Mutation<", ">Dakhil-Kharij<")
    content = content.replace("mutation process", "dakhil-kharij process")
    content = content.replace("All mutations in", "All dakhil-kharij cases in")
    content = content.replace("MutationInitiate", "DakhilKharijInitiate")
    content = content.replace("Pending Tehsildar", "Pending CO")

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {filepath}")

def main():
    src_dir = os.path.join(os.path.dirname(__file__), 'src')
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                replace_in_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
