import fitz
import os

FONT = os.path.join(os.path.dirname(__file__), "fonts", "NanumGothic.ttf")

def box(page, rect, text, size=8, align=fitz.TEXT_ALIGN_LEFT, valign=True):
    r = fitz.Rect(*rect)
    if valign:
        # Simple vertical centering approximation
        r.y0 += max(0, (r.height - size * 1.35) / 2)
    
    page.insert_textbox(
        r,
        str(text),
        fontsize=size,
        fontfile=FONT,
        fontname="nanum",
        align=align,
        color=(0, 0, 0)
    )

def cen(page, rect, text, size=8):
    box(page, rect, text, size=size, align=fitz.TEXT_ALIGN_CENTER, valign=True)

def exact(page, x, y, text, size=8):
    # PyMuPDF uses baseline for insert_text. y is top-left from pdfplumber.
    page.insert_text(fitz.Point(x, y + size * 0.85), str(text), fontsize=size, fontfile=FONT, fontname="nanum", color=(0,0,0))

def generate_application_form(data: dict, template_path: str, output_path: str):
    doc = fitz.open(template_path)
    page = doc[0]

    # ── Surname & Given names in separate cells ──────────────────────────────
    if "surname" in data:
        exact(page, 154.3, 307.4, data["surname"])
    if "given_names" in data:
        exact(page, 312.1, 307.4, data["given_names"])

    # ── Birth date ───────────────────────────────────────────────────────────
    if "birth_year" in data:
        exact(page, 169.0, 334.3, data["birth_year"])
    if "birth_month" in data:
        exact(page, 242.9, 332.7, data["birth_month"])
    if "birth_day" in data:
        exact(page, 282.7, 333.5, data["birth_day"])

    # ── Sex checkboxes ───────────────────────────────────────────────────────
    # Template: [ ]남 M → x=363, y=329 | [ ]여 F → x=363, y=340
    # Place "v" (lowercase v renders as a visible mark) inside the bracket.
    # Use helv (Helvetica) because NanumGothic cannot render the ✓ glyph.
    sex = data.get("sex", "").upper().strip()
    if sex in ("M", "MALE"):
        page.insert_text(fitz.Point(366, 329), "v", fontsize=8, fontname="nanum", fontfile=FONT, color=(0, 0, 0))
    elif sex in ("F", "FEMALE"):
        page.insert_text(fitz.Point(366, 340), "v", fontsize=8, fontname="nanum", fontfile=FONT, color=(0, 0, 0))

    # ── Nationality ──────────────────────────────────────────────────────────
    if "nationality" in data:
        exact(page, 490.7, 336.0, data["nationality"], size=7)

    # ── ARC digits (외국인등록번호) ──────────────────────────────────────────
    if "arc" in data:
        arc = data["arc"].replace("-", "").replace(" ", "")
        if len(arc) == 13:
            coords = [
                (196.6, 351.4), (214.5, 351.4), (236.4, 350.6), (255.1, 351.4),
                (274.6, 351.4), (295.7, 350.6), (312.8, 351.4), (330.7, 351.4),
                (347.7, 351.4), (364.8, 352.2), (384.3, 352.2), (402.2, 352.2), (418.4, 352.2)
            ]
            for i, (x0, y0) in enumerate(coords):
                exact(page, x0 + 1, y0, arc[i])

    # ── Passport ─────────────────────────────────────────────────────────────
    if "passport_no" in data:
        exact(page, 130.8, 373.3, data["passport_no"])
    if "passport_issue_date" in data:
        exact(page, 327.4, 371.7, data["passport_issue_date"])
    if "passport_expiry_date" in data:
        exact(page, 488.3, 371.7, data["passport_expiry_date"])

    # ── Address ──────────────────────────────────────────────────────────────
    if "address_in_korea" in data and data["address_in_korea"]:
        rect = fitz.Rect(159.2, 390, 533, 415)
        page.insert_textbox(
            rect, data["address_in_korea"],
            fontsize=8, fontfile=FONT, fontname="nanum",
            color=(0, 0, 0), align=fitz.TEXT_ALIGN_LEFT
        )

    # ── Phone ────────────────────────────────────────────────────────────────
    if "cell_phone" in data:
        exact(page, 425.7, 412.3, data["cell_phone"])

    # ── Signature line: full name (surname + given names incl. patronymic) ───
    # Coordinates: x=440, y=581 — field "신청인 서명 또는 인 / Signature/Seal"
    full_name_sig = (data.get("surname", "") + " " + data.get("given_names", "")).strip()
    if full_name_sig:
        exact(page, 440, 581, full_name_sig, size=6)

    doc.save(output_path)
    doc.close()



