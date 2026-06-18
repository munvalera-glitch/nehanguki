import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ImageEditorModal from "./ImageEditorModal";
import ImageAdjustmentModal from "./ImageAdjustmentModal";
import AuthModal from "./AuthModal";
import AdminPanel from "./AdminPanel";
import { privacyPolicy } from "./legal/privacy";
import { termsOfService } from "./legal/terms";
import imageCompression from "browser-image-compression";


export default function ImmigrationMVP() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [draftId, setDraftId] = useState(null);
  useEffect(() => {
    fetch("/api/auth/me", {
      credentials: "include"
    }).then(res => res.json()).then(data => {
      setUser(data.user || null);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
  }, []);
  const [step, setStep] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("step") || "visa";
  });

  // Helper to navigate between steps with browser history support
  const navigateToStep = (nextStep, replace = false) => {
    setStep(nextStep);
    const url = new URL(window.location);
    url.searchParams.set("step", nextStep);
    if (replace) {
      window.history.replaceState({
        step: nextStep
      }, "", url.toString());
    } else {
      window.history.pushState({
        step: nextStep
      }, "", url.toString());
    }
  };

  // Sync step with URL on mount and handle popstate (back/forward buttons)
  useEffect(() => {
    const handlePopState = event => {
      const stepFromState = event.state?.step;
      const params = new URLSearchParams(window.location.search);
      const stepFromUrl = params.get("step");
      if (stepFromState) {
        setStep(stepFromState);
      } else if (stepFromUrl) {
        setStep(stepFromUrl);
      } else {
        setStep("visa");
      }
    };

    const params = new URLSearchParams(window.location.search);
    const loginStatus = params.get("login");
    const initialStep = params.get("step");

    if (loginStatus === "success") {
      // If logged in from home (step=visa or no step), go to my-page
      if (!initialStep || initialStep === "visa") {
        setStep("my-page");
        navigateToStep("my-page", true);
      }
      // Clear the login param from URL without reloading
      const cleanUrl = new URL(window.location);
      cleanUrl.searchParams.delete("login");
      window.history.replaceState({ step: initialStep || "visa" }, "", cleanUrl.toString());
    } else if (initialStep) {
      setStep(initialStep);
      window.history.replaceState({ step: initialStep }, "", window.location.href);
    } else {
      window.history.replaceState({ step: "visa" }, "", window.location.href);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [visaType, setVisaType] = useState("");
  const [action, setAction] = useState("");
  const [housingType, setHousingType] = useState("");
  const [contractUploaded, setContractUploaded] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);
  const [providerSource, setProviderSource] = useState("");
  const [generated, setGenerated] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dataVerified, setDataVerified] = useState(false);
  const [addressCrop, setAddressCrop] = useState(null);
  const [selectingAddress, setSelectingAddress] = useState(false);
  const [providerCrop, setProviderCrop] = useState(null);
  const [selectingProvider, setSelectingProvider] = useState(false);
  const [passportFile, setPassportFile] = useState(null);
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardBackFile, setIdCardBackFile] = useState(null);
  const [idCardBackPreviewUrl, setIdCardBackPreviewUrl] = useState(null);
  const [signatureData, setSignatureData] = useState(null);
  const [contractFile, setContractFile] = useState(null);
  const [schoolFile, setSchoolFile] = useState(null);
  const [guarantorFile, setGuarantorFile] = useState(null);
  const [contractPreviewUrl, setContractPreviewUrl] = useState(null);

  // Passport OCR state
  const [passportOcrStatus, setPassportOcrStatus] = useState("idle"); // idle | loading | success | warning | error
  const [passportOcrError, setPassportOcrError] = useState("");
  const [passportOcrWarning, setPassportOcrWarning] = useState("");
  const [ocrFailedFields, setOcrFailedFields] = useState({});

  // ID Card OCR state
  const [idCardOcrStatus, setIdCardOcrStatus] = useState("idle");
  const [idCardOcrError, setIdCardOcrError] = useState("");
  const [nameWarning, setNameWarning] = useState("");

  // Address OCR state
  const [addressOcrStatus, setAddressOcrStatus] = useState("idle"); // idle | loading | success | warning | error
  const [addressOcrError, setAddressOcrError] = useState("");

  // Provider OCR state
  const [providerOcrStatus, setProviderOcrStatus] = useState("idle"); // idle | loading | success | warning | error
  const [providerOcrError, setProviderOcrError] = useState("");
  const [providerIdFile, setProviderIdFile] = useState(null);

  // School certificate OCR state
  const [schoolOcrStatus, setSchoolOcrStatus] = useState("idle"); // idle | loading | success | warning | error
  const [schoolOcrError, setSchoolOcrError] = useState("");

  // PDF generation state
  const [pdfStatus, setPdfStatus] = useState("idle"); // idle | loading | success | error
  const [pdfError, setPdfError] = useState("");

  // Guarantor passport OCR state
  const [guarantorOcrStatus, setGuarantorOcrStatus] = useState("idle"); // idle | loading | success | warning | error
  const [guarantorOcrError, setGuarantorOcrError] = useState("");

  // Navigation & Reset state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [myPagePackages, setMyPagePackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedCartItems, setSelectedCartItems] = useState([]);

  // Legal Modal state
  const [legalModal, setLegalModal] = useState({ open: false, type: "" }); // type: "privacy" | "terms"

  // Payment state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Auth Modal state
  const [authModal, setAuthModal] = useState({ open: false, type: "", subtitle: "" }); // login | register | forgot
  const [pendingAction, setPendingAction] = useState(null);

  // Image editor state
  const [editorState, setEditorState] = useState(null); // null = closed | { file, aspectRatio, helperText, onSave }
  const [adjustState, setAdjustState] = useState(null); // null = closed | { imageSrc, onSave }
  const [showAdmin, setShowAdmin] = useState(false);
  const ADMIN_EMAIL = "munvalera@gmail.com";

  function openEditor(file, aspectRatio, helperText, onSave, docType = null) {
    setEditorState({
      file,
      aspectRatio,
      helperText,
      onSave,
      docType
    });
  }
  async function handleEditorSave(data) {
    if (!editorState) return;

    const blob = data.blob || data;
    const corners = data.corners || null;

    let finalBlob = blob;
    if (editorState.docType) {
      try {
        const formData = new FormData();
        formData.append("image", data.fullBlob || blob, "crop.jpg");
        formData.append("docType", editorState.docType);
        if (corners) {
          formData.append("corners", corners);
        }

        const res = await fetch("/api/document/process-scan-preview", {
          method: "POST",
          body: formData
        });

        if (res.ok) {
          finalBlob = await res.blob();
        } else {
          console.warn("Scan processing failed", await res.text());
        }
      } catch (err) {
        console.warn("Scan processing network error:", err);
      }
    }

    editorState.onSave(finalBlob);
    setEditorState(null);
  }

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

  async function handleAdjustSave(blob) {
    if (!adjustState) return;
    adjustState.onSave(blob);
    setAdjustState(null);
  }

  const startOver = (force = false) => {
    if (!force && (visaType || action || applicant.fullName)) {
      setShowResetConfirm(true);
      return;
    }

    // Reset all form state
    setVisaType("");
    setAction("");
    setHousingType("");
    setContractUploaded(false);
    setAddressSelected(false);
    setProviderSource("");
    setGenerated(false);
    setTermsAccepted(false);
    setDataVerified(false);
    setAddressCrop(null);
    setSelectingAddress(false);
    setProviderCrop(null);
    setSelectingProvider(false);
    setPassportFile(null);
    setIdCardFile(null);
    setIdCardBackFile(null);
    setIdCardBackPreviewUrl(null);
    setSignatureData(null);
    setContractFile(null);
    setSchoolFile(null);
    setGuarantorFile(null);
    setPassportOcrStatus("idle");
    setPassportOcrError("");
    setPassportOcrWarning("");
    setOcrFailedFields({});
    setIdCardOcrStatus("idle");
    setIdCardOcrError("");
    setNameWarning("");
    setAddressOcrStatus("idle");
    setAddressOcrError("");
    setProviderOcrStatus("idle");
    setProviderOcrError("");
    setProviderIdFile(null);
    setSchoolOcrStatus("idle");
    setSchoolOcrError("");
    setPdfStatus("idle");
    setPdfError("");
    setGuarantorOcrStatus("idle");
    setGuarantorOcrError("");

    setApplicant({
      surname: "",
      givenNames: "",
      fullName: "",
      nationality: "",
      passportNumber: "",
      passportIssueDate: "",
      passportExpiryDate: "",
      idNumber: "",
      phone: "",
      birthDate: "",
      sex: "",
      isStudent: null,
      schoolName: ""
    });

    setGuarantor({
      fullName: "",
      nationality: "",
      sex: "",
      passportNumber: "",
      phone: "",
      relationship: "",
      company: "",
      jobPosition: "",
      workAddress: ""
    });

    setAddress("");
    setProvider({
      fullName: "",
      idNumber: "",
      phone: "",
      nationality: ""
    });

    setShowResetConfirm(false);
    setStep("visa");
    navigateToStep("visa", true);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      setUser(null);
      setStep("visa");
      navigateToStep("visa", true);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };



  const fetchMyPagePackages = async () => {
    setLoadingPackages(true);
    try {
      const res = await fetch("/api/user/packages", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setMyPagePackages(data.packages);
      }
    } catch (err) {
      console.error("Fetch packages error:", err);
    } finally {
      setLoadingPackages(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyPagePackages();
    }
  }, [user]);
  useEffect(() => {
    if (!authLoading && !user && step === "my-page") {
      navigateToStep("visa", true);
    }
  }, [authLoading, user, step]);
  React.useEffect(() => {
    if (!contractFile) {
      setContractPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(contractFile);
    setContractPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [contractFile]);
  const [applicant, setApplicant] = useState({
    surname: "",
    givenNames: "",
    fullName: "",
    nationality: "",
    passportNumber: "",
    passportIssueDate: "",
    passportExpiryDate: "",
    idNumber: "",
    phone: "",
    birthDate: "",
    sex: "",
    // "M" | "F" — from passport OCR
    isStudent: null,
    schoolName: "",
    hikoreaId: "",
    webmasterMessage: ""
  });
  const [guarantor, setGuarantor] = useState({
    fullName: "",
    nationality: "",
    sex: "",
    passportNumber: "",
    phone: "",
    relationship: "",
    company: "",
    jobPosition: "",
    workAddress: ""
  });
  const [address, setAddress] = useState("");
  const [provider, setProvider] = useState({
    fullName: "",
    idNumber: "",
    phone: "",
    nationality: ""
  });
  function calculateAge(birthDateString) {
    if (!birthDateString) return 0;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
      age--;
    }
    return age;
  }
  async function runPassportOCR(file) {
    setPassportOcrStatus("loading");
    setPassportOcrError("");
    try {
      const formData = new FormData();
      formData.append("passport", file);
      const res = await fetch("/api/ocr/passport", {
        method: "POST",
        body: formData
      });
      let textRes;
      let json;
      try {
        textRes = await res.text();
        json = JSON.parse(textRes);
      } catch (e) {
        console.error("Non-JSON response:", textRes);
        throw new Error(t("str_0") + e.message);
      }
      if (!res.ok || !json.ok) {
        let msg = json.error || `${t("str_7")}: ${res.status}`;
        if (json.raw) msg += `\nRaw: ${json.raw}`;
        throw new Error(msg);
      }
      const d = json.data;
      // Take given_names as a whole — do NOT split, do NOT take first word only
      const surname = (d.surname || "").trim();
      const givenNames = (d.given_names || d.givenNames || d.given_name || "").trim();
      const assembledFullName = d.full_name || (surname && givenNames ? `${surname} ${givenNames}` : surname || givenNames);
      const extracted = {
        surname: surname,
        givenNames: givenNames,
        fullName: assembledFullName,
        nationality: d.nationality,
        sex: d.sex || "",
        passportNumber: d.passport_number,
        birthDate: d.birth_date,
        passportIssueDate: d.issue_date,
        passportExpiryDate: d.expiry_date
      };
      const hasAnyData = Object.values(extracted).some(v => !!v);
      if (!hasAnyData) {
        throw new Error(t("str_1"));
      }
      const missingFields = {};
      let hasMissing = false;
      for (const key of Object.keys(extracted)) {
        if (!extracted[key]) {
          missingFields[key] = true;
          hasMissing = true;
        }
      }
      setApplicant(prev => ({
        ...prev,
        surname: extracted.surname || prev.surname,
        givenNames: extracted.givenNames || prev.givenNames,
        fullName: extracted.fullName || prev.fullName,
        nationality: extracted.nationality || prev.nationality,
        sex: extracted.sex || prev.sex,
        passportNumber: extracted.passportNumber || prev.passportNumber,
        birthDate: extracted.birthDate || prev.birthDate,
        passportIssueDate: extracted.passportIssueDate || prev.passportIssueDate,
        passportExpiryDate: extracted.passportExpiryDate || prev.passportExpiryDate
      }));
      setOcrFailedFields(missingFields);
      if (hasMissing) {
        setPassportOcrWarning(t("str_2"));
        setPassportOcrStatus("warning");
      } else {
        setPassportOcrWarning("");
        setPassportOcrStatus("success");
      }
    } catch (err) {
      console.error("Passport OCR error:", err);
      setPassportOcrWarning("");
      setPassportOcrError(err.message || t("str_3"));
      setPassportOcrStatus("error");
    }
  }
  async function runIdCardOCR(file) {
    setIdCardOcrStatus("loading");
    setIdCardOcrError("");
    setNameWarning("");
    try {
      const formData = new FormData();
      formData.append("idcard", file);
      const res = await fetch("/api/ocr/idcard", {
        method: "POST",
        body: formData
      });
      let json;
      try {
        json = JSON.parse(await res.text());
      } catch (e) {
        throw new Error(t("str_4"));
      }
      if (!res.ok || !json.ok) {
        throw new Error(t("str_4"));
      }
      const idNumber = (json.data?.id_number || "").trim();
      const fullName = (json.data?.full_name || "").trim();
      const surname = (json.data?.surname || "").trim();
      const givenNames = (json.data?.given_names || "").trim();
      const nationality = (json.data?.nationality || "").trim();

      // Update applicant: always set idNumber if found.
      // For name fields — fill only if passport hasn't filled them yet (prev value is empty).
      setApplicant(prev => ({
        ...prev,
        idNumber: idNumber || prev.idNumber,
        surname: prev.surname || surname,
        givenNames: prev.givenNames || givenNames,
        fullName: prev.fullName || fullName || (surname && givenNames ? `${surname} ${givenNames}` : surname || givenNames),
        nationality: prev.nationality || nationality,
      }));

      if (idNumber) {
        setIdCardOcrStatus("success");
      } else {
        setIdCardOcrStatus("warning");
        setIdCardOcrError(t("str_5"));
      }
    } catch (err) {
      console.error("ID Card OCR error:", err);
      setIdCardOcrError(err.message || t("str_3"));
      setIdCardOcrStatus("error");
    }
  }

  function handleIdCardUpload(file) {
    setIdCardFile(file);
    // Сейчас запускаем только OCR для ID-карты (который заполняет только idNumber и проверяет имя).
    // Если в будущем нужно будет отключить временно OCR, можно закомментировать строку ниже.
    setIdCardOcrStatus("idle");
    runIdCardOCR(file);
  }
  async function runContractAddressOCR(file, manualCrop = null) {
    setAddressOcrStatus("loading");
    setAddressOcrError("");
    try {
      let blob;
      if (manualCrop === "manual") {
        // Blob is already straightened/cropped by ImageEditorModal
        blob = file;
      } else {
        // Auto-crop top 1/3 or use provided rectangular crop
        const crop = manualCrop || {
          x: 0,
          y: 0,
          width: 100,
          height: 33.3
        };
        const tempUrl = URL.createObjectURL(file);
        blob = await cropImageToBlob(tempUrl, crop);
        URL.revokeObjectURL(tempUrl);
      }

      try {
        const fd = new FormData();
        fd.append("image", blob, "crop.jpg");
        fd.append("docType", "contract");
        const scanRes = await fetch("/api/document/process-scan-preview", { method: "POST", body: fd });
        if (scanRes.ok) blob = await scanRes.blob();
      } catch (e) {
        console.warn("Scan processing failed", e);
      }

      const formData = new FormData();
      formData.append("addressImage", blob, "address_crop.jpg");
      const res = await fetch("/api/ocr/contract-address", {
        method: "POST",
        body: formData
      });
      let json;
      try {
        json = JSON.parse(await res.text());
      } catch {
        throw new Error(t("str_6"));
      }
      if (!res.ok || !json.ok) throw new Error(json.error || t("str_7"));
      const recognizedAddress = (json.data?.address || "").trim();
      if (recognizedAddress) {
        setAddress(recognizedAddress);
        setAddressOcrStatus("success");
      } else {
        setAddressOcrStatus("warning");
        setAddressOcrError(t("str_8"));
      }
    } catch (err) {
      console.error("Contract Address OCR error:", err);
      setAddressOcrError(err.message || t("str_3"));
      setAddressOcrStatus("error");
    }
  }
  function dataURLtoBlob(dataurl) {
    if (!dataurl) return null;
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  function appendFilesToFormData(formData) {
    if (passportFile) formData.append("passport", passportFile);
    if (idCardFile) formData.append("idCard", idCardFile);
    if (idCardBackFile) formData.append("idCardBack", idCardBackFile);
    if (contractFile) formData.append("contract", contractFile);
    if (signatureData) {
      const signatureBlob = dataURLtoBlob(signatureData);
      if (signatureBlob) {
        formData.append("signature", signatureBlob, "signature.jpg");
      }
    }
  }

  function getPayload() {
    // Mapping relationship for 신원보증서 (Letter of Guarantee)
    let mappedRelationship = guarantor.relationship;
    if (guarantor.relationship === 'parent') {
      mappedRelationship = guarantor.sex === 'male' ? "부" : "모";
    } else if (guarantor.relationship === 'spouse') {
      mappedRelationship = "배우자";
    }
    return {
      // Applicant
      surname: applicant.surname || "",
      givenNames: applicant.givenNames || "",
      birthDate: applicant.birthDate || "",
      sex: applicant.sex || "",
      nationality: applicant.nationality || "",
      idNumber: applicant.idNumber || "",
      passportNumber: applicant.passportNumber || "",
      passportIssueDate: applicant.passportIssueDate || "",
      passportExpiryDate: applicant.passportExpiryDate || "",
      address: address || "",
      phone: applicant.phone || "",
      isStudent: applicant.isStudent,
      hikoreaId: applicant.hikoreaId || "",
      webmasterMessage: applicant.webmasterMessage || "",
      // Context flags
      visaType,
      action,
      housingType,
      // Signature (for password recovery)
      signature: signatureData || "",
      // Provider (for 거주숙소제공사실확인서)
      providerFullName: provider.fullName || "",
      providerIdNumber: provider.idNumber || "",
      providerPhone: provider.phone || "",
      providerNationality: provider.nationality || "",
      // Guarantor (for 신원보증서, F1 only)
      guarantorFullName: guarantor.fullName || "",
      guarantorNationality: guarantor.nationality || "",
      guarantorSex: guarantor.sex || "",
      guarantorPassportNumber: guarantor.passportNumber || "",
      guarantorPhone: guarantor.phone || "",
      guarantorDob: guarantor.birthDate || "",
      guarantorRelationship: mappedRelationship,
      guarantorCompany: guarantor.company || "",
      guarantorJobPosition: guarantor.jobPosition || "",
      guarantorWorkAddress: guarantor.workAddress || "",
      guaranteePeriod: "",
      // School form
      schoolName: applicant.schoolName || ""
    };
  }
  async function handlePreviewPDF() {
    if (!dataVerified || !termsAccepted) return;
    setPdfStatus("loading");
    setPdfError("");
    try {
      const formData = new FormData();
      formData.append("payload", JSON.stringify(getPayload()));
      appendFilesToFormData(formData);

      const res = await fetch("/api/generate/package-preview", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        let msg = t("str_9");
        try {
          const j = await res.json();
          msg = j.error || msg;
        } catch { }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Вместо window.open (который блокируется), используем скачивание
      const a = document.createElement("a");
      a.href = url;
      a.download = "preview_hikorea.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);
      setPdfStatus("success");
    } catch (err) {
      console.error("PDF Preview error:", err);
      setPdfStatus("error");
      setPdfError(err.message || t("str_10"));
    }
  }
  async function ensureGenerationAccess(actionType) {
    if (!user) {
      setPendingAction(() => actionType);
      setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") || t("auth.authRequiredForGeneration") });
      return false;
    }

    const hasFree = user.freeDownloadsUsed === 0;
    const hasPaid = (user.paidGenerationsRemaining || 0) > 0;

    if (hasFree || hasPaid) {
      return true;
    }

    try {
      const formData = new FormData();
      formData.append("payload", JSON.stringify(getPayload()));
      if (draftId) formData.append("draftId", draftId);
      appendFilesToFormData(formData);
      
      const res = await fetch("/api/generate/package-draft", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.draftId) setDraftId(data.draftId);
      }
    } catch (e) {
      console.error("Draft save failed", e);
    }

    setPendingAction(() => actionType);
    setPaymentModalOpen(true);
    return false;
  }

  async function handleSimulatedPayment() {
    if (!import.meta.env.DEV) return;
    setPaymentProcessing(true);
    try {
      const res = await fetch("/api/payment/mock-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });
      if (!res.ok) throw new Error("Payment simulation failed");
      const data = await res.json();
      if (data.ok && data.user) {
        setUser(data.user);
        setPaymentModalOpen(false);
        if (pendingAction) {
          setTimeout(() => {
            pendingAction();
            setPendingAction(null);
          }, 300);
        }
      }
    } catch (err) {
      console.error(err);
      alert(t("paymentNotCompleted") || t("pay.failed") || "Payment failed. Please try again.");
    } finally {
      setPaymentProcessing(false);
    }
  }

  async function handleDownloadPDF() {
    if (!dataVerified || !termsAccepted) return;
    const access = await ensureGenerationAccess(handleDownloadPDF);
    if (!access) return;

    setPdfStatus("loading");
    setPdfError("");
    try {
      const payload = { ...getPayload() };
      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      appendFilesToFormData(formData);

      const res = await fetch("/api/generate/package-download", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!res.ok) {
        let msg = t("str_11");
        try {
          const j = await res.json();
          if (j.error === "LOGIN_REQUIRED") {
            setPendingAction(() => handleDownloadPDF);
            setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") || t("auth.authRequiredForGeneration") });
            setPdfStatus("idle");
            return;
          }
          if (j.error === "PAYMENT_REQUIRED") {
            setPendingAction(() => handleDownloadPDF);
            setPaymentModalOpen(true);
            setPdfStatus("idle");
            return;
          }
          msg = j.message || msg;
        } catch (e) {
          msg = e.message || msg;
        }
        throw new Error(msg);
      }

      // Keep frontend state strictly consistent with backend balance consumption
      if (user) {
        const isFree = user.freeDownloadsUsed === 0;
        setUser({
          ...user,
          freeDownloadsUsed: isFree ? 1 : user.freeDownloadsUsed,
          paidGenerationsRemaining: isFree ? (user.paidGenerationsRemaining || 0) : Math.max(0, (user.paidGenerationsRemaining || 0) - 1)
        });
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `application_${applicant?.surname || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
      setPdfStatus("success");
      setGenerated(true);
    } catch (err) {
      console.error("PDF Download error:", err);
      setPdfStatus("error");
      setPdfError(err.message || t("str_12"));
    }
  }

  async function handleSendFax() {
    if (!dataVerified || !termsAccepted) return;
    const access = await ensureGenerationAccess(handleSendFax);
    if (!access) return;

    setPdfStatus("loading");
    setPdfError("");
    try {
      const payload = { ...getPayload() };
      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      appendFilesToFormData(formData);

      const res = await fetch("/api/fax/send", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!res.ok) {
        let msg = t("str_11") || "Network response was not ok";
        try {
          const j = await res.json();
          if (j.error === "LOGIN_REQUIRED") {
            setPendingAction(() => handleSendFax);
            setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") || t("auth.authRequiredForGeneration") });
            setPdfStatus("idle");
            return;
          }
          if (j.error === "PAYMENT_REQUIRED") {
            setPendingAction(() => handleSendFax);
            setPaymentModalOpen(true);
            setPdfStatus("idle");
            return;
          }
          msg = j.message || j.error || msg;
        } catch (e) {
          msg = e.message || msg;
        }
        throw new Error(msg);
      }

      if (user) {
        const isFree = user.freeDownloadsUsed === 0;
        setUser({
          ...user,
          freeDownloadsUsed: isFree ? 1 : user.freeDownloadsUsed,
          paidGenerationsRemaining: isFree ? (user.paidGenerationsRemaining || 0) : Math.max(0, (user.paidGenerationsRemaining || 0) - 1)
        });
      }

      await res.json();
      setPdfStatus("success");
      setGenerated(true);
    } catch (err) {
      console.error("Fax Send error:", err);
      setPdfStatus("error");
      setPdfError(err.message || t("str_12"));
    }
  }
  async function runSchoolCertificateOCR(file) {
    setSchoolOcrStatus("loading");
    setSchoolOcrError("");
    try {
      const formData = new FormData();
      formData.append("schoolCertificate", file);
      const res = await fetch("/api/ocr/school-certificate", {
        method: "POST",
        body: formData
      });
      let json;
      try {
        json = JSON.parse(await res.text());
      } catch {
        throw new Error(t("str_13"));
      }
      if (!res.ok || !json.ok) throw new Error(json.error || t("str_7"));
      const schoolName = (json.data?.school_name || "").trim();
      if (schoolName) {
        setApplicant(prev => ({
          ...prev,
          schoolName
        }));
        setSchoolOcrStatus("success");
      } else {
        setSchoolOcrStatus("warning");
        setSchoolOcrError(t("str_14"));
      }
    } catch (err) {
      console.error("School OCR error:", err);
      setSchoolOcrStatus("error");
      setSchoolOcrError(err.message || t("str_15"));
    }
  }

  // Helper: crop image to blob using canvas
  async function cropImageToBlob(previewUrl, crop) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const sx = crop.x / 100 * img.naturalWidth;
        const sy = crop.y / 100 * img.naturalHeight;
        const sw = crop.width / 100 * img.naturalWidth;
        const sh = crop.height / 100 * img.naturalHeight;
        canvas.width = sw;
        canvas.height = sh;
        canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error(t("str_16"))), "image/jpeg", 0.95);
      };
      img.onerror = () => reject(new Error(t("str_17")));
      img.src = previewUrl;
    });
  }
  async function runProviderIdCardOCR(file) {
    setProviderOcrStatus("loading");
    setProviderOcrError("");
    setProviderSource("id");
    try {
      const formData = new FormData();
      formData.append("providerIdCard", file);
      const res = await fetch("/api/ocr/provider-idcard", {
        method: "POST",
        body: formData
      });
      let json;
      try {
        json = JSON.parse(await res.text());
      } catch {
        throw new Error(t("str_13"));
      }
      if (!res.ok || !json.ok) throw new Error(json.error || t("str_7"));
      const d = json.data;
      const hasSome = d.full_name_for_check || d.id_number;
      setProvider(prev => ({
        ...prev,
        fullName: d.full_name_for_check || prev.fullName,
        idNumber: d.id_number || prev.idNumber,
        nationality: d.nationality || prev.nationality
        // phone never touched
      }));
      if (hasSome) {
        setProviderOcrStatus("success");
      } else {
        setProviderOcrStatus("warning");
        setProviderOcrError(t("str_18"));
      }
    } catch (err) {
      console.error("Provider ID Card OCR error:", err);
      setProviderOcrStatus("error");
      setProviderOcrError(err.message || t("str_15"));
    }
  }
  async function runProviderContractOCR(cropOrBlob) {
    setProviderOcrStatus("loading");
    setProviderOcrError("");
    setProviderSource("contract");
    try {
      let blob;
      if (cropOrBlob instanceof Blob || cropOrBlob instanceof File) {
        blob = cropOrBlob;
      } else {
        blob = await cropImageToBlob(contractPreviewUrl, cropOrBlob);
      }

      try {
        const fd = new FormData();
        fd.append("image", blob, "crop.jpg");
        fd.append("docType", "contract");
        const scanRes = await fetch("/api/document/process-scan-preview", { method: "POST", body: fd });
        if (scanRes.ok) blob = await scanRes.blob();
      } catch (e) {
        console.warn("Scan processing failed", e);
      }

      const formData = new FormData();
      formData.append("providerImage", blob, "provider_crop.jpg");
      const res = await fetch("/api/ocr/provider-contract", {
        method: "POST",
        body: formData
      });
      let json;
      try {
        json = JSON.parse(await res.text());
      } catch {
        throw new Error(t("str_13"));
      }
      if (!res.ok || !json.ok) throw new Error(json.error || t("str_7"));
      const d = json.data;
      const hasSome = d.full_name || d.id_number || d.phone;
      setProvider(prev => ({
        ...prev,
        fullName: d.full_name || prev.fullName,
        idNumber: d.id_number || prev.idNumber,
        phone: d.phone || prev.phone,
        nationality: d.nationality || prev.nationality
      }));
      const hasPhone = !!(d.phone || provider.phone);
      if (hasSome && hasPhone) {
        setProviderOcrStatus("success");
      } else if (hasSome) {
        setProviderOcrStatus("warning");
        setProviderOcrError(t("str_19"));
      } else {
        setProviderOcrStatus("warning");
        setProviderOcrError(t("str_18"));
      }
    } catch (err) {
      console.error("Provider Contract OCR error:", err);
      setProviderOcrStatus("error");
      setProviderOcrError(err.message || t("str_15"));
    }
  }
  async function runGuarantorPassportOCR(file) {
    setGuarantorOcrStatus("loading");
    setGuarantorOcrError("");
    try {
      const formData = new FormData();
      formData.append("passport", file);
      const res = await fetch("/api/ocr/passport", {
        method: "POST",
        body: formData
      });
      let textRes;
      let json;
      try {
        textRes = await res.text();
        json = JSON.parse(textRes);
      } catch (e) {
        throw new Error(t("str_13") + e.message);
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `${t("str_7")}: ${res.status}`);
      }
      const d = json.data;
      // Same logic as applicant: take full given_names string, no split
      const surname = (d.surname || "").trim();
      const givenNames = (d.given_names || d.givenNames || d.given_name || "").trim();
      const fullName = d.full_name || (surname && givenNames ? `${surname} ${givenNames}` : surname || givenNames);
      const hasAnyData = !!(surname || givenNames || d.nationality || d.passport_number);
      if (!hasAnyData) {
        throw new Error(t("str_20"));
      }

      // Normalize sex to lowercase male/female for frontend consistency
      let normalizedSex = "";
      if (d.sex) {
        const s = d.sex.toLowerCase();
        if (s.startsWith('m')) normalizedSex = 'male'; else if (s.startsWith('f')) normalizedSex = 'female';
      }

      // Fill only guarantor — never touch applicant
      setGuarantor(prev => ({
        ...prev,
        fullName: fullName || prev.fullName,
        nationality: d.nationality || prev.nationality,
        sex: normalizedSex || prev.sex,
        passportNumber: d.passport_number || prev.passportNumber,
        birthDate: d.birth_date || d.birthDate || prev.birthDate
      }));
      const hasMissing = !(fullName && d.nationality && d.sex && d.passport_number);
      if (hasMissing) {
        setGuarantorOcrStatus("warning");
        setGuarantorOcrError(t("str_21"));
      } else {
        setGuarantorOcrStatus("success");
      }
    } catch (err) {
      console.error("Guarantor Passport OCR error:", err);
      setGuarantorOcrStatus("error");
      setGuarantorOcrError(err.message || t("str_15"));
    }
  }
  function mockAddressOCR() {
    setAddress("인천광역시 미추홀구 숭의동 283-9 제1층 제104호");
    setAddressSelected(true);
  }
  function mockProviderFromId() {
    setProviderSource("id");
    setProvider({
      fullName: "KIM MINSU",
      idNumber: "800101-5123456",
      phone: ""
    });
  }
  function mockProviderFromContract() {
    setProviderSource("contract");
    setProvider({
      fullName: "KIM MINSU",
      idNumber: "800101",
      phone: "010-1234-5678"
    });
  }
  function mockGuarantorOCR() {/* replaced by runGuarantorPassportOCR */ }
  function mockProviderFromGuarantor() {
    setProviderSource("guarantor");
    setProvider({
      fullName: guarantor.fullName,
      idNumber: guarantor.passportNumber || guarantor.idNumber || "",
      phone: guarantor.phone,
      nationality: guarantor.nationality || ""
    });
  }
  const getStepsConfig = () => {
    let config = [{
      id: "visa",
      label: t("str_22")
    }, {
      id: "action",
      label: t("str_23")
    }];
    if (action === "password_recovery") {
      config.push({
        id: "applicant",
        label: t("str_25")
      });
      config.push({
        id: "generate",
        label: t("str_29")
      });
      return config;
    }
    config.push({
      id: "housing",
      label: t("str_24")
    });
    config.push({
      id: "applicant",
      label: t("str_25")
    });
    if (visaType === "F1") {
      config.push({
        id: "guarantor",
        label: t("str_26")
      });
    }
    config.push({
      id: "address",
      label: t("str_27")
    });
    config.push({
      id: "provider",
      label: t("str_28")
    });
    config.push({
      id: "generate",
      label: t("str_29")
    });
    return config;
  };
  const activeStepsConfig = getStepsConfig();
  const stepIndex = activeStepsConfig.findIndex(s => s.id === step);
  const currentStepLabel = activeStepsConfig[stepIndex]?.label;
  const totalSteps = activeStepsConfig.length;
  const goBack = () => {
    window.history.back();
  };
  const isApplicantValid = () => {
    if (action === "password_recovery") {
      const hasBasicInfo = applicant.surname && applicant.givenNames && applicant.nationality && applicant.idNumber && applicant.phone && applicant.birthDate && address;
      const hasIdCardFiles = idCardFile && idCardBackFile;
      const hasSignature = !!signatureData;
      return !!(hasBasicInfo && hasIdCardFiles && hasSignature);
    }
    const baseValid = applicant.fullName && applicant.nationality && applicant.passportNumber && applicant.passportIssueDate && applicant.passportExpiryDate && applicant.phone;
    if (action !== "address_change") {
      if (applicant.isStudent === null) return false;
      if (applicant.isStudent && !applicant.schoolName) return false;
    }
    return baseValid;
  };
  const canGenerateSelf = isApplicantValid() && address;
  const canGenerateOther = canGenerateSelf && provider.fullName && provider.phone && provider.idNumber && provider.nationality;
  return <>
    {/* ── Image Editor Modal (full-screen) ── */}
    {editorState && <ImageEditorModal file={editorState.file} docType={editorState.docType} aspectRatio={editorState.aspectRatio} helperText={editorState.helperText} onSave={handleEditorSave} onCancel={() => setEditorState(null)} />}
    {adjustState && <ImageAdjustmentModal imageSrc={adjustState.imageSrc} onSave={handleAdjustSave} onCancel={adjustState.onCancel} />}

    {/* ── Admin Panel (full-screen fixed overlay) ── */}
    {showAdmin && (
      <div className="fixed inset-0 z-[500] bg-[#f7f7f5] overflow-y-auto">
        <AdminPanel user={user} onBack={() => setShowAdmin(false)} />
      </div>
    )}
    <div className="min-h-screen bg-[#f7f7f5] text-[#2f3437] px-4 py-6 md:py-10 font-sans flex flex-col items-center">
      {/* ── Top Navigation Bar ── */}
      <nav className="w-full max-w-3xl mb-4 flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setStep("visa");
              navigateToStep("visa", true);
            }}
            className="text-lg font-bold bg-gradient-to-r from-[#1a1c1d] to-[#43474b] bg-clip-text text-transparent"
          >
            {t('appTitle')}
          </button>
        </div>

        <div className="flex items-center flex-wrap gap-2 md:gap-4">
          {user ? (
            <>
              <div className="hidden md:block text-sm text-[#5f6368] font-medium mr-2">
                {user.name || user.email}
              </div>
              <button
                onClick={() => navigateToStep("my-page")}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 border ${step === "my-page"
                    ? "bg-[#2f3437] text-white border-[#2f3437]"
                    : "bg-white text-[#2f3437] border-[#e7e5e2] hover:bg-[#f7f7f5]"
                  }`}
              >
                {t('nav.myPage')}
              </button>
              <button
                onClick={() => navigateToStep("my-page")}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-white text-[#2f3437] border border-[#e7e5e2] hover:bg-[#f7f7f5] transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                {t('nav.cart')}
                {myPagePackages.filter(p => p.paymentStatus === 'unpaid').length > 0 && (
                  <span className="ml-1 bg-[#d93025] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {myPagePackages.filter(p => p.paymentStatus === 'unpaid').length}
                  </span>
                )}
              </button>
              {(visaType || action || applicant.fullName) && step !== "my-page" && (
                <button
                  onClick={() => startOver()}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold bg-white text-[#d93025] border border-[#f5c6cb] hover:bg-[#fff5f5] transition-all"
                >
                  {t('nav.startOver')}
                </button>
              )}
              <button
                onClick={logout}
                className="px-4 py-1.5 rounded-full text-sm font-semibold bg-white text-[#5f6368] border border-[#e7e5e2] hover:bg-[#f7f7f5] transition-all"
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={() => setAuthModal({ open: true, type: "login" })} className="text-sm font-bold text-[#5f6368] hover:text-[#111111] transition-colors hidden sm:block">{t('auth.signIn')}</button>
              <button onClick={() => setAuthModal({ open: true, type: "register" })} className="px-4 py-1.5 rounded-full bg-[#111111] text-white text-sm font-bold hover:bg-[#2f3437] transition-all whitespace-nowrap hidden sm:block">{t('auth.createAccount')}</button>
              <button
                onClick={() => setAuthModal({ open: true, type: "login" })}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white text-[#2f3437] border border-[#e7e5e2] hover:shadow-md transition-all text-sm font-bold sm:hidden"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="w-full max-w-3xl space-y-6">
        <header className="bg-white border border-[#e7e5e2] rounded-[24px] px-6 py-8 md:px-10 shadow-sm text-center flex flex-col items-center relative">
          <div className="absolute top-4 right-4 flex bg-[#f7f7f5] rounded-full p-1 border border-[#e7e5e2]">
            {['ru', 'en', 'ko'].map(lang => (
              <button
                key={lang}
                onClick={() => {
                  i18n.changeLanguage(lang);
                  localStorage.setItem('appLanguage', lang);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium uppercase transition ${i18n.language === lang
                    ? 'bg-white text-[#111111] shadow-sm'
                    : 'text-[#787774] hover:text-[#111111]'
                  }`}
              >
                {lang}
              </button>
            ))}
          </div>
          <div className="mb-6 mt-2">
            <img src="/logo.png" alt="HiKoreaForms" className="h-24 md:h-28 w-auto mx-auto object-contain mix-blend-multiply" />
          </div>
          <h1 className="text-[28px] md:text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#111111]">{t("str_30")}<br />{t("str_31")}</h1>
          <p className="text-[#787774] mt-3 leading-relaxed text-sm md:text-base max-w-lg">{t("str_32")}</p>
        </header>

        <div className="flex items-center justify-between px-2">
          {step !== "visa" ? <button onClick={goBack} className="flex items-center gap-2 text-[#787774] hover:text-[#111111] transition font-medium text-sm py-2 px-3 rounded-lg hover:bg-[#ebebe9]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>{t("str_33")}</button> : <div />}

          <div className="flex items-center gap-2 text-sm font-medium text-[#787774] bg-white border border-[#e7e5e2] py-2 px-4 rounded-full shadow-sm cursor-pointer hover:bg-[#fbfbfa] transition">
            <span className="text-[#111111]">{t("str_34")}{stepIndex + 1}</span>
            <span className="opacity-50">{t("str_35")}{totalSteps}</span>
            <span className="w-1 h-1 rounded-full bg-[#d9d7d3] mx-1" />
            <span className="hidden sm:inline">{currentStepLabel}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-1 opacity-50"><path d="m6 9 6 6 6-6" /></svg>
          </div>
        </div>

        {step !== "my-page" && (
          <main className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">


            {step === "visa" && <Card title={t("str_22")} subtitle={t("str_36")}>
              <div className="grid md:grid-cols-3 gap-4">
                <OptionCard label="F-4" description={t("str_37")} tag={t("str_38")} selected={visaType === "F4"} onClick={() => {
                  setVisaType("F4");
                  navigateToStep("action");
                }} />
                <OptionCard label="F-1" description={t("str_39")} tag={t("str_38")} selected={visaType === "F1"} onClick={() => {
                  setVisaType("F1");
                  navigateToStep("action");
                }} />
                <OptionCard label={t("str_40")} description={t("str_41")} tag={t("str_38")} selected={visaType === "Other"} onClick={() => {
                  setVisaType("Other");
                  navigateToStep("action");
                }} />
              </div>
            </Card>}

            {step === "action" && <Card title={t("str_42")} subtitle={t("str_43")}>
              <div className="grid md:grid-cols-3 gap-4">
                <OptionCard label={t("str_44")} description={t("str_45")} selected={action === "extension"} onClick={() => {
                  setAction("extension");
                  navigateToStep("housing");
                }} />
                <OptionCard label={t("str_46")} description={t("str_47")} selected={action === "address_change"} onClick={() => {
                  setAction("address_change");
                  navigateToStep("housing");
                }} />
                <OptionCard label={t("action.password_recovery")} description={t("action.password_recovery_desc")} selected={action === "password_recovery"} onClick={() => {
                  setAction("password_recovery");
                  navigateToStep("applicant");
                }} />
              </div>
            </Card>}

            {step === "housing" && <Card title={t("str_48")} subtitle={t("str_49")}>
              <div className="grid md:grid-cols-2 gap-4">
                <OptionCard label={t("str_50")} description={t("str_51")} onClick={() => {
                  setHousingType("self");
                  navigateToStep("applicant");
                }} />
                <OptionCard label={t("str_52")} description={t("str_53")} onClick={() => {
                  setHousingType("other");
                  navigateToStep("applicant");
                }} />
              </div>
            </Card>}

            {step === "applicant" && <Card title={t("str_25")} subtitle={t("str_54")}>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {action !== "password_recovery" && (
                  <UploadBox title={t("str_55")} note={t("str_56")} file={passportFile} ocrStatus={passportOcrStatus} ocrError={passportOcrError} onAdjust={() => openAdjuster(passportFile, blob => {
                    const f = new File([blob], passportFile.name, { type: "image/jpeg" });
                    setPassportFile(f);
                    runPassportOCR(f);
                  })} onFile={file => {
                    openEditor(file, 1.42, t("crop.passportHint"), blob => {
                      const f = new File([blob], file.name, {
                        type: "image/jpeg"
                      });
                      setPassportFile(f);
                      setPassportOcrStatus("idle");
                      setPassportOcrWarning("");
                      setOcrFailedFields({});
                      runPassportOCR(f);
                    }, "passport");
                  }} />
                )}
                
                <UploadBox title={action === "password_recovery" ? `${t("str_58")} (${t("str_59")})` : t("str_58")} note={t("str_59")} file={idCardFile} ocrStatus={idCardOcrStatus} ocrError={idCardOcrError} onAdjust={() => openAdjuster(idCardFile, blob => {
                  const f = new File([blob], idCardFile.name, { type: "image/jpeg" });
                  setIdCardFile(f);
                  runIdCardOCR(f);
                })} onFile={file => {
                  openEditor(file, 1.586, t("crop.idCardHint"), blob => {
                    const f = new File([blob], file.name, {
                      type: "image/jpeg"
                    });
                    handleIdCardUpload(f);
                  }, "idcard");
                }} />

                {action === "password_recovery" && (
                  <UploadBox title={t("upload.idCardBack")} note={t("upload.idCardBackNote")} file={idCardBackFile} ocrStatus="idle" onAdjust={() => openAdjuster(idCardBackFile, blob => {
                    const f = new File([blob], idCardBackFile.name, { type: "image/jpeg" });
                    setIdCardBackFile(f);
                  })} onFile={file => {
                    openEditor(file, 1.586, t("upload.idCardBackHint"), blob => {
                      const f = new File([blob], file.name, {
                        type: "image/jpeg"
                      });
                      setIdCardBackFile(f);
                    }, "idcard");
                  }} />
                )}
              </div>

              {(nameWarning || passportOcrWarning) && <div className="mb-6 space-y-3">
                {passportOcrWarning && <div className="p-4 rounded-xl bg-[#fff8e6] border border-[#f5d996] text-[#8a6100] text-[14px] flex items-start gap-3 animate-in fade-in">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <div>{passportOcrWarning}</div>
                </div>}
                {nameWarning && <div className="p-4 rounded-xl bg-[#fff8e6] border border-[#f5d996] text-[#8a6100] text-[14px] flex items-start gap-3 animate-in fade-in">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <div>{nameWarning}</div>
                </div>}
              </div>}

              <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[18px] p-6 mb-6">
                <FieldGrid cols="2">
                  <Input label={t("str_61")} value={applicant.surname} onChange={v => {
                    setApplicant({
                      ...applicant,
                      surname: v,
                      fullName: (v + " " + applicant.givenNames).trim()
                    });
                    if (ocrFailedFields.surname) setOcrFailedFields({
                      ...ocrFailedFields,
                      surname: false
                    });
                  }} required helperText={ocrFailedFields.surname && !applicant.surname ? t("str_62") : ""} />
                  <Input label={t("str_63")} value={applicant.givenNames} onChange={v => {
                    setApplicant({
                      ...applicant,
                      givenNames: v,
                      fullName: (applicant.surname + " " + v).trim()
                    });
                    if (ocrFailedFields.givenNames) setOcrFailedFields({
                      ...ocrFailedFields,
                      givenNames: false
                    });
                  }} required helperText={ocrFailedFields.givenNames && !applicant.givenNames ? t("str_62") : ""} />
                  <Input label={t("str_64")} value={applicant.nationality} onChange={v => {
                    setApplicant({
                      ...applicant,
                      nationality: v
                    });
                    if (ocrFailedFields.nationality) setOcrFailedFields({
                      ...ocrFailedFields,
                      nationality: false
                    });
                  }} required helperText={ocrFailedFields.nationality && !applicant.nationality ? t("str_62") : ""} />
                  {action !== "password_recovery" && (
                    <Input label={t("str_65")} value={applicant.passportNumber} onChange={v => {
                      setApplicant({
                        ...applicant,
                        passportNumber: v
                      });
                      if (ocrFailedFields.passportNumber) setOcrFailedFields({
                        ...ocrFailedFields,
                        passportNumber: false
                      });
                    }} required helperText={ocrFailedFields.passportNumber && !applicant.passportNumber ? t("str_62") : ""} />
                  )}
                  <Input label={t("str_66")} value={applicant.idNumber} onChange={v => setApplicant({
                    ...applicant,
                    idNumber: v
                  })} placeholder={t("str_67")} required={action === "password_recovery"} />
                  {action !== "password_recovery" && (
                    <>
                      <Input label={t("str_68")} value={applicant.passportIssueDate} onChange={v => {
                        setApplicant({
                          ...applicant,
                          passportIssueDate: v
                        });
                        if (ocrFailedFields.passportIssueDate) setOcrFailedFields({
                          ...ocrFailedFields,
                          passportIssueDate: false
                        });
                      }} placeholder="YYYY-MM-DD" required helperText={ocrFailedFields.passportIssueDate && !applicant.passportIssueDate ? t("str_62") : ""} />
                      <Input label={t("str_69")} value={applicant.passportExpiryDate} onChange={v => {
                        setApplicant({
                          ...applicant,
                          passportExpiryDate: v
                        });
                        if (ocrFailedFields.passportExpiryDate) setOcrFailedFields({
                          ...ocrFailedFields,
                          passportExpiryDate: false
                        });
                      }} placeholder="YYYY-MM-DD" required helperText={ocrFailedFields.passportExpiryDate && !applicant.passportExpiryDate ? t("str_62") : ""} />
                    </>
                  )}
                  <Input label={t("str_70")} value={applicant.phone} onChange={v => setApplicant({
                    ...applicant,
                    phone: v
                  })} required helperText={t("str_71")} />
                  <Input label={t("str_72")} value={applicant.birthDate} onChange={v => {
                    setApplicant({
                      ...applicant,
                      birthDate: v
                    });
                    if (ocrFailedFields.birthDate) setOcrFailedFields({
                      ...ocrFailedFields,
                      birthDate: false
                    });
                  }} placeholder="YYYY-MM-DD" required helperText={ocrFailedFields.birthDate && !applicant.birthDate ? t("str_62") : ""} />
                  {action === "password_recovery" && (
                    <>
                      <Input label={t("applicant.hikoreaId")} value={applicant.hikoreaId} onChange={v => setApplicant({
                        ...applicant,
                        hikoreaId: v
                      })} placeholder="HiKorea ID" />
                      <Input label={t("nav.address")} value={address} onChange={setAddress} required placeholder={t("str_122")} />
                      <Input label={t("applicant.webmasterMessage")} value={applicant.webmasterMessage} onChange={v => setApplicant({
                        ...applicant,
                        webmasterMessage: v
                      })} placeholder={t("applicant.webmasterMessage")} />
                    </>
                  )}
                </FieldGrid>
              </div>

              {action !== "address_change" && action !== "password_recovery" && <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[18px] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#111111]">{t("str_73")}</h3>
                    <p className="text-[13px] text-[#787774] mt-0.5">{t("str_74")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setApplicant({
                      ...applicant,
                      isStudent: true
                    })} className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium rounded-xl border transition ${applicant.isStudent === true ? "bg-[#111111] text-white border-[#111111]" : "bg-white text-[#37352f] border-[#d9d7d3] hover:bg-[#f1f1ef]"}`}>{t("str_75")}</button>
                    <button onClick={() => setApplicant({
                      ...applicant,
                      isStudent: false,
                      schoolName: ""
                    })} className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium rounded-xl border transition ${applicant.isStudent === false ? "bg-[#111111] text-white border-[#111111]" : "bg-white text-[#37352f] border-[#d9d7d3] hover:bg-[#f1f1ef]"}`}>{t("str_76")}</button>
                  </div>
                </div>

                {applicant.isStudent === true && <div className="mt-4 pt-4 border-t border-[#e7e5e2] animate-in fade-in slide-in-from-top-2">
                  <div className="flex flex-col gap-4">
                    <Input label={t("str_77")} value={applicant.schoolName || ""} onChange={v => setApplicant({
                      ...applicant,
                      schoolName: v
                    })} required />

                    <div className="bg-white border border-[#e7e5e2] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="text-sm text-[#787774] leading-relaxed">{t("str_78")}</div>
                      <label className="h-[48px] px-6 bg-[#111] text-white text-sm font-medium rounded-xl hover:bg-[#2f2f2f] transition flex items-center justify-center cursor-pointer shrink-0">
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            openEditor(file, null, t("crop.schoolHint"), blob => {
                              const f = new File([blob], file.name, {
                                type: "image/jpeg"
                              });
                              setSchoolFile(f);
                              setSchoolOcrStatus("idle");
                              runSchoolCertificateOCR(f);
                            }, "school");
                          }
                        }} />
                        {schoolFile ? t("str_80") : t("str_81")}
                      </label>
                    </div>
                  </div>

                  {/* School OCR status */}
                  {schoolOcrStatus === "loading" && <div className="flex items-center gap-2 mt-3 text-[13px] text-[#4f7cff]">
                    <svg className="animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>{t("str_82")}</div>}
                  {schoolOcrStatus === "success" && <div className="flex items-center gap-2 mt-3 text-[13px] text-[#1a7a3a]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>{t("str_83")}</div>}
                  {(schoolOcrStatus === "warning" || schoolOcrStatus === "error") && schoolOcrError && <div className="flex items-center gap-2 mt-3 text-[13px] text-[#8a6100]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    {schoolOcrError}
                  </div>}
                </div>}
              </div>}

              {action === "password_recovery" && (
                <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[18px] p-6 mb-6">
                  <SignaturePad value={signatureData} onChange={setSignatureData} />
                </div>
              )}

              <NextButton onClick={() => navigateToStep(action === "password_recovery" ? "generate" : (visaType === "F1" ? "guarantor" : "address"))} disabled={!isApplicantValid()}>
                {action === "password_recovery" ? t("gen.generate") : (visaType === "F1" ? t("str_84") : t("str_85"))}
              </NextButton>
            </Card>}

            {step === "guarantor" && <Card title={t("str_86")} subtitle={t("str_87")}>
              <div className="mb-4">
                <UploadBox title={t("str_88")} note={t("str_89")} file={guarantorFile} onAdjust={() => openAdjuster(guarantorFile, blob => {
                  const f = new File([blob], guarantorFile.name, { type: "image/jpeg" });
                  setGuarantorFile(f);
                  runGuarantorOCR(f);
                })} onFile={file => {
                  openEditor(file, 1.42, t("crop.passportHint"), blob => {
                    const f = new File([blob], file.name, {
                      type: "image/jpeg"
                    });
                    setGuarantorFile(f);
                    setGuarantorOcrStatus("idle");
                    runGuarantorPassportOCR(f);
                  }, "passport");
                }} />
              </div>

              {/* Guarantor OCR status */}
              {guarantorOcrStatus === "loading" && <div className="flex items-center gap-3 p-4 rounded-xl bg-[#eef2ff] border border-[#c7d5fb] text-[#4f7cff] text-[14px] mb-4">
                <svg className="animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>{t("str_91")}</div>}
              {guarantorOcrStatus === "success" && <div className="flex items-center gap-3 p-4 rounded-xl bg-[#e8f9ed] border border-[#a8e6bc] text-[#1a7a3a] text-[14px] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>{t("str_92")}</div>}
              {(guarantorOcrStatus === "warning" || guarantorOcrStatus === "error") && guarantorOcrError && <div className="flex items-center gap-3 p-4 rounded-xl bg-[#fff8e6] border border-[#f5d996] text-[#8a6100] text-[14px] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                {guarantorOcrError}
              </div>}

              <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[18px] p-6 mb-6">
                <h3 className="text-sm font-semibold text-[#111111] uppercase tracking-wider mb-4">{t("str_93")}</h3>
                <FieldGrid cols="2">
                  <Input label={t("str_94")} value={guarantor.fullName} onChange={v => setGuarantor({
                    ...guarantor,
                    fullName: v
                  })} required />
                  <Input label={t("str_95")} value={guarantor.nationality} onChange={v => setGuarantor({
                    ...guarantor,
                    nationality: v
                  })} required />

                  <div className="flex flex-col justify-center">
                    <span className="block text-[13px] font-semibold text-[#787774] mb-2 ml-1">{t("str_96")}<span className="text-red-400">*</span></span>
                    <div className="flex gap-4 px-1">
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="sex" value="male" checked={guarantor.sex === 'male'} onChange={e => setGuarantor({
                        ...guarantor,
                        sex: e.target.value
                      })} className="w-4 h-4 accent-[#111111]" />{t("str_97")}</label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="sex" value="female" checked={guarantor.sex === 'female'} onChange={e => setGuarantor({
                        ...guarantor,
                        sex: e.target.value
                      })} className="w-4 h-4 accent-[#111111]" />{t("str_98")}</label>
                    </div>
                  </div>

                  <Input label={t("str_99")} value={guarantor.passportNumber} onChange={v => setGuarantor({
                    ...guarantor,
                    passportNumber: v
                  })} required />
                  <Input label={t("str_100")} value={guarantor.phone} onChange={v => setGuarantor({
                    ...guarantor,
                    phone: v
                  })} required />

                  <Select label={t("str_101")} value={guarantor.relationship} onChange={v => setGuarantor({
                    ...guarantor,
                    relationship: v
                  })} required options={[{
                    value: "spouse",
                    label: t("str_102")
                  }, {
                    value: "parent",
                    label: t("str_103")
                  }, {
                    value: "other",
                    label: t("str_104")
                  }]} />
                </FieldGrid>
              </div>

              <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[18px] p-6">
                <h3 className="text-sm font-semibold text-[#111111] uppercase tracking-wider mb-4">{t("str_105")}</h3>
                <FieldGrid cols="2">
                  <Input label={t("str_106")} value={guarantor.company} onChange={v => setGuarantor({
                    ...guarantor,
                    company: v
                  })} required={guarantor.relationship === 'other'} />
                  <Input label={t("str_107")} value={guarantor.jobPosition} onChange={v => setGuarantor({
                    ...guarantor,
                    jobPosition: v
                  })} required={guarantor.relationship === 'other'} />
                </FieldGrid>
                <div className="mt-4">
                  <Input label={t("str_108")} value={guarantor.workAddress} onChange={v => setGuarantor({
                    ...guarantor,
                    workAddress: v
                  })} required={guarantor.relationship === 'other'} />
                </div>
              </div>

              <NextButton onClick={() => navigateToStep("address")} disabled={!(guarantor.fullName && guarantor.nationality && guarantor.sex && guarantor.passportNumber && guarantor.phone && guarantor.relationship && (guarantor.relationship !== 'other' || guarantor.company && guarantor.jobPosition && guarantor.workAddress))}>{t("str_85")}</NextButton>
            </Card>}

            {step === "address" && <Card title={t("str_27")} subtitle={t("str_109")}>

              <div className="space-y-6">
                {/* Upload Section */}
                <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[24px] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15px] font-semibold text-[#111111]">{t("str_110")}</h3>
                    {contractFile && <button onClick={() => {
                      setContractFile(null);
                      setContractUploaded(false);
                      setAddressOcrStatus("idle");
                    }} className="text-[12px] text-[#e07a7a] hover:text-[#c0504d] font-medium">{t("str_111")}</button>}
                  </div>

                  {!contractUploaded ? <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#d9d7d3] rounded-[20px] p-8 bg-white hover:bg-[#f8f8f6] transition-all cursor-pointer group">
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        openEditor(file, 1.414, t("crop.contractHint"), blob => {
                          const f = new File([blob], file.name, { type: "image/jpeg" });
                          setContractFile(f);
                          setContractUploaded(true);
                          setContractPreviewUrl(URL.createObjectURL(f));
                          runContractAddressOCR(f, "manual");
                        }, "contract");
                      }
                    }} />
                    <div className="w-12 h-12 bg-[#f1f1ef] rounded-full flex items-center justify-center mb-3 text-[#787774] group-hover:scale-110 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                    </div>
                    <div className="text-[15px] font-semibold text-[#111111] mb-1 text-center">{t("str_112")}</div>
                    <div className="text-[12px] text-[#787774] text-center leading-relaxed">{t("str_113")}<br />{t("str_114")}</div>
                  </label> : <div className="space-y-4">
                    <div className="relative rounded-[20px] overflow-hidden border border-[#e7e5e2] bg-[#f0f0ee]">
                      {contractPreviewUrl && <>
                        <img src={contractPreviewUrl} alt={t("str_115")} onClick={() => {
                          openAdjuster(contractFile, blob => {
                            const f = new File([blob], contractFile.name, { type: "image/jpeg" });
                            setContractFile(f);
                            setContractPreviewUrl(URL.createObjectURL(f));
                            runContractAddressOCR(f, "manual");
                          });
                        }} className="w-full h-[200px] object-contain cursor-pointer hover:opacity-90 transition-opacity" />
                        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                          <div
                            className="bg-[#111]/70 backdrop-blur-sm text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm cursor-pointer hover:bg-[#111] transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAdjuster(contractFile, blob => {
                                const f = new File([blob], contractFile.name, { type: "image/jpeg" });
                                setContractFile(f);
                                setContractPreviewUrl(URL.createObjectURL(f));
                                runContractAddressOCR(f, "manual");
                              });
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                            <span className="text-[9px] font-medium uppercase tracking-wide">{t("adjust.adjustImage")}</span>
                          </div>
                          <div
                            className="bg-white/90 backdrop-blur-sm text-[#111] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm cursor-pointer hover:bg-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              document.getElementById('contractUpload').click();
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                            <span className="text-[9px] font-medium uppercase tracking-wide">{t("str_167")}</span>
                          </div>
                        </div>
                      </>}
                      {addressOcrStatus === "loading" && <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-[2px]">
                        <svg className="animate-spin text-white mb-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        <span className="text-white text-xs font-semibold">{t("str_116")}</span>
                      </div>}
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button onClick={() => {
                          openEditor(contractFile, 1.414, t("crop.contractHint"), blob => {
                            const f = new File([blob], contractFile.name, { type: "image/jpeg" });
                            setContractFile(f);
                            setContractPreviewUrl(URL.createObjectURL(f));
                            runContractAddressOCR(f, "manual");
                          }, "contract");
                        }} className="px-3 py-1.5 bg-white/90 backdrop-blur shadow-sm border border-[#d9d7d3] rounded-lg text-[11px] font-semibold text-[#111] hover:bg-white">{t("str_117")}</button>
                      </div>
                    </div>

                    {addressOcrStatus === "success" && <div className="flex items-center gap-2.5 px-4 py-2 bg-[#e8f9ed] border border-[#a8e6bc] text-[#1a7a3a] text-[13px] rounded-xl">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>{t("str_119")}</div>}

                    {(addressOcrStatus === "warning" || addressOcrStatus === "error") && <div className="flex items-start gap-2.5 px-4 py-3 bg-[#fff8e6] border border-[#f5d996] text-[#8a6100] text-[13px] rounded-xl leading-snug">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                      {addressOcrError || t("str_120")}
                    </div>}
                  </div>}
                </div>

                {/* Manual Entry Section */}
                <div className="bg-white border border-[#e7e5e2] rounded-[24px] p-6 shadow-sm">
                  <Textarea label={t("str_121")} placeholder={t("str_122")} value={address} onChange={setAddress} />
                  <p className="text-[12px] text-[#787774] mt-3 ml-1 leading-relaxed">{t("str_123")}</p>
                </div>
              </div>

              <NextButton onClick={() => navigateToStep(housingType === "self" ? "generate" : "provider")} disabled={!address.trim() || addressOcrStatus === "loading"}>
                {housingType === "self" ? t("str_124") : t("str_125")}
              </NextButton>
            </Card>}

            {step === "provider" && <Card title={t("str_28")} subtitle={t("str_126")}>

              {/* Option cards */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {/* Option 1: Upload provider ID card */}
                <label className="cursor-pointer">
                  <div className={`border-2 rounded-[20px] p-5 transition-all ${providerSource === "id" ? "border-[#111] bg-[#f8f8f6]" : "border-[#e7e5e2] bg-white hover:bg-[#f8f8f6]"}`}>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        openEditor(file, 1.586, t("crop.idCardHint"), blob => {
                          const f = new File([blob], file.name, {
                            type: "image/jpeg"
                          });
                          setProviderIdFile(f);
                          setProviderOcrStatus("idle");
                          runProviderIdCardOCR(f);
                        }, "idcard");
                      }
                    }} />
                    <div className="text-[15px] font-semibold text-[#111111] mb-1">
                      {providerIdFile ? <span className="text-[#1a7a3a]">✓ {providerIdFile.name.substring(0, 22)}…</span> : t("str_128")}
                    </div>
                    <div className="text-[13px] text-[#787774]">{t("str_129")}</div>
                  </div>
                </label>

                {/* Option 2: Select area in contract */}
                {contractPreviewUrl && <div className={`border-2 rounded-[20px] p-5 cursor-pointer transition-all ${providerSource === "contract" ? "border-[#111] bg-[#f8f8f6]" : "border-[#e7e5e2] bg-white hover:bg-[#f8f8f6]"}`} onClick={() => {
                  openEditor(contractFile, 1.414, t("crop.contractHint"), blob => {
                    const f = new File([blob], contractFile.name, { type: "image/jpeg" });
                    setProviderOcrStatus("idle");
                    runProviderContractOCR(f);
                  }, "contract");
                }}>
                  <div className="text-[15px] font-semibold text-[#111111] mb-1">{t("str_130")}</div>
                  <div className="text-[13px] text-[#787774]">{t("str_131")}</div>
                </div>}

                {visaType === "F1" && <div className={`border-2 rounded-[20px] p-5 cursor-pointer transition-all ${providerSource === "guarantor" ? "border-[#111] bg-[#f8f8f6]" : "border-[#e7e5e2] bg-white hover:bg-[#f8f8f6]"}`} onClick={mockProviderFromGuarantor}>
                  <div className="text-[15px] font-semibold text-[#111111] mb-1">{t("str_86")}</div>
                  <div className="text-[13px] text-[#787774]">{t("str_132")}</div>
                </div>}
              </div>



              {/* Provider OCR status */}
              {!selectingProvider && providerOcrStatus === "loading" && <div className="flex items-center gap-3 p-4 rounded-xl bg-[#eef2ff] border border-[#c7d5fb] text-[#4f7cff] text-[14px] mb-4">
                <svg className="animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>{t("str_134")}</div>}
              {!selectingProvider && providerOcrStatus === "success" && <div className="flex items-center gap-3 p-4 rounded-xl bg-[#e8f9ed] border border-[#a8e6bc] text-[#1a7a3a] text-[14px] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>{t("str_135")}</div>}
              {!selectingProvider && (providerOcrStatus === "warning" || providerOcrStatus === "error") && providerOcrError && <div className="flex items-center gap-3 p-4 rounded-xl bg-[#fff8e6] border border-[#f5d996] text-[#8a6100] text-[14px] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                {providerOcrError}
              </div>}

              {/* Fields */}
              {!selectingProvider && <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[18px] p-6 mb-6">
                <FieldGrid cols="3">
                  <Input label={t("str_136")} value={provider.fullName} onChange={v => setProvider({
                    ...provider,
                    fullName: v
                  })} required />
                  <Input label={t("str_66")} value={provider.idNumber} onChange={v => setProvider({
                    ...provider,
                    idNumber: v
                  })} required />
                  <Input label={t("str_95")} value={provider.nationality} onChange={v => setProvider({
                    ...provider,
                    nationality: v
                  })} required helperText={!provider.nationality ? t("str_137") : ""} />
                  <Input label={t("str_70")} value={provider.phone} onChange={v => setProvider({
                    ...provider,
                    phone: v
                  })} required helperText={!provider.phone ? t("str_138") : ""} />
                </FieldGrid>
              </div>}

              {!selectingProvider && <NextButton onClick={() => navigateToStep("generate")} disabled={!provider.fullName || !provider.idNumber || !provider.phone || !provider.nationality}>{t("str_124")}</NextButton>}
            </Card>}

            {step === "generate" && <Card title={t("str_29")} subtitle={t("str_139")}>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <DocBox title={visaType === "F4" ? "거소신고(신청)서.pdf" : "통합신청서(신고서).pdf"} desc={action === "address_change" ? t("str_140") : t("str_141")} />

                {housingType === "other" && <DocBox title="거주/숙소제공 확인서.pdf" desc={t("str_142")} />}

                {action !== "address_change" && applicant.isStudent === true && <DocBox title="초·중·고 재학사항 신고서.pdf" desc={t("str_143")} />}

                {action !== "address_change" && applicant.isStudent === false && calculateAge(applicant.birthDate) >= 19 && visaType !== "F1" && <DocBox title="외국인 직업 및 연간 소득금액 신고서.pdf" desc={t("str_144")} />}

                {visaType === "F1" && <DocBox title="신원보증서.pdf" desc={t("str_145")} />}
              </div>

              <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[20px] p-6 mb-8 text-[14px] text-[#37352f] shadow-sm">
                <h3 className="text-sm font-semibold text-[#111111] uppercase tracking-wider mb-4">{t("str_146")}</h3>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e7e5e2] pb-3 gap-1">
                    <span className="text-[#787774]">{t("str_147")}</span>
                    <span className="font-medium sm:text-right">{applicant.fullName || "-"} <br className="hidden sm:block" /><span className="text-xs text-[#9b9a97]">{applicant.passportNumber || ""}</span></span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e7e5e2] pb-3 gap-1">
                    <span className="text-[#787774]">{t("str_148")}</span>
                    <span className="font-medium sm:text-right text-sm leading-snug sm:max-w-[240px]">{address || "-"}</span>
                  </div>
                  {housingType === "other" && <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e7e5e2] pb-3 gap-1">
                    <span className="text-[#787774]">{t("str_28")}</span>
                    <span className="font-medium sm:text-right">{provider.fullName || "-"} <br className="hidden sm:block" /><span className="text-xs text-[#9b9a97]">{provider.phone || ""}</span></span>
                  </div>}
                  {visaType === "F1" && <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-1">
                    <span className="text-[#787774]">{t("str_26")}</span>
                    <span className="font-medium sm:text-right">{guarantor.fullName || "-"} <br className="hidden sm:block" /><span className="text-xs text-[#9b9a97]">({guarantor.relationship || "-"})</span></span>
                  </div>}
                </div>
              </div>

              <div className="mb-8 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                    <input type="checkbox" className="peer appearance-none w-5 h-5 border-2 border-[#d9d7d3] rounded-[6px] checked:bg-[#111111] checked:border-[#111111] transition-colors cursor-pointer" checked={dataVerified} onChange={e => setDataVerified(e.target.checked)} />
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="text-[13px] text-[#787774] leading-relaxed">{t("str_149")}</div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                    <input type="checkbox" className="peer appearance-none w-5 h-5 border-2 border-[#d9d7d3] rounded-[6px] checked:bg-[#111111] checked:border-[#111111] transition-colors cursor-pointer" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="text-[13px] text-[#787774] leading-relaxed">{t("str_150")}<button className="text-[#111111] font-medium underline underline-offset-2 decoration-[#d9d7d3] hover:decoration-[#111111] transition-colors">{t("str_151")}</button>.
                  </div>
                </label>
              </div>

              <div className="flex flex-col gap-4 mt-8">
                {action !== "password_recovery" && <button onClick={handlePreviewPDF} disabled={!dataVerified || !termsAccepted || pdfStatus === "loading"} className="w-full py-3.5 bg-white border border-[#111111] text-[#111111] rounded-[10px] font-medium text-[15px] hover:bg-[#fbfbfa] disabled:opacity-50 disabled:bg-white disabled:border-[#e7e5e2] disabled:text-[#9b9a97] transition-colors shadow-sm flex items-center justify-center gap-2">
                  {pdfStatus === "loading" ? <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>{t("str_152")}</> : t("str_153")}
                </button>}

                {action === "password_recovery" ? (
                  <button onClick={() => ensureGenerationAccess(handleSendFax)} disabled={!dataVerified || !termsAccepted || pdfStatus === "loading"} className="w-full py-3.5 bg-[#111111] text-white rounded-[10px] font-medium text-[15px] shadow-md hover:bg-[#2f2f2f] disabled:opacity-50 disabled:hover:bg-[#111111] transition-colors flex items-center justify-center gap-2">
                    {pdfStatus === "loading" && <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}{(i18n.language === 'ru' ? 'Отправить факсом (050-4466-4550)' : i18n.language === 'ko' ? '팩스로 전송 (050-4466-4550)' : 'Send by Fax (050-4466-4550)')}
                  </button>
                ) : (
                  authLoading ? <div className="text-center text-sm text-[#787774] py-2">{t("str_154")}</div> : !user ? <button onClick={() => {
                  ensureGenerationAccess(handleDownloadPDF);
                }} disabled={!dataVerified || !termsAccepted || pdfStatus === "loading"} className="w-full py-3.5 bg-[#111111] text-white rounded-[10px] font-medium text-[15px] shadow-md hover:bg-[#2f2f2f] disabled:opacity-50 disabled:hover:bg-[#111111] transition-colors">{t("str_155")}</button> : user.freeDownloadsUsed === 0 ? <div className="flex flex-col items-stretch gap-2">
                  <div className="text-center text-[13px] text-green-700 font-medium bg-green-50/80 px-3 py-1.5 rounded-md border border-green-200">{t("str_156")}</div>
                  <button onClick={() => handleDownloadPDF()} disabled={!dataVerified || !termsAccepted || pdfStatus === "loading"} className="w-full py-3.5 bg-[#111111] text-white rounded-[10px] font-medium text-[15px] shadow-md hover:bg-[#2f2f2f] disabled:opacity-50 disabled:hover:bg-[#111111] transition-colors flex items-center justify-center gap-2">
                    {pdfStatus === "loading" && <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}{t("str_157")}</button>
                </div> : (user.paidGenerationsRemaining || 0) > 0 ? <div className="flex flex-col items-stretch gap-2">
                  <div className="text-center text-[13px] text-green-700 font-medium bg-green-50/80 px-3 py-1.5 rounded-md border border-green-200">
                    {(i18n.language === 'ru' ? 'Доступно платных генераций: ' : i18n.language === 'ko' ? '이용 가능한 유료 문서 생성: ' : 'Paid generations available: ') + user.paidGenerationsRemaining}
                  </div>
                  <button onClick={() => handleDownloadPDF()} disabled={!dataVerified || !termsAccepted || pdfStatus === "loading"} className="w-full py-3.5 bg-[#111111] text-white rounded-[10px] font-medium text-[15px] shadow-md hover:bg-[#2f2f2f] disabled:opacity-50 disabled:hover:bg-[#111111] transition-colors flex items-center justify-center gap-2">
                    {pdfStatus === "loading" && <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}{t("str_159")}</button>
                </div> : <div className="flex flex-col items-stretch gap-2">
                  <div className="text-center text-[13px] text-[#8a0000] font-medium bg-[#fff0f0] px-3 py-1.5 rounded-md border border-[#f5c0c0]">{t("str_158")}</div>
                  <button onClick={() => ensureGenerationAccess(handleDownloadPDF)} disabled={!dataVerified || !termsAccepted || pdfStatus === "loading"} className="w-full py-3.5 bg-[#111111] text-white rounded-[10px] font-medium text-[15px] shadow-md hover:bg-[#2f2f2f] disabled:opacity-50 disabled:hover:bg-[#111111] transition-colors flex items-center justify-center gap-2">
                    {pdfStatus === "loading" && <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}{t("str_159")}</button>
                </div>
                )}
              </div>


              {pdfStatus === "error" && pdfError && <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-[#fff0f0] border border-[#f5c0c0] text-[#8a0000] text-[14px]">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                {pdfError}
              </div>}

              {generated && <div className="mt-6 p-6 rounded-[18px] bg-[#edf7ed] border border-[#d3e8d3] text-[#2f6b2f] font-medium flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                <div>
                  <div className="text-lg font-semibold mb-1">{t("str_160")}</div>
                  <div className="text-[#458045] font-normal text-sm">{t("str_161")}</div>
                </div>
              </div>}
            </Card>}
          </main>
        )}

        {/* ── My Page Content ── */}
        {step === "my-page" && (
          <main className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <section className="bg-white border border-[#e7e5e2] rounded-[24px] p-6 md:p-10 shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#e7e5e2]">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-[#1a1c1d]">{t('myPage.title')}</h2>
                  <p className="text-[#5f6368]">{user?.email}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {user?.email?.toLowerCase() === ADMIN_EMAIL && (
                    <button
                      onClick={() => setShowAdmin(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#4f7cff] text-white rounded-full font-bold hover:bg-[#3d6ae8] transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      Администратор
                    </button>
                  )}
                  <button
                    onClick={() => startOver(true)}
                    className="px-6 py-2.5 bg-[#2f3437] text-white rounded-full font-bold hover:bg-[#1a1c1d] transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    {t('myPage.startNew')}
                  </button>
                </div>
              </div>

              {/* Access Info + Credit Cards */}
              {(() => {
                const now = new Date();
                const permC = user?.permanentCredits ?? user?.paidGenerationsRemaining ?? 0;
                const tmpC = user?.temporaryCredits || 0;
                const tmpExpiry = user?.temporaryCreditsExpiresAt ? new Date(user.temporaryCreditsExpiresAt) : null;
                const unlimited = user?.unlimitedAccessExpiresAt ? new Date(user.unlimitedAccessExpiresAt) : null;
                const isTmpActive = tmpC > 0 && tmpExpiry && tmpExpiry > now;
                const isUnlimitedActive = unlimited && unlimited > now;
                const daysToUnlimited = unlimited ? Math.ceil((unlimited - now) / (1000 * 60 * 60 * 24)) : null;
                const hasAnyAccess = permC > 0 || isTmpActive || isUnlimitedActive;
                const label = (ru, en, ko) => i18n.language === 'ru' ? ru : i18n.language === 'ko' ? ko : en;
                const fmtDate = (d) => d.toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : i18n.language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

                return (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <span className="w-2 h-6 bg-[#2f3437] rounded-full"></span>
                      {t('myPage.accessInfo')}
                    </h3>

                    {/* Free download status */}
                    <div className="bg-[#f7f7f5] rounded-2xl p-4 border border-[#e7e5e2] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user?.freeDownloadsUsed === 0 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="text-sm font-medium text-[#5f6368]">{label("Бесплатная генерация", "Free generation", "무료 생성")}</span>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user?.freeDownloadsUsed === 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {user?.freeDownloadsUsed === 0 ? label("Доступна", "Available", "가능") : label("Использована", "Used", "사용됨")}
                      </span>
                    </div>

                    {/* 3-column credit cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Permanent credits */}
                      <div className={`rounded-2xl border p-4 space-y-2 ${permC > 0 ? 'bg-white border-green-200' : 'bg-[#f7f7f5] border-[#e7e5e2]'}`}>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#5f6368] uppercase tracking-wider">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {label("Постоянные", "Permanent", "영구")}
                        </div>
                        <p className={`text-3xl font-bold ${permC > 0 ? 'text-green-600' : 'text-[#ccc]'}`}>{permC}</p>
                        <p className="text-xs text-[#999]">{label("Не истекают", "Never expire", "만료 없음")}</p>
                      </div>

                      {/* Temporary credits */}
                      <div className={`rounded-2xl border p-4 space-y-2 ${isTmpActive ? 'bg-white border-blue-200' : 'bg-[#f7f7f5] border-[#e7e5e2]'}`}>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#5f6368] uppercase tracking-wider">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {label("Временные", "Temporary", "임시")}
                        </div>
                        <p className={`text-3xl font-bold ${isTmpActive ? 'text-blue-600' : 'text-[#ccc]'}`}>{tmpC}</p>
                        {isTmpActive ? (
                          <p className="text-xs text-blue-500">{label("До", "Until", "~")} {fmtDate(tmpExpiry)}</p>
                        ) : (
                          <p className="text-xs text-[#999]">{label("Нет", "None", "없음")}</p>
                        )}
                      </div>

                      {/* Unlimited */}
                      <div className={`rounded-2xl border p-4 space-y-2 ${isUnlimitedActive ? 'bg-white border-purple-200' : 'bg-[#f7f7f5] border-[#e7e5e2]'}`}>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#5f6368] uppercase tracking-wider">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          {label("Безлимит", "Unlimited", "무제한")}
                        </div>
                        <p className={`text-3xl font-bold ${isUnlimitedActive ? 'text-purple-600' : 'text-[#ccc]'}`}>∞</p>
                        {isUnlimitedActive ? (
                          <p className="text-xs text-purple-500">{label("До", "Until", "~")} {fmtDate(unlimited)}</p>
                        ) : (
                          <p className="text-xs text-[#999]">{label("Нет", "None", "없음")}</p>
                        )}
                      </div>
                    </div>

                    {/* No access banner */}
                    {!hasAnyAccess && user?.freeDownloadsUsed !== 0 && (
                      <div className="flex items-center gap-3 bg-[#f7f7f5] border border-[#e7e5e2] rounded-2xl p-4">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <p className="text-sm text-[#5f6368]">{label("У вас нет активного доступа", "No active subscription", "활성 이용권이 없습니다")}</p>
                      </div>
                    )}

                    {/* Expiry warning: unlimited soon */}
                    {isUnlimitedActive && daysToUnlimited !== null && daysToUnlimited <= 7 && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-amber-500 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <p className="text-amber-700 text-xs font-medium">{label("Ваш безлимитный доступ скоро закончится", "Your unlimited access will expire soon", "무제한 이용 기간이 곧 만료됩니다")}</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-2 h-6 bg-[#2f3437] rounded-full"></span>
                  {t('str_146')}
                </h3>

                {loadingPackages ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-50">
                    <div className="w-10 h-10 border-4 border-[#2f3437] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : myPagePackages.length > 0 ? (
                  <div className="space-y-8">
                    {myPagePackages.some(p => p.paymentStatus === "unpaid") && (
                      <div className="space-y-4">
                        <h4 className="font-bold text-[#e15241] flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                          {t('myPage.cart') || 'Cart'}
                        </h4>
                        <div className="grid gap-4">
                          {myPagePackages.filter(p => p.paymentStatus === "unpaid").map(pkg => (
                            <div key={pkg.id} className="bg-orange-50/50 border border-orange-200 rounded-2xl p-4 hover:border-orange-300 transition-all flex gap-3">
                              <div className="pt-2 pl-1 flex-shrink-0">
                                <input 
                                  type="checkbox" 
                                  className="w-5 h-5 accent-[#111111] cursor-pointer"
                                  checked={selectedCartItems.includes(pkg.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedCartItems(prev => [...prev, pkg.id]);
                                    else setSelectedCartItems(prev => prev.filter(id => id !== pkg.id));
                                  }}
                                />
                              </div>
                              <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase px-2 py-0.5 bg-orange-100 rounded-md text-orange-700">
                                      {pkg.visaType}
                                    </span>
                                    <span className="text-xs text-[#999]">{new Date(pkg.createdAt).toLocaleDateString()}</span>
                                    <span className="text-xs font-bold text-[#e15241] border border-[#e15241]/30 px-2 rounded-full">{t('myPage.statusUnpaid') || 'Unpaid'}</span>
                                  </div>
                                  <h4 className="font-bold text-[#1a1c1d]">
                                    {pkg.applicant?.surname} {pkg.applicant?.givenNames}
                                  </h4>
                                  <p className="text-sm text-[#5f6368]">{pkg.address}</p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      setMyPagePackages(prev => prev.filter(p => p.id !== pkg.id));
                                      setSelectedCartItems(prev => prev.filter(id => id !== pkg.id));
                                    }}
                                    className="px-4 py-2 text-sm font-bold text-[#5f6368] bg-white border border-[#e7e5e2] rounded-full hover:bg-[#f7f7f5] transition-all w-full sm:w-auto"
                                  >
                                    {t('myPage.remove') || 'Remove'}
                                  </button>
                                  {myPagePackages.filter(p => p.paymentStatus === "unpaid").length === 1 && (
                                    <button
                                      onClick={async () => {
                                        const performDownload = async () => {
                                          setPdfStatus("loading");
                                          try {
                                            const res = await fetch("/api/generate/package-download", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                ...pkg.applicant,
                                                ...pkg.provider,
                                                ...pkg.guarantor,
                                                visaType: pkg.visaType,
                                                action: pkg.action,
                                                housingType: pkg.housingType,
                                                address: pkg.address,
                                                packageId: pkg.id,
                                                paymentConfirmed: true
                                              }),
                                              credentials: "include"
                                            });
                                            if (!res.ok) {
                                              const j = await res.json().catch(() => ({}));
                                              if (j.error === "LOGIN_REQUIRED" || j.error === "PAYMENT_REQUIRED") {
                                                setPendingAction(() => performDownload);
                                                if (j.error === "PAYMENT_REQUIRED") setPaymentModalOpen(true);
                                                else setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") });
                                                setPdfStatus("idle");
                                                return;
                                              }
                                              throw new Error("Download failed");
                                            }
                                            if (user) {
                                              const hasFree = user.freeDownloadsUsed === 0;
                                              setUser({
                                                ...user,
                                                freeDownloadsUsed: hasFree ? 1 : user.freeDownloadsUsed,
                                                paidGenerationsRemaining: hasFree ? (user.paidGenerationsRemaining || 0) : Math.max(0, (user.paidGenerationsRemaining || 0) - 1)
                                              });
                                            }
                                            const blob = await res.blob();
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = `application_${pkg.applicant?.surname || 'document'}.pdf`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                            setPdfStatus("success");
                                            fetch("/api/user/packages", { credentials: "include" })
                                              .then(r => r.json())
                                              .then(d => { if (d.ok) setMyPagePackages(d.packages); });
                                          } catch (err) {
                                            console.error(err);
                                            setPdfStatus("error");
                                          }
                                        };
                                        const access = await ensureGenerationAccess(performDownload);
                                        if (access) performDownload();
                                      }}
                                      className="px-6 py-2 text-sm font-bold bg-[#111111] text-white rounded-full hover:bg-[#2f2f2f] transition-all shadow-md w-full sm:w-auto"
                                    >
                                      {t('myPage.payButton') || 'Pay'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {myPagePackages.filter(p => p.paymentStatus === "unpaid").length > 1 && (
                          <div className="flex justify-end pt-2">
                            <button
                              disabled={selectedCartItems.length === 0}
                              onClick={async () => {
                                const performMultiDownload = async () => {
                                  for (const id of selectedCartItems) {
                                    const pkg = myPagePackages.find(p => p.id === id);
                                    if (!pkg) continue;
                                    setPdfStatus("loading");
                                    try {
                                      const res = await fetch("/api/generate/package-download", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          ...pkg.applicant,
                                          ...pkg.provider,
                                          ...pkg.guarantor,
                                          visaType: pkg.visaType,
                                          action: pkg.action,
                                          housingType: pkg.housingType,
                                          address: pkg.address,
                                          packageId: pkg.id,
                                          paymentConfirmed: true
                                        }),
                                        credentials: "include"
                                      });
                                      if (!res.ok) {
                                        const j = await res.json().catch(() => ({}));
                                        if (j.error === "LOGIN_REQUIRED" || j.error === "PAYMENT_REQUIRED") {
                                          setPendingAction(() => performMultiDownload);
                                          if (j.error === "PAYMENT_REQUIRED") setPaymentModalOpen(true);
                                          else setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") });
                                          setPdfStatus("idle");
                                          return;
                                        }
                                        throw new Error("Download failed");
                                      }
                                      if (user) {
                                        const hasFree = user.freeDownloadsUsed === 0;
                                        setUser({
                                          ...user,
                                          freeDownloadsUsed: hasFree ? 1 : user.freeDownloadsUsed,
                                          paidGenerationsRemaining: hasFree ? (user.paidGenerationsRemaining || 0) : Math.max(0, (user.paidGenerationsRemaining || 0) - 1)
                                        });
                                      }
                                      const blob = await res.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `application_${pkg.applicant?.surname || 'document'}.pdf`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }
                                  setPdfStatus("success");
                                  setSelectedCartItems([]);
                                  fetch("/api/user/packages", { credentials: "include" })
                                    .then(r => r.json())
                                    .then(d => { if (d.ok) setMyPagePackages(d.packages); });
                                };
                                const access = await ensureGenerationAccess(performMultiDownload);
                                if (access) performMultiDownload();
                              }}
                              className="px-6 py-3 bg-[#111111] text-white rounded-full font-bold shadow-lg hover:bg-[#2f3437] transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11 5.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-1z"/><path d="M2 2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3-6a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/></svg>
                              {t('myPage.paySelected') || 'Pay selected'} ({selectedCartItems.length})
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {myPagePackages.some(p => p.paymentStatus !== "unpaid") && (
                      <div className="space-y-4">
                        <h4 className="font-bold text-[#5f6368]">{t('myPage.paidApplications') || 'Оплаченные заявления'}</h4>
                        <div className="grid gap-4">
                          {myPagePackages.filter(p => p.paymentStatus !== "unpaid").map(pkg => (
                            <div key={pkg.id} className="bg-white border border-[#e7e5e2] rounded-2xl p-5 hover:border-[#2f3437] transition-all group">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase px-2 py-0.5 bg-[#f7f7f5] rounded-md text-[#5f6368]">
                                      {pkg.visaType}
                                    </span>
                                    <span className="text-xs text-[#999]">{new Date(pkg.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <h4 className="font-bold text-[#1a1c1d]">
                                    {pkg.applicant?.surname} {pkg.applicant?.givenNames}
                                  </h4>
                                  <p className="text-sm text-[#5f6368]">{pkg.address}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button className="px-4 py-2 text-sm font-bold border border-[#e7e5e2] rounded-full hover:bg-[#f7f7f5] transition-all">
                                    {t('myPage.sendEmail')}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const performDownload = async () => {
                                        setPdfStatus("loading");
                                        try {
                                          const res = await fetch("/api/generate/package-download", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              ...pkg.applicant,
                                              ...pkg.provider,
                                              ...pkg.guarantor,
                                              visaType: pkg.visaType,
                                              action: pkg.action,
                                              housingType: pkg.housingType,
                                              address: pkg.address,
                                              packageId: pkg.id,
                                              paymentConfirmed: true
                                            }),
                                            credentials: "include"
                                          });
                                          if (!res.ok) {
                                            const j = await res.json().catch(() => ({}));
                                            if (j.error === "LOGIN_REQUIRED" || j.error === "PAYMENT_REQUIRED") {
                                              setPendingAction(() => performDownload);
                                              if (j.error === "PAYMENT_REQUIRED") setPaymentModalOpen(true);
                                              else setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") });
                                              setPdfStatus("idle");
                                              return;
                                            }
                                            throw new Error("Download failed");
                                          }
      
                                          const blob = await res.blob();
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url;
                                          a.download = `application_${pkg.applicant?.surname || 'document'}.pdf`;
                                          a.click();
                                          URL.revokeObjectURL(url);
                                          setPdfStatus("success");
                                        } catch (err) {
                                          console.error(err);
                                          setPdfStatus("error");
                                        }
                                      };
                                      await performDownload();
                                    }}
                                    disabled={pdfStatus === "loading"}
                                    className="px-4 py-2 text-sm font-bold bg-[#2f3437] text-white rounded-full hover:bg-[#1a1c1d] transition-all disabled:opacity-50"
                                  >
                                    {t('myPage.download')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#f7f7f5] rounded-2xl p-12 border border-[#e7e5e2] border-dashed text-center space-y-2">
                    <p className="text-[#5f6368] font-medium">{t('myPage.noDocs')}</p>
                    <button
                      onClick={() => startOver(true)}
                      className="text-[#2f3437] font-bold underline"
                    >
                      {t('myPage.startNew')}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </main>
        )}
      </div>

      {/* ── Reset Confirmation Modal ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 duration-300 space-y-6">
            <div className="w-16 h-16 bg-[#fff5f5] text-[#d93025] rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-[#1a1c1d]">{t('confirm.startOverTitle')}</h3>
              <p className="text-[#5f6368]">{t('confirm.startOverMessage')}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 px-4 border border-[#e7e5e2] rounded-xl font-bold text-[#2f3437] hover:bg-[#f7f7f5] transition-all"
              >
                {t('confirm.cancel')}
              </button>
              <button
                onClick={() => startOver(true)}
                className="flex-1 py-3 px-4 bg-[#d93025] text-white rounded-xl font-bold hover:bg-[#b9281e] transition-all shadow-md active:scale-95"
              >
                {t('confirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Legal Modal (Privacy / Terms) ── */}
      {legalModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e7e5e2] flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-[#1a1c1d]">
                {legalModal.type === "privacy"
                  ? t('footer.privacyPolicy')
                  : t('footer.termsOfService')
                }
              </h3>
              <button
                onClick={() => setLegalModal({ open: false, type: "" })}
                className="p-2 hover:bg-[#f7f7f5] rounded-full transition-colors text-[#5f6368]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 md:p-10 overflow-y-auto text-[#2f3437] leading-relaxed space-y-4">
              {renderLegalContent(legalModal.type === "privacy" ? privacyPolicy : termsOfService, i18n.language)}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e7e5e2] flex justify-end shrink-0">
              <button
                onClick={() => setLegalModal({ open: false, type: "" })}
                className="px-6 py-2 bg-[#2f3437] text-white rounded-full font-bold hover:bg-[#1a1c1d] transition-all"
              >
                {t('legalModal.close')}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Simulated Payment Modal ── */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-[#e7e5e2] flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-[#1a1c1d] flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                {t('documentGenerationPayment') || t('pay.title') || "Document generation payment"}
              </h3>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="p-2 hover:bg-[#f7f7f5] rounded-full transition-colors text-[#5f6368]"
                disabled={paymentProcessing}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 text-[#2f3437] space-y-4 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto border border-green-100 text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-base font-medium text-[#1a1c1d]">{t('paymentDescription') || t('pay.desc')}</p>
                <p className="text-2xl font-bold text-[#111111] mt-3 tracking-tight">{t('oneGenerationPrice') || t('pay.cost')}</p>
                <div className="mt-2 text-xs text-[#787774] bg-[#f7f7f5] py-1 px-2.5 rounded-md inline-block border border-[#e7e5e2]">
                  🔒 {i18n.language === 'ru' ? 'Безопасный платёж' : i18n.language === 'ko' ? '안전한 결제' : 'Secure Checkout'}
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-[#e7e5e2] flex flex-col gap-3 bg-[#fbfbfa]">
              <button
                onClick={handleSimulatedPayment}
                disabled={paymentProcessing || !import.meta.env.DEV}
                className={`w-full py-3 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${!import.meta.env.DEV ? 'bg-[#e7e5e2] text-[#9b9a97] cursor-not-allowed' : 'bg-[#111111] hover:bg-[#2f2f2f] disabled:opacity-50'}`}
              >
                {!import.meta.env.DEV ? (
                  t('paymentIntegrationComingSoon') || "Payment integration coming soon"
                ) : paymentProcessing ? (
                  <><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>{t('pay.pending') || "Processing..."}</>
                ) : (
                  t('pay') || t('pay.btn') || "Pay"
                )}
              </button>
              <button
                onClick={() => setPaymentModalOpen(false)}
                disabled={paymentProcessing}
                className="w-full py-2.5 text-sm font-bold text-[#5f6368] hover:text-[#111111] transition-all text-center"
              >
                {t('pay.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Auth Modal ── */}
      <AuthModal
        open={authModal.open}
        initialType={authModal.type}
        subtitle={authModal.subtitle}
        onClose={() => {
          setAuthModal({ open: false, type: "", subtitle: "" });
          setPendingAction(null);
        }}
        onSuccess={(userData) => {
          setUser(userData);
          setAuthModal({ open: false, type: "", subtitle: "" });
          if (pendingAction) {
            pendingAction(userData);
            setPendingAction(null);
          } else {
            navigateToStep("my-page");
          }
        }}
      />

      <style>{`
        .btn-primary {
          background: #111111;
          color: white;
          border-radius: 14px;
          padding: 12px 20px;
          font-weight: 600;
          transition: all .2s ease;
        }
        .btn-primary:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
      `}</style>
      <footer className="w-full max-w-3xl mt-12 mb-8 text-center text-xs text-[#9b9a97] space-y-3">
        <div className="flex justify-center gap-4 text-[#787774]">
          <button onClick={() => setLegalModal({ open: true, type: "privacy" })} className="hover:text-[#111111] transition underline underline-offset-2">{t('footer.privacyPolicy')}</button>
          <span>•</span>
          <button onClick={() => setLegalModal({ open: true, type: "terms" })} className="hover:text-[#111111] transition underline underline-offset-2">{t('footer.termsOfService')}</button>
        </div>

        <div className="leading-relaxed whitespace-pre-line">
          {t('footer.companyInfo')}
        </div>
        <div className="mt-4 font-mono opacity-50 tracking-widest text-[10px]">
          v1.3
        </div>
      </footer>
    </div>
  </>;
}
function Card({
  title,
  subtitle,
  children
}) {
  return <section className="bg-white border border-[#e7e5e2] rounded-[24px] p-6 md:p-10 shadow-sm relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#e7e5e2] to-transparent"></div>
    <h2 className="text-[26px] md:text-[32px] leading-tight font-semibold tracking-[-0.03em] text-[#111111]">{title}</h2>
    {subtitle && <p className="text-[#787774] mt-3 mb-8 leading-relaxed text-[15px]">{subtitle}</p>}
    {children}
  </section>;
}
function OptionCard({
  label,
  description,
  tag,
  selected,
  onClick
}) {
  return <button onClick={onClick} className={`group text-left rounded-[20px] p-4 md:p-6 min-h-[120px] md:min-h-[160px] border transition-all duration-200 bg-white hover:bg-[#fbfbfa] hover:-translate-y-[2px] flex flex-col justify-between ${selected ? "border-[#111111] shadow-[0_0_0_1px_#111111] bg-[#fbfbfa]" : "border-[#e7e5e2] shadow-sm hover:shadow-md"}`}>
    <div>
      <div className="flex justify-between gap-3 items-start mb-3">
        <div className="text-[18px] md:text-[22px] leading-tight font-semibold tracking-[-0.03em] text-[#111111]">{label}</div>
      </div>
      <div className="text-[13px] md:text-[14px] leading-relaxed text-[#787774]">{description}</div>
    </div>
    {tag && <div className="mt-4"><span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${selected ? "bg-[#111111] text-white" : "bg-[#f1f1ef] text-[#787774]"}`}>{tag}</span></div>}
  </button>;
}
function UploadBox({
  title,
  note,
  file,
  onFile,
  ocrStatus,
  ocrError,
  onAdjust
}) {
  const { t } = useTranslation();
  const galleryInputRef = React.useRef(null);
  const cameraInputRef = React.useRef(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const uploaded = !!file;
  const isLoading = ocrStatus === "loading" || isCompressing;
  const isSuccess = ocrStatus === "success";
  const isError = ocrStatus === "error";

  React.useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isTouchDevice || isMobileUA);
  }, []);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = async e => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const fileType = rawFile.type.toLowerCase();
    const fileName = rawFile.name.toLowerCase();

    const isSupported = allowedTypes.includes(fileType) ||
      allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isSupported) {
      alert(t("upload.unsupportedError"));
      e.target.value = "";
      return;
    }

    if (rawFile.type.startsWith("image/")) {
      setIsCompressing(true);
      try {
        const options = {
          maxWidthOrHeight: 2000,
          initialQuality: 0.85,
          useWebWorker: true,
          exifOrientation: true
        };
        const compressedBlob = await imageCompression(rawFile, options);
        const optimizedFile = new File([compressedBlob], rawFile.name, { type: "image/jpeg" });

        console.log(
          "Original:",
          (rawFile.size / 1024 / 1024).toFixed(2),
          "MB"
        );
        console.log(
          "Compressed:",
          (optimizedFile.size / 1024 / 1024).toFixed(2),
          "MB"
        );
        console.log(
          "Reduction:",
          ((1 - optimizedFile.size / rawFile.size) * 100).toFixed(1) + "%"
        );

        if (onFile) onFile(optimizedFile);
      } catch (error) {
        console.warn("Image compression failed, falling back to original", error);
        if (onFile) onFile(rawFile);
      } finally {
        setIsCompressing(false);
      }
    } else {
      if (onFile) onFile(rawFile);
    }
    // Reset input so same file can be re-selected after editor cancel
    e.target.value = "";
  };
  const truncate = (name, max = 26) => name.length > max ? name.slice(0, max - 1) + "…" : name;
  const isWarning = ocrStatus === "warning";
  return <div className={`relative border rounded-[16px] md:rounded-[20px] transition-all duration-200 text-center flex flex-col items-center select-none overflow-hidden
                ${uploaded ? isError ? "border-[#e07a7a] bg-[#fff6f6]" : isWarning ? "border-[#d97706] bg-[#fffbef]" : "border-[#2d7a2d] bg-[#f0faf0]" : "border-dashed border-[#d9d7d3] bg-white hover:bg-[#fbfbfa] p-4 md:p-8 justify-center"}`} onClick={() => {
      if (uploaded && !isLoading) galleryInputRef.current?.click();
    }}>
    <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={isLoading} />
    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} disabled={isLoading} />

    {uploaded && previewUrl ? <>
      {/* Image preview */}
      <div className="w-full relative">
        <img src={previewUrl} alt={file.name} onClick={(e) => {
          if (onAdjust) {
            e.stopPropagation();
            onAdjust();
          }
        }} className={`w-full h-[140px] md:h-[180px] object-cover rounded-t-[14px] md:rounded-t-[18px] ${onAdjust ? 'cursor-pointer hover:opacity-90' : ''}`} style={{
          opacity: isLoading ? 0.5 : 1,
          transition: "opacity 0.2s"
        }} />

        {/* Adjust Image badge & Choose another photo */}
        {!isLoading && (
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            {onAdjust && (
              <div
                className="bg-[#111]/70 backdrop-blur-sm text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm cursor-pointer hover:bg-[#111] transition-colors"
                onClick={(e) => { e.stopPropagation(); onAdjust(); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                <span className="text-[9px] font-medium uppercase tracking-wide">{t("adjust.adjustImage")}</span>
              </div>
            )}
            <div
              className="bg-white/90 backdrop-blur-sm text-[#111] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm cursor-pointer hover:bg-white transition-colors"
              onClick={e => {
                e.stopPropagation();
                galleryInputRef.current?.click();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
              <span className="text-[9px] font-medium uppercase tracking-wide">{t("str_167")}</span>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 rounded-t-[14px] md:rounded-t-[18px]">
          <svg className="animate-spin mb-1.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-white text-[11px] font-medium">{isCompressing ? (t("str_162") || "Processing...") : t("str_162")}</span>
        </div>}

        {/* Success / Warning badge */}
        {isSuccess && <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#2d7a2d] text-white px-2 py-0.5 rounded-full shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span className="text-[10px] font-semibold">{t("str_163")}</span>
        </div>}
        {isWarning && <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#d97706] text-white px-2 py-0.5 rounded-full shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          <span className="text-[10px] font-semibold">{t("str_164")}</span>
        </div>}
      </div>

      {/* Footer row */}
      <div className="w-full px-3 py-2 md:px-4 md:py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isLoading ? <span className="text-[11px] md:text-[12px] text-[#787774] italic">{t("str_165")}</span> : isError ? <span className="text-[11px] md:text-[12px] text-[#e07a7a] truncate">{ocrError || t("str_166")}</span> : <>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isWarning ? "#d97706" : "#2d7a2d"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
            <span className={`text-[11px] md:text-[12px] font-medium truncate ${isWarning ? 'text-[#d97706]' : 'text-[#2d7a2d]'}`}>{truncate(file.name)}</span>
          </>}
        </div>
      </div>

      {/* Error banner below footer */}
      {isError && ocrError && <div className="w-full px-3 pb-2.5 md:px-4">
        <div className="bg-[#fff0f0] border border-[#f5c6c6] rounded-[10px] px-3 py-2 flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c0504d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
          <p className="text-[11px] text-[#c0504d] leading-snug">{ocrError}</p>
        </div>
      </div>}
    </> : <>
      <div className="w-10 h-10 md:w-12 md:h-12 bg-[#f1f1ef] rounded-full flex items-center justify-center mb-2 md:mb-3 text-[#787774]">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" className="md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
      </div>
      <div className="text-[15px] md:text-[17px] font-semibold text-[#111111]">{title}</div>
      <div className="text-[12px] md:text-[13px] text-[#787774] mt-0.5 md:mt-1 mb-3 md:mb-4">{note}</div>

      <div className="flex flex-col gap-2 w-full md:w-auto mt-2">
        {isMobile && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 text-xs md:text-sm font-medium text-[#111111] border border-[#d9d7d3] px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-white shadow-sm hover:bg-[#f1f1ef] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
            {t("upload.takePhoto")}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); galleryInputRef.current?.click(); }}
          disabled={isLoading}
          className={`flex items-center justify-center gap-2 text-xs md:text-sm font-medium px-3 py-2 md:px-4 md:py-2.5 rounded-xl transition-colors ${isMobile
              ? "text-[#787774] border border-[#e7e5e2] bg-[#fbfbfa]"
              : "text-[#111111] border border-[#d9d7d3] bg-white shadow-sm"
            } hover:bg-[#f1f1ef]`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          {t("upload.fromGallery")}
        </button>
      </div>

      {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-[16px] md:rounded-[20px]">
        <svg className="animate-spin mb-1.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#787774" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span className="text-[#787774] text-[11px] font-medium">{isCompressing ? (t("str_162") || "Processing...") : t("str_162")}</span>
      </div>}
    </>}
  </div>;
}
function FieldGrid({
  children,
  cols
}) {
  return <div className={`grid ${cols === "3" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-x-5 gap-y-4`}>{children}</div>;
}
function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
  helperText,
  type = "text"
}) {
  return <div className="block w-full">
    <label>
      <span className="block text-[13px] font-semibold text-[#787774] mb-2 ml-1">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className={`w-full h-[46px] border rounded-xl px-4 bg-white text-[#111111] text-[15px] outline-none transition shadow-sm focus:border-[#111111] focus:ring-4 focus:ring-[#111111]/5 ${required && !value ? "border-[#e07a7a] bg-[#fffcfc]" : "border-[#d9d7d3]"}`} placeholder={placeholder} />
    </label>
    {helperText && <div className="text-[11.5px] text-[#787774] mt-2 ml-1 leading-relaxed">{helperText}</div>}
  </div>;
}
function Select({
  label,
  value,
  onChange,
  options,
  required,
  placeholder
}) {
  const { t } = useTranslation();
  return <label className="block relative w-full">
    <span className="block text-[13px] font-semibold text-[#787774] mb-2 ml-1">
      {label} {required && <span className="text-red-400">*</span>}
    </span>
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={`w-full h-[46px] border rounded-xl px-4 bg-white text-[#111111] text-[15px] outline-none transition shadow-sm focus:border-[#111111] focus:ring-4 focus:ring-[#111111]/5 appearance-none cursor-pointer ${required && !value ? "border-[#e07a7a] bg-[#fffcfc]" : "border-[#d9d7d3]"}`}>
        <option value="" disabled hidden>{placeholder || t("str_169")}</option>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#787774]"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  </label>;
}
function Textarea({
  label,
  value,
  onChange,
  placeholder,
  required
}) {
  return <div className="block w-full">
    <label>
      <span className="block text-[13px] font-semibold text-[#787774] mb-2 ml-1">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-[#d9d7d3] rounded-xl px-4 py-4 min-h-[120px] bg-white text-[#111111] text-[15px] outline-none transition shadow-sm focus:border-[#111111] focus:ring-4 focus:ring-[#111111]/5 resize-y" />
    </label>
  </div>;
}
function NextButton({
  children,
  onClick,
  disabled
}) {
  return <button onClick={onClick} disabled={disabled} className="btn-primary mt-8 w-full py-4 text-[16px] disabled:opacity-30 disabled:cursor-not-allowed shadow-sm">
    {children}
  </button>;
}
function DocumentPreview({
  selected,
  provider,
  label,
  note
}) {
  return <div className="bg-[#fbfbfa] rounded-[24px] border border-[#e7e5e2] p-4 md:p-6 h-[220px] md:h-[400px] flex items-center justify-center relative overflow-hidden mb-5">
    {(selected || provider) && <div className={`absolute border-[3px] border-[#4f7cff] bg-[#4f7cff]/10 rounded-[12px] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] transition-all duration-500 ${provider ? "w-[75%] h-[25%] bottom-[15%]" : "w-[65%] h-[20%] top-[30%]"}`} />}
    <div className="text-center text-[#787774] relative z-10 bg-white/80 px-4 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl backdrop-blur-sm shadow-sm border border-white/50">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="md:w-6 md:h-6 mx-auto mb-1.5 md:mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
      <div className="text-[14px] md:text-[16px] font-semibold text-[#111111]">{label}</div>
      <div className="text-[12px] md:text-[13px] mt-0.5 md:mt-1">{note}</div>
    </div>
  </div>;
}
function ContractImagePreview({
  previewUrl,
  fileName,
  onReplace,
  onDelete,
  compact
}) {
  const { t } = useTranslation();
  const replaceRef = React.useRef(null);
  const truncate = (name, max = 36) => name && name.length > max ? name.slice(0, max - 1) + "…" : name;
  return <div className="bg-[#f8f8f6] border border-[#e7e5e2] rounded-[20px] overflow-hidden">
    {/* Image container — ready for selection rectangle overlay in future */}
    <div className="relative w-full overflow-hidden bg-[#f0f0ee]" style={{
      minHeight: compact ? "180px" : "260px"
    }} data-contract-preview="true">
      {previewUrl ? <img src={previewUrl} alt={t("str_170")} className="w-full h-full object-contain" style={{
        maxHeight: compact ? "220px" : "380px",
        display: "block"
      }} draggable={false} /> : <div className="flex items-center justify-center h-full min-h-[180px] text-[#c0bfbc]">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
      </div>}
    </div>

    {/* Footer toolbar */}
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#e7e5e2] bg-white">
      <div className="flex items-center gap-2 min-w-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a9a4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
        <span className="text-[12px] text-[#4a4a4a] truncate">{truncate(fileName) || t("str_171")}</span>
      </div>
      {(onReplace || onDelete) && <div className="flex items-center gap-3 shrink-0">
        {onReplace && <>
          <input ref={replaceRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (f) onReplace(f);
          }} />
          <button type="button" onClick={() => replaceRef.current?.click()} className="text-[11px] md:text-[12px] text-[#787774] hover:text-[#111] underline underline-offset-2 transition-colors">{t("str_167")}</button>
        </>}
        {onDelete && <button type="button" onClick={onDelete} className="text-[11px] md:text-[12px] text-[#e07a7a] hover:text-[#c0504d] underline underline-offset-2 transition-colors">{t("str_111")}</button>}
      </div>}
    </div>
  </div>;
}
function AreaSelector({
  previewUrl,
  initialCrop,
  onConfirm,
  onCancel,
  label
}) {
  const { t } = useTranslation();
  const containerRef = React.useRef(null);
  const [crop, setCrop] = React.useState(initialCrop || {
    x: 10,
    y: 10,
    width: 80,
    height: 20
  });
  const dragState = React.useRef(null);

  // Unified pointer position relative to container (supports mouse + touch)
  const getPos = e => {
    const rect = containerRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) / rect.width * 100,
      y: (src.clientY - rect.top) / rect.height * 100
    };
  };
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const onPointerDown = (e, type) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = getPos(e);
    dragState.current = {
      type,
      startPos: pos,
      startCrop: {
        ...crop
      }
    };
    const move = ev => {
      ev.preventDefault();
      if (!dragState.current) return;
      const {
        type,
        startPos,
        startCrop
      } = dragState.current;
      const cur = getPos(ev);
      const dx = cur.x - startPos.x;
      const dy = cur.y - startPos.y;
      let {
        x,
        y,
        width,
        height
      } = startCrop;
      const minSize = 5;
      if (type === "move") {
        x = clamp(x + dx, 0, 100 - width);
        y = clamp(y + dy, 0, 100 - height);
      } else {
        if (type.includes("e")) width = clamp(width + dx, minSize, 100 - x);
        if (type.includes("s")) height = clamp(height + dy, minSize, 100 - y);
        if (type.includes("w")) {
          const nw = clamp(width - dx, minSize, x + width);
          x = clamp(x + (width - nw), 0, 100 - minSize);
          width = nw;
        }
        if (type.includes("n")) {
          const nh = clamp(height - dy, minSize, y + height);
          y = clamp(y + (height - nh), 0, 100 - minSize);
          height = nh;
        }
      }
      setCrop({
        x,
        y,
        width,
        height
      });
    };
    const up = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
    window.addEventListener("mousemove", move, {
      passive: false
    });
    window.addEventListener("touchmove", move, {
      passive: false
    });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
  };
  const handles = [{
    id: "n",
    cursor: "ns-resize",
    style: {
      top: "-5px",
      left: "50%",
      transform: "translateX(-50%)"
    }
  }, {
    id: "s",
    cursor: "ns-resize",
    style: {
      bottom: "-5px",
      left: "50%",
      transform: "translateX(-50%)"
    }
  }, {
    id: "e",
    cursor: "ew-resize",
    style: {
      right: "-5px",
      top: "50%",
      transform: "translateY(-50%)"
    }
  }, {
    id: "w",
    cursor: "ew-resize",
    style: {
      left: "-5px",
      top: "50%",
      transform: "translateY(-50%)"
    }
  }, {
    id: "ne",
    cursor: "nesw-resize",
    style: {
      top: "-5px",
      right: "-5px"
    }
  }, {
    id: "nw",
    cursor: "nwse-resize",
    style: {
      top: "-5px",
      left: "-5px"
    }
  }, {
    id: "se",
    cursor: "nwse-resize",
    style: {
      bottom: "-5px",
      right: "-5px"
    }
  }, {
    id: "sw",
    cursor: "nesw-resize",
    style: {
      bottom: "-5px",
      left: "-5px"
    }
  }];
  return <div className="bg-[#f8f8f6] border-2 border-[#4f7cff] rounded-[20px] overflow-hidden">
    {/* Instruction banner */}
    <div className="flex items-center gap-2 px-4 py-2.5 bg-[#eef2ff] border-b border-[#c7d5fb]">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f7cff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></svg>
      <span className="text-[12px] text-[#4f7cff] font-medium">{label || t("str_172")}</span>
    </div>

    {/* Image + selection overlay */}
    <div ref={containerRef} className="relative w-full select-none bg-[#f0f0ee]" style={{
      minHeight: "280px"
    }}>
      {previewUrl && <img src={previewUrl} alt={t("str_115")} className="w-full block" style={{
        maxHeight: "420px",
        objectFit: "contain"
      }} draggable={false} />}

      {/* Dark overlay outside selection */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `linear-gradient(rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.35) 100%)`
      }} />

      {/* Selection rectangle */}
      <div className="absolute" style={{
        left: `${crop.x}%`,
        top: `${crop.y}%`,
        width: `${crop.width}%`,
        height: `${crop.height}%`,
        border: "2.5px solid #4f7cff",
        background: "rgba(79,124,255,0.12)",
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.38)",
        borderRadius: "6px",
        cursor: "move",
        boxSizing: "border-box"
      }} onMouseDown={e => onPointerDown(e, "move")} onTouchStart={e => onPointerDown(e, "move")}>
        {/* Resize handles */}
        {handles.map(h => <div key={h.id} style={{
          position: "absolute",
          width: "14px",
          height: "14px",
          background: "white",
          border: "2px solid #4f7cff",
          borderRadius: "3px",
          cursor: h.cursor,
          zIndex: 10,
          ...h.style
        }} onMouseDown={e => onPointerDown(e, h.id)} onTouchStart={e => onPointerDown(e, h.id)} />)}
      </div>
    </div>

    {/* Confirm / Cancel toolbar */}
    <div className="flex items-center gap-3 px-4 py-3 border-t border-[#e7e5e2] bg-white">
      <button type="button" onClick={() => onConfirm(crop)} className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#4f7cff] rounded-xl hover:bg-[#3d6ae8] transition-colors shadow-sm">{t("str_173")}</button>
      <button type="button" onClick={onCancel} className="px-4 py-2.5 text-[13px] font-medium text-[#787774] border border-[#d9d7d3] bg-white rounded-xl hover:bg-[#f1f1ef] transition-colors">{t("str_174")}</button>
      <button type="button" onClick={() => setCrop({
        x: 10,
        y: 10,
        width: 80,
        height: 20
      })} className="px-4 py-2.5 text-[13px] font-medium text-[#787774] border border-[#d9d7d3] bg-white rounded-xl hover:bg-[#f1f1ef] transition-colors">{t("str_175")}</button>
    </div>
  </div>;
function SignaturePad({ value, onChange }) {
  const { t } = useTranslation();
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 600;
    canvas.height = 240;

    const ctx = getCanvasContext();
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (value) {
      const img = new Image();
      img.src = value;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    }
  }, [value]);

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
    e.preventDefault();
    const ctx = getCanvasContext();
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = getCanvasContext();
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      onChange(dataUrl);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <span className="block text-[13px] font-semibold text-[#787774] ml-1">
          {t("applicant.signature")} <span className="text-red-400">*</span>
        </span>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-semibold text-[#8a6100] hover:text-[#b88400] transition-colors"
          >
            {t("applicant.signatureClear")}
          </button>
        )}
      </div>
      <div className="text-[11.5px] text-[#787774] ml-1 leading-relaxed">
        {t("applicant.signatureNote")}
      </div>
      <div 
        className="w-full border border-[#d9d7d3] rounded-xl overflow-hidden bg-white shadow-inner relative"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full block aspect-[2.5/1] cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}

function DocBox({
  title,
  desc
}) {
  return <div className="border border-[#e7e5e2] rounded-[20px] p-5 bg-white shadow-sm flex items-start gap-4">
    <div className="mt-1 w-10 h-10 rounded-xl bg-[#f1f1ef] flex items-center justify-center shrink-0 text-[#787774]">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
    </div>
    <div>
      <div className="font-semibold text-[#111111] text-[16px] leading-tight">{title}</div>
      <div className="text-[#787774] text-[13px] mt-1.5 leading-relaxed">{desc}</div>
    </div>
  </div>;
}

function renderLegalContent(legalData, lang) {
  const text = legalData[lang] || legalData['en'];
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed && line === '') return <div key={i} className="h-2" />;
    if (trimmed.startsWith('# ')) return <h1 key={i} className="text-2xl font-extrabold text-[#1a1c1d] mt-8 mb-4 border-b pb-2">{trimmed.replace('# ', '')}</h1>;
    if (trimmed.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-[#1a1c1d] mt-6 mb-3">{trimmed.replace('## ', '')}</h2>;
    if (trimmed.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-[#1a1c1d] mt-5 mb-2">{trimmed.replace('### ', '')}</h3>;

    // Handle basic bolding **text**
    const parts = trimmed.split(/(\*\*.*?\*\*)/g);
    const content = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="font-bold text-[#1a1c1d]">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    return <p key={i} className="text-[14px] md:text-[15px] text-[#2f3437] leading-relaxed mb-3">{content}</p>;
  });
}