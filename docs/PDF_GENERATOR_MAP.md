# PDF Generator Explicit Source Code Map

This document is a direct extraction of every single coordinate, mapping, font, and logical rule found strictly inside `pdf_generator.py`. 

---

## 1. Form: Application Form
**Function**: `generate_application_form`

| Field Name | Page | Coordinates (X, Y) | Font | Font Size | Special Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `surname` | 0 | 154.3, 307.4 | NanumGothic | 8 | Uses `exact()` adding Y shift of `size * 0.85` |
| `given_names` | 0 | 312.1, 307.4 | NanumGothic | 8 | Uses `exact()` |
| `birth_year` | 0 | 169.0, 334.3 | NanumGothic | 8 | Uses `exact()` |
| `birth_month` | 0 | 242.9, 332.7 | NanumGothic | 8 | Uses `exact()` |
| `birth_day` | 0 | 282.7, 333.5 | NanumGothic | 8 | Uses `exact()` |
| `sex` (Male) | 0 | 366.0, 329.0 | NanumGothic | 8 | Checkbox injection using lowercase `v`. Comment says use Helvetica, but code explicitly loads `fontname="nanum"`. |
| `sex` (Female) | 0 | 366.0, 340.0 | NanumGothic | 8 | Checkbox injection using lowercase `v`. |
| `nationality` | 0 | 490.7, 336.0 | NanumGothic | 7 | Uses `exact()` |
| `arc` (Digit 1-13) | 0 | X varies (196.6 to 418.4), 351.4 / 350.6 / 352.2 | NanumGothic | 8 | Strips `-` and ` `, loops over coordinate array. Adds `+1` to X0 during injection. |
| `passport_no` | 0 | 130.8, 373.3 | NanumGothic | 8 | Uses `exact()` |
| `passport_issue_date` | 0 | 327.4, 371.7 | NanumGothic | 8 | Uses `exact()` |
| `passport_expiry_date` | 0 | 488.3, 371.7 | NanumGothic | 8 | Uses `exact()` |
| `address_in_korea` | 0 | Rect: `159.2, 390` to `533, 415` | NanumGothic | 8 | `insert_textbox`, left aligned |
| `cell_phone` | 0 | 425.7, 412.3 | NanumGothic | 8 | Uses `exact()` |
| `applicant_signature` | 0 | 440.0, 581.0 | NanumGothic | 6 | Dynamically concatenates `surname` + `" "` + `given_names`. |

---

## 2. Form: Accommodation Form
**Function**: `generate_accommodation_form`

| Field Name | Page | Coordinates (X, Y) | Font | Font Size | Special Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `[개정 2024. 5.]` Cover | 0 | N/A | N/A | N/A | Searches document text to hide this specific string using a white rectangle mask. |
| `receiver_nationality` | 0 | Rect: `166, 112` to `252, 158` | NanumGothic | 8 | Centered via `cen()`. Replaces space with newline before insertion. |
| `receiver_arc` | 0 | Rect: `386, 112` to `532, 158` | NanumGothic | 8 | Centered via `cen()` |
| `receiver_full_name` | 0 | Rect: `166, 160` to `360, 185` | NanumGothic | 8 | Left-aligned via `box()` |
| `receiver_phone` | 0 | Rect: `426, 160` to `532, 185` | NanumGothic | 8 | Centered via `cen()` |
| `receiver_address` | 0 | Rect: `166, 187` to `532, 212` | NanumGothic | 7 | Left-aligned via `box()` |
| `provider_nationality` | 0 | Rect: `166, 247` to `241, 286` | NanumGothic | 8 | Centered via `cen()` |
| `provider_arc` | 0 | Rect: `377, 247` to `532, 286` | NanumGothic | 8 | Centered via `cen()` |
| `provider_full_name` | 0 | Rect: `166, 289` to `360, 316` | NanumGothic | 8 | Left-aligned via `box()` |
| `provider_phone` | 0 | Rect: `426, 289` to `532, 316` | NanumGothic | 8 | Centered via `cen()` |
| `provider_signature` | 0 | 263.0, 540.0 | NanumGothic | 8 | Point insertion adding `8 * 0.85` Y shift directly in `insert_text`. |

---

## 3. Form: Goso Form
**Function**: `generate_goso_form`