def generate_accommodation_form(data: dict, template_path: str, output_path: str):
    doc = fitz.open(template_path)
    page = doc[0]

    # Скрываем надпись "[개정 2024. 5.]" белым прямоугольником
    for inst in page.search_for("[개정 2024. 5.]"):
        page.draw_rect(inst, color=(1, 1, 1), fill=(1, 1, 1))


    # Receiver
    if "receiver_nationality" in data:
        nat = data["receiver_nationality"].replace(" ", "\n")
        cen(page, (166, 112, 252, 158), nat)
    if "receiver_arc" in data:
        cen(page, (386, 112, 532, 158), data["receiver_arc"])
    if "receiver_full_name" in data:
        box(page, (166, 160, 360, 185), data["receiver_full_name"], align=fitz.TEXT_ALIGN_LEFT)
    if "receiver_phone" in data:
        cen(page, (426, 160, 532, 185), data["receiver_phone"])
    if "receiver_address" in data:
        box(page, (166, 187, 532, 212), data["receiver_address"], size=7, align=fitz.TEXT_ALIGN_LEFT)
        
    # Provider
    if "provider_nationality" in data:
        cen(page, (166, 247, 241, 286), data["provider_nationality"])
    if "provider_arc" in data:
        cen(page, (377, 247, 532, 286), data["provider_arc"])
    if "provider_full_name" in data:
        box(page, (166, 289, 360, 316), data["provider_full_name"], align=fitz.TEXT_ALIGN_LEFT)
    if "provider_phone" in data:
        cen(page, (426, 289, 532, 316), data["provider_phone"])

    # ── Provider signature / name (bottom block) — x=263, y=540
    if "provider_full_name" in data and data["provider_full_name"]:
        page.insert_text(
            fitz.Point(263, 540 + 8 * 0.85),
            str(data["provider_full_name"]),
            fontsize=8, fontname="nanum", fontfile=FONT, color=(0, 0, 0),
        )

    doc.save(output_path)
    doc.close()

def generate_goso_form(data: dict, template_path: str, output_path: str):
    doc = fitz.open(template_path)
    page = doc[0]

    # Surname
    if "surname" in data:
        exact(page, 171.4, 264.5, data["surname"])
    # Given name
    if "given_names" in data:
        exact(page, 300.0, 265.2, data["given_names"])
    # Birth
    if "birth_year" in data:
        exact(page, 180.7, 293.1, data["birth_year"])
    if "birth_month" in data:
        exact(page, 253.6, 293.1, data["birth_month"])
    if "birth_day" in data:
        exact(page, 302.9, 292.4, data["birth_day"])
    # Sex — не заполняем
    # Nationality
    if "nationality" in data:
        exact(page, 489.3, 286.9, data["nationality"], size=7)
    
    # ARC digits
    if "arc" in data:
        arc = data["arc"].replace("-", "").replace(" ", "")
        if len(arc) == 13:
            coords = [
                (200.7, 315.5), (215.7, 314.8), (234.3, 315.5), (252.1, 314.8),
                (270.7, 315.5), (289.3, 315.5), (311.4, 315.5), (330.0, 315.5),
                (347.9, 315.5), (365.7, 315.5), (384.3, 315.5), (405.7, 316.2), (421.4, 315.5)
            ]
            for i, (x0, y0) in enumerate(coords):
                exact(page, x0, y0, arc[i])
            
    # Passport
    if "passport_no" in data:
        exact(page, 160.0, 345.5, data["passport_no"])
    if "passport_issue_date" in data:
        exact(page, 332.9, 341.9, data["passport_issue_date"])
    if "passport_expiry_date" in data:
        exact(page, 491.4, 343.4, data["passport_expiry_date"])
        
    # Address
    if "address_in_korea" in data:
        exact(page, 160.0, 365.7, data["address_in_korea"], size=7)
        
    # Phone
    if "cell_phone" in data:
        exact(page, 443.6, 389.8, data["cell_phone"])

    doc.save(output_path)
    doc.close()

