# PDF Coordinate Inventory

This document maps every explicit static PDF injection coordinate across all Python generators (`pdf_generator.py`) and JSON configurations (`shablon_otkaz_coordinates.json`) within the project.

---

## 1. Application Form (`templates/application.pdf`)
**Source File:** `pdf_generator.py` (`generate_application_form`)

| Field Name | Page | X | Y | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `surname` | 0 | 154.3 | 307.4 | Exact Point |
| `given_names` | 0 | 312.1 | 307.4 | Exact Point |
| `birth_year` | 0 | 169.0 | 334.3 | Exact Point |
| `birth_month` | 0 | 242.9 | 332.7 | Exact Point |
| `birth_day` | 0 | 282.7 | 333.5 | Exact Point |
| `sex` (Male Checkmark) | 0 | 366.0 | 329.0 | Exact Point (Helvetica `v`) |
| `sex` (Female Checkmark) | 0 | 366.0 | 340.0 | Exact Point (Helvetica `v`) |
| `nationality` | 0 | 490.7 | 336.0 | Exact Point |
| `arc` (Digit 1) | 0 | 196.6 | 351.4 | Exact Point (+1 offset in code) |
| `arc` (Digit 2) | 0 | 214.5 | 351.4 | Exact Point (+1 offset in code) |
| `arc` (Digit 3) | 0 | 236.4 | 350.6 | Exact Point (+1 offset in code) |
| `arc` (Digit 4) | 0 | 255.1 | 351.4 | Exact Point (+1 offset in code) |
| `arc` (Digit 5) | 0 | 274.6 | 351.4 | Exact Point (+1 offset in code) |
| `arc` (Digit 6) | 0 | 295.7 | 350.6 | Exact Point (+1 offset in code) |
| `arc` (Digit 7) | 0 | 312.8 | 351.4 | Exact Point (+1 offset in code) |
| `arc` (Digit 8) | 0 | 330.7 | 351.4 | Exact Point (+1 offset in code) |
| `arc` (Digit 9) | 0 | 347.7 | 351.4 | Exact Point (+1 offset in code) |
| `arc` (Digit 10) | 0 | 364.8 | 352.2 | Exact Point (+1 offset in code) |
| `arc` (Digit 11) | 0 | 384.3 | 352.2 | Exact Point (+1 offset in code) |
| `arc` (Digit 12) | 0 | 402.2 | 352.2 | Exact Point (+1 offset in code) |
| `arc` (Digit 13) | 0 | 418.4 | 352.2 | Exact Point (+1 offset in code) |
| `passport_no` | 0 | 130.8 | 373.3 | Exact Point |
| `passport_issue_date` | 0 | 327.4 | 371.7 | Exact Point |
| `passport_expiry_date` | 0 | 488.3 | 371.7 | Exact Point |
| `address_in_korea` | 0 | 159.2..533 | 390..415 | `fitz.Rect` Bounding Box |
| `cell_phone` | 0 | 425.7 | 412.3 | Exact Point |
| `applicant_signature` | 0 | 440.0 | 581.0 | Exact Point |

---

## 2. Accommodation Form (`templates/accommodation.pdf`)
**Source File:** `pdf_generator.py` (`generate_accommodation_form`)

| Field Name | Page | X | Y | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `receiver_nationality` | 0 | 166..252 | 112..158 | `fitz.Rect` Centered |
| `receiver_arc` | 0 | 386..532 | 112..158 | `fitz.Rect` Centered |
| `receiver_full_name` | 0 | 166..360 | 160..185 | `fitz.Rect` Left-Aligned |
| `receiver_phone` | 0 | 426..532 | 160..185 | `fitz.Rect` Centered |
| `receiver_address` | 0 | 166..532 | 187..212 | `fitz.Rect` Left-Aligned |
| `provider_nationality` | 0 | 166..241 | 247..286 | `fitz.Rect` Centered |
| `provider_arc` | 0 | 377..532 | 247..286 | `fitz.Rect` Centered |
| `provider_full_name` | 0 | 166..360 | 289..316 | `fitz.Rect` Left-Aligned |
| `provider_phone` | 0 | 426..532 | 289..316 | `fitz.Rect` Centered |
| `provider_signature_name` | 0 | 263.0 | 540.0 | Exact Point (+ y-offset) |

---

## 3. Goso Form (`templates/goso.pdf` / implied)
**Source File:** `pdf_generator.py` (`generate_goso_form`)

