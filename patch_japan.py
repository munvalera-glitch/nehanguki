import re

with open("src/JapanVisaMVP.jsx", "r") as f:
    content = f.read()

# 1. Add companions state
if "const [companions, setCompanions] = useState([]);" not in content:
    content = content.replace(
        "const [formData, setFormData] = useState({",
        "const [companions, setCompanions] = useState([]);\n    const [isCompanion, setIsCompanion] = useState(false);\n    const [formData, setFormData] = useState({"
    )

# 2. Add relation field
if "relationToApplicant" not in content:
    content = content.replace(
        "maritalStatus: \"\",",
        "maritalStatus: \"\",\n        relationToApplicant: \"\",\n        relationOther: \"\","
    )

# 3. Add handleTemporarySave and handleAddCompanion
new_funcs = """
    const handleTemporarySave = () => {
        const payload = { formData, companions, isCompanion, step };
        localStorage.setItem("japanVisaDraft", JSON.stringify(payload));
        alert("Данные временно сохранены! Вы можете закрыть страницу и продолжить позже.");
    };

    const handleAddCompanion = () => {
        setCompanions([...companions, formData]);
        setIsCompanion(true);
        setFormData({
            ...formData, // keep entryDate and city
            passportData: {}, idCardData: {},
            passport: null, idCardFront: null, idCardBack: null, sasil: null,
            firstName: "", lastName: "", birthDate: "",
            occupation: "", employerName: "", employerAddress: "", employerPhone: "",
            maritalStatus: "", partnerName: "",
            relationToApplicant: "", relationOther: "",
            workCertificate: null, studyCertificate: null,
            photo: null, bankStatement: null, relationshipProof: null, translationProof: null,
            signature: null
        });
        setStep(1); // Go back to start of data entry
        window.scrollTo(0, 0);
    };

    useEffect(() => {
        const draft = localStorage.getItem("japanVisaDraft");
        if (draft) {
            try {
                const parsed = JSON.parse(draft);
                if (parsed.formData) setFormData(parsed.formData);
                if (parsed.companions) setCompanions(parsed.companions);
                if (parsed.isCompanion) setIsCompanion(parsed.isCompanion);
                if (parsed.step) setStep(parsed.step);
            } catch (e) {
                console.error("Failed to load draft", e);
            }
        }
    }, []);
"""

if "handleAddCompanion" not in content:
    content = content.replace(
        "const handlePrev = () => {",
        new_funcs + "\n    const handlePrev = () => {"
    )

# 4. Step 2 relation dropdown
relation_jsx = """
                            {isCompanion && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <label className="block text-sm font-medium mb-1">Отношение к основному заявителю</label>
                                    <select className="w-full p-3 border rounded-lg mb-3" value={formData.relationToApplicant} onChange={e => updateForm("relationToApplicant", e.target.value)}>
                                        <option value="">Выберите...</option>
                                        <option value="Child">Сын / Дочь</option>
                                        <option value="Parent">Родитель</option>
                                        <option value="Spouse">Супруг(а)</option>
                                        <option value="Family">Семья / Родственник</option>
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
if "relationToApplicant" not in content:
    content = content.replace(
        '<h2 className="text-xl font-bold">Шаг 2: Проверка данных (Автоматически)</h2>',
        '<h2 className="text-xl font-bold">Шаг 2: Проверка данных (Автоматически)</h2>\n' + relation_jsx
    )

# 5. Generate Package - sending array
generate_logic = """
    const generatePackage = async () => {
        setStep(7);
        try {
            const currentTraveler = { ...formData };
            const allTravelers = [...companions, currentTraveler];
            
            const res = await fetch("/api/generate/japan-package-download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ travelers: allTravelers })
            });
            if (!res.ok) throw new Error("Server error");
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "japan_visa_package.zip";
            a.click();
            setStep(8);
            localStorage.removeItem("japanVisaDraft"); // Clear draft on success
        } catch (error) {
            console.error("Error generating package:", error);
            alert("Произошла ошибка при генерации документов.");
            setStep(6);
        }
    };
"""
if "const allTravelers =" not in content:
    # replace the old generatePackage
    content = re.sub(r'const generatePackage = async \(\) => \{.*?\n    \};', generate_logic.strip(), content, flags=re.DOTALL)


# 6. Step 6 signature UI with new buttons
step6_ui = """
                {/* Step 6: Signature */}
                {step === 6 && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Шаг 6: Подпись</h2>
                            <button onClick={handleTemporarySave} className="text-blue-600 hover:text-blue-800 font-medium px-4 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                                Временное сохранение
                            </button>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                            <p className="text-gray-600 mb-4">Нарисуйте вашу подпись. Она будет использована в финальных документах.</p>
                            
                            <div className="border-2 border-dashed border-gray-300 rounded-xl h-48 mb-4 relative flex items-center justify-center bg-gray-50 overflow-hidden">
                                {formData.signature ? (
                                    <img src={formData.signature} alt="Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                ) : (
                                    <div className="text-gray-400">Нажмите кнопку ниже, чтобы расписаться</div>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => setShowSignaturePad(true)} 
                                className="px-6 py-3 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors inline-flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                {formData.signature ? "Изменить подпись" : "Распишитесь"}
                            </button>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={handleAddCompanion} className="flex-1 py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold hover:bg-indigo-100 transition-colors">
                                Добавить попутчика
                            </button>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={handlePrev} className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium">Назад</button>
                            <button onClick={generatePackage} disabled={!formData.signature} className="flex-1 py-3 bg-green-600 disabled:opacity-50 text-white rounded-lg font-bold">Сгенерировать документы</button>
                        </div>
                    </div>
                )}
"""
if "handleAddCompanion" not in content:
    content = re.sub(r'\{\/\* Step 6: Signature \*\/\}.*?\{\/\* Step 7: Loading \*\/\}', step6_ui.strip() + '\n\n                {/* Step 7: Loading */}', content, flags=re.DOTALL)


with open("src/JapanVisaMVP.jsx", "w") as f:
    f.write(content)