# Словарь перевода гражданства на корейский
NATIONALITY_KO = {
    "RUSSIA": "러시아",
    "RUSSIAN FEDERATION": "러시아",
    "UZBEKISTAN": "우즈베키스탄",
    "KAZAKHSTAN": "카자흐스탄",
    "KYRGYZSTAN": "키르기스스탄",
    "TAJIKISTAN": "타지키스탄",
    "UKRAINE": "우크라이나",
    "BELARUS": "벨라루스",
    "MOLDOVA": "몰도바",
    "AZERBAIJAN": "아제르바이잔",
    "GEORGIA": "조지아",
    "ARMENIA": "아르메니아",
    "CHINA": "중국",
    "MONGOLIA": "몽골",
}

def generate_occupation_form(data: dict, template_path: str, output_path: str):
    """Заполняет форму 외국인 직업 및 연간 소득금액 신고서"""
    doc = fitz.open(template_path)

    # === СТРАНИЦА 1 (index 0) ===
    page = doc[0]

    # Фамилия
    if "surname" in data:
        page.insert_text((113.50, 269.00), str(data["surname"]), fontsize=9, fontname="nanum", fontfile=FONT, color=(0,0,0))
        print(f"surname -> {data['surname']} -> page 0, x=113.50, y=269.00")

    # Имя
    if "given_names" in data:
        page.insert_text((215.00, 269.00), str(data["given_names"]), fontsize=9, fontname="nanum", fontfile=FONT, color=(0,0,0))
        print(f"given_names -> {data['given_names']} -> page 0, x=215.00, y=269.00")

    # Дата рождения
    if "birth_year" in data:
        page.insert_text((142.00, 300.00), str(data["birth_year"]), fontsize=9, fontname="nanum", fontfile=FONT, color=(0,0,0))
        print(f"birth_year -> {data['birth_year']} -> page 0, x=142.00, y=300.00")
    if "birth_month" in data:
        page.insert_text((222.00, 300.00), str(data["birth_month"]), fontsize=9, fontname="nanum", fontfile=FONT, color=(0,0,0))
        print(f"birth_month -> {data['birth_month']} -> page 0, x=222.00, y=300.00")
    if "birth_day" in data:
        page.insert_text((265.50, 300.00), str(data["birth_day"]), fontsize=9, fontname="nanum", fontfile=FONT, color=(0,0,0))
        print(f"birth_day -> {data['birth_day']} -> page 0, x=265.50, y=300.00")

    # ── Пол — чекбоксы M: x=353,y=287  F: x=351,y=298
    sex_occ = data.get("sex", "").upper().strip()
    if sex_occ in ("M", "MALE"):
        page.insert_text((353, 287), "v", fontsize=9, fontname="nanum", fontfile=FONT, color=(0, 0, 0))
    elif sex_occ in ("F", "FEMALE"):
        page.insert_text((351, 298), "v", fontsize=9, fontname="nanum", fontfile=FONT, color=(0, 0, 0))

    # Гражданство (на корейском)
    if "nationality" in data:
        nat_upper = data["nationality"].upper().strip()
        nat_ko = NATIONALITY_KO.get(nat_upper, data["nationality"])
        page.insert_text((474.00, 303.50), nat_ko, fontsize=10, fontfile=FONT, fontname="nanum", color=(0,0,0))
        print(f"nationality -> {nat_ko} -> page 0, x=474.00, y=303.50")

    # ARC по цифрам
    arc_coords = [
        (173.00, 323.50), (193.00, 323.50), (214.00, 323.50),
        (235.00, 323.50), (254.00, 323.50), (273.00, 323.50),
        (294.00, 323.50), (313.00, 323.50), (329.50, 323.50),
        (347.00, 323.50), (365.00, 323.50), (382.00, 323.50),
        (399.50, 323.50)
    ]
    if "arc" in data:
        arc = data["arc"].replace("-", "").replace(" ", "")
        for i, (x, y) in enumerate(arc_coords):
            if i < len(arc):
                page.insert_text((x, y), arc[i], fontsize=9, fontname="nanum", fontfile=FONT, color=(0,0,0))
                print(f"arc_digit_{i+1} -> {arc[i]} -> page 0, x={x}, y={y}")

    # === СТРАНИЦА 3 (index 2) ===
    if len(doc) > 2:
        page3 = doc[2]
        full_name = f"{data.get('surname', '')} {data.get('given_names', '')}".strip()
        if full_name:
            page3.insert_text((309.00, 555.00), full_name, fontsize=9, fontname="nanum", fontfile=FONT, color=(0,0,0))
            print(f"bottom_applicant_name -> {full_name} -> page 2, x=309.00, y=555.00")

    # === ГАЛОЧКА ЗАНЯТОСТИ ===
    OCCUPATION_COORDS = {
        "production":   (2, 60, 166),   # Производство / прочее — стр. 3
        "warehouse":    (2, 59, 215),   # Склад / логистика     — стр. 3
        "construction": (1, 58, 747),   # Стройка               — стр. 2
        "retail":       (1, 60, 334),   # Магазин / продажи     — стр. 2
        "office":       (1, 60,  76),   # Офис / документы      — стр. 2
        "business":     (0, 58, 515),   # Свой бизнес           — стр. 1
        "unemployed":   (0, 60, 364),   # Временно не работаю   — стр. 1
    }

    occupation_key = data.get("occupationType", "") or data.get("occupation_type", "")
    if occupation_key and occupation_key in OCCUPATION_COORDS:
        chk_page_idx, chk_x, chk_y_top = OCCUPATION_COORDS[occupation_key]
        chk_size = 10
        if chk_page_idx < len(doc):
            chk_page = doc[chk_page_idx]
            chk_page.insert_text(
                fitz.Point(chk_x, chk_y_top + chk_size * 0.85),
                "v",
                fontsize=chk_size,
                fontname="nanum",
                fontfile=FONT,
                color=(0, 0, 0),
            )
            print(f"occupation_checkbox -> key={occupation_key}, page={chk_page_idx}, x={chk_x}, y_top={chk_y_top}")

    doc.save(output_path)
    doc.close()


