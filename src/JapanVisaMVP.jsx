import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import ImageEditorModal from "./ImageEditorModal";
import ImageAdjustmentModal from "./ImageAdjustmentModal";
import SignaturePadModal from "./SignaturePadModal";
import UploadBox from "./UploadBox";
import UnifiedEditorModal from "./UnifiedEditorModal";

import imageCompression from "browser-image-compression";

export default function JapanVisaMVP() {
    const [step, setStep] = useState(0);
    
    const [companions, setCompanions] = useState([]);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [isCompanion, setIsCompanion] = useState(false);

    // New unified states for Immigration-style UploadBox
    const [passportFile, setPassportFile] = useState(null);
    const [idCardFile, setIdCardFile] = useState(null);
    const [idCardBackFile, setIdCardBackFile] = useState(null);
    const [passportOcrStatus, setPassportOcrStatus] = useState("idle");
    const [idCardOcrStatus, setIdCardOcrStatus] = useState("idle");
    const [passportInstructionModalOpen, setPassportInstructionModalOpen] = useState(false);
    const [passportUploadOpener, setPassportUploadOpener] = useState(null);

    const [quickSignatureModalOpen, setQuickSignatureModalOpen] = useState(false);
    const [quickDocumentModalOpen, setQuickDocumentModalOpen] = useState(false);
    const [quickSigName, setQuickSigName] = useState("");
    const [quickSigDob, setQuickSigDob] = useState("");
    const [quickSigSending, setQuickSigSending] = useState(false);
    const [quickSigSuccess, setQuickSigSuccess] = useState(false);
    const [quickSigDownloadUrl, setQuickSigDownloadUrl] = useState(null);
    const [quickSigFilename, setQuickSigFilename] = useState("");

    const [formData, setFormData] = useState({
        entryDate: "", city: "Tokyo",
        passport: null, idCardFront: null, idCardBack: null, sasil: null,
        passportData: {}, idCardData: {},
        prevCitizenship: "", birthPlace: "", phone: "", email: "", maritalStatus: "",
        relationToApplicant: "",
        relationOther: "", visaHistory: "", relationshipToApplicant: "Сын",
        visitedJapan: "", japanVisitFrom: "", japanVisitTo: "", japanVisaRefusal: "",
        workStatus: "Работаю", freelanceSphere: "", workCertificate: null, studyCertificate: null,
        photo: null, bankStatement: null, bankStatementName: "Да", relationshipProof: null, translationProof: null, optionalDocs: [],
        signature: null
    });
    
    useEffect(() => {
        try {
            const draft = localStorage.getItem("japanVisaDraft");
            if (draft) {
                const parsed = JSON.parse(draft);
                setCompanions(parsed.companions || []);
                setFormData(parsed.formData || {});
                setIsCompanion(parsed.isCompanion || false);
                setStep(parsed.step || 0);
            }
        } catch (e) {}
    }, []);

    const updateForm = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

    const handleNext = () => {
        window.scrollTo(0, 0);
        setStep(s => s + 1);
    };
    
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
        setPassportFile(null);
        setIdCardFile(null);
        setIdCardBackFile(null);
        setPassportOcrStatus("idle");
        setIdCardOcrStatus("idle");
        setStep(1); // Go back to start of data entry
        window.scrollTo(0, 0);
    };

    

    const handlePrev = () => {
        window.scrollTo(0, 0);
        setStep(s => s - 1);
    };

    const [imageEditorConfig, setImageEditorConfig] = useState(null);
    const [adjustState, setAdjustState] = useState(null);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);

    
    const runPassportOCR = async (fileObj) => {
        setPassportOcrStatus("loading");
        try {
            const formData = new FormData();
            formData.append("image", fileObj);
            const res = await fetch("/api/ocr/passport", { method: "POST", body: formData });
            if (!res.ok) throw new Error("OCR fail");
            const data = await res.json();
            setFormData(prev => ({
                ...prev,
                passportData: {
                    ...prev.passportData,
                    surname: data.surname || "",
                    given_names: data.given_names || "",
                    passport_number: data.passport_number || "",
                    birth_date: data.birth_date || "",
                    issue_date: data.issue_date || "",
                    expiry_date: data.expiry_date || "",
                },
                birthPlace: data.birth_place ? data.birth_place : prev.birthPlace
            }));
            setPassportOcrStatus(data.surname ? "success" : "error");
        } catch {
            setPassportOcrStatus("error");
        }
    };

    const runIdCardOCR = async (fileObj) => {
        setIdCardOcrStatus("loading");
        try {
            const formData = new FormData();
            formData.append("image", fileObj);
            const res = await fetch("/api/ocr/idcard", { method: "POST", body: formData });
            if (!res.ok) throw new Error("OCR fail");
            const data = await res.json();
            updateForm("idCardData", {
                ...formData.idCardData,
                id_number: data.id_number || ""
            });
            setIdCardOcrStatus(data.id_number ? "success" : "error");
        } catch {
            setIdCardOcrStatus("error");
        }
    };

    const handleUnifiedEditorSave = (resultBlob, fieldName) => {
        const file = new File([resultBlob], "edited.jpg", { type: "image/jpeg" });
        if (fieldName === "passport") {
            setPassportFile(file);
            runPassportOCR(file);
        } else if (fieldName === "idCardFront") {
            setIdCardFile(file);
            runIdCardOCR(file);
        } else if (fieldName === "idCardBack") {
            setIdCardBackFile(file);
        }
        setUnifiedEditorConfig(null);
    };

    const handleFileUpload = async (e, fieldName) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsCompressing(true);
        let finalFile = file;
        try {
            const options = {
                maxSizeMB: fieldName === 'passport' ? 1.0 : 1.5,
                maxWidthOrHeight: 2000,
                useWebWorker: true,
                exifOrientation: true
            };
            const compressedBlob = await imageCompression(file, options);
            finalFile = new File([compressedBlob], file.name, { type: "image/jpeg" });
        } catch (error) {
            console.warn("Image compression failed, falling back to original", error);
        } finally {
            setIsCompressing(false);
        }
        
        let docType = "none";
        if (fieldName === "passport") docType = "passport";
        else if (fieldName === "idCardFront" || fieldName === "idCardBack") docType = "idcard";
        else if (fieldName === "photo") docType = null; // Standard 2D crop for face photo
        else docType = "contract"; // for arbitrary documents like sasil to at least get 4 corners

        // Run OCR on the original, high-quality compressed image BEFORE cropping/distorting
        // This runs in the background while the user edits the image corners
        if (fieldName === 'passport') runOCR('/api/ocr/passport', finalFile, 'passportData');
        if (fieldName === 'idCardFront') runOCR('/api/ocr/idcard', finalFile, 'idCardData');

        setImageEditorConfig({
            file: finalFile,
            fieldName: fieldName,
            docType: docType,
            onSave: (data) => handleEditorSave(data, fieldName)
        });
        e.target.value = null;
    };

    const handleEditorSave = async (data, fieldName) => {
        let finalBlob = data;
        if (data && data.blob) {
            // It's from 4-corner mode
            finalBlob = data.blob;
            
            // Compute docType from fieldName instead of using stale imageEditorConfig
            let docType = "none";
            if (fieldName === "passport") docType = "passport_full";
            else if (fieldName === "idCardFront" || fieldName === "idCardBack") docType = "idcard";
            else if (fieldName === "photo") docType = null;
            else docType = "contract";

            if (docType) {
                try {
                    const formData = new FormData();
                    formData.append("image", data.fullBlob || data.blob, "crop.jpg");
                    formData.append("docType", docType);
                    formData.append("keepColor", "true"); // Keep color for Japan Visa!
                    console.log("Sending corners:", data.corners);
                    if (data.corners) {
                        formData.append("corners", data.corners);
                    }
                    const res = await fetch("/api/document/process-scan-preview", {
                        method: "POST",
                        body: formData
                    });
                    if (res.ok) {
                        finalBlob = await res.blob();
                    }
                } catch (err) {
                    console.warn("Scan processing error:", err);
                }
            }
        }

        setImageEditorConfig(null);
        
        if (fieldName === 'passport') {
            handleAdjustSave(finalBlob, fieldName);
        } else {
            openAdjuster(finalBlob, (adjustedBlob) => handleAdjustSave(adjustedBlob, fieldName));
        }
    };

    function openAdjuster(fileOrBlob, onSave) {
        if (!fileOrBlob) return;
        const url = URL.createObjectURL(fileOrBlob);
        setAdjustState({
            imageSrc: url,
            onSave: (adjustedBlob) => {
                URL.revokeObjectURL(url);
                onSave(adjustedBlob);
            },
            onCancel: () => {
                URL.revokeObjectURL(url);
                setAdjustState(null);
            }
        });
    }

    const handleAdjustSave = (blob, fieldName) => {
        setAdjustState(null);

        const fileToUpload = new File([blob], `${fieldName}.jpg`, { type: "image/jpeg" });
        
        if (fieldName === 'passport') setPassportFile(fileToUpload);
        else if (fieldName === 'idCardFront') setIdCardFile(fileToUpload);
        else if (fieldName === 'idCardBack') setIdCardBackFile(fileToUpload);

        const reader = new FileReader();
        reader.onload = (ev) => {
            updateForm(fieldName, ev.target.result);
        };
        reader.readAsDataURL(blob);
    };

    const runOCR = async (url, file, dataField) => {
        setOcrLoading(true);
        const formData = new FormData();
        const fieldName = url.includes('passport') ? 'passport' : 'idcard';
        formData.append(fieldName, file);
        try {
            const res = await fetch(url, { method: "POST", body: formData });
            
            let textRes = await res.text();
            let data;
            try {
                data = JSON.parse(textRes);
            } catch (err) {
                console.error("Non-JSON response from OCR:", textRes);
                alert("Ошибка сервера (некорректный ответ). Пожалуйста, введите данные вручную.");
                return;
            }

            if (res.ok && data.ok) {
                updateForm(dataField, data.data);
            } else {
                alert("Не удалось автоматически распознать данные: " + (data.error || "Неизвестная ошибка"));
                console.warn("OCR non-ok response", data);
            }
        } catch (e) {
            console.error("OCR Error", e);
            alert("Ошибка сети при распознавании. Пожалуйста, введите данные вручную.");
        } finally {
            setOcrLoading(false);
        }
    };

    const renderHeader = () => (
        <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link to="/" className="text-xl font-bold text-gray-900 tracking-tight">HiKorea Forms</Link>
                <div className="text-sm font-medium text-gray-500">Виза в Японию</div>
            </div>
        </header>
    );

    const check14Days = () => {
        if (!formData.entryDate) return false;
        const diff = new Date(formData.entryDate) - new Date();
        return diff < 14 * 24 * 60 * 60 * 1000;
    };

    const checkPassport6Months = () => {
        if (!formData.passportData.expiry_date) return false;
        const diff = new Date(formData.passportData.expiry_date) - new Date();
        return diff < 180 * 24 * 60 * 60 * 1000;
    };

    
    const toBase64 = (file) => new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    const buildTravelerPayload = (data) => ({
        applicant: {
            ...data.passportData,
            prevCitizenship: data.prevCitizenship,
            birthPlace: data.birthPlace,
            phone: data.phone,
            email: data.email,
            maritalStatus: data.maritalStatus,
            relationshipToApplicant: data.relationshipToApplicant
        },
        work: {
            status: data.workStatus,
            freelanceSphere: data.freelanceSphere
        },
        images: [
            { type: "passport", data: data.passport },
            { type: "idcard", data: data.idCardFront },
            { type: "idcard", data: data.idCardBack },
            { type: "a4", data: data.sasil },
            { type: "photo", data: data.photo },
            { type: "a4", data: data.bankStatement },
            { type: "a4", data: data.bankStatementName === "Нет" ? data.relationshipProof : null },
            { type: "a4", data: data.bankStatementName === "Нет" ? data.translationProof : null },
            { type: "a4", data: data.workStatus === "Работаю" ? data.workCertificate : null },
            { type: "a4", data: data.workStatus === "Учусь" ? data.studyCertificate : null },
            { type: "signature", data: data.signature },
            ...data.optionalDocs.map(d => ({ type: "a4", data: d }))
        ].filter(item => item.data)
    });

    const generatePackage = async () => {
        setStep(7);
        try {
            
            // Transform images into the format expected by the backend
            const prepareTraveler = (t) => {
                const imgFields = [
                    { key: 'passport', type: 'passport' },
                    { key: 'idCardFront', type: 'idcard' },
                    { key: 'idCardBack', type: 'idcard' },
                    { key: 'photo', type: 'photo' },
                    { key: 'sasil', type: 'a4' },
                    { key: 'workCertificate', type: 'a4' },
                    { key: 'studyCertificate', type: 'a4' },
                    { key: 'businessRegistration', type: 'a4' },
                    { key: 'bankStatement', type: 'a4' },
                    { key: 'relationshipProof', type: 'a4' },
                    { key: 'translationProof', type: 'a4' },
                    { key: 'otherDocs', type: 'a4' },
                    { key: 'signature', type: 'signature' }
                ];
                
                const images = [];
                for (const field of imgFields) {
                    if (t[field.key]) {
                        // Handle multiple files if it's an array, or single file
                        const files = Array.isArray(t[field.key]) ? t[field.key] : [t[field.key]];
                        for (const fileData of files) {
                            if (fileData && typeof fileData === 'string' && fileData.startsWith('data:image')) {
                                images.push({ type: field.type, data: fileData });
                            }
                        }
                    }
                }
                
                return {
                    applicant: {
                        surname: (t.passportData && t.passportData.surname) || t.surname || "",
                        given_names: (t.passportData && t.passportData.given_names) || t.given_names || t.firstName || ""
                    },
                    work: {}, // Optionally map work details
                    images: images,
                    // Keep original properties just in case
                    ...t
                };
            };
            
            const currentTraveler = prepareTraveler({ ...formData });
            const allTravelers = [currentTraveler, ...companions.map(c => prepareTraveler(c))];

            
            const res = await fetch("/api/generate/japan-package-download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    travelers: allTravelers,
                    entryDate: formData.entryDate,
                    city: formData.city
                })
            });
            if (!res.ok) throw new Error("Server error");
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            setDownloadUrl(url);
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

    return (
        <>
            {passportInstructionModalOpen && (
                <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm mx-auto animate-fade-in bg-white">
                        
                        <div className="relative">
                            <img src="/passport_sample_v2.jpg" alt="Passport Sample" className="w-full h-auto block" />
                            
                            {/* Overlay on the top half */}
                            <div className="absolute top-0 left-0 w-full h-[55%] flex flex-col items-center justify-center p-5 bg-black/60 backdrop-blur-[2px]">
                                <h2 className="text-xl font-bold text-white mb-3 text-center drop-shadow-md">Фото паспорта</h2>
                                <ul className="text-white/95 text-[14px] space-y-1.5 mb-5 drop-shadow-md list-disc pl-5">
                                    <li>Сфотографируйте <strong>полный разворот</strong> (две страницы).</li>
                                    <li>Избегайте бликов и темных теней.</li>
                                    <li>Затем выровняйте 4 угла.</li>
                                </ul>
                                <button 
                                    onClick={() => {
                                        setPassportInstructionModalOpen(false);
                                        if (passportUploadOpener) passportUploadOpener();
                                    }} 
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition-all active:scale-95 text-[15px]"
                                >
                                    Понятно, загрузить фото
                                </button>
                            </div>
                        </div>

                        {/* Close button */}
                        <button 
                            onClick={() => setPassportInstructionModalOpen(false)}
                            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            )}

            {quickDocumentModalOpen && (
                <QuickDocumentModal 
                    onClose={() => setQuickDocumentModalOpen(false)} 
                    setImageEditorConfig={setImageEditorConfig} 
                    setAdjustState={setAdjustState}
                    setPassportUploadOpener={setPassportUploadOpener}
                    setPassportInstructionModalOpen={setPassportInstructionModalOpen}
                />
            )}

            {quickSignatureModalOpen && (
                <div className="fixed inset-0 z-[11000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <button onClick={() => {
                                setQuickSignatureModalOpen(false);
                                setQuickSigSuccess(false);
                                setQuickSigDownloadUrl(null);
                                setQuickSigFilename("");
                                setQuickSigName("");
                                setQuickSigDob("");
                            }} className="p-2 -ml-2 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                            <span className="font-bold text-gray-800">Онлайн Подпись</span>
                            <div className="w-10"></div>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {quickSigSuccess ? (
                                <div className="text-center py-6">
                                    <div className="text-6xl mb-4">✅</div>
                                    <h2 className="text-xl font-bold mb-4 text-green-700">Подпись отправлена</h2>
                                    <p className="text-gray-600 mb-6 text-sm">Документ с вашей подписью сгенерирован и успешно передан в Telegram.</p>
                                    {quickSigDownloadUrl && (
                                        <a 
                                            href={quickSigDownloadUrl} 
                                            download={quickSigFilename || "Signature.pdf"}
                                            className="w-full py-3 mb-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                                        >
                                            Скачать на телефон
                                        </a>
                                    )}
                                    <button 
                                        onClick={() => {
                                            setQuickSignatureModalOpen(false);
                                            setQuickSigSuccess(false);
                                            setQuickSigDownloadUrl(null);
                                            setQuickSigFilename("");
                                            setQuickSigName("");
                                            setQuickSigDob("");
                                        }} 
                                        className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors"
                                    >
                                        Закрыть
                                    </button>
                                </div>
                            ) : (
                                <div className="text-left">
                                    <div className="space-y-4 mb-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия Имя</label>
                                            <input 
                                                type="text" 
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors" 
                                                placeholder="Ivanov Ivan"
                                                value={quickSigName}
                                                onChange={(e) => setQuickSigName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Дата рождения</label>
                                            <input 
                                                type="date" 
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors" 
                                                value={quickSigDob}
                                                onChange={(e) => setQuickSigDob(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Подпись</label>
                                            <QuickSignaturePad 
                                                sending={quickSigSending}
                                                onSave={async (sigBlobUrl) => {
                                                    if (!quickSigName || !quickSigDob) {
                                                        alert("Пожалуйста, заполните Имя и Дату рождения.");
                                                        return;
                                                    }
                                                    setQuickSigSending(true);
                                                    try {
                                                        const fd = new FormData();
                                                        fd.append("fullName", quickSigName);
                                                        fd.append("dob", quickSigDob);
                                                        
                                                        // Convert dataUrl to blob
                                                        const resBlob = await fetch(sigBlobUrl).then(r => r.blob());
                                                        fd.append("signature", resBlob, "signature.png");
                                                        
                                                        const res = await fetch("/api/japan-visa/quick-signature", {
                                                            method: "POST",
                                                            body: fd
                                                        });
                                                        if (res.ok) {
                                                            const pdfBlob = await res.blob();
                                                            const url = URL.createObjectURL(pdfBlob);
                                                            setQuickSigDownloadUrl(url);
                                                            setQuickSigFilename(`Signature_${quickSigName.replace(/[^A-Za-z0-9а-яА-ЯёЁ]/g, "_")}.pdf`);
                                                            setQuickSigSuccess(true);
                                                        } else {
                                                            alert("Ошибка при отправке подписи.");
                                                        }
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert("Сетевая ошибка при отправке.");
                                                    } finally {
                                                        setQuickSigSending(false);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {imageEditorConfig && (
                <ImageEditorModal
                    forceLanguage="ru"
                    file={imageEditorConfig.file}
                    docType={imageEditorConfig.docType}
                    onSave={imageEditorConfig.onSave}
                    onCancel={() => setImageEditorConfig(null)}
                />
            )}
            {adjustState && (
                <ImageAdjustmentModal
                    forceLanguage="ru"
                    imageSrc={adjustState.imageSrc}
                    onSave={adjustState.onSave}
                    onCancel={adjustState.onCancel}
                />
            )}
            {showSignaturePad && (
                <SignaturePadModal
                    isOpen={showSignaturePad}
                    onClose={() => setShowSignaturePad(false)}
                    onSave={(dataUrl) => {
                        updateForm("signature", dataUrl);
                        setShowSignaturePad(false);
                    }}
                />
            )}
            <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 pb-24">
            {renderHeader()}
            <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8">
                
                {/* Step 0: Gateway Page */}
                {step === 0 && (
                    <div className="space-y-8">
                        {/* Japan Visa Focus Block */}
                        <div className="bg-white rounded-3xl shadow-lg border border-blue-100 overflow-hidden">
                            <div className="bg-blue-600 px-8 py-10 text-white text-center">
                                <h1 className="text-3xl md:text-4xl font-extrabold mb-4">Виза в Японию</h1>
                                <p className="text-blue-100 text-lg max-w-lg mx-auto">
                                    Бесплатная подготовка пакета документов для подачи на визу в Японию для граждан СНГ в Корее.
                                </p>
                            </div>

                            {/* Requirements Block */}
                            <div className="p-6 md:p-10">
                                <h2 className="text-2xl md:text-3xl font-extrabold mb-8 text-center text-gray-900">Что потребуется для оформления</h2>
                                
                                <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                                    {/* Column 1: Docs */}
                                    <div className="bg-blue-50/60 rounded-3xl p-6 md:p-8 border border-blue-100 shadow-sm">
                                        <div className="flex items-center mb-6">
                                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl mr-4 shadow-md transform rotate-3">📄</div>
                                            <h3 className="text-xl font-bold text-gray-900 leading-tight">Обязательные документы</h3>
                                        </div>
                                        <ul className="space-y-4 text-[15px] text-gray-700">
                                            <li className="flex items-start"><span className="text-blue-500 mr-3 mt-1 font-black text-lg">•</span><div><b className="text-gray-900">Паспорт</b><br/><span className="text-gray-500">— срок действия не менее 6 месяцев</span></div></li>
                                            <li className="flex items-start"><span className="text-blue-500 mr-3 mt-1 font-black text-lg">•</span><div><b className="text-gray-900">Корейская ID-карта</b><br/><span className="text-gray-500">— должна покрывать всю поездку</span><br/><span className="text-gray-500">— 외국인등록 사실증명서 (если данные на обороте плохо читаются)</span></div></li>
                                            <li className="flex items-start"><span className="text-blue-500 mr-3 mt-1 font-black text-lg">•</span><div><b className="text-gray-900">Фото 3.5 × 4.5 см</b><br/><span className="text-gray-500">— сделано за последние 6 месяцев</span></div></li>
                                            <li className="flex items-start"><span className="text-blue-500 mr-3 mt-1 font-black text-lg">•</span><div><b className="text-gray-900">Справка из банка (잔액증명서)</b><br/><span className="text-gray-500">— о балансе счёта, действительна 1 месяц</span><br/><span className="text-gray-500">— если не на ваше имя: документ о родстве + перевод</span></div></li>
                                        </ul>
                                    </div>

                                    {/* Column 2: Data & Work */}
                                    <div className="space-y-6 md:space-y-8">
                                        <div className="bg-purple-50/60 rounded-3xl p-6 md:p-8 border border-purple-100 shadow-sm">
                                            <div className="flex items-center mb-6">
                                                <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl mr-4 shadow-md transform -rotate-3">ℹ️</div>
                                                <h3 className="text-xl font-bold text-gray-900 leading-tight">Данные для анкеты</h3>
                                            </div>
                                            <ul className="space-y-3 text-[15px] text-gray-700">
                                                <li className="flex items-start"><span className="text-purple-500 mr-3 font-black text-lg">•</span><span><b className="text-gray-900">Гражданство:</b> предыдущее (если было)</span></li>
                                                <li className="flex items-start"><span className="text-purple-500 mr-3 font-black text-lg">•</span><span><b className="text-gray-900">Место рождения:</b> страна, область, город</span></li>
                                                <li className="flex items-start"><span className="text-purple-500 mr-3 font-black text-lg">•</span><span><b className="text-gray-900">Контакты:</b> телефон, email</span></li>
                                                <li className="flex items-start"><span className="text-purple-500 mr-3 font-black text-lg">•</span><span><b className="text-gray-900">Семейное положение</b></span></li>
                                                <li className="flex items-start"><span className="text-purple-500 mr-3 font-black text-lg">•</span><span><b className="text-gray-900">Визовая история:</b> подачи, отказы</span></li>
                                                <li className="flex items-start"><span className="text-purple-500 mr-3 font-black text-lg">•</span><span><b className="text-gray-900">Поездки в Японию:</b> даты, срок пребывания</span></li>
                                            </ul>
                                        </div>

                                        <div className="bg-green-50/60 rounded-3xl p-6 md:p-8 border border-green-100 shadow-sm">
                                            <div className="flex items-center mb-6">
                                                <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white text-2xl mr-4 shadow-md transform rotate-3">💼</div>
                                                <h3 className="text-xl font-bold text-gray-900 leading-tight">Работа, учёба, бизнес</h3>
                                            </div>
                                            <ul className="space-y-4 text-[15px] text-gray-700">
                                                <li className="flex items-start"><span className="text-green-500 mr-3 mt-1 font-black text-lg">•</span><div><b className="text-gray-900">Работающим</b><br/><span className="text-gray-500">— справка с работы (재직증명서)</span></div></li>
                                                <li className="flex items-start"><span className="text-green-500 mr-3 mt-1 font-black text-lg">•</span><div><b className="text-gray-900">Студентам/школьникам</b><br/><span className="text-gray-500">— справка с места учёбы (재학증명서)</span></div></li>
                                                <li className="flex items-start"><span className="text-green-500 mr-3 mt-1 font-black text-lg">•</span><div><b className="text-gray-900">Предпринимателям</b><br/><span className="text-gray-500">— свидетельство о регистрации бизнеса (사업자등록증)</span></div></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 px-8 py-8 border-t border-gray-100 text-center flex flex-col items-center">
                                <button onClick={handleNext} className="w-full sm:w-auto px-14 py-4 bg-blue-600 text-white hover:bg-blue-700 font-extrabold rounded-2xl shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-1 hover:shadow-xl text-xl mb-4">
                                    Начать оформление
                                </button>
                                <div className="flex gap-2">
                                    <button onClick={() => setQuickSignatureModalOpen(true)} className="text-gray-400 hover:text-gray-600 text-[14px] underline cursor-pointer px-4 py-2">
                                        (подпись)
                                    </button>
                                    <button onClick={() => setQuickDocumentModalOpen(true)} className="text-gray-400 hover:text-gray-600 text-[14px] underline cursor-pointer px-4 py-2">
                                        (загрузка доп документов)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Main Service Upsell Block */}
                        <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 rounded-3xl shadow-lg border-2 border-indigo-100 p-8 relative overflow-hidden">
                            {/* Decorative Blobs */}
                            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-200/40 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
                            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-200/40 rounded-full mix-blend-multiply filter blur-3xl"></div>

                            <div className="relative z-10">
                                <h2 className="text-2xl md:text-3xl font-extrabold mb-3 text-center text-indigo-900 tracking-tight">🇰🇷 Иммиграционные формы Кореи</h2>
                                <p className="text-indigo-700 text-center mb-8 font-medium">
                                    Также на нашем сайте вы можете подготовить документы для иммиграционной службы Кореи (HiKorea).
                                </p>
                                
                                <div className="grid md:grid-cols-2 gap-5">
                                    <Link to="/" className="flex items-center p-5 bg-white/80 backdrop-blur-sm rounded-2xl border border-indigo-100 hover:border-indigo-400 hover:shadow-xl hover:bg-white transition-all transform hover:-translate-y-1 group">
                                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm flex items-center justify-center font-black text-2xl mr-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors transform group-hover:rotate-3">
                                            F-4
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">Виза зарубежного<br/>соотечественника</h3>
                                            <p className="text-sm text-gray-500 font-medium">Продление, изменение статуса</p>
                                        </div>
                                    </Link>
                                    <Link to="/" className="flex items-center p-5 bg-white/80 backdrop-blur-sm rounded-2xl border border-indigo-100 hover:border-indigo-400 hover:shadow-xl hover:bg-white transition-all transform hover:-translate-y-1 group">
                                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm flex items-center justify-center font-black text-2xl mr-5 group-hover:bg-emerald-600 group-hover:text-white transition-colors transform group-hover:-rotate-3">
                                            F-1
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">Виза по приглашению</h3>
                                            <p className="text-sm text-gray-500 font-medium">F-1-9, F-1-15<br/>(Супруги, дети)</p>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                            
                            <div className="mt-6 text-center">

                                <Link to="/" className="inline-flex items-center text-blue-600 font-medium hover:text-blue-800">
                                    Перейти на главную страницу HiKorea Forms 
                                    <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 1: Entry Date & Docs */}
                {step === 1 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold">Шаг 1: Дата поездки и основные документы</h2>

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

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <label className="block text-sm font-medium mb-4">Паспорт - разворот с личными данными</label>
                            <div className="mb-4 p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200 shadow-sm font-medium">
                                <span className="text-xl mr-1">⚠️</span> <strong>Внимание:</strong> Сфотографируйте документ так, чтобы <strong>отчетливо были видны все 4 угла</strong>. Убедитесь, что на фото <strong>нет бликов и теней</strong>.
                            </div>
                            <UploadBox
                                forceLanguage="ru"
                                bgImage="/passport_bg.png"
                                title="Разворот паспорта"
                                note="Загрузите фото паспорта с личными данными"
                                file={passportFile}
                                ocrStatus={passportOcrStatus}
                                onClickIntercept={(openPicker) => {
                                    setPassportUploadOpener(() => openPicker);
                                    setPassportInstructionModalOpen(true);
                                }}
                                onFile={(f) => handleFileUpload({ target: { files: [f] } }, "passport")}
                                onUnifiedReplace={() => { updateForm("passport", null); setPassportFile(null); setPassportOcrStatus("idle"); }}
                                onUnifiedAdjust={() => setImageEditorConfig({
                                    file: passportFile,
                                    fieldName: "passport",
                                    docType: "passport_full",
                                    onSave: (data) => handleEditorSave(data, "passport")
                                })}
                            />
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <label className="block text-sm font-medium mb-4">ID-карта - передняя сторона</label>
                            <UploadBox
                                forceLanguage="ru"
                                bgImage="/id_card_bg.png"
                                title="Передняя сторона ID"
                                note="Лицевая сторона корейской ID-карты"
                                file={idCardFile}
                                ocrStatus={idCardOcrStatus}
                                onFile={(f) => handleFileUpload({ target: { files: [f] } }, "idCardFront")}
                                onUnifiedReplace={() => { updateForm("idCardFront", null); setIdCardFile(null); setIdCardOcrStatus("idle"); }}
                                onUnifiedAdjust={() => setImageEditorConfig({
                                    file: idCardFile,
                                    fieldName: "idCardFront",
                                    docType: "idcard",
                                    onSave: (data) => handleEditorSave(data, "idCardFront")
                                })}
                            />
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <label className="block text-sm font-medium mb-4">ID-карта - задняя сторона</label>
                            <UploadBox
                                forceLanguage="ru"
                                bgPosition="top center"
                                bgImage="/id_card_back_bg.png"
                                title="Задняя сторона ID (если есть)"
                                note="Обратная сторона с адресом (Опционально)"
                                file={idCardBackFile}
                                ocrStatus="idle"
                                onFile={(f) => handleFileUpload({ target: { files: [f] } }, "idCardBack")}
                                onUnifiedReplace={() => { updateForm("idCardBack", null); setIdCardBackFile(null); }}
                                onUnifiedAdjust={() => setImageEditorConfig({
                                    file: idCardBackFile,
                                    fieldName: "idCardBack",
                                    docType: "idcard",
                                    onSave: (data) => handleEditorSave(data, "idCardBack")
                                })}
                            />
                        </div>
                            
                        <div className="bg-gray-50 p-6 rounded-xl shadow-sm border border-gray-200">
                            <label className="block text-sm font-medium mb-2">외국인등록 사실증명서 (Опционально)</label>
                            <p className="text-xs text-gray-500 mb-3">Загрузите этот документ, если на ID-карте плохо читается адрес или срок действия/период пребывания.</p>
                            
                            {!formData.sasil ? (
                                <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "sasil")} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                            ) : (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center text-green-700">
                                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        <span className="font-semibold text-sm">Документ загружен</span>
                                    </div>
                                    <button onClick={() => updateForm("sasil", null)} className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1 bg-red-50 rounded-lg">Удалить</button>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={handlePrev} className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium">Назад</button>
                            <button onClick={handleNext} disabled={(!isCompanion && !formData.entryDate) || !formData.passport || !formData.idCardFront || !formData.idCardBack} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">Далее</button>
                        </div>
                    </div>
                )}

                {/* Step 2: Data Verification */}
                {step === 2 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold">Шаг 2: Проверка данных</h2>
                        
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                            {checkPassport6Months() && (
                                <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">
                                    ⚠️ Срок действия паспорта меньше 6 месяцев. Для подачи на визу Японии может потребоваться новый паспорт.
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия (Surname)</label>
                                <input type="text" className="w-full p-3 border rounded-lg" value={formData.passportData.surname || ""} onChange={e => updateForm("passportData", { ...formData.passportData, surname: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Имя (Given Names)</label>
                                <input type="text" className="w-full p-3 border rounded-lg" value={formData.passportData.given_names || ""} onChange={e => updateForm("passportData", { ...formData.passportData, given_names: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Дата рождения</label>
                                <input type="date" className="w-full p-3 border rounded-lg" value={formData.passportData.birth_date || ""} onChange={e => updateForm("passportData", { ...formData.passportData, birth_date: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Номер паспорта</label>
                                <input type="text" className="w-full p-3 border rounded-lg" value={formData.passportData.passport_number || ""} onChange={e => updateForm("passportData", { ...formData.passportData, passport_number: e.target.value })} />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата выдачи</label>
                                    <input type="date" className="w-full p-3 border rounded-lg" value={formData.passportData.issue_date || ""} onChange={e => updateForm("passportData", { ...formData.passportData, issue_date: e.target.value })} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Годен до</label>
                                    <input type="date" className="w-full p-3 border rounded-lg" value={formData.passportData.expiry_date || ""} onChange={e => updateForm("passportData", { ...formData.passportData, expiry_date: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Номер ID-карты</label>
                                <input type="text" className="w-full p-3 border rounded-lg" value={formData.idCardData.id_number || ""} onChange={e => updateForm("idCardData", { ...formData.idCardData, id_number: e.target.value })} />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={handlePrev} className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium">Назад</button>
                            <button onClick={handleNext} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold">Далее</button>
                        </div>
                    </div>
                )}

                {/* Step 3: Additional Data */}
                {step === 3 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold">Шаг 3: Дополнительные анкетные данные</h2>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Предыдущее гражданство (если было)</label>
                                <input type="text" className="w-full p-3 border rounded-lg" value={formData.prevCitizenship} onChange={e => updateForm("prevCitizenship", e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Полное место рождения (Страна, Регион, Город)</label>
                                <input type="text" className="w-full p-3 border rounded-lg" value={formData.birthPlace} onChange={e => updateForm("birthPlace", e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Телефон</label>
                                <input type="text" className="w-full p-3 border rounded-lg" value={formData.phone} onChange={e => updateForm("phone", e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input type="email" className="w-full p-3 border rounded-lg" value={formData.email} onChange={e => updateForm("email", e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Семейное положение</label>
                                <select className="w-full p-3 border rounded-lg" value={formData.maritalStatus} onChange={e => updateForm("maritalStatus", e.target.value)}>
                                    <option value="">Выберите...</option>
                                    <option value="single">Не женат / Не замужем</option>
                                    <option value="married">Женат / Замужем</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Посещали ли вы Японию ранее?</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="visitedJapan" value="Да" checked={formData.visitedJapan === "Да"} onChange={e => updateForm("visitedJapan", e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                        <span>Да</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="visitedJapan" value="Нет" checked={formData.visitedJapan === "Нет"} onChange={e => updateForm("visitedJapan", e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                        <span>Нет</span>
                                    </label>
                                </div>
                            </div>

                            {formData.visitedJapan === "Да" && (
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4">
                                    <p className="text-sm font-medium text-blue-800">Укажите даты вашей последней поездки:</p>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Дата въезда</label>
                                            <input type="date" className="w-full p-2 border rounded-lg" value={formData.japanVisitFrom} onChange={e => updateForm("japanVisitFrom", e.target.value)} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Дата выезда</label>
                                            <input type="date" className="w-full p-2 border rounded-lg" value={formData.japanVisitTo} onChange={e => updateForm("japanVisitTo", e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formData.visitedJapan === "Нет" && (
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                                    <label className="block text-sm font-medium mb-2">Было ли вам когда-либо отказано в выдаче визы в Японию?</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="japanVisaRefusal" value="Да" checked={formData.japanVisaRefusal === "Да"} onChange={e => updateForm("japanVisaRefusal", e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                            <span>Да</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="japanVisaRefusal" value="Нет" checked={formData.japanVisaRefusal === "Нет"} onChange={e => updateForm("japanVisaRefusal", e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                            <span>Нет</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={handlePrev} className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium">Назад</button>
                            <button onClick={handleNext} disabled={!formData.phone || !formData.maritalStatus || !formData.visitedJapan || (formData.visitedJapan === "Да" && (!formData.japanVisitFrom || !formData.japanVisitTo)) || (formData.visitedJapan === "Нет" && !formData.japanVisaRefusal)} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">Далее</button>
                        </div>
                    </div>
                )}

                {/* Step 4: Work/Study */}
                {step === 4 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold">Шаг 4: Место работы или учебы в Корее</h2>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Статус</label>
                                <select className="w-full p-3 border rounded-lg" value={formData.workStatus} onChange={e => updateForm("workStatus", e.target.value)}>
                                    <option value="Работаю">Работаю</option>
                                    <option value="Учусь">Учусь</option>
                                    <option value="Не работаю">Не работаю</option>
                                    <option value="Фриланс">Фриланс</option>
                                    <option value="Пенсионер">Пенсионер</option>
                                </select>
                            </div>
                            
                            {formData.workStatus === 'Работаю' && (
                                <div className="mt-4 border-t pt-4">
                                    <label className="block text-sm font-medium mb-2">Справка с работы - 재직증명서</label>
                                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "workCertificate")} className="block w-full text-sm text-gray-500 mb-2" />
                                    {formData.workCertificate && <img src={formData.workCertificate} alt="Work Certificate" className="w-full h-40 object-cover rounded-lg border mb-4" />}
                                </div>
                            )}

                            {formData.workStatus === 'Учусь' && (
                                <div className="mt-4 border-t pt-4">
                                    <label className="block text-sm font-medium mb-2">Справка с учебы - 재학증명서</label>
                                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "studyCertificate")} className="block w-full text-sm text-gray-500 mb-2" />
                                    {formData.studyCertificate && <img src={formData.studyCertificate} alt="Study Certificate" className="w-full h-40 object-cover rounded-lg border mb-4" />}
                                </div>
                            )}

                            {formData.workStatus === 'Фриланс' && (
                                <div className="mt-4 border-t pt-4">
                                    <label className="block text-sm font-medium mb-1">В какой сфере вы работаете?</label>
                                    <p className="text-xs text-gray-500 mb-2">Например: IT, дизайн, переводы, онлайн-продажи, консультации и т.д.</p>
                                    <input type="text" className="w-full p-3 border rounded-lg" value={formData.freelanceSphere} onChange={e => updateForm("freelanceSphere", e.target.value)} />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={handlePrev} className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium">Назад</button>
                            <button onClick={handleNext} disabled={!formData.workStatus || (formData.workStatus === "Фриланс" && !formData.freelanceSphere)} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">Далее</button>
                        </div>
                    </div>
                )}

                {/* Step 5: Remaining Docs */}
                {step === 5 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold">Шаг 5: Остальные документы</h2>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                            
                            <label className="block text-sm font-medium mb-2">Фото 3.5 × 4.5 см</label>
                            <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "photo")} className="block w-full text-sm text-gray-500 mb-2" />
                            {formData.photo && <img src={formData.photo} alt="Photo" className="w-32 h-40 object-cover rounded-lg border mb-4" />}

                            <label className="block text-sm font-medium mb-2 border-t pt-4">Справка из банка - 잔액증명서</label>
                            <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "bankStatement")} className="block w-full text-sm text-gray-500 mb-2" />
                            {formData.bankStatement && <img src={formData.bankStatement} alt="Bank" className="w-full h-40 object-cover rounded-lg border mb-4" />}

                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Справка из банка оформлена на имя заявителя?</label>
                                <select className="w-full p-3 border rounded-lg" value={formData.bankStatementName} onChange={e => updateForm("bankStatementName", e.target.value)}>
                                    <option value="Да">Да</option>
                                    <option value="Нет">Нет</option>
                                </select>
                                {formData.bankStatementName === "Нет" && (
                                    <div className="mt-3 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-200">
                                        <p className="mb-4">ℹ️ Если банковская справка оформлена не на имя заявителя, необходимо приложить документ, подтверждающий родство, и перевод на корейский язык.</p>
                                        
                                        <label className="block text-sm font-medium mb-2">1. Документ, подтверждающий родство</label>
                                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "relationshipProof")} className="block w-full text-sm mb-2" />
                                        {formData.relationshipProof && <img src={formData.relationshipProof} alt="Relationship Proof" className="w-full h-40 object-cover rounded-lg border mb-4" />}

                                        <label className="block text-sm font-medium mb-2 mt-4">2. Перевод документа на корейский язык</label>
                                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "translationProof")} className="block w-full text-sm mb-2" />
                                        {formData.translationProof && <img src={formData.translationProof} alt="Translation Proof" className="w-full h-40 object-cover rounded-lg border mb-4" />}
                                    </div>
                                )}
                            </div>

                        </div>

                        <div className="flex gap-4">
                            <button onClick={handlePrev} className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium">Назад</button>
                            <button onClick={handleNext} disabled={!formData.photo || !formData.bankStatement} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">Далее</button>
                        </div>
                    </div>
                )}

                {/* Step 6: Signature */}
                {step === 6 && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Шаг 6: Подпись</h2>
                            
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                            <p className="text-gray-600 mb-4">Нарисуйте вашу подпись. Она будет использована в финальных документах.</p>
                            <InlineSignaturePad 
                                signature={formData.signature}
                                onSave={(sig) => updateForm("signature", sig)}
                                onClear={() => updateForm("signature", null)}
                            />
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

                {/* Step 7: Loading */}
                {step === 7 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <h2 className="text-xl font-bold mb-2">Генерация документов...</h2>
                        <p className="text-gray-600">Пожалуйста, подождите. Это может занять около 10-20 секунд.</p>
                    </div>
                )}

                {/* Step 8: Success */}
                {step === 8 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h2 className="text-2xl font-bold mb-4">Документы отправлены в визовый центр</h2>
                        <p className="text-gray-600 mb-8">Скачивание архива началось автоматически. Вы также можете скачать копию себе на телефон.</p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            {downloadUrl && (
                                <a href={downloadUrl} download="japan_visa_package.zip" className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors inline-block cursor-pointer">
                                    Скачать на телефон
                                </a>
                            )}
                            <button onClick={() => setStep(0)} className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors">
                                Вернуться в начало
                            </button>
                        </div>
                    </div>
                )}

            </main>

            {/* Loading Overlay for Compression */}
            {isCompressing && (
                <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white p-6 rounded-2xl flex flex-col items-center gap-4 shadow-xl">
                        <svg className="animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        <p className="text-gray-800 font-medium text-center">Обработка изображения...</p>
                    </div>
                </div>
            )}

            {/* Non-blocking OCR Toast */}
            {ocrLoading && (
                <div className="fixed bottom-6 right-6 z-[9999] bg-white p-4 rounded-xl shadow-2xl border border-blue-100 flex items-center gap-4 animate-fade-in max-w-[300px]">
                    <svg className="animate-spin text-blue-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    <div className="text-sm">
                        <p className="font-bold text-gray-800">Распознавание...</p>
                        <p className="text-gray-500 leading-tight">Извлекаем данные с документа (5-10 сек).</p>
                    </div>
                </div>
            )}
        </div>
        </>
    );
}
function QuickSignaturePad({ onSave, sending }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = 240;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = "#111111";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
        }, 50);
    }, []);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);
        return { x, y };
    };

    const startDrawing = (e) => {
        if (e.type.startsWith('touch')) e.preventDefault();
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const { x, y } = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (e.type.startsWith('touch')) e.preventDefault();
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const cropAndSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        let hasPixels = false;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const alpha = data[(y * canvas.width + x) * 4 + 3];
                if (alpha > 0) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    hasPixels = true;
                }
            }
        }

        if (!hasPixels) {
            alert("Пожалуйста, распишитесь.");
            return;
        }

        const padding = 10;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvas.width, maxX + padding);
        maxY = Math.min(canvas.height, maxY + padding);

        const cropWidth = maxX - minX;
        const cropHeight = maxY - minY;

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        
        onSave(croppedCanvas.toDataURL('image/png'));
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden relative touch-none bg-gray-50" style={{ height: "240px" }}>
                {!hasDrawn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                        <span className="text-xl font-bold mb-2">Распишитесь здесь</span>
                        <span className="text-sm font-medium px-4 text-center text-blue-800 bg-blue-100 py-1 rounded">Поставьте подпись точно так же, как в паспорте</span>
                    </div>
                )}
                <canvas
                    ref={canvasRef}
                    className="w-full h-full cursor-crosshair relative z-10"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ touchAction: 'none' }}
                />
            </div>
            <div className="flex gap-4">
                <button type="button" onClick={handleClear} disabled={sending} className="flex-1 py-3 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50 transition-colors">Очистить</button>
                <button type="button" onClick={cropAndSave} disabled={sending} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {sending ? "Отправка..." : "Отправить"}
                </button>
            </div>
        </div>
    );
}

function QuickDocumentModal({ onClose, setImageEditorConfig, setAdjustState, setPassportUploadOpener, setPassportInstructionModalOpen }) {
    const [quickDocName, setQuickDocName] = useState("");
    const [quickDocDob, setQuickDocDob] = useState("");
    const [passportFile, setPassportFile] = useState(null);
    const [otherDocs, setOtherDocs] = useState([{ id: Date.now(), file: null }]);
    const [quickDocSending, setQuickDocSending] = useState(false);
    const [quickDocSuccess, setQuickDocSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!quickDocName || !quickDocDob || !passportFile) {
            alert("Пожалуйста, заполните Имя, Дату рождения и загрузите паспорт.");
            return;
        }

        setQuickDocSending(true);
        try {
            const formData = new FormData();
            formData.append("fullName", quickDocName);
            formData.append("dob", quickDocDob);
            formData.append("passport", passportFile);
            
            const validOtherDocs = otherDocs.filter(d => d.file !== null);
            for (let i = 0; i < validOtherDocs.length; i++) {
                formData.append("otherDocs", validOtherDocs[i].file);
            }

            const res = await fetch("/api/japan-visa/quick-documents", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                alert("Ошибка при отправке документов");
                setQuickDocSending(false);
                return;
            }

            setQuickDocSuccess(true);
        } catch (err) {
            console.error(err);
            alert("Произошла ошибка при отправке.");
        } finally {
            setQuickDocSending(false);
        }
    };

    const handleQuickFileUpload = async (file, docId, isPassport) => {
        if (!file) return;

        let finalFile = file;
        try {
            const options = {
                maxSizeMB: isPassport ? 1.0 : 1.5,
                maxWidthOrHeight: 2000,
                useWebWorker: true,
                exifOrientation: true
            };
            const compressedBlob = await imageCompression(file, options);
            finalFile = new File([compressedBlob], file.name, { type: "image/jpeg" });
        } catch (error) {
            console.warn("Image compression failed, falling back to original", error);
        }

        setImageEditorConfig({
            file: finalFile,
            fieldName: isPassport ? "passport" : `otherDoc_${docId}`,
            docType: isPassport ? "passport_full" : "contract",
            onSave: async (data) => {
                let finalBlob = data;
                if (data && data.blob) {
                    finalBlob = data.blob;
                    try {
                        const formData = new FormData();
                        formData.append("image", data.fullBlob || data.blob, "crop.jpg");
                        formData.append("docType", isPassport ? "passport_full" : "contract");
                        formData.append("keepColor", "true");
                        if (data.corners) {
                            formData.append("corners", data.corners);
                        }
                        const res = await fetch("/api/document/process-scan-preview", {
                            method: "POST",
                            body: formData
                        });
                        if (res.ok) {
                            finalBlob = await res.blob();
                        }
                    } catch (err) {
                        console.warn("Scan processing error:", err);
                    }
                }
                setImageEditorConfig(null);

                if (isPassport) {
                    const editedFile = new File([finalBlob], 'passport.jpg', { type: "image/jpeg" });
                    setPassportFile(editedFile);
                    return;
                }

                // Open Adjuster
                const url = URL.createObjectURL(finalBlob);
                setAdjustState({
                    imageSrc: url,
                    onSave: (adjustedBlob) => {
                        URL.revokeObjectURL(url);
                        setAdjustState(null);
                        const editedFile = new File([adjustedBlob], `${isPassport ? 'passport' : docId}.jpg`, { type: "image/jpeg" });
                        
                        if (isPassport) {
                            setPassportFile(editedFile);
                        } else {
                            setOtherDocs(prevDocs => {
                                const newDocs = [...prevDocs];
                                const idx = newDocs.findIndex(d => d.id === docId);
                                if (idx !== -1) {
                                    newDocs[idx].file = editedFile;
                                }
                                return newDocs;
                            });
                        }
                    },
                    onCancel: () => {
                        URL.revokeObjectURL(url);
                        setAdjustState(null);
                    }
                });
            }
        });
    };

    const addOtherDoc = () => {
        setOtherDocs([...otherDocs, { id: Date.now(), file: null }]);
    };

    return (
        <div className="fixed inset-0 z-[9000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-xl font-bold text-gray-900">Загрузка документов</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {quickDocSuccess ? (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 text-green-500 shadow-sm border border-green-200">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h4 className="text-2xl font-bold text-gray-900 mb-3">Документы отправлены!</h4>
                            <p className="text-gray-600 mb-6">Мы успешно получили ваш паспорт и другие документы.</p>
                            <button onClick={onClose} className="w-full py-3.5 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200 transition-colors">Закрыть</button>
                        </div>
                    ) : (
                        <div className="space-y-6 mb-2">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия Имя</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors" 
                                        placeholder="Ivanov Ivan"
                                        value={quickDocName}
                                        onChange={(e) => setQuickDocName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата рождения</label>
                                    <input 
                                        type="date" 
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors" 
                                        value={quickDocDob}
                                        onChange={(e) => setQuickDocDob(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Паспорт - разворот с личными данными *</label>
                                <UploadBox
                                    forceLanguage="ru"
                                    bgImage="/passport_bg.png"
                                    title="Разворот паспорта"
                                    note="Загрузите фото паспорта с личными данными"
                                    file={passportFile}
                                    ocrStatus="idle"
                                    onClickIntercept={(openPicker) => {
                                        setPassportUploadOpener(() => openPicker);
                                        setPassportInstructionModalOpen(true);
                                    }}
                                    onFile={(f) => handleQuickFileUpload(f, null, true)}
                                    onUnifiedReplace={() => setPassportFile(null)}
                                    onUnifiedAdjust={() => {
                                        if (passportFile) handleQuickFileUpload(passportFile, null, true);
                                    }}
                                />
                            </div>
                            
                            <div className="border-t border-gray-100 pt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Прочие документы (необязательно)</label>
                                {otherDocs.map((doc, index) => (
                                    <div key={doc.id} className="mb-4">
                                        <UploadBox
                                            forceLanguage="ru"
                                            title={`Дополнительный документ ${index + 1}`}
                                            note="Любой другой документ"
                                            file={doc.file}
                                            ocrStatus="idle"
                                            onFile={(f) => handleQuickFileUpload(f, doc.id, false)}
                                            onUnifiedReplace={() => {
                                                const newDocs = [...otherDocs];
                                                newDocs[index].file = null;
                                                setOtherDocs(newDocs);
                                            }}
                                            onUnifiedAdjust={() => {
                                                if (doc.file) handleQuickFileUpload(doc.file, doc.id, false);
                                            }}
                                        />
                                    </div>
                                ))}
                                <button type="button" onClick={addOtherDoc} className="w-full py-3 bg-gray-50 text-blue-600 border border-dashed border-blue-200 rounded-xl font-medium hover:bg-blue-50 transition-colors">
                                    + Добавить еще документ
                                </button>
                            </div>

                            <div className="pt-2 pb-2">
                                <button type="button" onClick={handleSubmit} disabled={quickDocSending} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-200 text-lg">
                                    {quickDocSending ? "Отправка..." : "Отправить документы"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
