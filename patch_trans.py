import re

with open("pdf/pdf_generator.py", "r", encoding="utf-8") as f:
    content = f.read()

translations = """
COUNTRY_KO = {
    "RUSSIAN FEDERATION": "러시아",
    "UZBEKISTAN": "우즈베키스탄",
    "KAZAKHSTAN": "카자흐스탄",
    "KYRGYZSTAN": "키르기스스탄",
    "TAJIKISTAN": "타지키스탄",
    "UKRAINE": "우크라이나",
    "BELARUS": "벨라루스",
    "MOLDOVA": "몰도바",
    "ARMENIA": "아르메니아",
    "AZERBAIJAN": "아제르바이잔",
    "GEORGIA": "조지아",
    "TURKMENISTAN": "투르크메니스탄",
    "CHINA": "중국",
    "VIETNAM": "베트남",
    "THAILAND": "태국",
    "PHILIPPINES": "필리핀",
    "MONGOLIA": "몽골",
    "INDONESIA": "인도네시아",
    "MYANMAR": "미얀마",
    "CAMBODIA": "캄보디아",
    "NEPAL": "네팔",
    "SRI LANKA": "스리랑카",
    "BANGLADESH": "방글라데시",
    "PAKISTAN": "파키스탄",
    "INDIA": "인도",
    "USA": "미국",
    "JAPAN": "일본",
    "CANADA": "캐나다",
    "AUSTRALIA": "호주",
    "NEW ZEALAND": "뉴질랜드",
    "UK": "영국",
    "FRANCE": "프랑스",
    "GERMANY": "독일",
    "ITALY": "이탈리아",
    "SPAIN": "스페인"
}

GENDER_KO = {
    "M": "남",
    "F": "여",
    "MALE": "남",
    "FEMALE": "여"
}

def translate_country(country_en):
    if not country_en:
        return ""
    return COUNTRY_KO.get(str(country_en).strip().upper(), country_en)

def translate_gender(gender_en):
    if not gender_en:
        return ""
    return GENDER_KO.get(str(gender_en).strip().upper(), gender_en)
"""

if "def translate_country" not in content:
    content = content.replace("import fitz\nimport os\nimport base64", "import fitz\nimport os\nimport base64\n" + translations)

# Patch generate_otkaz_form to use translation
target_func = """    if "full_name" in data:
        exact(page, coords["full_name"][0], coords["full_name"][1], data["full_name"])
    if "nationality" in data:
        exact(page, coords["nationality"][0], coords["nationality"][1], data["nationality"])
    if "gender" in data:
        exact(page, coords["gender"][0], coords["gender"][1], data["gender"])"""

replacement_func = """    if "full_name" in data:
        exact(page, coords["full_name"][0], coords["full_name"][1], data["full_name"])
    if "nationality" in data:
        exact(page, coords["nationality"][0], coords["nationality"][1], translate_country(data["nationality"]))
    if "gender" in data:
        exact(page, coords["gender"][0], coords["gender"][1], translate_gender(data["gender"]))"""

content = content.replace(target_func, replacement_func)

with open("pdf/pdf_generator.py", "w", encoding="utf-8") as f:
    f.write(content)