def generate_guarantee_form(app_data: dict, guarantor_data: dict, template_path: str, output_path: str):
    """Заполняет форму 신원보증서 (Personal Guarantee/Surety).
    app_data      — данные из секции 'application' (заявитель)
    guarantor_data — данные из секции 'guarantor'
    Поле Sex/пол НЕ заполняется.
    Координаты Y_top — от верхнего края страницы.
    """
    doc = fitz.open(template_path)
    page = doc[0]

    def t(x, y_top, text, size=9):
        """Вставка латинского текста. y_top — от верхнего края."""
        if text:
            page.insert_text(fitz.Point(x, y_top + size), str(text),
                             fontsize=size, fontname="nanum", fontfile=FONT, color=(0, 0, 0))

    def tk(x, y_top, text, size=9):
        """Вставка текста с корейским шрифтом. y_top — от верхнего края."""
        if text:
            page.insert_text(fitz.Point(x, y_top + size), str(text),
                             fontsize=size, fontfile=FONT, fontname="nanum", color=(0, 0, 0))

    # ── APPLICANT ────────────────────────────────────────────
    # Фамилия (только фамилия, поле Family name: x≈118)
    t(118, 133, app_data.get("surname", ""))
    # Имя (поле Given names: x≈265)
    t(265, 133, app_data.get("given_names", ""))

    # Дата рождения заявителя (YYYY.MM.DD) — зона правее метки "Date of birth" x=113
    by = app_data.get("birth_year", "")
    bm = app_data.get("birth_month", "")
    bd = app_data.get("birth_day", "")
    if by and bm and bd:
        t(180, 161, f"{by}.{bm}.{bd}")

    # Гражданство заявителя — правее метки "Nationality" x=113
    t(175, 189, app_data.get("nationality", ""))

    # Номер паспорта заявителя — правее метки "Passport No." x=412, строка y=193→210
    t(419, 200, app_data.get("passport_no", ""))

    # Адрес в Корее — правее метки "Address in Korea" x=113, y=225
    tk(131, 225, app_data.get("address_in_korea", ""), size=8)

    # Телефон заявителя (только если есть) — правее "Telephone No." x=412
    t(413, 225, app_data.get("cell_phone", ""))

    # ── 성별 Sex checkboxes — Applicant  M: (468,162)  F: (469,176)
    sex_app = app_data.get("sex", "").upper().strip()
    if sex_app in ("M", "MALE"):
        page.insert_text(fitz.Point(468, 162), "v", fontsize=9, fontname="nanum", fontfile=FONT, color=(0, 0, 0))
    elif sex_app in ("F", "FEMALE"):
        page.insert_text(fitz.Point(469, 176), "v", fontsize=9, fontname="nanum", fontfile=FONT, color=(0, 0, 0))

    # ⚬ Цель пребывания — вшита постоянно
    tk(214, 252, "국내 체류 중인 가족 동반 및 동거", size=8)

    # ── GUARANTOR ─────────────────────────────────────────────
    # Полное имя гаранта — правее "Full name" x=113, y=323
    t(172, 319, guarantor_data.get("guarantor_full_name", ""))

    # Гражданство гаранта — правее "Nationality" x=113, y=355
    t(175, 351, guarantor_data.get("guarantor_nationality", ""))

    # ── 성별 Sex checkboxes — Guarantor  M: (467,356)  F: (468,368)
    sex_guar = guarantor_data.get("guarantor_sex", "").upper().strip()
    if sex_guar in ("M", "MALE"):
        page.insert_text(fitz.Point(467, 356), "v", fontsize=9, fontname="nanum", fontfile=FONT, color=(0, 0, 0))
    elif sex_guar in ("F", "FEMALE"):
        page.insert_text(fitz.Point(468, 368), "v", fontsize=9, fontname="nanum", fontfile=FONT, color=(0, 0, 0))

    # Номер паспорта гаранта — поле "Passport Number or Date of Birth" y=386,
    # паспорт слева (x≈131), дата рождения правее (x≈285), телефон справа (x≈413)
    t(131, 386, guarantor_data.get("guarantor_passport_no", ""))
    t(285, 386, guarantor_data.get("guarantor_dob", ""))
    t(413, 386, guarantor_data.get("guarantor_phone", ""))


    # Адрес гаранта = адрес заявителя
    guarantor_addr = app_data.get("address_in_korea", "")
    tk(164, 417, guarantor_addr, size=8)

    # Отношение к заявителю
    tk(244, 451, guarantor_data.get("guarantor_relationship", ""), size=8)

    # Компания / организация (опционально)
    tk(140, 482, guarantor_data.get("guarantor_company", ""), size=8)

    # Должность (опционально)
    t(420, 482, guarantor_data.get("guarantor_position", ""))

    # Рабочий адрес (опционально)
    tk(140, 512, guarantor_data.get("guarantor_work_address", ""), size=8)

    # Примечание (опционально)
    t(420, 512, guarantor_data.get("guarantor_note", ""))

    # ── ПЕРИОД ГАРАНТИИ ──────────────────────────
    t(260, 545, guarantor_data.get("guarantee_period", ""))

    # ── ПОДПИСЬ ГАРАНТА (имя) ──────────────────────────────
    t(342, 759, guarantor_data.get("guarantor_full_name", ""))

    doc.save(output_path)
    doc.close()