| Field Name | Page | Coordinates (X, Y) | Font | Font Size | Special Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `surname` | 0 | 171.4, 264.5 | NanumGothic | 8 | Uses `exact()` |
| `given_names` | 0 | 300.0, 265.2 | NanumGothic | 8 | Uses `exact()` |
| `birth_year` | 0 | 180.7, 293.1 | NanumGothic | 8 | Uses `exact()` |
| `birth_month` | 0 | 253.6, 293.1 | NanumGothic | 8 | Uses `exact()` |
| `birth_day` | 0 | 302.9, 292.4 | NanumGothic | 8 | Uses `exact()` |
| `nationality` | 0 | 489.3, 286.9 | NanumGothic | 7 | Uses `exact()` |
| `arc` (Digit 1-13) | 0 | X varies, Y ~315.5 | NanumGothic | 8 | Exact arrays. |
| `passport_no` | 0 | 160.0, 345.5 | NanumGothic | 8 | Uses `exact()` |
| `passport_issue_date` | 0 | 332.9, 341.9 | NanumGothic | 8 | Uses `exact()` |
| `passport_expiry_date` | 0 | 491.4, 343.4 | NanumGothic | 8 | Uses `exact()` |
| `address_in_korea` | 0 | 160.0, 365.7 | NanumGothic | 7 | Uses `exact()` |
| `cell_phone` | 0 | 443.6, 389.8 | NanumGothic | 8 | Uses `exact()` |

---

## 4. Form: Occupation Form
**Function**: `generate_occupation_form`

| Field Name | Page | Coordinates (X, Y) | Font | Font Size | Special Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `surname` | 0 | 113.50, 269.00 | NanumGothic | 9 | `insert_text` direct |
| `given_names` | 0 | 215.00, 269.00 | NanumGothic | 9 | `insert_text` direct |
| `birth_year` | 0 | 142.00, 300.00 | NanumGothic | 9 | `insert_text` direct |
| `birth_month` | 0 | 222.00, 300.00 | NanumGothic | 9 | `insert_text` direct |
| `birth_day` | 0 | 265.50, 300.00 | NanumGothic | 9 | `insert_text` direct |
| `sex` (Male Checkmark) | 0 | 353.0, 287.0 | NanumGothic | 9 | Inserts `v` |
| `sex` (Female Checkmark)| 0 | 351.0, 298.0 | NanumGothic | 9 | Inserts `v` |
| `nationality` | 0 | 474.00, 303.50 | NanumGothic | 10 | Uses `NATIONALITY_KO` dictionary to hardcode translate country names to Korean before injection. |
| `arc` (Digit 1-13) | 0 | X varies, 323.50 | NanumGothic | 9 | Direct string index mapping |
| `applicant_signature` | 2 | 309.00, 555.00 | NanumGothic | 9 | Conditionally renders only if `len(doc) > 2` |
| `occupation_type` (Check)| Dynamic | Dynamic | NanumGothic | 10 | Looks up page index, X, Y from `OCCUPATION_COORDS` dictionary mapping strings (`production`, `warehouse`, etc.) to specific checkmark inject points. |

---

## 5. Form: Guarantee Form
**Function**: `generate_guarantee_form`

| Field Name | Page | Coordinates (X, Y) | Font | Font Size | Special Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `applicant_surname` | 0 | 118, 133 | NanumGothic | 9 | Uses `t()` wrapper adding `+ size` offset. |
| `applicant_given_names`| 0 | 265, 133 | NanumGothic | 9 | Uses `t()` |
| `applicant_birth_date` | 0 | 180, 161 | NanumGothic | 9 | Concatenates `YYYY.MM.DD` |
| `applicant_nationality`| 0 | 175, 189 | NanumGothic | 9 | Uses `t()` |
| `applicant_passport_no`| 0 | 419, 200 | NanumGothic | 9 | Uses `t()` |
| `applicant_address` | 0 | 131, 225 | NanumGothic | 8 | Uses `tk()` |
| `applicant_phone` | 0 | 413, 225 | NanumGothic | 9 | Uses `t()` |
| `applicant_sex` (M/F) | 0 | 468, 162 / 469, 176 | NanumGothic | 9 | Checkmark `v` |
| `stay_purpose_static` | 0 | 214, 252 | NanumGothic | 8 | Statically injects "국내 체류 중인 가족 동반 및 동거" |
| `guarantor_full_name` | 0 | 172, 319 | NanumGothic | 9 | Uses `t()` |
| `guarantor_nationality`| 0 | 175, 351 | NanumGothic | 9 | Uses `t()` |
| `guarantor_sex` (M/F) | 0 | 467, 356 / 468, 368 | NanumGothic | 9 | Checkmark `v` |
| `guarantor_passport_no`| 0 | 131, 386 | NanumGothic | 9 | Uses `t()` |
| `guarantor_dob` | 0 | 285, 386 | NanumGothic | 9 | Uses `t()` |
| `guarantor_phone` | 0 | 413, 386 | NanumGothic | 9 | Uses `t()` |
| `guarantor_address` | 0 | 164, 417 | NanumGothic | 8 | Mirrors applicant's address. |
| `guarantor_relationship`| 0 | 244, 451 | NanumGothic | 8 | Uses `tk()` |
| `guarantor_company` | 0 | 140, 482 | NanumGothic | 8 | Uses `tk()` |
| `guarantor_position` | 0 | 420, 482 | NanumGothic | 9 | Uses `t()` |
| `guarantor_work_address`| 0 | 140, 512 | NanumGothic | 8 | Uses `tk()` |
| `guarantor_note` | 0 | 420, 512 | NanumGothic | 9 | Uses `t()` |
| `guarantee_period` | 0 | 260, 545 | NanumGothic | 9 | Uses `t()` |
| `guarantor_signature` | 0 | 342, 759 | NanumGothic | 9 | Uses `t()` |

