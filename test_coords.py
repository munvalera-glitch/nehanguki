import fitz

doc = fitz.open("templates/f4_non_employment_pledge.pdf")
page = doc[0]

coords = {
    "full_name": (134.17, 131.56),
    "nationality": (386.67, 131.56),
    "gender": (492.50, 133.85),
    "date_of_birth": (136.67, 155.31),
    "phone": (390.83, 159.06),
    "passport_number": (137.92, 184.48),
    "passport_issue_date": (307.08, 184.89),
    "passport_expiry_date": (463.33, 184.06),
    "address": (136.00, 212.00),
    "date_year": (169.17, 525.31),
    "date_month": (257.92, 525.73),
    "date_day": (337.92, 525.73),
    "applicant_name": (186.25, 542.81)
}

for k, v in coords.items():
    page.draw_circle(v, 3, color=(1, 0, 0), fill=(1, 0, 0))

doc.save("test_coords.pdf")
