import re
import json

with open('src/ImmigrationMVP.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# This is a complex task for a simple regex, so we'll just write a script to find strings with Cyrillic characters
# and then manually review or let the script do a best-effort replacement.
