#!/usr/bin/env python3
"""
Diagnostic: генерирует КАЖДУЮ форму с галочками и рендерит в PNG.
Запусти: python3 /Users/macvalera/Documents/HIkoreaFORMS/diag_checkmarks.py
"""
import sys, os, fitz

ROOT = "/Users/macvalera/Documents/HIkoreaFORMS"
sys.path.insert(0, os.path.join(ROOT, "pdf"))

from pdf_generator import (
    generate_application_form,
    generate_guarantee_form,
    generate_occupation_form,
    generate_accommodation_form,
    generate_goso_f4_form,
)

TEMPLATES = {
    "application": os.path.join(ROOT, "templates/application.pdf"),
    "guarantee":   os.path.join(ROOT, "templates/guarantee.pdf"),
    "occupation":  os.path.join(ROOT, "templates/occupation.pdf"),
    "accommodation": os.path.join(ROOT, "templates/accommodation.pdf"),
    "gosoF4":      os.path.join(ROOT, "templates/goso_f4.pdf"),
}

OUT = "/tmp/diag_out"
os.makedirs(OUT, exist_ok=True)

# ── test data ──────────────────────────────────────────────────────────────
APP_DATA = {
    "surname": "IVANOV",
    "given_names": "IVAN",
    "birth_year": "1990",
    "birth_month": "05",
    "birth_day": "15",
    "sex": "M",
    "nationality": "RUSSIAN FEDERATION",
    "arc": "901515-1234567",
    "passport_no": "AA1234567",
    "passport_issue_date": "2020-01-01",
    "passport_expiry_date": "2030-01-01",
    "address_in_korea": "서울특별시 마포구 테스트 100",
    "cell_phone": "010-1234-5678",
    "visaType": "F1",
    "action": "initial",
    "signatures": {},
}

GUARANTOR_DATA = {
    "guarantor_full_name": "PETROV PETR",
    "guarantor_nationality": "RUSSIAN FEDERATION",
    "guarantor_sex": "M",
    "guarantor_passport_no": "BB9876543",
    "guarantor_phone": "010-9999-9999",
    "guarantor_dob": "650101",
    "guarantor_relationship": "spouse",
    "guarantor_company": "ООО Тест",
    "guarantor_position": "Director",
    "guarantor_work_address": "서울특별시 강남구",
    "signatures": {},
}

OCC_DATA = {
    "surname": "IVANOV",
    "given_names": "IVAN",
    "birth_year": "1990",
    "birth_month": "05",
    "birth_day": "15",
    "sex": "M",
    "nationality": "RUSSIAN FEDERATION",
    "arc": "901515-1234567",
    "occupationType": "unemployed",
    "signatures": {},
}

ACC_DATA = {
    "receiver_full_name": "IVAN IVANOV",
    "receiver_nationality": "RUSSIAN FEDERATION",
    "receiver_arc": "901515-1234567",
    "receiver_phone": "010-1234-5678",
    "receiver_address": "서울특별시 마포구 테스트 100",
    "provider_full_name": "KIM MINJUN",
    "provider_arc": "800101-1234567",
    "provider_phone": "010-8888-8888",
    "provider_nationality": "대한민국",
    "acc_relationship": "friend",
    "acc_ownership_type": "rent",
    "acc_residence_type": "apartment",
    "signatures": {},
}

GOSO_DATA = {
    "surname": "IVANOV",
    "given_names": "IVAN",
    "birth_year": "1990",
    "birth_month": "05",
    "birth_day": "15",
    "sex": "M",
    "nationality": "RUSSIAN FEDERATION",
    "arc": "901515-1234567",
    "passport_no": "AA1234567",
    "passport_issue_date": "2020-01-01",
    "passport_expiry_date": "2030-01-01",
    "address_in_korea": "서울특별시 마포구 테스트 100",
    "cell_phone": "010-1234-5678",
    "action": "initial",
    "signatures": {},
}

forms = [
    ("01_application", lambda: generate_application_form(APP_DATA, TEMPLATES["application"], os.path.join(OUT, "01_application.pdf"))),
    ("04_guarantee",   lambda: generate_guarantee_form(APP_DATA, GUARANTOR_DATA, TEMPLATES["guarantee"], os.path.join(OUT, "04_guarantee.pdf"))),
    ("03_occupation",  lambda: generate_occupation_form(OCC_DATA, TEMPLATES["occupation"], os.path.join(OUT, "03_occupation.pdf"))),
    ("02_accommodation",lambda: generate_accommodation_form(ACC_DATA, TEMPLATES["accommodation"], os.path.join(OUT, "02_accommodation.pdf"))),
    ("05_goso",        lambda: generate_goso_f4_form(GOSO_DATA, TEMPLATES["gosoF4"], os.path.join(OUT, "05_goso.pdf"))),
]

for name, fn in forms:
    pdf_path = os.path.join(OUT, f"{name}.pdf")
    print(f"Generating {name}...")
    try:
        fn()
        # render page 0
        doc = fitz.open(pdf_path)
        for pg_i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=120)
            png_path = os.path.join(OUT, f"{name}_page{pg_i}.png")
            pix.save(png_path)
            # Search for text "v" or "V" on the page
            text_blocks = page.get_text("words")
            v_words = [w for w in text_blocks if w[4].strip() in ("v","V","✓")]
            print(f"  page {pg_i}: found {len(v_words)} checkmark words: {v_words[:5]}")
        doc.close()
        print(f"  → PNG saved to {OUT}/{name}_page*.png")
    except Exception as e:
        print(f"  ERROR: {e}")

print("\nDone! Open PNGs in:", OUT)
