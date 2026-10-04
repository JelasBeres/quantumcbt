import os
import zipfile

def zipdir(path, ziph):
    # ziph is zipfile handle
    for root, dirs, files in os.walk(path):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', 'venv', '__pycache__', '.next', '.pytest_cache', 'uploads']]
        for file in files:
            if file.endswith('.zip') or file.endswith('.pyc') or file == 'clean_db.py':
                continue
            file_path = os.path.join(root, file)
            ziph.write(file_path, os.path.relpath(file_path, path))

if __name__ == '__main__':
    zipf = zipfile.ZipFile('QUANTUMCBT_Clean.zip', 'w', zipfile.ZIP_DEFLATED)
    zipdir('.', zipf)
    zipf.close()
    print("Clean zip created successfully!")