def generate_goso_f4_form(data: dict, template_path: str, output_path: str):
    """Заполняет форму 재외동포(F-4) 거소신고(신청)서.

    Координаты origin top-left, единицы pt.
    data keys: surname, given_names, birth_year, birth_month, birth_day,
               sex, nationality, arc, passport_no, passport_issue_date,
               passport_expiry_date, address_in_korea, cell_phone
    """
    doc = fitz.open(template_path)
    page = doc[0]

    def t(x, y, text, size=8, korean=False):
        if not text:
            return
        if korean:
            page.insert_text(fitz.Point(x, y + size * 0.85), str(text),
                             fontsize=size, fontfile=FONT, fontname="nanum", color=(0, 0, 0))
        else:
            page.insert_text(fitz.Point(x, y + size * 0.85), str(text),
                             fontsize=size, fontname="nanum", fontfile=FONT, color=(0, 0, 0))

    # ── 성 Surname ───────────────────────────────────────────────────────────
    t(150.0, 264.2, data.get("surname", ""))

    # ── 명 Given Names ───────────────────────────────────────────────────────
    t(267.1, 264.2, data.get("given_names", ""))

    # ── 생년월일 Date of Birth (YYYY / MM / DD) ─────────────────────────────
    t(152.1, 294.2, data.get("birth_year",  ""))
    t(232.9, 293.5, data.get("birth_month", ""))
    t(288.6, 292.8, data.get("birth_day",   ""))

    # ── 국적 Nationality ──────────────────────────────────────────────────────
    t(487.9, 288.5, data.get("nationality", ""), size=7)

    # ── 외국인등록번호 ARC — 13 digits, evenly spaced xStart=194..xEnd=418, y=315
    arc_raw = data.get("arc", "").replace("-", "").replace(" ", "")
    if arc_raw:
        n = 13
        x_start, x_end, y_arc = 194.0, 418.0, 315.0
        step = (x_end - x_start) / (n - 1)          # ≈ 18.67 pt per cell
        for i, digit in enumerate(arc_raw[:n]):
            t(x_start + i * step, y_arc, digit, size=8)

    # ── 여권번호 Passport No. ─────────────────────────────────────────────────
    t(152.1, 344.2, data.get("passport_no", ""))

    # ── 여권 발급일자 Passport Issue Date ────────────────────────────────────
    t(327.1, 344.9, data.get("passport_issue_date",  ""), size=7)

    # ── 여권 유효기간 Passport Expiry Date ───────────────────────────────────
    t(491.4, 342.1, data.get("passport_expiry_date", ""), size=7)

    # ── 대한민국 안의 거소 Residence In Korea ─────────────────────────────────
    t(154.3, 366.4, data.get("address_in_korea", ""), size=7, korean=True)

    # ── 휴대전화 Cell Phone ───────────────────────────────────────────────────
    t(440.0, 390.7, data.get("cell_phone", ""))

    # ── 신청인 서명 Applicant Signature ───────────────────────────────────────
    full = f"{data.get('surname','')} {data.get('given_names','')}".strip()
    t(455, 558, full, size=6)

    doc.save(output_path)
    doc.close()


