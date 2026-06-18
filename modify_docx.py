import zipfile
import re
import os
import shutil

def modify_docx(filepath):
    # Create a temporary file
    temp_path = filepath + ".tmp"
    shutil.copyfile(filepath, temp_path)
    
    with zipfile.ZipFile(filepath, 'r') as zin:
        with zipfile.ZipFile(temp_path, 'w') as zout:
            for item in zin.infolist():
                content = zin.read(item.filename)
                if item.filename == "word/document.xml":
                    text = content.decode('utf-8')
                    # Replace Day 1, Day 2 etc
                    text = re.sub(r'Day 1', '{date1}', text)
                    text = re.sub(r'Day 2', '{date2}', text)
                    text = re.sub(r'Day 3', '{date3}', text)
                    text = re.sub(r'Day 4', '{date4}', text)
                    text = re.sub(r'Day 5', '{date5}', text)
                    
                    # Remove XML tags inside the target phrases if any, but since we are regexing, it might be tricky.
                    # Instead of complex regex for XML tags, let's just replace known texts.
                    # We can use regex to remove tags between letters for specific words.
                    
                    zout.writestr(item, text.encode('utf-8'))
                else:
                    zout.writestr(item, content)
                    
    shutil.move(temp_path, filepath)

modify_docx('templates/schedule_tokyo_1_villa_fontaine_kayabacho.docx')
