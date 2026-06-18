import re

# 1. Update locales
locales = {
    'ru': '    "acc.title": "Детали проживания",\n    "acc.subtitle": "Пожалуйста, уточните детали вашего проживания",\n    "acc.relationship": "Отношения с иностранцем",\n    "acc.rel.family_relative": "Семья и родственники",\n    "acc.rel.employer": "Работодатель",\n    "acc.rel.other": "Другое",\n    "acc.ownershipType": "Тип владения",\n    "acc.own.own": "Собственность",\n    "acc.own.rent": "Аренда",\n    "acc.own.other": "Другое",\n    "acc.residenceType": "Тип жилья",\n    "acc.res.private_residence": "Частный дом и т.д.",\n    "acc.res.dormitory": "Общежитие",\n    "acc.res.accommodation": "Гостиница",\n    "acc.res.other": "Другое",\n    "acc.validationError": "Пожалуйста, выберите один вариант в каждой категории.",',
    'en': '    "acc.title": "Accommodation Details",\n    "acc.subtitle": "Please specify your accommodation details",\n    "acc.relationship": "Relationship with Foreigner",\n    "acc.rel.family_relative": "Family and Relatives",\n    "acc.rel.employer": "Employer",\n    "acc.rel.other": "Other",\n    "acc.ownershipType": "Ownership Type",\n    "acc.own.own": "Own",\n    "acc.own.rent": "Rent",\n    "acc.own.other": "Other",\n    "acc.residenceType": "Residence Type",\n    "acc.res.private_residence": "Private Residence, etc.",\n    "acc.res.dormitory": "Dormitory",\n    "acc.res.accommodation": "Accommodation",\n    "acc.res.other": "Other",\n    "acc.validationError": "Please select one option in each category.",',
    'ko': '    "acc.title": "거주/숙소 상세정보",\n    "acc.subtitle": "거주/숙소 상세정보를 선택해 주세요",\n    "acc.relationship": "외국인과의 관계",\n    "acc.rel.family_relative": "가족 및 친척",\n    "acc.rel.employer": "고용주",\n    "acc.rel.other": "기타",\n    "acc.ownershipType": "소유형태",\n    "acc.own.own": "자가",\n    "acc.own.rent": "임대",\n    "acc.own.other": "기타",\n    "acc.residenceType": "주거형태",\n    "acc.res.private_residence": "개인주택 등",\n    "acc.res.dormitory": "기숙사",\n    "acc.res.accommodation": "숙박시설",\n    "acc.res.other": "기타",\n    "acc.validationError": "각 항목에서 옵션을 하나씩 선택해 주세요.",'
}

for lang, additions in locales.items():
    path = f"/Users/macvalera/Documents/HIkoreaFORMS/src/i18n/locales/{lang}.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if '"acc.title"' not in content:
        new_content = content.replace('export default {', 'export default {\n' + additions)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)

print("Locales updated.")