def generate_school_form(data: dict, template_path: str, output_path: str):
    """Заполняет форму 외국인 초·중·고 재학사항 신고서
    (REPORT OF ELEMENTARY/MIDDLE/HIGH SCHOOL ENROLLMENT).

    data keys:
        full_name       – surname + given names (Latin)
        sex             – "M" | "F"
        date_of_birth   – "YYYY-MM-DD" or "YYYY.MM.DD"
        nationality     – e.g. "UZBEKISTAN"
        passport_no     – e.g. "FA0668827"
        registration_no – ARC e.g. "741203-5140276"
        school_name     – name of school (Korean or Latin)
    """
    doc = fitz.open(template_path)
    page = doc[0]

    def t(x, y, text, size=9, korean=False):
        """Insert text at (x, y_top). Uses Helvetica for Latin, NanumGothic for Korean."""
        if not text:
            return
        font_kwargs = (
            {"fontfile": FONT, "fontname": "nanum"} if korean
            else {"fontname": "helv"}
        )
        page.insert_text(
            fitz.Point(x, y + size * 0.85),
            str(text),
            fontsize=size,
            color=(0, 0, 0),
            **font_kwargs,
        )

    def chk(x, y, value, size=10):
        """Insert checkbox mark ✓ (via Helvetica 'v') if value is truthy."""
        if value:
            page.insert_text(
                fitz.Point(x, y + size * 0.85),
                "v",
                fontsize=size,
                fontname="nanum", fontfile=FONT,
                color=(0, 0, 0),
            )

    # ── 성명 Full Name ────────────────────────────────────────────────────────
    t(345.7, 150.6, data.get("full_name", ""))

    # ── 성별 Sex checkboxes ───────────────────────────────────────────────────
    sex = data.get("sex", "").upper()
    chk(347.1, 192.7, sex == "M")   # 남 Male
    chk(443.6, 191.6, sex == "F")   # 여 Female

    # ── 생년월일 Date of Birth ────────────────────────────────────────────────
    t(347.1, 223.4, data.get("date_of_birth", ""))

    # ── 국적 Nationality ──────────────────────────────────────────────────────
    t(348.6, 255.9, data.get("nationality", ""))

    # ── 여권번호 Passport No. ─────────────────────────────────────────────────
    t(348.6, 290.6, data.get("passport_no", ""))

    # ── 외국인등록번호 Foreign Resident Reg. No. ──────────────────────────────
    t(346.4, 322.0, data.get("registration_no", ""))

    # ── 학교명 Name of School ─────────────────────────────────────────────────
    # School name may be Korean → use NanumGothic
    school = data.get("school_name", "")
    has_korean = any('\uac00' <= c <= '\ud7a3' for c in school)
    t(346.4, 445.6, school, korean=has_korean)

    # ── 신청인 Applicant (signature line) ────────────────────────────────────
    t(325, 699, data.get("full_name", ""), size=8)

    doc.save(output_path)
    doc.close()


