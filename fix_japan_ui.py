import re

with open("src/JapanVisaMVP.jsx", "r") as f:
    content = f.read()

# 1. Start by changing useEffect for draft loading to be manual instead of automatic
# Find the useEffect that loads the draft and remove it
draft_effect_pattern = r'useEffect\(\(\) => \{\s*const draft = localStorage\.getItem\("japanVisaDraft"\);.*?\}, \[\]\);'
content = re.sub(draft_effect_pattern, '', content, flags=re.DOTALL)

# Now add a manual check for draft in the state/component body
if "const [hasDraft, setHasDraft]" not in content:
    content = content.replace(
        "const [step, setStep] = useState(0);",
        "const [step, setStep] = useState(0);\n    const [hasDraft, setHasDraft] = useState(false);\n\n    useEffect(() => {\n        if (localStorage.getItem(\"japanVisaDraft\")) setHasDraft(true);\n    }, []);\n\n    const loadDraft = () => {\n        try {\n            const draft = JSON.parse(localStorage.getItem(\"japanVisaDraft\"));\n            if (draft.formData) setFormData(draft.formData);\n            if (draft.companions) setCompanions(draft.companions);\n            if (draft.isCompanion) setIsCompanion(draft.isCompanion);\n            if (draft.step) setStep(draft.step);\n        } catch(e) { console.error(e); }\n    };\n"
    )

# Add "Load Draft" button to Step 0
step0_button = """
                                </div>
                            </div>
                            
                            {hasDraft && (
                                <div className="mt-6 text-center bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
                                    <h3 className="font-bold text-yellow-800 mb-2">У вас есть сохраненный черновик!</h3>
                                    <p className="text-yellow-700 text-sm mb-4">Вы можете продолжить заполнение с того места, где остановились.</p>
                                    <button onClick={loadDraft} className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-sm transition-colors">
                                        Продолжить заполнение
                                    </button>
                                </div>
                            )}

                            <div className="mt-6 text-center">
"""
content = content.replace("</div>\n                            <div className=\"mt-6 text-center\">", step0_button)


# 2. Fix handleAddCompanion to reset file states
add_companion_func = """
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
        setPassportFile(null);
        setIdCardFile(null);
        setIdCardBackFile(null);
        setPassportOcrStatus("idle");
        setIdCardOcrStatus("idle");
        setStep(1); // Go back to start of data entry
        window.scrollTo(0, 0);
    };
"""
# Replace the old handleAddCompanion with the new one
content = re.sub(r'const handleAddCompanion = \(\) => \{.*?\n    \};', add_companion_func.strip(), content, flags=re.DOTALL)


# 3. Hide Entry Date and City for companions on Step 1
# Locate Step 1: Entry Date & Docs
# The city and entryDate inputs should be conditionally hidden if `isCompanion` is true.
step1_date_city = """
                        {!isCompanion && (
                            <>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <label className="block text-sm font-medium mb-2">Предполагаемая дата въезда в Японию</label>
                                    <input type="date" className="w-full p-3 border rounded-lg" value={formData.entryDate} onChange={e => updateForm("entryDate", e.target.value)} />
                                    {check14Days() && (
                                        <div className="mt-3 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                                            ⚠️ До предполагаемой даты въезда осталось менее 14 дней. Для подачи на визу Японии может быть недостаточно времени. Проверьте сроки подачи документов.
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                                    <label className="block text-sm font-medium">Город</label>
                                    <div className="flex gap-2">
                                        {["Tokyo", "Osaka", "Okinawa"].map(c => (
                                            <button key={c} onClick={() => updateForm("city", c)} className={`flex-1 py-2 rounded-lg font-medium transition ${formData.city === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{c}</button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
"""
content = re.sub(r'<div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">\s*<label className="block text-sm font-medium mb-2">Предполагаемая дата въезда в Японию</label>.*?</div>\s*</div>', step1_date_city.strip(), content, flags=re.DOTALL)


with open("src/JapanVisaMVP.jsx", "w") as f:
    f.write(content)
