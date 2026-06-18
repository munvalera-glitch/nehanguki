import re

with open("src/JapanVisaMVP.jsx", "r") as f:
    content = f.read()

# 1. Remove Temporary Save logic
content = re.sub(r'const \[hasDraft, setHasDraft\].*?console\.error\(e\); \}\n    \};\n', '', content, flags=re.DOTALL)
content = re.sub(r'\{hasDraft && \(.*?\)\}  ', '', content, flags=re.DOTALL)
content = re.sub(r'<button onClick=\{handleTemporarySave\}.*?</button>', '', content, flags=re.DOTALL)

# Remove the text "Временное сохранение" entirely from Step 6 if left
if "Временное сохранение" in content:
    content = re.sub(r'<div className="flex justify-between items-center">\s*<h2 className="text-xl font-bold">Шаг 6: Подпись</h2>\s*</div>', '<h2 className="text-xl font-bold">Шаг 6: Подпись</h2>', content)

# 2. Adapt Step 1 for companion
# Currently Step 1 has relationToApplicant on Step 2.
# First, remove it from Step 2
relation_pattern = r'\{isCompanion && \(\s*<div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">\s*<label className="block text-sm font-medium mb-1">Отношение к основному заявителю</label>.*?</div>\s*\)\}'
content = re.sub(relation_pattern, '', content, flags=re.DOTALL)

# Add relation to Step 1
relation_step1 = """
                        {isCompanion && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <label className="block text-sm font-medium mb-1">Отношение к основному заявителю</label>
                                <select className="w-full p-3 border rounded-lg mb-3" value={formData.relationToApplicant} onChange={e => updateForm("relationToApplicant", e.target.value)}>
                                    <option value="">Выберите...</option>
                                    <option value="Child">Сын / Дочь</option>
                                    <option value="Mother">Мама</option>
                                    <option value="Father">Папа</option>
                                    <option value="Brother">Брат</option>
                                    <option value="Sister">Сестра</option>
                                    <option value="Spouse">Супруг(а)</option>
                                    <option value="Family">Родственник</option>
                                    <option value="Friend">Друг / Подруга</option>
                                    <option value="Other">Прочее</option>
                                </select>
                                {formData.relationToApplicant === "Other" && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Укажите кем приходится (на английском)</label>
                                        <input type="text" className="w-full p-3 border rounded-lg" value={formData.relationOther} onChange={e => updateForm("relationOther", e.target.value)} placeholder="Например: Colleague" />
                                    </div>
                                )}
                            </div>
                        )}
"""
content = re.sub(r'(<h2 className="text-xl font-bold">Шаг 1: Дата поездки и основные документы</h2>)', r'\1\n' + relation_step1, content)

with open("src/JapanVisaMVP.jsx", "w") as f:
    f.write(content)