# ══════════════════════════════════════════════════════════════════════════════
# Watermark
# ══════════════════════════════════════════════════════════════════════════════

def apply_watermark(input_path: str, output_path: str) -> None:
    """
    Overlay a diagonal semi-transparent watermark on every page of a PDF.
    Writes result to output_path (can be same as input_path).
    """
    doc = fitz.open(input_path)
    font = fitz.Font("helv")

    MAIN_TEXT = "HiKorea Forms"
    SUB_TEXT  = "PREVIEW - NOT FOR SUBMISSION"
    ANGLE     = 42          # degrees (diagonal)
    OPACITY_MAIN = 0.18
    OPACITY_SUB  = 0.14
    COLOR = (0.40, 0.40, 0.40)

    rot = fitz.Matrix(ANGLE)  # rotation matrix

    for page in doc:
        w = page.rect.width
        h = page.rect.height
        pivot = fitz.Point(w / 2, h / 2)

        # ── Main large text ──────────────────────────────────────────────────
        tw1 = fitz.TextWriter(page.rect, opacity=OPACITY_MAIN, color=COLOR)
        # Approximate center: Helvetica ~0.55 width-per-pt at fontsize 52
        fs_main = 52
        approx_w = len(MAIN_TEXT) * fs_main * 0.38
        x1 = w / 2 - approx_w / 2
        y1 = h / 2 + fs_main / 2
        tw1.append(fitz.Point(x1, y1), MAIN_TEXT, font=font, fontsize=fs_main)
        tw1.write_text(page, morph=(pivot, rot))

        # ── Secondary smaller text ───────────────────────────────────────────
        tw2 = fitz.TextWriter(page.rect, opacity=OPACITY_SUB, color=COLOR)
        fs_sub = 15
        approx_w2 = len(SUB_TEXT) * fs_sub * 0.38
        x2 = w / 2 - approx_w2 / 2
        y2 = h / 2 + fs_main / 2 + fs_sub + 8
        tw2.append(fitz.Point(x2, y2), SUB_TEXT, font=font, fontsize=fs_sub)
        tw2.write_text(page, morph=(pivot, rot))

    doc.save(output_path)
    doc.close()

