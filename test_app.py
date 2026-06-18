import fitz
import sys
import json
import os
sys.path.insert(0, os.getcwd())
from pdf_generator import generate_application_form

data = {"sex": "M"}
generate_application_form(data, "templates/application.pdf", "test_out_app.pdf")
print("Done")