---

## 6. Form: Goso F-4 Form
**Function**: `generate_goso_f4_form`

| Field Name | Page | Coordinates (X, Y) | Font | Font Size | Special Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `surname` | 0 | 150.0, 264.2 | NanumGothic | 8 | Wrapper `t()` uses NanumGothic for both `korean=True/False` |
| `given_names` | 0 | 267.1, 264.2 | NanumGothic | 8 | |
| `birth_year` | 0 | 152.1, 294.2 | NanumGothic | 8 | |
| `birth_month` | 0 | 232.9, 293.5 | NanumGothic | 8 | |
| `birth_day` | 0 | 288.6, 292.8 | NanumGothic | 8 | |
| `nationality` | 0 | 487.9, 288.5 | NanumGothic | 7 | |
| `arc` (13 digits) | 0 | Start: 194.0, Step: 18.67, Y: 315.0 | NanumGothic | 8 | Automatically iterates with `18.67 pt` spacing constraint. |
| `passport_no` | 0 | 152.1, 344.2 | NanumGothic | 8 | |
| `passport_issue_date` | 0 | 327.1, 344.9 | NanumGothic | 7 | |
| `passport_expiry_date` | 0 | 491.4, 342.1 | NanumGothic | 7 | |
| `address_in_korea` | 0 | 154.3, 366.4 | NanumGothic | 7 | Flagged `korean=True` |
| `cell_phone` | 0 | 440.0, 390.7 | NanumGothic | 8 | |
| `applicant_signature` | 0 | 455.0, 558.0 | NanumGothic | 6 | Dynamically assembled full name. |

---

## 7. Form: School Enrollment Form
**Function**: `generate_school_form`

| Field Name | Page | Coordinates (X, Y) | Font | Font Size | Special Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `full_name` | 0 | 345.7, 150.6 | Helvetica | 9 | `t()` defaults to `fontname="helv"` unless `korean=True` is passed. |
| `sex` (M/F Checkmark) | 0 | 347.1, 192.7 / 443.6, 191.6 | NanumGothic | 10 | Checkmark `v` via `chk()` using `nanum`. |
| `date_of_birth` | 0 | 347.1, 223.4 | Helvetica | 9 | |
| `nationality` | 0 | 348.6, 255.9 | Helvetica | 9 | |
| `passport_no` | 0 | 348.6, 290.6 | Helvetica | 9 | |
| `registration_no` | 0 | 346.4, 322.0 | Helvetica | 9 | |
| `school_name` | 0 | 346.4, 445.6 | Helvetica / NanumGothic | 9 | Checks if string contains Hangul Unicode `\uac00 <= c <= \ud7a3`. If true, forces NanumGothic. Else defaults to Helvetica. |
| `applicant_signature` | 0 | 325.0, 699.0 | Helvetica | 8 | |

---

## 8. Form: Otkaz Waiver Form
**Function**: `generate_otkaz_form`

| Field Name | Page | Coordinates (X, Y) | Font | Font Size | Special Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `full_name` | 0 | 134.17, 131.56 | NanumGothic | 8 | Coordinates pulled dynamically from `shablon_otkaz_coordinates.json`, injected via `exact()` |
| `nationality` | 0 | 386.67, 131.56 | NanumGothic | 8 | |
| `gender` | 0 | 492.50, 133.85 | NanumGothic | 8 | |
| `date_of_birth` | 0 | 136.67, 155.31 | NanumGothic | 8 | |
| `phone` | 0 | 390.83, 159.06 | NanumGothic | 8 | |
| `passport_number` | 0 | 137.92, 184.48 | NanumGothic | 8 | |
| `passport_issue_date` | 0 | 307.08, 184.89 | NanumGothic | 8 | |
| `passport_expiry_date` | 0 | 463.33, 184.06 | NanumGothic | 8 | |
| `address` | 0 | 136.00, 212.00 | NanumGothic | 8 | |
| `date_year` | 0 | 169.17, 525.31 | NanumGothic | 8 | |
| `date_month` | 0 | 257.92, 525.73 | NanumGothic | 8 | |
| `date_day` | 0 | 337.92, 525.73 | NanumGothic | 8 | |
| `applicant_name` | 0 | 186.25, 542.81 | NanumGothic | 8 | |