| Field Name | Page | X | Y | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `surname` | 0 | 171.4 | 264.5 | Exact Point |
| `given_names` | 0 | 300.0 | 265.2 | Exact Point |
| `birth_year` | 0 | 180.7 | 293.1 | Exact Point |
| `birth_month` | 0 | 253.6 | 293.1 | Exact Point |
| `birth_day` | 0 | 302.9 | 292.4 | Exact Point |
| `nationality` | 0 | 489.3 | 286.9 | Exact Point |
| `arc` (Digit 1) | 0 | 200.7 | 315.5 | Exact Point |
| `arc` (Digit 2) | 0 | 215.7 | 314.8 | Exact Point |
| `arc` (Digit 3) | 0 | 234.3 | 315.5 | Exact Point |
| `arc` (Digit 4) | 0 | 252.1 | 314.8 | Exact Point |
| `arc` (Digit 5) | 0 | 270.7 | 315.5 | Exact Point |
| `arc` (Digit 6) | 0 | 289.3 | 315.5 | Exact Point |
| `arc` (Digit 7) | 0 | 311.4 | 315.5 | Exact Point |
| `arc` (Digit 8) | 0 | 330.0 | 315.5 | Exact Point |
| `arc` (Digit 9) | 0 | 347.9 | 315.5 | Exact Point |
| `arc` (Digit 10) | 0 | 365.7 | 315.5 | Exact Point |
| `arc` (Digit 11) | 0 | 384.3 | 315.5 | Exact Point |
| `arc` (Digit 12) | 0 | 405.7 | 316.2 | Exact Point |
| `arc` (Digit 13) | 0 | 421.4 | 315.5 | Exact Point |
| `passport_no` | 0 | 160.0 | 345.5 | Exact Point |
| `passport_issue_date` | 0 | 332.9 | 341.9 | Exact Point |
| `passport_expiry_date` | 0 | 491.4 | 343.4 | Exact Point |
| `address_in_korea` | 0 | 160.0 | 365.7 | Exact Point |
| `cell_phone` | 0 | 443.6 | 389.8 | Exact Point |

---

## 4. Occupation Form (`templates/occupation.pdf`)
**Source File:** `pdf_generator.py` (`generate_occupation_form`)

| Field Name | Page | X | Y | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `surname` | 0 | 113.5 | 269.0 | Exact Point |
| `given_names` | 0 | 215.0 | 269.0 | Exact Point |
| `birth_year` | 0 | 142.0 | 300.0 | Exact Point |
| `birth_month` | 0 | 222.0 | 300.0 | Exact Point |
| `birth_day` | 0 | 265.5 | 300.0 | Exact Point |
| `sex` (Male Checkmark) | 0 | 353.0 | 287.0 | Exact Point (Helvetica `v`) |
| `sex` (Female Checkmark) | 0 | 351.0 | 298.0 | Exact Point (Helvetica `v`) |
| `nationality` | 0 | 474.0 | 303.5 | Exact Point |
| `arc` (Digit 1) | 0 | 173.0 | 323.5 | Exact Point |
| `arc` (Digit 2) | 0 | 193.0 | 323.5 | Exact Point |
| `arc` (Digit 3) | 0 | 214.0 | 323.5 | Exact Point |
| `arc` (Digit 4) | 0 | 235.0 | 323.5 | Exact Point |
| `arc` (Digit 5) | 0 | 254.0 | 323.5 | Exact Point |
| `arc` (Digit 6) | 0 | 273.0 | 323.5 | Exact Point |
| `arc` (Digit 7) | 0 | 294.0 | 323.5 | Exact Point |
| `arc` (Digit 8) | 0 | 313.0 | 323.5 | Exact Point |
| `arc` (Digit 9) | 0 | 329.5 | 323.5 | Exact Point |
| `arc` (Digit 10) | 0 | 347.0 | 323.5 | Exact Point |
| `arc` (Digit 11) | 0 | 365.0 | 323.5 | Exact Point |
| `arc` (Digit 12) | 0 | 382.0 | 323.5 | Exact Point |
| `arc` (Digit 13) | 0 | 399.5 | 323.5 | Exact Point |
| `applicant_signature` | 2 | 309.0 | 555.0 | Exact Point |
| `occ_chk_production` | 2 | 60.0 | 166.0 | Checkbox Point |
| `occ_chk_warehouse` | 2 | 59.0 | 215.0 | Checkbox Point |
| `occ_chk_construction` | 1 | 58.0 | 747.0 | Checkbox Point |
| `occ_chk_retail` | 1 | 60.0 | 334.0 | Checkbox Point |
| `occ_chk_office` | 1 | 60.0 | 76.0 | Checkbox Point |
| `occ_chk_business` | 0 | 58.0 | 515.0 | Checkbox Point |
| `occ_chk_unemployed` | 0 | 60.0 | 364.0 | Checkbox Point |

---

## 5. Guarantee Form (`templates/guarantee.pdf`)
**Source File:** `pdf_generator.py` (`generate_guarantee_form`)

