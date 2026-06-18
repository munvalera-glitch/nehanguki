import re

with open("src/JapanVisaMVP.jsx", "r") as f:
    content = f.read()

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

if "Временное сохранение" not in content:
    content = re.sub(r'\{\/\* Step 6: Signature \*\/\}.*?\{\/\* Step 7: Loading \*\/\}', step6_ui.strip() + '\n\n                {/* Step 7: Loading */}', content, flags=re.DOTALL)

with open("src/JapanVisaMVP.jsx", "w") as f:
    f.write(content)