def generate_scan_pages(files_dict, output_path):
    doc = fitz.open()
    
    passport_path = files_dict.get("passport")
    idcard_path = files_dict.get("idCard")
    contract_path = files_dict.get("contract")
    
    A4_WIDTH = 595.27
    A4_HEIGHT = 841.89
    
    MM_TO_PT = 2.8346
    
    # Standard sizes
    PASS_W = 125.0 * MM_TO_PT
    PASS_H = 88.0 * MM_TO_PT
    
    ID_W = 85.60 * MM_TO_PT
    ID_H = 53.98 * MM_TO_PT
    
    has_page_1 = (passport_path and os.path.exists(passport_path)) or (idcard_path and os.path.exists(idcard_path))
    if has_page_1:
        page = doc.new_page(width=A4_WIDTH, height=A4_HEIGHT)
        
        if passport_path and os.path.exists(passport_path):
            # Centered in upper half
            px0 = (A4_WIDTH - PASS_W) / 2
            py0 = (A4_HEIGHT / 2 - PASS_H) / 2
            rect = fitz.Rect(px0, py0, px0 + PASS_W, py0 + PASS_H)
            page.insert_image(rect, filename=passport_path, keep_proportion=True)
            
        if idcard_path and os.path.exists(idcard_path):
            # Centered in lower half
            ix0 = (A4_WIDTH - ID_W) / 2
            iy0 = A4_HEIGHT / 2 + (A4_HEIGHT / 2 - ID_H) / 2
            rect = fitz.Rect(ix0, iy0, ix0 + ID_W, iy0 + ID_H)
            page.insert_image(rect, filename=idcard_path, keep_proportion=True)
            
    if contract_path and os.path.exists(contract_path):
        page = doc.new_page(width=A4_WIDTH, height=A4_HEIGHT)
        # Full A4 without margins
        rect = fitz.Rect(0, 0, A4_WIDTH, A4_HEIGHT)
        page.insert_image(rect, filename=contract_path, keep_proportion=True)
        
    if has_page_1 or (contract_path and os.path.exists(contract_path)):
        doc.save(output_path)
    doc.close()

def generate_otkaz_form(data, template_path, output_path):
    doc = fitz.open(template_path)
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

    if "full_name" in data:
        exact(page, coords["full_name"][0], coords["full_name"][1], data["full_name"])
    if "nationality" in data:
        exact(page, coords["nationality"][0], coords["nationality"][1], data["nationality"])
    if "gender" in data:
        exact(page, coords["gender"][0], coords["gender"][1], data["gender"])
    if "date_of_birth" in data:
        exact(page, coords["date_of_birth"][0], coords["date_of_birth"][1], data["date_of_birth"])
    if "phone" in data:
        exact(page, coords["phone"][0], coords["phone"][1], data["phone"])
    if "passport_number" in data:
        exact(page, coords["passport_number"][0], coords["passport_number"][1], data["passport_number"])
    if "passport_issue_date" in data:
        exact(page, coords["passport_issue_date"][0], coords["passport_issue_date"][1], data["passport_issue_date"])
    if "passport_expiry_date" in data:
        exact(page, coords["passport_expiry_date"][0], coords["passport_expiry_date"][1], data["passport_expiry_date"])
    if "address" in data:
        exact(page, coords["address"][0], coords["address"][1], data["address"])
    
    if "date_year" in data:
        exact(page, coords["date_year"][0], coords["date_year"][1], data["date_year"])
    if "date_month" in data:
        exact(page, coords["date_month"][0], coords["date_month"][1], data["date_month"])
    if "date_day" in data:
        exact(page, coords["date_day"][0], coords["date_day"][1], data["date_day"])
    if "applicant_name" in data:
        exact(page, coords["applicant_name"][0], coords["applicant_name"][1], data["applicant_name"])

    doc.save(output_path, deflate=True, garbage=4)
    doc.close()