| Field Name | Page | X | Y | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `applicant_surname` | 0 | 118.0 | 133.0 | Exact Point |
| `applicant_given_names` | 0 | 265.0 | 133.0 | Exact Point |
| `applicant_birth_date` | 0 | 180.0 | 161.0 | Exact Point |
| `applicant_nationality` | 0 | 175.0 | 189.0 | Exact Point |
| `applicant_passport_no` | 0 | 419.0 | 200.0 | Exact Point |
| `applicant_address` | 0 | 131.0 | 225.0 | Exact Point |
| `applicant_phone` | 0 | 413.0 | 225.0 | Exact Point |
| `applicant_sex` (M) | 0 | 468.0 | 162.0 | Checkbox Point (Helvetica `v`) |
| `applicant_sex` (F) | 0 | 469.0 | 176.0 | Checkbox Point (Helvetica `v`) |
| `stay_purpose_static` | 0 | 214.0 | 252.0 | Static string injection |
| `guarantor_full_name` | 0 | 172.0 | 319.0 | Exact Point |
| `guarantor_nationality` | 0 | 175.0 | 351.0 | Exact Point |
| `guarantor_sex` (M) | 0 | 467.0 | 356.0 | Checkbox Point (Helvetica `v`) |
| `guarantor_sex` (F) | 0 | 468.0 | 368.0 | Checkbox Point (Helvetica `v`) |
| `guarantor_passport_no` | 0 | 131.0 | 386.0 | Exact Point |
| `guarantor_dob` | 0 | 285.0 | 386.0 | Exact Point |
| `guarantor_phone` | 0 | 413.0 | 386.0 | Exact Point |
| `guarantor_address` | 0 | 164.0 | 417.0 | Exact Point |
| `guarantor_relationship`| 0 | 244.0 | 451.0 | Exact Point |
| `guarantor_company` | 0 | 140.0 | 482.0 | Exact Point |
| `guarantor_position` | 0 | 420.0 | 482.0 | Exact Point |
| `guarantor_work_address`| 0 | 140.0 | 512.0 | Exact Point |
| `guarantor_note` | 0 | 420.0 | 512.0 | Exact Point |
| `guarantee_period` | 0 | 260.0 | 545.0 | Exact Point |
| `guarantor_signature` | 0 | 342.0 | 759.0 | Exact Point |

---

## 6. Goso F-4 Form (`templates/goso_f4.pdf`)
**Source File:** `pdf_generator.py` (`generate_goso_f4_form`)

| Field Name | Page | X | Y | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `surname` | 0 | 150.0 | 264.2 | Exact Point |
| `given_names` | 0 | 267.1 | 264.2 | Exact Point |
| `birth_year` | 0 | 152.1 | 294.2 | Exact Point |
| `birth_month` | 0 | 232.9 | 293.5 | Exact Point |
| `birth_day` | 0 | 288.6 | 292.8 | Exact Point |
| `nationality` | 0 | 487.9 | 288.5 | Exact Point |
| `arc` (13 digits) | 0 | 194.0 | 315.0 | X-Start to X-End (418.0) Step: 18.67 pt |
| `passport_no` | 0 | 152.1 | 344.2 | Exact Point |
| `passport_issue_date` | 0 | 327.1 | 344.9 | Exact Point |
| `passport_expiry_date` | 0 | 491.4 | 342.1 | Exact Point |
| `address_in_korea` | 0 | 154.3 | 366.4 | Exact Point |
| `cell_phone` | 0 | 440.0 | 390.7 | Exact Point |
| `applicant_signature` | 0 | 455.0 | 558.0 | Exact Point |

---

## 7. School Enrollment Form (`templates/school_report.pdf`)
**Source File:** `pdf_generator.py` (`generate_school_form`)

| Field Name | Page | X | Y | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `full_name` | 0 | 345.7 | 150.6 | Exact Point |
| `sex` (Male Checkmark) | 0 | 347.1 | 192.7 | Checkbox Point (Helvetica `v`) |
| `sex` (Female Checkmark)| 0 | 443.6 | 191.6 | Checkbox Point (Helvetica `v`) |
| `date_of_birth` | 0 | 347.1 | 223.4 | Exact Point |
| `nationality` | 0 | 348.6 | 255.9 | Exact Point |
| `passport_no` | 0 | 348.6 | 290.6 | Exact Point |
| `registration_no` | 0 | 346.4 | 322.0 | Exact Point |
| `school_name` | 0 | 346.4 | 445.6 | Exact Point |
| `applicant_signature` | 0 | 325.0 | 699.0 | Exact Point |

---

## 8. Otkaz Waiver Form (`templates/otkaz.pdf` implied)
**Source File:** `shablon_otkaz_coordinates.json` (Used via `pdf_generator.py`'s `generate_otkaz_form`)

| Field Name | Page | X | Y | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `full_name` | 1 | 134.17| 131.56| Exact Point |
| `nationality` | 1 | 386.67| 131.56| Exact Point |
| `gender` | 1 | 492.50| 133.85| Exact Point |
| `date_of_birth` | 1 | 136.67| 155.31| Exact Point |
| `phone` | 1 | 390.83| 159.06| Exact Point |
| `passport_number` | 1 | 137.92| 184.48| Exact Point |
| `passport_issue_date` | 1 | 307.08| 184.89| Exact Point |
| `passport_expiry_date` | 1 | 463.33| 184.06| Exact Point |
| `address` | 1 | 136.00| 212.00| Exact Point |
| `date_year` | 1 | 169.17| 525.31| Exact Point |
| `date_month` | 1 | 257.92| 525.73| Exact Point |
| `date_day` | 1 | 337.92| 525.73| Exact Point |
| `applicant_name` | 1 | 186.25| 542.81| Exact Point |
