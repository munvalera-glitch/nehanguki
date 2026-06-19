import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ImageEditorModal from "./ImageEditorModal";
import UnifiedEditorModal from "./UnifiedEditorModal";
import ImageAdjustmentModal from "./ImageAdjustmentModal";
import AuthModal from "./AuthModal";
import AdminPanel from "./AdminPanel";
import { privacyPolicy } from "./legal/privacy";
import { termsOfService } from "./legal/terms";
import { refundPolicy } from "./legal/refund";
import imageCompression from "browser-image-compression";

class PackageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("MyPage/Cart Render Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-sm text-red-600 font-bold">Не удалось загрузить данные этой заявки.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const getSimpleActionLabel = (action, t) => {
  const keys = {
    registration: "registration",
    extension: "extension",
    address_change: "address",
    id_reissue: "idcard",
    status_change: "status_change",
    status_grant: "status_grant",
    password_recovery: "hikorea"
  };
  return t(`appType.${keys[action] || 'unspecified'}`);
};

export const formatDateTime = (dateString, i18n = { language: 'ru' }) => {
  const fallback = i18n.language === 'ru' ? 'Дата не указана' : i18n.language === 'ko' ? '날짜 없음' : 'Date unspecified';
  if (!dateString) return fallback;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return fallback;
    const pad = (n) => n.toString().padStart(2, '0');
    const DD = pad(d.getDate());
    const MM = pad(d.getMonth() + 1);
    const YYYY = d.getFullYear();
    const HH = pad(d.getHours());
    const min = pad(d.getMinutes());
    if (i18n.language === 'ko') return `${YYYY}.${MM}.${DD} ${HH}:${min}`;
    return `${DD}.${MM}.${YYYY} ${HH}:${min}`;
  } catch (e) {
    console.error("formatDateTime error:", e);
    return fallback;
  }
};

// ── Dynamic Pricing ──────────────────────────────────────────────────────────
// Count official forms that will be generated for a package.
// Mirrors server-side conditions (server.js: forms 1–6).
// Does NOT count: passport/ID/contract scans, preview, service pages.
function getOfficialFormCount(pkg) {
  if (!pkg) return 1;
  const p = pkg.payload || pkg || {};
  const applicant = pkg.applicant || p.applicant || {};
  const vt = p.visaType || pkg.visaType || "";
  const act = p.action || pkg.action || "";
  const ht = p.housingType || pkg.housingType || "";
  const isStudent = p.isStudent === true || (applicant.isStudent === true);
  const schoolName = String(p.schoolName || applicant.schoolName || "").trim();
  const birthDate = String(p.birthDate || applicant.birthDate || "");

  if (act === "password_recovery") return 1;

  let count = 0;

  // 1. 통합신청서 — if visaType !== "F4"
  if (vt !== "F4") count++;

  // 2. 거주숙소제공사실확인서 — if housingType === "other"
  if (ht === "other") count++;

  // 3. 외국인 직업 및 연간 소득금액 신고서
  //    if action !== "address_change" && isStudent === false && age >= 19 && visaType !== "F1"
  if (act !== "address_change" && act !== "reissue" && act !== "initial" && !isStudent && vt !== "F1") {
    let age = 0;
    if (birthDate) {
      const today = new Date();
      const dob = new Date(birthDate);
      age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    }
    if (age >= 19) count++;
  }

  // 4. 신원보증서 — if visaType === "F1"
  if (vt === "F1" && act !== "address_change" && act !== "reissue") count++;

  // 5. 거소신고(신청)서 — if visaType === "F4"
  if (vt === "F4") count++;

  // 6. 재학사항 신고서 — if isStudent or schoolName present
  if (isStudent || schoolName.length > 0) count++;

  // 7. Отказ от работы — if visaType === "F4" and action === "initial"
  if (vt === "F4" && act === "initial") count++;

  return Math.max(count, 1); // At least 1 form
}

// ── Required Signatures ──────────────────────────────────────────────────────
function getRequiredSignatures(pkg) {
  if (!pkg) return { applicant: false, guarantor: false, accommodationProvider: false };
  const p = pkg.payload || pkg || {};
  const act = p.action || pkg.action || "";
  const vt = p.visaType || pkg.visaType || "";
  const ht = p.housingType || pkg.housingType || "";
  
  const sm = p.submissionMethod || pkg.submissionMethod || "";
  
  const req = {
    applicant: false,
    guarantor: false,
    accommodationProvider: false
  };

  const signaturesNeeded = (act === "password_recovery") || (sm === "online");
  if (!signaturesNeeded) {
    return req;
  }

  req.applicant = true; 

  if (act !== "password_recovery") {
    if (vt === "F1" && act !== "address_change") {
      req.guarantor = true;
    }
    if (ht === "other") {
      const providerIsGuarantor = p.guarantorFullName && p.providerFullName && (p.guarantorFullName.trim().toLowerCase() === p.providerFullName.trim().toLowerCase());
      if (!providerIsGuarantor) {
        req.accommodationProvider = true;
      }
    }
  }

  return req;
}

// Price tiers based on official form count per package
function getPackagePrice(pkg) {
  return getPackageCredits(pkg) * 1000;
}

function getPackageCredits(pkg) {
  if (!pkg) return 3;
  const p = pkg.payload || pkg || {};
  const act = p.action || pkg.action || "";
  if (act === "password_recovery") return 3;
  const count = getOfficialFormCount(pkg);
  if (count <= 1) return 3;
  if (count === 2) return 4;
  return 5;
}

function getPackagePriceKRW(pkg) {
  if (!pkg) return 3000;
  const p = pkg.payload || pkg || {};
  const act = p.action || pkg.action || "";
  if (act === "password_recovery") return 3000;
  const count = getOfficialFormCount(pkg);
  if (count <= 1) return 3000;
  if (count === 2) return 4000;
  return 5000;
}

function calculateSinglePrice(pkg, user) {
  if (user?.isB2B) {
    const creditsRequired = getPackageCredits(pkg);
    return Math.max(0, creditsRequired - (user?.paidGenerationsRemaining || 0)) * 1000;
  }
  if (!user?.freeGenerationUsed) return 0;
  return getPackagePriceKRW(pkg);
}

function calculateCartPrice(cartIds, packages, user) {
  if (!Array.isArray(cartIds) || !Array.isArray(packages)) return 0;
  
  if (user?.isB2B) {
    const totalCredits = cartIds.reduce((sum, id) => {
      const p = packages.find(pp => pp && pp?.id === id);
      return sum + (p ? getPackageCredits(p) : 3);
    }, 0);
    return Math.max(0, totalCredits - (user?.paidGenerationsRemaining || 0)) * 1000;
  }
  
  let price = 0;
  let freeUsed = user?.freeGenerationUsed;
  
  cartIds.forEach(id => {
    const p = packages.find(pp => pp && pp?.id === id);
    if (!freeUsed) {
      freeUsed = true;
      price += 0;
    } else {
      price += getPackagePriceKRW(p);
    }
  });
  return price;
}

const PAYMENT_ENABLED = true;

function useSessionState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      if (state === undefined) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, JSON.stringify(state));
      }
    } catch (e) {
      console.error(e);
    }
  }, [key, state]);

  return [state, setState];
}

export default function ImmigrationMVP() {
  const { t, i18n } = useTranslation();
  const label = (ru, en, ko) => i18n.language === 'ru' ? ru : i18n.language === 'ko' ? ko : en;

  const [user, setUser] = useState(null);
  const userRef = useRef(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [draftId, setDraftId] = useSessionState("mvp_draftId", null);
  useEffect(() => {
    fetch("/api/auth/me", {
      credentials: "include"
    }).then(res => res.json()).then(data => {
      const u = data.user || null;
      setUser(u);
      userRef.current = u;
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
  }, []);
  const [step, setStep] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("step") || "visa";
  });

  const navigateToStep = (nextStep, replace = false) => {
    setStep(nextStep);
    const url = new URL(window.location);
    url.searchParams.set("step", nextStep);
    if (replace) {
      window.history.replaceState({ step: nextStep }, "", url.toString());
    } else {
      window.history.pushState({ step: nextStep }, "", url.toString());
    }
    
    // Auto-scroll to the top navigation block
    setTimeout(() => {
      const topNav = document.getElementById("step-top-anchor");
      if (topNav) {
        // Scroll so the element is near the top of the viewport
        const y = topNav.getBoundingClientRect().top + window.scrollY - 20;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 50);
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
  const [visaType, setVisaType] = useSessionState("mvp_visaType", "");
  const [action, setAction] = useSessionState("mvp_action", "");
  const [submissionMethod, setSubmissionMethod] = useSessionState("mvp_submissionMethod", "");
  const [accommodationOptions, setAccommodationOptions] = useSessionState("mvp_accommodationOptions", { relationship: "", ownershipType: "", residenceType: "" });
  const [housingType, setHousingType] = useSessionState("mvp_housingType", "");
  const [contractUploaded, setContractUploaded] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);
  const [providerSource, setProviderSource] = useSessionState("mvp_providerSource", "");
  const [generated, setGenerated] = useState(false);
  const [missingSubmissionMethodPkg, setMissingSubmissionMethodPkg] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dataVerified, setDataVerified] = useState(false);
  const [addressCrop, setAddressCrop] = useState(null);
  const [selectingAddress, setSelectingAddress] = useState(false);
  const [providerCrop, setProviderCrop] = useState(null);
  const [selectingProvider, setSelectingProvider] = useState(false);
  const [passportFile, setPassportFile] = useState(null);
  const [idCardFile, setIdCardFile] = useState(null);
  const [contractFile, setContractFile] = useState(null);
  const [schoolFile, setSchoolFile] = useState(null);
  const [guarantorFile, setGuarantorFile] = useState(null);
  const [idCardBackFile, setIdCardBackFile] = useState(null);
  const [signatureData, setSignatureData] = useState(null); // Keep for password_recovery
  const [signatures, setSignatures] = useState({
    applicant: { required: false, completed: false, imageBase64: null },
    guarantor: { required: false, completed: false, imageBase64: null },
    accommodationProvider: { required: false, completed: false, imageBase64: null },
  });
  const [activeSignatureRole, setActiveSignatureRole] = useState(null); // Which role is currently drawing
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

  // Occupation selection state
  const [occupationType, setOccupationType] = useSessionState("mvp_occupationType", "");

  // PDF generation state
  const [pdfStatus, setPdfStatus] = useState("idle"); // idle | loading | success | error
  const [pdfError, setPdfError] = useState("");
  const [pdfPreviewModalOpen, setPdfPreviewModalOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfPreviewContext, setPdfPreviewContext] = useState(null);

  // Guarantor passport OCR state
  const [guarantorOcrStatus, setGuarantorOcrStatus] = useState("idle"); // idle | loading | success | warning | error
  const [guarantorOcrError, setGuarantorOcrError] = useState("");

  // Navigation & Reset state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [myPagePackages, setMyPagePackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedCartItems, setSelectedCartItems] = useState([]);
  const [selectedPaidItems, setSelectedPaidItems] = useState([]);

  // Legal Modal state
  const [legalModal, setLegalModal] = useState({ open: false, type: "" }); // type: "privacy" | "terms"

  // Payment state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [virtualAccountResult, setVirtualAccountResult] = useState(null);
  const [paymentCount, setPaymentCount] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [cartPromptModalOpen, setCartPromptModalOpen] = useState(false);
  const [cartActionType, setCartActionType] = useState("download");
  const [cartPromptData, setCartPromptData] = useState(null);
  const [cartAddedSuccess, setCartAddedSuccess] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const paymentInProgressRef = useRef(false);

  // Auth Modal state
  const [authModal, setAuthModal] = useState({ open: false, type: "", subtitle: "" }); // login | register | forgot
  const [pendingAction, setPendingAction] = useState(null);

  // Image editor state
  const [editorState, setEditorState] = useState(null); // null = closed | { file, aspectRatio, helperText, onSave }
  const [unifiedEditorConfig, setUnifiedEditorConfig] = useState(null);
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

  const [toastMessage, setToastMessage] = useState(null);
  const [successModalData, setSuccessModalData] = useState(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);
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

  const resetApplicationState = () => {
    // Reset all form state
    setDraftId(null);
    setPendingAction(null);
    setVisaType("");
    setAction("");
    setSubmissionMethod("");
    setHousingType("");
    setAccommodationOptions({ relationship: "", ownershipType: "", residenceType: "" });
    setContractUploaded(false);
    setAddressSelected(false);
    setProviderSource("");
    setGenerated(false);
    setMissingSubmissionMethodPkg(null);
    setTermsAccepted(false);
    setDataVerified(false);
    setAddressCrop(null);
    setSelectingAddress(false);
    setProviderCrop(null);
    setSelectingProvider(false);
    setPassportFile(null);
    setIdCardFile(null);
    setIdCardBackFile(null);
    setContractFile(null);
    setSchoolFile(null);
    setGuarantorFile(null);
    setProviderIdFile(null);
    setContractPreviewUrl(null);
    setSignatureData(null);
    setSignatures({
      applicant: { completed: false, imageBase64: null, date: null },
      guarantor: { completed: false, imageBase64: null, date: null },
      accommodationProvider: { completed: false, imageBase64: null, date: null }
    });
    setActiveSignatureRole(null);

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
  };

  const startOver = (force = false) => {
    if (!force && (visaType || action || applicant.fullName)) {
      setShowResetConfirm(true);
      return;
    }
    resetApplicationState();
    setShowResetConfirm(false);
    setStep("visa");
    navigateToStep("visa", true);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      setUser(null);
      userRef.current = null;
      resetApplicationState();
      setStep("visa");
      window.scrollTo(0, 0);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Inactivity timeout: 30 minutes (30 * 60 * 1000 ms)
  useEffect(() => {
    if (!userRef.current) return;

    let lastActiveTime = Date.now();

    const handleActivity = () => {
      lastActiveTime = Date.now();
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    const checkInterval = setInterval(() => {
      const inactiveDuration = Date.now() - lastActiveTime;
      if (inactiveDuration >= 30 * 60 * 1000) {
        console.log("Session expired due to inactivity. Logging out...");
        logout();
      }
    }, 10000); // Check every 10s

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(checkInterval);
    };
  }, [user]);


  const fetchMyPagePackages = async () => {
    setLoadingPackages(true);
    try {
      const res = await fetch("/api/user/packages", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setMyPagePackages(data.packages || []);
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
  const [applicant, setApplicant] = useSessionState("mvp_applicant", {
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
    hikoreaId: "",
    webmasterMessage: "",
    sex: "",
    // "M" | "F" — from passport OCR
    isStudent: null,
    schoolName: ""
  });
  const [guarantor, setGuarantor] = useSessionState("mvp_guarantor", {
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
  const [address, setAddress] = useSessionState("mvp_address", "");
  const [provider, setProvider] = useSessionState("mvp_provider", {
    fullName: "",
    idNumber: "",
    phone: "",
    nationality: ""
  });
  // Returns true if the occupation step should be shown before generate
  function needsOccupationStep() {
    return (
      action !== "password_recovery" &&
      action !== "address_change" &&
      action !== "initial" &&
      applicant.isStudent === false &&
      calculateAge(applicant.birthDate) >= 19 &&
      visaType !== "F1"
    );
  }

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
      const hasName = !!(surname || givenNames || assembledFullName);
      const hasPassportNumber = !!extracted.passportNumber;

      if (!hasName && !hasPassportNumber) {
        throw new Error(t("upload.autoProcessFailed"));
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
      formData.append("action", action);
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
      
      let idNumber = (json.data?.id_number || "").trim();
      
      if (action === "password_recovery") {
        idNumber = (json.data?.id_number || json.data?.registration_number || idNumber).trim();
        const fullName = (json.data?.full_name_for_check || json.data?.full_name || "").trim();
        const surname = (json.data?.surname || "").trim();
        const givenNames = (json.data?.given_names || "").trim();
        const nationality = (json.data?.nationality || "").trim();
        
        let extractedDob = (json.data?.date_of_birth || "").trim();
        if (!extractedDob && idNumber.length >= 6) {
          const firstTwo = parseInt(idNumber.substring(0, 2), 10);
          if (!isNaN(firstTwo)) {
            const yearPrefix = firstTwo <= 25 ? "20" : "19";
            const year = yearPrefix + idNumber.substring(0, 2);
            const month = idNumber.substring(2, 4);
            const day = idNumber.substring(4, 6);
            extractedDob = `${year}-${month}-${day}`;
          }
        }
        
        if (idNumber || fullName || surname || givenNames) {
          setApplicant(prev => ({
            ...prev,
            idNumber: idNumber || prev.idNumber,
            fullName: fullName || prev.fullName,
            surname: surname || prev.surname,
            givenNames: givenNames || prev.givenNames,
            nationality: nationality || prev.nationality,
            birthDate: extractedDob || prev.birthDate
          }));
          setIdCardOcrStatus("success");
          
          if (!surname && !givenNames && !fullName) {
            setIdCardOcrStatus("warning");
            setIdCardOcrError("Имя не распознано. Введите вручную.");
            setNameWarning("Пожалуйста, проверьте имя.");
          }
        } else {
          setIdCardOcrStatus("warning");
          setIdCardOcrError(t("str_5"));
        }
      } else {
        // Standard flow: always update idNumber.
        // Fill name fields ONLY if passport is not uploaded (to avoid conflicts).
        const fullName = (json.data?.full_name || "").trim();
        const surname = (json.data?.surname || "").trim();
        const givenNames = (json.data?.given_names || "").trim();
        const nationality = (json.data?.nationality || "").trim();

        const hasName = !!(fullName || surname || givenNames);
        const hasIdNumber = !!idNumber;

        if (!hasName && !hasIdNumber) {
          throw new Error(t("upload.autoProcessFailed"));
        }

        setApplicant(prev => ({
          ...prev,
          idNumber: idNumber || prev.idNumber,
          ...(passportFile ? {} : {
            surname: prev.surname || surname,
            givenNames: prev.givenNames || givenNames,
            fullName: prev.fullName || fullName || (surname && givenNames ? `${surname} ${givenNames}` : surname || givenNames),
            nationality: prev.nationality || nationality,
          }),
        }));

        if (hasName && hasIdNumber && nationality) {
          setIdCardOcrStatus("success");
        } else {
          setIdCardOcrStatus("warning");
          setIdCardOcrError(t("str_5"));
        }
      }


    } catch (err) {
      console.error("ID Card OCR error:", err);
      setIdCardOcrError(err.message || t("str_3"));
      setIdCardOcrStatus("error");
    }
  }

  async function runIdCardBackOCR(file) {
    if (action !== "password_recovery") return;
    setAddressOcrStatus("loading"); // reuse addressOcrStatus for back card address
    setAddressOcrError("");
    try {
      const formData = new FormData();
      formData.append("idcardBack", file);
      const res = await fetch("/api/ocr/idcard-back", {
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
      
      const address = (json.data?.address || "").trim();
      
      if (address) {
        setApplicant(prev => ({
          ...prev,
          address
        }));
        setAddressOcrStatus("success");
      } else {
        setAddressOcrStatus("warning");
        setAddressOcrError(t("addressFallbackText"));
      }
    } catch (err) {
      console.error("ID Card Back OCR error:", err);
      setAddressOcrError(err.message || t("str_3"));
      setAddressOcrStatus("error");
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
        // Auto-crop top 66.6% or use provided rectangular crop
        const crop = manualCrop || {
          x: 0,
          y: 0,
          width: 100,
          height: 66.6
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
      const koreanRegions = ["서울", "인천", "경기", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
      const hasRegion = koreanRegions.some(region => recognizedAddress.includes(region));
      const hasNumber = /\d/.test(recognizedAddress);

      if (!recognizedAddress) {
        throw new Error(t("upload.autoProcessFailed"));
      } else if (recognizedAddress.length < 10 || !hasRegion || !hasNumber) {
        setAddress(recognizedAddress);
        setApplicant(prev => ({ ...prev, address: recognizedAddress }));
        setAddressOcrStatus("warning");
        setAddressOcrError(t("str_8"));
      } else {
        setAddress(recognizedAddress);
        setApplicant(prev => ({ ...prev, address: recognizedAddress }));
        setAddressOcrStatus("success");
      }
    } catch (err) {
      console.error("Contract Address OCR error:", err);
      setAddressOcrError(err.message || t("str_3"));
      setAddressOcrStatus("error");
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
      fullName: applicant.fullName || "",
      birthDate: applicant.birthDate || "",
      sex: applicant.sex || "",
      nationality: applicant.nationality || "",
      idNumber: applicant.idNumber || "",
      passportNumber: applicant.passportNumber || "",
      passportIssueDate: applicant.passportIssueDate || "",
      passportExpiryDate: applicant.passportExpiryDate || "",
      address: action === "password_recovery" ? (applicant.address || "") : (address || ""),
      phone: applicant.phone || "",
      isStudent: applicant.isStudent,
      hikoreaId: applicant.hikoreaId || "",
      // Context flags
      visaType,
      action,
      submissionMethod,
      housingType,
      // Provider (for 거주숙소제공사실확인서)
      providerFullName: provider.fullName || "",
      providerIdNumber: provider.idNumber || "",
      providerPhone: provider.phone || "",
      providerNationality: provider.nationality || "",
      accRelationship: accommodationOptions.relationship,
      accOwnershipType: accommodationOptions.ownershipType,
      accResidenceType: accommodationOptions.residenceType,
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
      schoolName: applicant.schoolName || "",
      // Occupation form
      occupationType: occupationType || "",
      // New Unified Signatures
      signatures: {
        ...signatures,
        accommodationProvider: (guarantor.fullName && provider.fullName && guarantor.fullName.trim().toLowerCase() === provider.fullName.trim().toLowerCase()) 
          ? signatures.guarantor 
          : signatures.accommodationProvider
      }
    };
  }
  function dataURLtoBlob(dataurl) {
    if (!dataurl) return null;
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
  }

  function appendFilesToFormData(formData) {
    if (passportFile) formData.append("passport", passportFile);
    if (idCardFile) formData.append("idCard", idCardFile);
    if (idCardBackFile) formData.append("idCardBack", idCardBackFile);
    if (contractFile) formData.append("contract", contractFile);
    if (providerIdFile) formData.append("providerIdCard", providerIdFile);
    if (guarantorFile) formData.append("guarantorPassport", guarantorFile);
    if (signatures.applicant.completed && signatures.applicant.imageBase64) {
      const signatureBlob = dataURLtoBlob(signatures.applicant.imageBase64);
      if (signatureBlob) {
        formData.append("signature", signatureBlob, "signature.jpg");
      }
    }
  }
  async function handlePreviewPDF() {
    if (!dataVerified || !termsAccepted) return;
    setPdfStatus("loading");
    setPdfError("");
    try {
      const formData = new FormData();
      formData.append("payload", JSON.stringify(getPayload()));
      if (draftId) formData.append("draftId", draftId);
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

      setPdfPreviewUrl(url);
      setPdfPreviewContext("wizard");
      setPdfPreviewModalOpen(true);
      setPdfStatus("success");
    } catch (err) {
      console.error("PDF Preview error:", err);
      setPdfStatus("error");
      setPdfError(err.message || t("str_10"));
    }
  }
  async function ensureGenerationAccess(actionType) {
    const currentUser = userRef.current;
    if (!currentUser) {
      setPendingAction(() => actionType);
      setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") || t("auth.authRequiredForGeneration") });
      return false;
    }

    const cost = getPackageCredits(getPayload());
    const isPackagePaid = draftId && currentUser?.packages?.some(p => p.id === draftId && p.paymentStatus === 'paid');
    const hasPaid = isPackagePaid || (currentUser.paidGenerationsRemaining || 0) >= cost;

    if (hasPaid) {
      return true;
    }

    if (!PAYMENT_ENABLED) {
      setToastMessage(i18n.language === 'ru' ? 'Недостаточно кредитов' : i18n.language === 'ko' ? '크레딧이 부족합니다' : 'Not enough credits');
      return false;
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
        if (data.packageId) setDraftId(data.packageId);
      }
    } catch (e) {
      console.error("Draft save failed", e);
    }

    setPendingAction(() => actionType);
    setPaymentCount(1);
    setCartPromptModalOpen(true);
    return false;
  }

  const pgTriggeredRef = useRef(false);
  useEffect(() => {
    if (paymentModalOpen && !virtualAccountResult) {
      if (!pgTriggeredRef.current) {
        pgTriggeredRef.current = true;
        handlePortOnePayment();
      }
    } else if (!paymentModalOpen) {
      pgTriggeredRef.current = false;
    }
  }, [paymentModalOpen, virtualAccountResult]);

  const handlePortOnePayment = async () => {
    if (paymentInProgressRef.current) return;
    try {
      paymentInProgressRef.current = true;
      setPaymentProcessing(true);
      let usedCredits = 0;
      let pIds = [];
      if (selectedCartItems.length > 0) {
        pIds = selectedCartItems;
        const totalCreditsCost = selectedCartItems.reduce((sum, id) => {
          const p = myPagePackages.find(pp => pp?.id === id);
          return sum + (p ? getPackageCredits(p) : 3);
        }, 0);
        usedCredits = Math.min(user?.paidGenerationsRemaining || 0, totalCreditsCost);
      } else if (draftId) {
        pIds = [draftId];
        const cost = getPackageCredits(getPayload());
        usedCredits = Math.min(user?.paidGenerationsRemaining || 0, cost);
      }

      if (!window.PortOne) {
        alert("Payment module not loaded. Please refresh the page.");
        setPaymentProcessing(false);
        paymentInProgressRef.current = false;
        return;
      }

      const paymentId = `payment${new Date().getTime()}`;
      
      const portOneLocale = i18n.language === 'ru' || i18n.language === 'en' ? 'EN_US' : 'KO_KR';

      const response = await window.PortOne.requestPayment({
        storeId: import.meta.env.VITE_PORTONE_USER_CODE,
        channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY, 
        paymentId: paymentId,
        orderName: "문서 생성 서비스",
        totalAmount: paymentAmount,
        currency: "KRW",
        payMethod: paymentMethod,
        customer: {
          fullName: user?.name || "Guest",
          email: user?.email || "",
          phoneNumber: "010-0000-0000",
        },
      });

      if (response?.code != null) {
        // Error case
        alert(`Payment failed: ${response.message}`);
        setPaymentProcessing(false);
        setPaymentModalOpen(false);
        paymentInProgressRef.current = false;
        return;
      }

      // Success case
      try {
        const res = await fetch("/api/payment/portone/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: response.paymentId,
            packageIds: pIds,
            usedCredits
          }),
          credentials: "include"
        });
        if (!res.ok) throw new Error("Payment verification failed");
        const data = await res.json();
        if (data.ok && data.user) {
          setUser(data.user);
          userRef.current = data.user;

          if (data.isVirtualAccount) {
            setVirtualAccountResult(data.virtualAccount);
            // don't close modal, show the bank details
          } else {
            setPaymentModalOpen(false);
            if (pendingAction) {
              setTimeout(() => {
                pendingAction();
                setPendingAction(null);
              }, 300);
            }
          }
        } else {
          throw new Error(data.error || "Verification failed");
        }
      } catch (err) {
        console.error(err);
        alert(t("paymentNotCompleted") || "Payment verification failed.");
        setPaymentModalOpen(false);
      } finally {
        setPaymentProcessing(false);
        paymentInProgressRef.current = false;
      }
    } catch (err) {
      console.error(err);
      alert(t("paymentNotCompleted") || "Payment failed. Please try again.");
      setPaymentProcessing(false);
      setPaymentModalOpen(false);
    }
  }

  async function executeDownloadPDF() {
    if (!dataVerified || !termsAccepted || pdfStatus === "loading") return;
    const access = await ensureGenerationAccess(handleDownloadPDF);
    if (!access) return;

    setPdfStatus("loading");
    setPdfError("");
    try {
      const payload = { ...getPayload() };
      const cost = getPackageCredits(payload);
      const available = user?.paidGenerationsRemaining || 0;
      const currentPrice = calculateSinglePrice(payload, user);
      
      if (currentPrice === 0) {
        payload.paymentConfirmed = true;
      }
      
      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      if (draftId) {
        formData.append("packageId", draftId);
      }
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
            setPendingAction(() => executeDownloadPDF);
            setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") || t("auth.authRequiredForGeneration") });
            setPdfStatus("idle");
            return;
          }
          if (j.error === "PAYMENT_REQUIRED") {
            // Route through CartPromptModal (Pay and download / Add to cart / Cancel)
            setPendingAction(() => executeDownloadPDF);
            setPaymentCount(1);
            setCartPromptModalOpen(true);
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
      const latestUser = userRef.current;
      let remainingCost = cost;
      let newPaid = latestUser?.paidGenerationsRemaining || 0;

      if (latestUser) {
        newPaid = Math.max(0, (latestUser.paidGenerationsRemaining || 0) - remainingCost);

        const updatedUser = {
          ...latestUser,
          paidGenerationsRemaining: newPaid
        };
        setUser(updatedUser);
        userRef.current = updatedUser;
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
      
      setPdfStatus("idle");
      setGenerated(true);
      
      setSuccessModalData({
        open: true,
        used: remainingCost,
        remaining: newPaid
      });
    } catch (err) {
      console.error("PDF Download error:", err);
      setPdfStatus("error");
      setPdfError(err.message || t("str_12"));
    }
  }

  async function handleDownloadPDF() {
    if (!dataVerified || !termsAccepted || pdfStatus === "loading") return;
    if (!userRef.current) {
      setPendingAction(() => handleDownloadPDF);
      setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") || t("auth.authRequiredForGeneration") });
      return;
    }
    setCartActionType("download");
    setPaymentCount(1);
    setCartPromptModalOpen(true);
  }

  async function executeSendFax() {
    if (!dataVerified || !termsAccepted || pdfStatus === "loading") return;
    if (!userRef.current) {
      setPendingAction(() => executeSendFax);
      setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") || t("auth.authRequiredForGeneration") });
      return;
    }

    setPdfStatus("loading");
    setPdfError("");
    try {
      const payload = { ...getPayload(), paymentConfirmed: true };
      const cost = getPackageCredits(payload);

      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      if (draftId) {
        formData.append("draftId", draftId);
      }
      appendFilesToFormData(formData);

      const res = await fetch("/api/fax/send", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!res.ok) {
        let msg = t("str_11");
        try {
          const j = await res.json();
          if (j.error === "LOGIN_REQUIRED") {
            setPendingAction(() => executeSendFax);
            setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") || t("auth.authRequiredForGeneration") });
            setPdfStatus("idle");
            return;
          }
          msg = j.message || j.error || msg;
        } catch (e) {
          msg = e.message || msg;
        }
        throw new Error(msg);
      }

      const latestUser = userRef.current;
      let remainingCost = cost;
      let newPaid = latestUser?.paidGenerationsRemaining || 0;

      if (latestUser) {
        newPaid = Math.max(0, (latestUser.paidGenerationsRemaining || 0) - remainingCost);
        const updatedUser = { ...latestUser, paidGenerationsRemaining: newPaid };
        setUser(updatedUser);
      }
      const jsonRes = await res.json().catch(() => ({}));

      setPdfStatus("idle");
      setGenerated(true);

      setSuccessModalData({
        open: true,
        isFax: true,
        used: remainingCost,
        remaining: newPaid
      });
    } catch (err) {
      console.error("Fax Send error:", err);
      setPdfStatus("error");
      setPdfError(err.message || t("str_12"));
    }
  }

  async function handleSendFax() {
    if (!dataVerified || !termsAccepted || pdfStatus === "loading") return;
    if (!userRef.current) {
      setPendingAction(() => handleSendFax);
      setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") || t("auth.authRequiredForGeneration") });
      return;
    }
    setPaymentCount(1);
    setCartActionType("fax");
    setCartPromptModalOpen(true);
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
    }, {
      id: "housing",
      label: t("str_24")
    }, {
      id: "applicant",
      label: t("str_25")
    }];
    if (visaType === "F1" && action !== "address_change") {
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
      const isPhoneValid = /^\d+$/.test(applicant.phone || "");
      const hasName = applicant.fullName || (applicant.surname && applicant.givenNames);
      const hasBasicInfo = hasName && applicant.nationality && applicant.idNumber && isPhoneValid && applicant.birthDate && applicant.address && applicant.hikoreaId;
      const hasIdCardFiles = idCardFile && idCardBackFile;
      return !!(hasBasicInfo && hasIdCardFiles);
    }
    const baseValid = applicant.fullName && applicant.nationality && applicant.passportNumber && applicant.passportIssueDate && applicant.passportExpiryDate && applicant.phone;
    if (action !== "address_change" && action !== "initial") {
      if (applicant.isStudent === null || applicant.isStudent === undefined) return false;
      if (applicant.isStudent && !applicant.schoolName) return false;
    }
    return baseValid;
  };
  const canGenerateSelf = isApplicantValid() && address;
  const canGenerateOther = canGenerateSelf && provider.fullName && provider.phone && provider.idNumber && provider.nationality;
  return <>
    {/* ── Image Editor Modal (full-screen) ── */}
    {editorState && <ImageEditorModal file={editorState.file} docType={editorState.docType} aspectRatio={editorState.aspectRatio} helperText={editorState.helperText} onSave={handleEditorSave} onCancel={() => setEditorState(null)} />}
    {unifiedEditorConfig && <UnifiedEditorModal file={unifiedEditorConfig.file} onSave={(blob) => {
      const f = new File([blob], unifiedEditorConfig.file.name, { type: "image/jpeg" });
      unifiedEditorConfig.onSave(f);
      setUnifiedEditorConfig(null);
    }} onCancel={() => setUnifiedEditorConfig(null)} onReplace={() => {
      setUnifiedEditorConfig(null);
      if (unifiedEditorConfig.onReplace) unifiedEditorConfig.onReplace();
    }} />}
    {adjustState && <ImageAdjustmentModal imageSrc={adjustState.imageSrc} onSave={handleAdjustSave} onCancel={adjustState.onCancel} />}

    {/* ── Admin Panel (full-screen fixed overlay) ── */}
    {showAdmin && (
      <div className="fixed inset-0 z-[500] bg-[#f7f7f5] overflow-y-auto">
        <AdminPanel user={user} onBack={() => setShowAdmin(false)} t={t} />
      </div>
    )}

    {toastMessage && (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[600] bg-[#2f3437] text-white px-6 py-3 rounded-full shadow-lg font-bold flex items-center gap-2 animate-bounce">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        {toastMessage}
      </div>
    )}
    <div className="min-h-screen bg-[#f7f7f5] text-[#2f3437] px-1 md:px-4 py-6 md:py-10 font-sans flex flex-col items-center">
      {/* ── Top Navigation Bar ── */}
      <nav className="w-full max-w-3xl mb-4 flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setStep("visa");
              navigateToStep("visa", true);
            }}
            className="text-base sm:text-lg font-bold bg-gradient-to-r from-[#1a1c1d] to-[#43474b] bg-clip-text text-transparent"
          >
            {t('appTitle')}
          </button>
        </div>

        <div className="flex items-center flex-nowrap gap-1.5 sm:gap-2 md:gap-4 shrink-0">
          {user ? (
            <>
              <div className="hidden md:block text-sm text-[#5f6368] font-medium mr-2">
                {user.name || user.email}
              </div>
              <button
                onClick={() => navigateToStep("my-page")}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 border shrink-0 ${step === "my-page"
                    ? "bg-[#2f3437] text-white border-[#2f3437]"
                    : "bg-white text-[#2f3437] border-[#e7e5e2] hover:bg-[#f7f7f5]"
                  }`}
              >
                {t('nav.myPage')}
              </button>
              <button
                onClick={() => {
                  navigateToStep("my-page");
                  const startTime = Date.now();
                  const interval = setInterval(() => {
                    const loader = document.getElementById('packages-loader');
                    if (!loader) {
                      const el = document.getElementById('actual-cart-section') || document.getElementById('cart-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      clearInterval(interval);
                    } else if (Date.now() - startTime > 5000) {
                      clearInterval(interval);
                    }
                  }, 100);
                }}
                title={t('nav.cart')}
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-full text-sm font-semibold bg-white text-[#2f3437] border border-[#e7e5e2] hover:bg-[#f7f7f5] transition-all shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                <span className="hidden sm:inline">{t('nav.cart')}</span>
                {myPagePackages.filter(p => p?.paymentStatus === 'unpaid').length > 0 && (
                  <span className="ml-0.5 bg-[#d93025] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {myPagePackages.filter(p => p?.paymentStatus === 'unpaid').length}
                  </span>
                )}
              </button>
              {(visaType || action || applicant.fullName) && step !== "my-page" && (
                <button
                  onClick={() => startOver()}
                  className="hidden sm:inline-flex px-4 py-1.5 rounded-full text-sm font-semibold bg-white text-[#d93025] border border-[#f5c6cb] hover:bg-[#fff5f5] transition-all shrink-0"
                >
                  {t('nav.startOver')}
                </button>
              )}
              <button
                onClick={logout}
                title={t('nav.logout')}
                className="p-1.5 sm:px-4 sm:py-1.5 rounded-full text-sm font-semibold bg-white text-[#5f6368] border border-[#e7e5e2] hover:bg-[#f7f7f5] transition-all flex items-center justify-center shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:hidden">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span className="hidden sm:inline">{t('nav.logout')}</span>
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
          <div className="absolute top-4 right-4 flex gap-1 bg-[#f7f7f5] rounded-full p-1 border border-[#e7e5e2]">
            {[
              { code: 'ru', flag: '🇷🇺' },
              { code: 'en', flag: '🇺🇸' },
              { code: 'ko', flag: '🇰🇷' }
            ].map(({ code, flag }) => (
              <button
                key={code}
                onClick={() => {
                  i18n.changeLanguage(code);
                  localStorage.setItem('appLanguage', code);
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-lg transition ${i18n.language === code
                    ? 'bg-white shadow-sm opacity-100'
                    : 'opacity-50 hover:opacity-100'
                  }`}
              >
                {flag}
              </button>
            ))}
          </div>
          <div className="mb-6 mt-2">
            <img src="/logo.png" alt="HiKoreaForms" className="h-24 md:h-28 w-auto mx-auto object-contain mix-blend-multiply" />
          </div>
          <h1 className="text-[20px] md:text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#111111] whitespace-pre-line">{t("str_30")}<br />{t("str_31")}</h1>
          <p className="text-[#333333] mt-3 md:leading-relaxed leading-[1.5] text-[17px] md:text-base font-medium md:font-normal max-w-lg mx-auto whitespace-pre-line">{t("str_32")}</p>
        </header>

        <div id="step-top-anchor" className="px-2 mb-4">
          {(step !== "visa" && step !== "action" && step !== "my-page") ? (
            <div className="flex flex-col gap-2 bg-white border border-[#e7e5e2] rounded-[16px] p-4 shadow-sm">
              <div className="text-[14px] font-bold text-[#111111]">
                {visaType === "Other" ? t("str_40") : visaType}{action ? ` / ${action === "address_change" ? getSimpleActionLabel("address_change", t) : t(`action.${action}`)}` : ""}
              </div>
              <div className="flex items-center text-[#787774] text-[13px] font-medium">
                <button onClick={goBack} className="flex items-center hover:text-[#111111] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="m15 18-6-6 6-6" /></svg>
                  {t("str_33") || "Back"}
                </button>
                <span className="mx-2 opacity-50">|</span>
                <span>{t("str_34") || "Step "}{(() => {
                  let sequence = ["visa", "action"];
                  if (action === "extension") sequence.push("submission_method");
                  if (action === "initial" || action === "address_change" || action === "extension") sequence.push("housing");
                  sequence.push("applicant");
                  if (visaType === "F1" && action !== "address_change" && action !== "reissue") sequence.push("guarantor");
                  if (action !== "password_recovery") sequence.push("address");
                  if (action !== "password_recovery" && housingType !== "self" && action !== "reissue" && action !== "address_change") sequence.push("provider");
                  if (action !== "password_recovery" && housingType === "other") sequence.push("acc-options");
                  if (needsOccupationStep()) sequence.push("occupation");
                  sequence.push("generate");
                  const idx = sequence.indexOf(step);
                  return idx >= 0 ? idx + 1 : stepIndex + 1;
                })()}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
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
          )}
        </div>

        {step !== "my-page" && (
          <main className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

            {step === "visa" && i18n.language !== 'ko' && (
              <div className="mb-6 mx-2">
                <Link 
                  to={i18n.language === 'en' ? "/en/articles" : "/articles"} 
                  className="block cursor-pointer bg-gradient-to-r from-blue-50 to-blue-100/80 border border-blue-200 rounded-[20px] p-5 shadow-sm active:scale-[0.98] transition-all hover:shadow-md hover:border-blue-300 group"
                  style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl mt-1">📚</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-[16px] mb-1">
                        {i18n.language === 'en' ? 'Not sure where to start?' : 'Не знаете с чего начать?'}
                      </h3>
                      <p className="text-gray-600 text-[14px] leading-snug mb-4">
                        {i18n.language === 'en' ? 'Read our detailed guides on visas, HiKorea appointments, and getting ID cards.' : 'Читайте наши подробные инструкции по визам, записи в HiKorea и получению ID-карт.'}
                      </p>
                      <div className="flex items-center justify-center w-full bg-blue-600 text-white rounded-xl px-4 py-3 font-bold text-[15px] shadow-sm group-hover:bg-blue-700 transition-colors">
                        {i18n.language === 'en' ? 'Go to Knowledge Base' : 'Перейти к базе знаний'}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {step === "visa" && <Card title={t("str_22")} subtitle={t("str_36")}>
              <div className="grid md:grid-cols-3 gap-4">
                <OptionCard label="F-4" description={t("str_37")} tag={t("str_38")} selected={visaType === "F4"} onClick={() => {
                  resetApplicationState();
                  setVisaType("F4");
                  navigateToStep("action");
                }} />
                 <OptionCard label="F-1 / F-3 / F-6" description={t("str_39")} tag={t("str_38")} selected={visaType === "F1"} onClick={() => {
                  resetApplicationState();
                  setVisaType("F1");
                  navigateToStep("action");
                }} />
                <OptionCard label={t("str_40")} description={t("str_41")} tag={t("str_38")} selected={visaType === "Other"} onClick={() => {
                  resetApplicationState();
                  setVisaType("Other");
                  navigateToStep("action");
                }} />
              </div>
            </Card>}

            {step === "action" && <Card title={t("str_42")} subtitle={t("str_43")}>
              <div className="grid md:grid-cols-3 gap-4">
                <OptionCard label={t("action.initial")} description={t("action.initial_desc")} selected={action === "initial"} onClick={() => {
                  setAction("initial");
                  navigateToStep("housing");
                }} />
                <OptionCard label={t("action.extension")} description={t("action.extension_desc")} selected={action === "extension"} onClick={() => {
                  setAction("extension");
                  navigateToStep("submission_method");
                }} />
                <OptionCard label={t("action.reissue")} description={t("action.reissue_desc")} selected={action === "reissue"} onClick={() => {
                  setAction("reissue");
                  navigateToStep("applicant");
                }} />
                <OptionCard label={getSimpleActionLabel("address_change", t)} description={t("str_47")} selected={action === "address_change"} onClick={() => {
                  setAction("address_change");
                  navigateToStep("housing");
                }} />
                <OptionCard label={t("action.password_recovery")} description={t("action.password_recovery_desc")} selected={action === "password_recovery"} onClick={() => {
                  setAction("password_recovery");
                  navigateToStep("applicant");
                }} />
              </div>
            </Card>}

            {step === "submission_method" && <Card title={t("step.submission_method")} subtitle={t("step.submission_method_desc")}>
              <div className="grid md:grid-cols-2 gap-4">
                <OptionCard label={t("method.online")} description="" selected={submissionMethod === "online"} onClick={() => {
                  setSubmissionMethod("online");
                  navigateToStep("housing");
                }} />
                <OptionCard label={t("method.office")} description="" selected={submissionMethod === "office"} onClick={() => {
                  setSubmissionMethod("office");
                  navigateToStep("housing");
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
              {/* Dynamic Action Message */}
              <div className="mb-6 p-4 rounded-xl bg-[#eef2ff] border border-[#c7d5fb] text-[#4f7cff] flex items-start gap-3 shadow-sm animate-in fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div>
                  <div className="font-bold text-[15px] mb-1">
                    Выбранное действие: {action === "address_change" ? getSimpleActionLabel("address_change", t) : t(`action.${action}`)}
                  </div>
                  <div className="text-[14px] leading-relaxed">
                    {action === "password_recovery" 
                      ? 'Пожалуйста, загрузите лицевую и оборотную сторону вашей ID-карты (ARC) и заполните данные ниже.'
                      : 'Пожалуйста, загрузите разворот паспорта и лицевую сторону вашей ID-карты (ARC).'
                    }
                  </div>
                </div>
              </div>
              <div 
                onClick={() => {
                  document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="mb-6 flex flex-col sm:flex-row items-center justify-between bg-gradient-to-r from-[#fdfbfc] to-[#f4f7fc] border border-[#e2e8f0] rounded-[16px] p-4 shadow-sm gap-3 cursor-pointer hover:shadow-md hover:border-[#cbd5e1] transition-all"
              >
                <div className="flex items-center gap-3 text-left w-full sm:w-auto">
                  <div className="flex items-center justify-center w-12 h-12 rounded-[14px] bg-[#eff6ff] text-[#2563eb] shrink-0 border border-[#bfdbfe]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                  </div>
                  <div>
                    <div className="text-[16px] md:text-[18px] font-bold text-[#1e293b] leading-tight mb-0.5">
                      {i18n.language === 'ru' ? 'Загрузите фото документов' : i18n.language === 'ko' ? '서류 사진을 업로드하세요' : 'Upload document photos'}
                    </div>
                    <div className="text-[13px] md:text-[14px] font-medium text-[#475569]">
                      {i18n.language === 'ru' ? 'Паспорт + ID-карта' : i18n.language === 'ko' ? '여권 + 신분증' : 'Passport + ID Card'}
                    </div>
                  </div>
                </div>
                <div className="text-[12px] md:text-[12px] text-[#2563eb] font-semibold bg-[#eff6ff] inline-flex px-2.5 py-1 rounded-full border border-[#bfdbfe] items-center whitespace-nowrap self-start sm:self-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
                  {i18n.language === 'ru' ? 'AI автозаполнение' : i18n.language === 'ko' ? 'AI 자동 작성' : 'AI Autofill'}
                </div>
              </div>
              <div className="mb-6 p-4 rounded-xl bg-[#ecfccb] border border-[#d9f99d] flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4d7c0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <div className="text-sm text-[#3f6212] font-medium leading-relaxed">
                  {i18n.language === 'ru' ? 'Данные обрабатываются автоматически с применением AI. Возможны ошибки распознавания. Перед продолжением обязательно проверьте правильность имени, гражданства, номера ID-карты, даты рождения, адреса и других данных.' :
                   i18n.language === 'ko' ? 'AI를 사용하여 정보가 자동으로 처리됩니다. 인식 오류가 발생할 수 있습니다. 계속 진행하기 전에 이름, 국적, 등록번호, 생년월일, 주소 및 기타 정보를 반드시 확인해 주세요.' :
                   'Data is processed automatically using AI. Recognition errors may occur. Before continuing, please carefully check the name, nationality, ID card number, date of birth, address, and other details.'}
                </div>
              </div>
              <div id="upload-section" className="grid md:grid-cols-2 gap-4 mb-6">
                {action !== "password_recovery" && (
                  <UploadBox bgImage="/passport_bg.png" title={t("str_55")} note={t("str_56")} file={passportFile} ocrStatus={passportOcrStatus} ocrError={passportOcrError} onAdjust={() => openAdjuster(passportFile, blob => {
                    const f = new File([blob], passportFile.name, { type: "image/jpeg" });
                    setPassportFile(f);
                    runPassportOCR(f);
                  })} onFile={file => {
                    setPassportFile(file);
                    setPassportOcrStatus("idle");
                    setPassportOcrWarning("");
                    setOcrFailedFields({});
                    runPassportOCR(file);
                  }} onUnifiedAdjust={() => {
                    setUnifiedEditorConfig({
                      file: passportFile,
                      onSave: (f) => {
                        setPassportFile(f);
                        setPassportOcrStatus("idle");
                        setPassportOcrWarning("");
                        setOcrFailedFields({});
                        runPassportOCR(f);
                      }
                    });
                  }} />
                )}
                {action !== "initial" && (
                  <UploadBox bgImage="/id_card_bg.png" title={action === "password_recovery" ? `${t("str_58")} (${t("str_59")})` : t("str_58")} note={t("str_59")} file={idCardFile} ocrStatus={idCardOcrStatus} ocrError={idCardOcrError} onAdjust={() => openAdjuster(idCardFile, blob => {
                    const f = new File([blob], idCardFile.name, { type: "image/jpeg" });
                    setIdCardFile(f);
                    runIdCardOCR(f);
                  })} onFile={file => {
                    if (action === "password_recovery") {
                      openEditor(file, 1.586, t("crop.idCardHint"), blob => {
                        const f = new File([blob], file.name, { type: "image/jpeg" });
                        handleIdCardUpload(f);
                      }, "idcard");
                    } else {
                      handleIdCardUpload(file);
                    }
                  }} isPasswordRecovery={action === "password_recovery"} onUnifiedAdjust={() => {
                    setUnifiedEditorConfig({
                      file: idCardFile,
                      onSave: (f) => handleIdCardUpload(f)
                    });
                  }} />
                )}
                {action === "password_recovery" && (
                  <UploadBox bgPosition="top center" bgImage="/id_card_back_bg.png" title={t("upload.idCardBack")} note={t("upload.idCardBackNote")} file={idCardBackFile} ocrStatus={addressOcrStatus} ocrError={addressOcrError} onAdjust={() => openAdjuster(idCardBackFile, blob => {
                    const f = new File([blob], idCardBackFile.name, { type: "image/jpeg" });
                    setIdCardBackFile(f);
                    runIdCardBackOCR(f);
                  })} onFile={file => {
                    openEditor(file, 1.586, t("upload.idCardBackHint"), blob => {
                      const f = new File([blob], file.name, {
                        type: "image/jpeg"
                      });
                      setIdCardBackFile(f);
                      runIdCardBackOCR(f);
                    }, "idcard");
                  }} isPasswordRecovery={true} />
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

              <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[18px] p-4 md:p-6 mb-6">
                <FieldGrid cols="2">
                  {action === "password_recovery" ? (
                    <div className="col-span-full">
                      <Input label={t("str_136") || "Полное имя"} value={applicant.fullName} onChange={v => {
                        setApplicant({
                          ...applicant,
                          fullName: v
                        });
                        if (ocrFailedFields.surname || ocrFailedFields.givenNames) setOcrFailedFields({
                          ...ocrFailedFields,
                          surname: false,
                          givenNames: false
                        });
                      }} required helperText={(ocrFailedFields.surname || ocrFailedFields.givenNames) && !applicant.fullName ? t("str_62") : ""} />
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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
                  {action === "password_recovery" && (
                    <Input label={t("applicant.hikoreaId")} value={applicant.hikoreaId || ""} onChange={v => setApplicant({
                      ...applicant,
                      hikoreaId: v
                    })} placeholder="HiKorea ID" required />
                  )}
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
                  })} placeholder={t("str_67")} />
                  {action !== "password_recovery" && (
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
                  )}
                  {action !== "password_recovery" && (
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
                  )}
                  <Input 
                    label={t("str_70")} 
                    value={applicant.phone} 
                    onChange={v => {
                      setApplicant({ ...applicant, phone: v.replace(/\D/g, "") });
                    }} 
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="tel"
                    required 
                    helperText={(action === "password_recovery" && applicant.phone && !/^\d+$/.test(applicant.phone)) ? t("app.phoneDigitsOnly") : t("str_71")} 
                  />
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
                    <div className="col-span-1 md:col-span-2 mt-2 space-y-3">
                      <Textarea 
                        label={t("app.addressInKorea")} 
                        placeholder={t("str_122")} 
                        value={applicant.address || address} 
                        onChange={v => {
                          setAddress(v);
                          setApplicant({...applicant, address: v});
                        }} 
                      />
                      <div className="flex items-center gap-3">
                        <span className="text-[#787774] text-[13px]">{t("app.contractFallback")}</span>
                        <button 
                          type="button" 
                          disabled={addressOcrStatus === "loading"}
                          onClick={() => {
                            const fileInput = document.createElement('input');
                            fileInput.type = 'file';
                            fileInput.accept = 'image/*,application/pdf';
                            fileInput.onchange = (e) => {
                              const file = e.target.files[0];
                              if (file) {
                                openEditor(file, 1.414, t("crop.contractHint"), blob => {
                                  const f = new File([blob], file.name, { type: "image/jpeg" });
                                  setContractFile(f);
                                }, "contract");
                              }
                            };
                            fileInput.click();
                          }}
                          className="px-3 py-1.5 border border-[#e7e5e2] rounded-[8px] bg-white text-[#111111] hover:bg-[#fbfbfa] transition-colors text-[13px] font-medium flex items-center gap-1.5 shrink-0 shadow-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          {contractFile ? contractFile.name : t("app.uploadBtn")}
                        </button>
                      </div>
                    </div>
                  )}

                </FieldGrid>
                
                {getRequiredSignatures(getPayload()).applicant && (
                  <div className="mt-6 pt-6 border-t border-[#e7e5e2] flex items-center justify-between">
                    <div>
                      <h4 className="text-[14px] font-bold text-[#111111]">{t("sig_applicant_req") || "Applicant signature"}</h4>
                      <p className="text-[12px] text-[#787774] mt-0.5">{signatures.applicant.completed ? (t("sig_edit") || "Edit signature") : (t("sig_applicant") || "Add applicant signature")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSignatureRole("applicant")}
                      className={`px-4 py-2 text-[13px] font-medium rounded-xl border transition-colors ${
                        signatures.applicant.completed 
                          ? "bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9] hover:bg-[#c8e6c9]"
                          : "bg-[#ef4444] text-white border-[#ef4444] hover:bg-[#dc2626] shadow-sm animate-pulse"
                      }`}
                    >
                      {signatures.applicant.completed ? (t("sig_edit") || "Edit") : (t("sig_title") || "Add signature")}
                    </button>
                  </div>
                )}
              </div>
              


              {action !== "address_change" && action !== "password_recovery" && action !== "initial" && <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[18px] p-6">
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
                      <SchoolUploadButton 
                        t={t} 
                        file={schoolFile} 
                        ocrStatus={schoolOcrStatus}
                        onFile={e => {
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
                          e.target.value = "";
                        }} 
                      />
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

              <NextButton onClick={() => navigateToStep(action === "password_recovery" ? "generate" : (visaType === "F1" && action !== "address_change" && action !== "reissue") ? "guarantor" : "address")} disabled={!isApplicantValid() || (getRequiredSignatures(getPayload()).applicant && !signatures.applicant.completed)}>
                {action === "password_recovery" ? t("action.password_recovery_continue") : (visaType === "F1" && action !== "address_change" && action !== "reissue") ? t("str_84") : t("str_85")}
              </NextButton>
            </Card>}

            {step === "guarantor" && <Card title={t("str_86")} subtitle={t("str_87")}>
              <div className="mb-4">
                <UploadBox bgImage="/passport_bg.png" title={t("str_88")} note={t("str_89")} file={guarantorFile} onAdjust={() => openAdjuster(guarantorFile, blob => {
                  const f = new File([blob], guarantorFile.name, { type: "image/jpeg" });
                  setGuarantorFile(f);
                  runGuarantorOCR(f);
                })} onFile={file => {
                  setGuarantorFile(file);
                  setGuarantorOcrStatus("idle");
                  runGuarantorPassportOCR(file);
                }} onUnifiedAdjust={() => {
                  setUnifiedEditorConfig({
                    file: guarantorFile,
                    onSave: (f) => {
                      setGuarantorFile(f);
                      setGuarantorOcrStatus("idle");
                      runGuarantorPassportOCR(f);
                    }
                  });
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
                    phone: v.replace(/\D/g, '')
                  })} inputMode="numeric" pattern="[0-9]*" autoComplete="tel" required />

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
              
              {getRequiredSignatures(getPayload()).guarantor && (
                <div className="mt-6 pt-6 border-t border-[#e7e5e2] flex items-center justify-between">
                <div>
                  <h4 className="text-[14px] font-bold text-[#111111]">{t("sig_guarantor_req") || "Guarantor signature"}</h4>
                  <p className="text-[12px] text-[#787774] mt-0.5">{signatures.guarantor.completed ? (t("sig_edit") || "Edit signature") : (t("sig_guarantor") || "Add guarantor signature")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSignatureRole("guarantor")}
                  className={`px-4 py-2 text-[13px] font-medium rounded-xl border transition-colors ${
                    signatures.guarantor.completed 
                      ? "bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9] hover:bg-[#c8e6c9]"
                      : "bg-[#ef4444] text-white border-[#ef4444] hover:bg-[#dc2626] shadow-sm animate-pulse"
                  }`}
                >
                  {signatures.guarantor.completed ? (t("sig_edit") || "Edit") : (t("sig_title") || "Add signature")}
                </button>
              </div>
              )}


              <NextButton onClick={() => navigateToStep("address")} disabled={!(guarantor.fullName && guarantor.nationality && guarantor.sex && guarantor.passportNumber && guarantor.phone && guarantor.relationship && (guarantor.relationship !== 'other' || guarantor.company && guarantor.jobPosition && guarantor.workAddress)) || (getRequiredSignatures(getPayload()).guarantor && !signatures.guarantor.completed)}>{t("str_85")}</NextButton>
            </Card>}

            {step === "address" && <Card title={t("str_27")} subtitle={t("str_109")}>

              <div className="space-y-6">
                {/* Upload Section */}
                <div className="mb-6">
                  <UploadBox
                    bgImage="/contract_bg.png"
                    title={t("str_110")}
                    note={t("str_113")}
                    file={contractFile}
                    ocrStatus={addressOcrStatus}
                    ocrError={action === "password_recovery" ? 
                       (i18n.language === 'ru' ? 'Не удалось определить адрес из договора. Введите адрес вручную или загрузите другое фото.' :
                        i18n.language === 'ko' ? '계약서에서 주소를 확인하지 못했습니다. 주소를 직접 입력하거나 다른 사진을 업로드해 주세요.' :
                        'Could not detect the address from the contract. Please enter it manually or upload another photo.')
                     : (addressOcrError || t("str_120"))}
                    loadingText={action === "password_recovery" ? 
                       (i18n.language === 'ru' ? 'Определяем адрес из договора...' :
                        i18n.language === 'ko' ? '계약서에서 주소를 확인하는 중입니다...' :
                        'Detecting the address from the contract...') : undefined}
                    onAdjust={() => {
                      if (contractFile) {
                        openAdjuster(contractFile, blob => {
                          const f = new File([blob], contractFile.name, { type: "image/jpeg" });
                          setContractFile(f);
                          setAddressOcrStatus("idle");
                          runContractAddressOCR(f);
                        });
                      }
                    }}
                    onFile={file => {
                      setContractFile(file);
                      setAddressOcrStatus("idle");
                      runContractAddressOCR(file);
                    }}
                    onUnifiedAdjust={() => {
                      setUnifiedEditorConfig({
                        file: contractFile,
                        onSave: (f) => {
                          setContractFile(f);
                          setAddressOcrStatus("idle");
                          runContractAddressOCR(f);
                        }
                      });
                    }}
                  />
                </div>

                {/* Manual Entry Section */}
                <div className="bg-white border border-[#e7e5e2] rounded-[24px] p-6 shadow-sm">
                  <Textarea label={t("str_121")} placeholder={t("str_122")} value={address} onChange={setAddress} />
                  <p className="text-[12px] text-[#787774] mt-3 ml-1 leading-relaxed">{t("str_123")}</p>
                </div>
              </div>

              <NextButton
                onClick={() => {
                  const nextAfterAddress = housingType === "self" || action === "reissue";
                  if (nextAfterAddress && needsOccupationStep()) {
                    navigateToStep("occupation");
                  } else {
                    navigateToStep(nextAfterAddress ? "generate" : "provider");
                  }
                }}
                disabled={!address.trim() || addressOcrStatus === "loading"}
              >
                {(housingType === "self" || action === "reissue") ? (needsOccupationStep() ? t("action.next_occupation") : t("str_124")) : t("str_125")}
              </NextButton>
            </Card>}

            {step === "provider" && <Card title={t("str_28")} subtitle={t("str_126")}>

              {/* Option cards */}
              <div className="mb-4">
                {/* Option 1: Upload provider ID card */}
                <UploadBox
                  bgImage="/id_card_bg.png"
                  title={t("str_128") || "Upload provider ID card"}
                  note={t("str_129") || "Take a photo of ID card"}
                  file={providerIdFile}
                  ocrStatus={providerOcrStatus}
                  ocrError={providerOcrError}
                  onAdjust={() => {
                    if (providerIdFile) {
                      openAdjuster(providerIdFile, blob => {
                        const f = new File([blob], providerIdFile.name, { type: "image/jpeg" });
                        setProviderIdFile(f);
                        setProviderOcrStatus("idle");
                        runProviderIdCardOCR(f);
                      });
                    }
                  }}
                  onFile={file => {
                    setProviderIdFile(file);
                    setProviderOcrStatus("idle");
                    runProviderIdCardOCR(file);
                  }}
                  onUnifiedAdjust={() => {
                    setUnifiedEditorConfig({
                      file: providerIdFile,
                      onSave: (f) => {
                        setProviderIdFile(f);
                        setProviderOcrStatus("idle");
                        runProviderIdCardOCR(f);
                      }
                    });
                  }}
                />
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
                    phone: v.replace(/\D/g, '')
                  })} inputMode="numeric" pattern="[0-9]*" autoComplete="tel" required helperText={!provider.phone ? t("str_138") : ""} />
                </FieldGrid>
                
                {!(guarantor.fullName && provider.fullName && guarantor.fullName.trim().toLowerCase() === provider.fullName.trim().toLowerCase()) && getRequiredSignatures(getPayload()).accommodationProvider && (
                  <div className="mt-6 pt-6 border-t border-[#e7e5e2] flex items-center justify-between">
                    <div>
                      <h4 className="text-[14px] font-bold text-[#111111]">{t("sig_provider_req") || "Accommodation provider signature"}</h4>
                      <p className="text-[12px] text-[#787774] mt-0.5">{signatures.accommodationProvider.completed ? (t("sig_edit") || "Edit signature") : (t("sig_provider") || "Add accommodation provider signature")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSignatureRole("accommodationProvider")}
                      className={`px-4 py-2 text-[13px] font-medium rounded-xl border transition-colors ${
                        signatures.accommodationProvider.completed 
                          ? "bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9] hover:bg-[#c8e6c9]"
                          : "bg-[#ef4444] text-white border-[#ef4444] hover:bg-[#dc2626] shadow-sm animate-pulse"
                      }`}
                    >
                      {signatures.accommodationProvider.completed ? (t("sig_edit") || "Edit") : (t("sig_title") || "Add signature")}
                    </button>
                  </div>
                )}
              </div>}

              {!selectingProvider && <NextButton
                onClick={() => {
                  if (housingType === "other") {
                    navigateToStep("acc-options");
                  } else if (needsOccupationStep()) {
                    navigateToStep("occupation");
                  } else {
                    navigateToStep("generate");
                  }
                }}
                disabled={!provider.fullName || !provider.idNumber || !provider.phone || !provider.nationality || (!(guarantor.fullName && provider.fullName && guarantor.fullName.trim().toLowerCase() === provider.fullName.trim().toLowerCase()) && getRequiredSignatures(getPayload()).accommodationProvider && !signatures.accommodationProvider.completed)}
              >{housingType === "other" ? t("action.next_acc_options") : t("str_124")}</NextButton>}
            </Card>}

            
            {/* ══════════════════════════════════════════════════════════════
                ACCOMMODATION OPTIONS STEP
                ══════════════════════════════════════════════════════════════ */}
            {step === "acc-options" && <Card title={t("acc.title")} subtitle={t("acc.subtitle")}>
              {/* ── Group 1: Relationship ─────────────────────────────────── */}
              <div className="mb-6">
                <p className="text-[16px] font-semibold text-[#1a1c1d] mb-3">{t("acc.relationship")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: "family_relative", label: t("acc.rel.family_relative") },
                    { key: "employer",         label: t("acc.rel.employer") },
                    { key: "other",            label: t("acc.rel.other") },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setAccommodationOptions(prev => ({ ...prev, relationship: opt.key }))}
                      className={`py-4 px-4 rounded-[16px] border-2 text-[14px] font-semibold text-left transition-all duration-150 min-h-[56px]
                        ${accommodationOptions.relationship === opt.key
                          ? "border-[#111111] bg-[#111111] text-white shadow-md"
                          : "border-[#e7e5e2] bg-white text-[#1a1c1d] hover:border-[#111111] hover:bg-[#f8f8f6]"
                        }`}
                    >
                      {accommodationOptions.relationship === opt.key && <span className="mr-2">✓</span>}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Group 2: Ownership Type ───────────────────────────────── */}
              <div className="mb-6">
                <p className="text-[16px] font-semibold text-[#1a1c1d] mb-3">{t("acc.ownershipType")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: "own",   label: t("acc.own.own") },
                    { key: "rent",  label: t("acc.own.rent") },
                    { key: "other", label: t("acc.own.other") },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setAccommodationOptions(prev => ({ ...prev, ownershipType: opt.key }))}
                      className={`py-4 px-4 rounded-[16px] border-2 text-[14px] font-semibold text-left transition-all duration-150 min-h-[56px]
                        ${accommodationOptions.ownershipType === opt.key
                          ? "border-[#111111] bg-[#111111] text-white shadow-md"
                          : "border-[#e7e5e2] bg-white text-[#1a1c1d] hover:border-[#111111] hover:bg-[#f8f8f6]"
                        }`}
                    >
                      {accommodationOptions.ownershipType === opt.key && <span className="mr-2">✓</span>}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Group 3: Residence Type ───────────────────────────────── */}
              <div className="mb-6">
                <p className="text-[16px] font-semibold text-[#1a1c1d] mb-3">{t("acc.residenceType")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: "private_residence", label: t("acc.res.private_residence") },
                    { key: "dormitory",          label: t("acc.res.dormitory") },
                    { key: "accommodation",      label: t("acc.res.accommodation") },
                    { key: "other",              label: t("acc.res.other") },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setAccommodationOptions(prev => ({ ...prev, residenceType: opt.key }))}
                      className={`py-4 px-4 rounded-[16px] border-2 text-[14px] font-semibold text-left transition-all duration-150 min-h-[56px]
                        ${accommodationOptions.residenceType === opt.key
                          ? "border-[#111111] bg-[#111111] text-white shadow-md"
                          : "border-[#e7e5e2] bg-white text-[#1a1c1d] hover:border-[#111111] hover:bg-[#f8f8f6]"
                        }`}
                    >
                      {accommodationOptions.residenceType === opt.key && <span className="mr-2">✓</span>}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Validation error ──────────────────────────────────────── */}
              {(!accommodationOptions.relationship || !accommodationOptions.ownershipType || !accommodationOptions.residenceType) && (
                <div className="text-[13px] text-[#e15241] mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {t("acc.validationError")}
                </div>
              )}

              <NextButton
                onClick={() => needsOccupationStep() ? navigateToStep("occupation") : navigateToStep("generate")}
                disabled={!accommodationOptions.relationship || !accommodationOptions.ownershipType || !accommodationOptions.residenceType}
              >
                {needsOccupationStep() ? t("action.next_occupation") : t("str_124")}
              </NextButton>
            </Card>}

            {/* ══════════════════════════════════════════════════════════════
                OCCUPATION STEP
                ══════════════════════════════════════════════════════════════ */}
            {step === "occupation" && <Card
              title="Сведения о занятости"
              subtitle="Это обобщённый список сфер деятельности."
            >
              <div className="bg-red-50 border-[2px] border-red-500 rounded-2xl p-5 mb-6 text-[15px] text-red-900 leading-relaxed shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <strong className="text-red-700 text-[17px]">Внимание</strong>
                </div>
                Если вы работаете <strong>неофициально</strong> или временно не трудоустроены — выбирайте вариант <strong>«Временно не работаю»</strong>.
              </div>

              {/* Top Hero Tile: Временно не работаю */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setOccupationType("unemployed")}
                  className={`w-full flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all duration-200 hover:scale-[1.01] hover:shadow-sm ${
                    occupationType === "unemployed"
                      ? "bg-[#f0f7ff] border-[#4a9eff] ring-2 ring-[#4a9eff]/10 shadow-md"
                      : "bg-white border-[#e7e5e2] hover:border-[#c0bdb8] hover:bg-[#fafaf9]"
                  }`}
                >
                  <span className={`text-[15px] font-semibold tracking-tight ${
                    occupationType === "unemployed" ? "text-[#1a6fd8]" : "text-[#1a1c1d]"
                  }`}>
                    Временно не работаю
                  </span>
                  <span className={`text-[12px] font-medium mt-1.5 flex items-center gap-1.5 transition-colors duration-200 ${
                    occupationType === "unemployed" ? "text-[#1a6fd8]" : "text-[#d97706]"
                  }`}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                    Вариант при неофициальном трудоустройстве
                  </span>
                </button>
              </div>

              {/* Middle Grid: 6 основных категорий (2 колонки) */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { key: "production",   label: "Производство / прочее" },
                  { key: "warehouse",    label: "Склад / логистика" },
                  { key: "construction", label: "Стройка" },
                  { key: "retail",       label: "Магазин / продажи" },
                  { key: "office",       label: "Офис / документы" },
                  { key: "business",     label: "Свой бизнес - управление" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOccupationType(key)}
                    className={`flex flex-col items-start justify-between p-4 rounded-xl border text-left transition-all duration-200 hover:scale-[1.015] hover:shadow-sm h-full w-full ${
                      occupationType === key
                        ? "bg-[#f0f7ff] border-[#4a9eff] shadow-sm"
                        : "bg-white border-[#e7e5e2] hover:border-[#c0bdb8] hover:bg-[#fafaf9]"
                    }`}
                  >
                    <span className={`text-[13.5px] font-medium leading-snug ${
                      occupationType === key ? "text-[#1a6fd8]" : "text-[#1a1c1d]"
                    }`}>
                      {label}
                    </span>
                    {occupationType === key && (
                      <span className="mt-2 text-[#4a9eff]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Bottom Tile: Укажу вручную */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setOccupationType("manual")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-200 hover:scale-[1.005] hover:shadow-sm ${
                    occupationType === "manual"
                      ? "bg-[#f5f5f4] border-[#a8a29e] shadow-sm"
                      : "bg-white border-[#e7e5e2] hover:border-[#c0bdb8] hover:bg-[#fafaf9]"
                  }`}
                >
                  <span className="flex-1">
                    <span className={`text-[13px] font-medium ${
                      occupationType === "manual" ? "text-[#44403c]" : "text-[#1a1c1d]"
                    }`}>
                      Укажу вручную
                    </span>
                    <span className="block text-[11px] text-[#787774] mt-0.5">
                      Форма распечатается без отметок в графе «Работа», чтобы заполнить ручкой
                    </span>
                  </span>
                  {occupationType === "manual" && (
                    <svg className="w-4 h-4 text-[#787774] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </div>

              {!occupationType && (
                <div className="text-[13px] text-[#787774] mb-4 text-center">
                  Выберите один из вариантов, чтобы продолжить
                </div>
              )}

              <NextButton
                onClick={() => navigateToStep("generate")}
                disabled={!occupationType}
              >
                {t("str_124")}
              </NextButton>
            </Card>}

            {step === "generate" && <Card title={t("str_29")} subtitle={t("str_139")}>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {action !== "password_recovery" && <DocBox title={visaType === "F4" ? "거소신고(신청)서.pdf" : "통합신청서(신고서).pdf"} desc={action === "address_change" ? t("str_140") : t("str_141")} />}

                {action !== "password_recovery" && housingType === "other" && <DocBox title="거주/숙소제공 확인서.pdf" desc={t("str_142")} />}

                {action !== "password_recovery" && action !== "address_change" && action !== "initial" && applicant.isStudent === true && <DocBox title="초·중·고 재학사항 신고서.pdf" desc={t("str_143")} />}

                {action !== "password_recovery" && action !== "address_change" && action !== "initial" && applicant.isStudent === false && calculateAge(applicant.birthDate) >= 19 && visaType !== "F1" && <DocBox title="외국인 직업 및 연간 소득금액 신고서.pdf" desc={t("str_144")} />}
                
                {action === "initial" && visaType === "F4" && <DocBox title="취업활동 제한직업 비취업 서약서.pdf" desc={t("str_otkaz", { defaultValue: "Обязательство об отказе от запрещённой трудовой деятельности" })} />}

                {action === "password_recovery" && <DocBox title="비밀번호 복구 신청서.pdf" desc={t("action.password_recovery")} />}

                 {action !== "password_recovery" && visaType === "F1" && action !== "address_change" && action !== "reissue" && <DocBox title="신원보증서.pdf" desc={t("str_145")} />}
              </div>

              <div className="bg-[#fbfbfa] border border-[#e7e5e2] rounded-[20px] p-6 mb-8 text-[14px] text-[#37352f] shadow-sm">
                <h3 className="text-sm font-semibold text-[#111111] uppercase tracking-wider mb-4">{t("str_146")}</h3>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e7e5e2] pb-3 gap-1">
                    <span className="text-[#787774]">{t("str_147")}</span>
                    <span className="font-medium sm:text-right">{applicant.fullName || "-"} <br className="hidden sm:block" /><span className="text-xs text-[#9b9a97]">{action === "password_recovery" ? applicant.idNumber : applicant.passportNumber}</span></span>
                  </div>
                  {action !== "password_recovery" && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e7e5e2] pb-3 gap-1">
                      <span className="text-[#787774]">{t("str_148")}</span>
                      <span className="font-medium sm:text-right text-sm leading-snug sm:max-w-[240px]">{address || "-"}</span>
                    </div>
                  )}
                  {action !== "password_recovery" && housingType === "other" && <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e7e5e2] pb-3 gap-1">
                    <span className="text-[#787774]">{t("str_28")}</span>
                    <span className="font-medium sm:text-right">{provider.fullName || "-"} <br className="hidden sm:block" /><span className="text-xs text-[#9b9a97]">{provider.phone || ""}</span></span>
                  </div>}
                   {action !== "password_recovery" && visaType === "F1" && action !== "address_change" && <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-1">
                    <span className="text-[#787774]">{t("str_26")}</span>
                    <span className="font-medium sm:text-right">{guarantor.fullName || "-"} <br className="hidden sm:block" /><span className="text-xs text-[#9b9a97]">({guarantor.relationship || "-"})</span></span>
                  </div>}
                </div>
              </div>

              {/* Payment Summary */}
              {(() => {
                const draftPkg = {
                  visaType,
                  action,
                  housingType,
                  isStudent: applicant.isStudent,
                  birthDate: applicant.birthDate,
                  schoolName: applicant.schoolName
                };
                const availableCredits = user?.paidGenerationsRemaining || 0;
                const reqCredits = getPackageCredits(draftPkg);
                const costKRW = calculateSinglePrice(draftPkg, user);
                const formCount = getOfficialFormCount(draftPkg);
                
                return (
                  <div className="bg-[#f7f7f5] border border-[#e7e5e2] rounded-[20px] p-6 mb-8 text-[14px] text-[#37352f] shadow-sm">
                    <h3 className="text-sm font-semibold text-[#111111] uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                      {i18n.language === 'ru' ? 'Оплата' : i18n.language === 'ko' ? '결제 요약' : 'Payment Summary'}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e7e5e2] pb-3 gap-1">
                        <span className="text-[#787774]">{i18n.language === 'ru' ? 'Списание кредитов' : i18n.language === 'ko' ? '사용 크레딧' : 'Credits Used'}</span>
                        <span className="font-medium text-sm text-[#111111]">{reqCredits} {i18n.language === 'ru' ? 'кредит(ов)' : i18n.language === 'ko' ? '크레딧' : 'credits'} <span className="text-[#999] ml-1">({formCount} {formCount === 1 ? (i18n.language === 'ru' ? 'форма' : i18n.language === 'ko' ? '서식' : 'form') : (i18n.language === 'ru' ? (formCount < 5 ? 'формы' : 'форм') : i18n.language === 'ko' ? '서식' : 'forms')})</span></span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-1">
                        <span className="text-[#787774]">{i18n.language === 'ru' ? 'Итого к оплате' : i18n.language === 'ko' ? '총 결제 금액' : 'Total Cost'}</span>
                        <span className="font-bold text-lg text-[#111111]">
                          {costKRW === 0 ? (i18n.language === 'ru' ? '0 KRW (Оплачено кредитами)' : i18n.language === 'ko' ? '0 KRW (크레딧 결제)' : '0 KRW (Paid with credits)') : `${costKRW.toLocaleString()} KRW`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                {action === "password_recovery" && !isApplicantValid() && (
                  <div className="p-4 mb-4 rounded-xl bg-[#fff0f0] border border-[#f5c0c0] text-[#8a0000] text-[14px]">
                    <span className="font-bold">Missing required fields:</span> Please go back and ensure your name, nationality, ID number, phone, address, HiKorea ID, and signature are filled correctly.
                  </div>
                )}

                {(() => {
                  if (action === "password_recovery") return null;
                  const reqSigs = getRequiredSignatures(getPayload());
                  const missing = [];
                  if (reqSigs.applicant && !signatures.applicant.completed) missing.push(t("sig_applicant_req") || "Applicant signature");
                  if (reqSigs.guarantor && !signatures.guarantor.completed) missing.push(t("sig_guarantor_req") || "Guarantor signature");
                  if (reqSigs.accommodationProvider && !signatures.accommodationProvider.completed) missing.push(t("sig_provider_req") || "Accommodation provider signature");

                  if (missing.length > 0) {
                    return (
                      <div className="p-4 mb-4 rounded-xl bg-[#fff0f0] border border-[#f5c0c0] text-[#8a0000] text-[14px]">
                        <span className="font-bold">{t("sig_required_all") || "Please add all required signatures."}</span> 
                        <ul className="list-disc ml-5 mt-1">
                          {missing.map((m, idx) => <li key={idx}>{m}</li>)}
                        </ul>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <button 
                  onClick={handlePreviewPDF} 
                  disabled={
                    !dataVerified || 
                    !termsAccepted || 
                    pdfStatus === "loading" || 
                    (action === "password_recovery" && !isApplicantValid()) ||
                    (action !== "password_recovery" && Object.entries(getRequiredSignatures(getPayload())).some(([role, req]) => req && !signatures[role].completed))
                  } 
                  className="w-full py-3.5 bg-white border border-[#111111] text-[#111111] rounded-[10px] font-medium text-[15px] hover:bg-[#fbfbfa] disabled:opacity-50 disabled:bg-white disabled:border-[#e7e5e2] disabled:text-[#9b9a97] transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  {pdfStatus === "loading" ? <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>{t("str_152")}</> : t("str_153")}
                </button>
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
                

                return (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <span className="w-2 h-6 bg-[#2f3437] rounded-full"></span>
                      {t('myPage.accessInfo')}
                    </h3>



                    {/* Access Info Cards */}
                    {user?.role === "b2b" || user?.isB2B || user?.email?.toLowerCase() === ADMIN_EMAIL ? (
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
                            <p className="text-xs text-blue-500">{label("До", "Until", "~")} {formatDateTime(tmpExpiry, i18n)}</p>
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
                            <p className="text-xs text-purple-500">{label("До", "Until", "~")} {formatDateTime(unlimited, i18n)}</p>
                          ) : (
                            <p className="text-xs text-[#999]">{label("Нет", "None", "없음")}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {!user?.freeGenerationUsed && (
                          <div className="bg-white border border-[#e7e5e2] rounded-2xl p-5 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#f7f7f5] text-[#2f3437] flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </div>
                              <div>
                                <p className="text-sm text-[#5f6368] font-medium">{label("Доступно", "Available", "사용 가능")}</p>
                                <p className="text-xl font-bold text-green-600">{label("1 Бесплатная генерация", "1 Free Generation", "1회 무료 생성")}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Pricing explanation */}
                        <div className="bg-[#f7f7f5] rounded-2xl p-5 border border-[#e7e5e2] text-sm text-[#5f6368] space-y-2">
                          <p className="font-bold text-[#1a1c1d] mb-1">{label("Стоимость:", "Cost:", "비용:")}</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>{label("1 форма = 3,000 KRW", "1 form = 3,000 KRW", "서식 1장 = 3,000 KRW")}</li>
                            <li>{label("2 формы = 4,000 KRW", "2 forms = 4,000 KRW", "서식 2장 = 4,000 KRW")}</li>
                            <li>{label("3 и более форм = 5,000 KRW", "3+ forms = 5,000 KRW", "서식 3장 이상 = 5,000 KRW")}</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* No access banner */}
                    {!hasAnyAccess && (user?.role === "b2b" || user?.isB2B || user?.email?.toLowerCase() === ADMIN_EMAIL) && (

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

              <div id="cart-section" className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-2 h-6 bg-[#2f3437] rounded-full"></span>
                  {t('str_146')}
                </h3>

                {loadingPackages ? (
                  <div id="packages-loader" className="flex flex-col items-center justify-center py-20 space-y-4 opacity-50">
                    <div className="w-10 h-10 border-4 border-[#2f3437] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : myPagePackages.length > 0 ? (
                  <div className="space-y-8">
                    
                    {myPagePackages.some(p => p?.paymentStatus === "unpaid") && (
                      <div id="actual-cart-section" className="space-y-4">
                        <h4 className="font-bold text-[#e15241] flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                          {t('myPage.cart') || 'Cart'}
                        </h4>
                        <div className="grid gap-4">
                          {myPagePackages.filter(p => p?.paymentStatus === "unpaid").map(pkg => (
                            <PackageErrorBoundary key={pkg.id}>
                              <div className="bg-orange-50/50 border border-orange-200 rounded-2xl p-4 hover:border-orange-300 transition-all flex gap-3">
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
                                      <span className="text-xs text-[#999]">{formatDateTime(pkg.createdAt, i18n)}</span>
                                      <span className="text-xs font-bold text-[#e15241] border border-[#e15241]/30 px-2 rounded-full">{t('myPage.statusUnpaid') || 'Unpaid'}</span>
                                    </div>
                                    <h4 className="font-bold text-[#1a1c1d]">
                                      {(pkg.applicant?.surname || pkg.applicant?.givenNames) ? `${pkg.applicant?.surname || ''} ${pkg.applicant?.givenNames || ''}`.trim() : (t('appType.unspecified') || 'Not specified')}
                                    </h4>
                                    <p className="text-sm text-[#5f6368]">
                                      {getSimpleActionLabel(pkg.action, t)}
                                    </p>
                                    {!PAYMENT_ENABLED || user?.role === "b2b" ? (
                                      <p className="text-sm font-semibold text-[#1a1c1d] mt-1">
                                      <button 
                                        onClick={async () => {
                                          if (pkg.action === "extension" && !pkg.payload?.submissionMethod && !pkg.submissionMethod) {
                                            setMissingSubmissionMethodPkg({ ...pkg, onMethodSelected: async (method) => {
                                              const updatedPkg = { ...pkg, payload: { ...(pkg.payload || {}), submissionMethod: method } };
                                              
                                              // Send update to server
                                              try {
                                                await fetch("/api/generate/package-draft", {
                                                  method: "POST",
                                                  body: (() => {
                                                    const fd = new FormData();
                                                    fd.append("payload", JSON.stringify(updatedPkg.payload));
                                                    fd.append("draftId", pkg.id);
                                                    return fd;
                                                  })(),
                                                  credentials: "include"
                                                });
                                                
                                                // Update local state
                                                setMyPagePackages(prev => prev.map(p => p?.id === pkg.id ? updatedPkg : p));
                                              } catch(e) {
                                                console.error("Failed to update method", e);
                                              }
                                              
                                              // Proceed to preview
                                              setPdfStatus("loading");
                                              try {
                                                const formData = new FormData();
                                                formData.append("payload", JSON.stringify(updatedPkg.payload || {}));
                                                formData.append("draftId", pkg.id);
                                                const res = await fetch("/api/generate/package-preview", {
                                                  method: "POST",
                                                  body: formData
                                                });
                                                if (!res.ok) throw new Error("Preview failed");
                                                const blob = await res.blob();
                                                const url = URL.createObjectURL(blob);
                                                setPdfPreviewUrl(url);
                                                setPdfPreviewModalOpen(true);
                                                setPdfStatus("success");
                                              } catch (err) {
                                                console.error(err);
                                                setPdfStatus("error");
                                              }
                                            }});
                                            return;
                                          }
                                          setPdfStatus("loading");
                                          try {
                                            const formData = new FormData();
                                            formData.append("payload", JSON.stringify(pkg.payload || {}));
                                            formData.append("draftId", pkg.id);
                                            const res = await fetch("/api/generate/package-preview", {
                                              method: "POST",
                                              body: formData
                                            });
                                            if (!res.ok) throw new Error("Preview failed");
                                            const blob = await res.blob();
                                            const url = URL.createObjectURL(blob);
                                            setPdfPreviewUrl(url);
                                            setPdfPreviewModalOpen(true);
                                            setPdfStatus("success");
                                          } catch (err) {
                                            console.error(err);
                                            setPdfStatus("error");
                                          }
                                        }}
                                        className="text-blue-600 underline"
                                      >
                                        {i18n.language === 'ru' ? `Будет списано: ${getPackageCredits(pkg)} кредит(ов)` : i18n.language === 'ko' ? `차감 예정: ${getPackageCredits(pkg)} 크레딧` : `Will use: ${getPackageCredits(pkg)} credits`}
                                      </button>
                                        <span className="text-xs text-[#999] ml-1">({getOfficialFormCount(pkg)} {getOfficialFormCount(pkg) === 1 ? (i18n.language === 'ru' ? 'форма' : i18n.language === 'ko' ? '서식' : 'form') : (i18n.language === 'ru' ? (getOfficialFormCount(pkg) < 5 ? 'формы' : 'форм') : i18n.language === 'ko' ? '서식' : 'forms')})</span>
                                      </p>
                                    ) : user?.role === "admin" ? (
                                      <p className="text-sm font-semibold text-[#1a1c1d] mt-1">
                                        {(pkg.priceKRW || getPackagePrice(pkg)).toLocaleString()} KRW
                                        <span className="text-xs text-[#999] ml-1">({getOfficialFormCount(pkg)} forms, {getPackageCredits(pkg)} credits)</span>
                                      </p>
                                    ) : (
                                      <p className="text-sm font-semibold text-[#1a1c1d] mt-1">
                                        {(pkg.priceKRW || calculateSinglePrice(pkg, user)).toLocaleString()} KRW
                                        <span className="text-xs text-[#999] ml-1">({getOfficialFormCount(pkg)} {getOfficialFormCount(pkg) === 1 ? (i18n.language === 'ru' ? 'форма' : i18n.language === 'ko' ? '서식' : 'form') : (i18n.language === 'ru' ? (getOfficialFormCount(pkg) < 5 ? 'формы' : 'форм') : i18n.language === 'ko' ? '서식' : 'forms')})</span>
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col sm:flex-row items-center gap-2">
                                    <button 
                                      onClick={async () => {
                                        setPdfStatus("loading");
                                        try {
                                          const formData = new FormData();
                                          formData.append("payload", JSON.stringify(pkg.payload || {}));
                                          formData.append("draftId", pkg.id);
                                          const res = await fetch("/api/generate/package-preview", {
                                            method: "POST",
                                            body: formData
                                          });
                                          if (!res.ok) throw new Error("Preview failed");
                                          const blob = await res.blob();
                                          const url = URL.createObjectURL(blob);
                                          setPdfPreviewUrl(url);
                                          setPdfPreviewModalOpen(true);
                                          setPdfStatus("success");
                                        } catch (err) {
                                          console.error(err);
                                          setPdfStatus("error");
                                        }
                                      }}
                                      className="px-4 py-2 text-sm font-bold text-[#111111] bg-white border border-[#e7e5e2] rounded-full hover:bg-[#f7f7f5] transition-all w-full sm:w-auto flex items-center justify-center gap-2"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                      {t('cart.preview')}
                                    </button>
                                    {pkg.action === "password_recovery" && (
                                      <button
                                        onClick={async () => {
                                          setPdfStatus("loading");
                                          setPdfError("");
                                          try {
                                            const payload = { ...(pkg.payload || {}), paymentConfirmed: true };
                                            const formData = new FormData();
                                            formData.append("payload", JSON.stringify(payload));
                                            formData.append("draftId", pkg.id);
                                            const res = await fetch("/api/fax/send", {
                                              method: "POST",
                                              body: formData,
                                              credentials: "include"
                                            });
                                            if (!res.ok) {
                                              const j = await res.json().catch(() => ({}));
                                              throw new Error(j.message || j.error || (i18n.language === 'ru' ? 'Ошибка при отправке факса' : 'Fax send error'));
                                            }
                                            const jsonRes = await res.json().catch(() => ({}));
                                            setPdfStatus("idle");
                                            // Refresh packages
                                            fetch("/api/user/packages", { credentials: "include" })
                                              .then(r => r.json())
                                              .then(d => { if (d.ok) setMyPagePackages(d.packages || []); });
                                            fetch("/api/auth/me", { credentials: "include" })
                                              .then(r => r.json())
                                              .then(d => { if (d.user) { setUser(d.user); userRef.current = d.user; } });
                                            setSuccessModalData({
                                              open: true,
                                              isFax: true,
                                              used: getPackageCredits(pkg),
                                              remaining: Math.max(0, (userRef.current?.paidGenerationsRemaining || 0) - getPackageCredits(pkg))
                                            });
                                          } catch (err) {
                                            console.error("Cart fax error:", err);
                                            setPdfStatus("error");
                                            setPdfError(err.message);
                                          }
                                        }}
                                        className="px-4 py-2 text-sm font-bold text-white bg-[#111111] rounded-full hover:bg-[#2f2f2f] transition-all w-full sm:w-auto flex items-center justify-center gap-2"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/></svg>
                                        {i18n.language === 'ru' ? 'Отправить факсом' : i18n.language === 'ko' ? '팩스로 전송' : 'Send by Fax'}
                                      </button>
                                    )}
                                    <button 
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setMyPagePackages(prev => prev.filter(p => p?.id !== pkg.id));
                                        setSelectedCartItems(prev => prev.filter(id => id !== pkg.id));
                                        try {
                                          const res = await fetch(`/api/user/packages/${pkg.id}`, {
                                            method: "DELETE",
                                            credentials: "include"
                                          });
                                          if (!res.ok) {
                                            const errData = await res.json();
                                            throw new Error(errData.error || "Failed to delete package");
                                          }
                                        } catch (err) {
                                          console.error("Error deleting package:", err);
                                          const refreshRes = await fetch("/api/user/packages", { credentials: "include" });
                                          if (refreshRes.ok) {
                                            const data = await refreshRes.json();
                                            setMyPagePackages(data.packages || []);
                                          }
                                        }
                                      }}
                                      className="px-4 py-2 text-sm font-bold text-[#e15241] bg-white border border-[#ffcccc] rounded-full hover:bg-[#fff5f5] transition-all w-full sm:w-auto"
                                    >
                                      {t('myPage.remove') || 'Remove'}
                                    </button>
                                  </div>
                                </div>
                            </div>
                            </PackageErrorBoundary>
                          ))}
                        </div>
                        {myPagePackages.filter(p => p?.paymentStatus === "unpaid").length > 0 && selectedCartItems.length > 0 && (
                          <div className="flex justify-between items-center pt-2 border-t border-[#e7e5e2]">
                            <span className="text-sm font-semibold text-[#5f6368]">
                              {(() => {
                                if (!PAYMENT_ENABLED || user?.role === "b2b") {
                                  const totalCredits = selectedCartItems.reduce((sum, id) => {
                                    const p = myPagePackages.find(pp => pp?.id === id);
                                    return sum + (p ? getPackageCredits(p) : 1);
                                  }, 0);
                                  return (
                                    <>
                                      {selectedCartItems.length} {i18n.language === 'ru' ? 'выбрано' : i18n.language === 'ko' ? '개 선택됨' : 'selected'} = <strong className="text-[#1a1c1d]">{totalCredits} {i18n.language === 'ru' ? 'кредит(ов)' : i18n.language === 'ko' ? '크레딧' : 'credits'}</strong>
                                    </>
                                  );
                                } else if (user?.role === "admin") {
                                  const total = calculateCartPrice(selectedCartItems, myPagePackages, user);
                                  const totalCredits = selectedCartItems.reduce((sum, id) => {
                                    const p = myPagePackages.find(pp => pp?.id === id);
                                    return sum + (p ? getPackageCredits(p) : 1);
                                  }, 0);
                                  return (
                                    <>
                                      {selectedCartItems.length} {i18n.language === 'ru' ? 'выбрано' : i18n.language === 'ko' ? '개 선택됨' : 'selected'} = <strong className="text-[#1a1c1d]">{total.toLocaleString()} KRW ({totalCredits} credits)</strong>
                                    </>
                                  );
                                } else {
                                  const total = calculateCartPrice(selectedCartItems, myPagePackages, user);
                                  return (
                                    <>
                                      {selectedCartItems.length} {i18n.language === 'ru' ? 'выбрано' : i18n.language === 'ko' ? '개 선택됨' : 'selected'} = <strong className="text-[#1a1c1d]">{total.toLocaleString()} KRW</strong>
                                    </>
                                  );
                                }
                              })()}
                            </span>
                            <button
                              disabled={selectedCartItems.length === 0}
                              onClick={async () => {
                                const itemsToDownload = [...selectedCartItems];

                                // Check for missing submission methods, but ONLY for unpaid packages
                                const missingMethods = itemsToDownload.map(id => myPagePackages.find(p => p?.id === id)).filter(p => p?.action === "extension" && !p.payload?.submissionMethod && !p.submissionMethod && p?.paymentStatus !== "paid");
                                
                                if (missingMethods.length > 0) {
                                  // Prompt for the first one. (If they have multiple, they will have to be prompted for each, but usually they just have one).
                                  const pkg = missingMethods[0];
                                  setMissingSubmissionMethodPkg({ ...pkg, onMethodSelected: async (method) => {
                                    const updatedPkg = { ...pkg, payload: { ...(pkg.payload || {}), submissionMethod: method } };
                                    
                                    try {
                                      await fetch("/api/generate/package-draft", {
                                        method: "POST",
                                        body: (() => {
                                          const fd = new FormData();
                                          fd.append("payload", JSON.stringify(updatedPkg.payload));
                                          fd.append("draftId", pkg.id);
                                          return fd;
                                        })(),
                                        credentials: "include"
                                      });
                                      setMyPagePackages(prev => prev.map(p => p?.id === pkg.id ? updatedPkg : p));
                                    } catch(e) {
                                      console.error("Failed to update method", e);
                                    }
                                  }});
                                  return;
                                }

                                const runDownloads = async (paymentConfirmed = false) => {
                                  for (const id of itemsToDownload) {
                                    const pkg = myPagePackages.find(p => p?.id === id);
                                    if (!pkg) continue;
                                    setPdfStatus("loading");
                                    try {
                                      const payload = {
                                          ...pkg.applicant,
                                          ...(pkg.provider || {}),
                                          ...(pkg.guarantor || {}),
                                          visaType: pkg.visaType,
                                          action: pkg.action,
                                          housingType: pkg.housingType,
                                          address: pkg.address,
                                          packageId: pkg.id,
                                          isStudent: pkg.applicant?.isStudent !== undefined ? pkg.applicant.isStudent : null,
                                          schoolName: pkg.applicant?.schoolName || ''
                                      };
                                      if (paymentConfirmed) {
                                        payload.paymentConfirmed = true;
                                      }

                                      if (pkg.action === "password_recovery") {
                                        const formData = new FormData();
                                        formData.append("payload", JSON.stringify(payload));
                                        formData.append("draftId", pkg.id);
                                        const res = await fetch("/api/fax/send", {
                                          method: "POST",
                                          body: formData,
                                          credentials: "include"
                                        });
                                        if (!res.ok) {
                                          const j = await res.json().catch(() => ({}));
                                          if (j.error === "PAYMENT_REQUIRED") {
                                            if (!PAYMENT_ENABLED) {
                                              alert(i18n.language === 'ru' ? 'Недостаточно кредитов' : i18n.language === 'ko' ? '크레딧이 부족합니다' : 'Not enough credits');
                                              setPdfStatus("idle");
                                              return;
                                            }
                                            const total = calculateCartPrice(itemsToDownload, myPagePackages, user);
                                            setPaymentCount(itemsToDownload.length);
                                            setPaymentAmount(total);
                                            setPendingAction(() => () => runDownloads(true));
                                            setPaymentModalOpen(true);
                                            setPdfStatus("idle");
                                            return;
                                          }
                                          if (j.error === "LOGIN_REQUIRED") {
                                            setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") });
                                            setPdfStatus("idle");
                                            return;
                                          }
                                          throw new Error(j.message || j.error || "Fax send failed");
                                        }
                                        const jsonRes = await res.json().catch(() => ({}));
                                      } else {
                                        const res = await fetch("/api/generate/package-download", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify(payload),
                                          credentials: "include"
                                        });
                                        if (!res.ok) {
                                          const j = await res.json().catch(() => ({}));
                                          if (j.error === "PAYMENT_REQUIRED") {
                                            if (!PAYMENT_ENABLED) {
                                              alert(i18n.language === 'ru' ? 'Недостаточно кредитов' : i18n.language === 'ko' ? '크레딧이 부족합니다' : 'Not enough credits');
                                              setPdfStatus("idle");
                                              return;
                                            }
                                            const total = calculateCartPrice(itemsToDownload, myPagePackages, user);
                                            setPaymentCount(itemsToDownload.length);
                                            setPaymentAmount(total);
                                            setPendingAction(() => () => runDownloads(true));
                                            setPaymentModalOpen(true);
                                            setPdfStatus("idle");
                                            return;
                                          }
                                          if (j.error === "LOGIN_REQUIRED") {
                                            setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") });
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
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                      }
                                      
                                      // Deduct local credits to keep state in sync
                                      const cost = getPackageCredits(payload);
                                      if (userRef.current) {
                                        const updatedUser = { ...userRef.current };
                                        updatedUser.paidGenerationsRemaining = Math.max(0, (updatedUser.paidGenerationsRemaining || 0) - cost);
                                        setUser(updatedUser);
                                        userRef.current = updatedUser;
                                      }
                                    } catch (err) {
                                      console.error("Download error for pkg", id, err);
                                    }
                                  }
                                  setPdfStatus("success");
                                  setSelectedCartItems([]);
                                  fetch("/api/user/packages", { credentials: "include" })
                                    .then(r => r.json())
                                    .then(d => { if (d.ok) setMyPagePackages(d.packages || []); });
                                  // Refresh user credits
                                  fetch("/api/auth/me", { credentials: "include" })
                                    .then(r => r.json())
                                    .then(d => { if (d.user) { setUser(d.user); userRef.current = d.user; } });
                                };

                                if (!userRef.current) {
                                  setAuthModal({ open: true, type: "login", subtitle: t("loginRequiredForDownload") });
                                  return;
                                }

                                const totalCredits = itemsToDownload.reduce((sum, id) => {
                                  const p = myPagePackages.find(pp => pp?.id === id);
                                  return sum + (p ? getPackageCredits(p) : 1);
                                }, 0);
                                
                                const totalCostKRW = calculateCartPrice(itemsToDownload, myPagePackages, user);

                                setCartPromptData({
                                  mode: 'cart',
                                  items: itemsToDownload,
                                  totalCredits,
                                  totalCostKRW,
                                  runDownloads
                                });
                                setCartPromptModalOpen(true);
                              }}
                              className="px-6 py-3 bg-[#111111] text-white rounded-full font-bold shadow-lg hover:bg-[#2f3437] transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11 5.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-1z"/><path d="M2 2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3-6a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/></svg>
                              {(() => {
                                if (user?.role === "b2b") {
                                  const totalCredits = selectedCartItems.reduce((sum, id) => {
                                    const p = myPagePackages.find(pp => pp?.id === id);
                                    return sum + (p ? getPackageCredits(p) : 1);
                                  }, 0);
                                  return i18n.language === 'ru'
                                    ? `Оплатить выбранные — ${totalCredits} кредит(ов)`
                                    : i18n.language === 'ko'
                                    ? `선택 항목 결제 — ${totalCredits} 크레딧`
                                    : `Pay selected — ${totalCredits} credits`;
                                } else if (user?.role === "admin") {
                                  const total = calculateCartPrice(selectedCartItems, myPagePackages, user);
                                  const totalCredits = selectedCartItems.reduce((sum, id) => {
                                    const p = myPagePackages.find(pp => pp?.id === id);
                                    return sum + (p ? getPackageCredits(p) : 1);
                                  }, 0);
                                  return `Pay selected — ${total.toLocaleString()} KRW (${totalCredits} credits)`;
                                } else {
                                  const total = calculateCartPrice(selectedCartItems, myPagePackages, user);
                                  if (!PAYMENT_ENABLED) {
                                    return i18n.language === 'ru'
                                      ? `Сформировать выбранные`
                                      : i18n.language === 'ko'
                                      ? `선택 항목 생성`
                                      : `Generate selected`;
                                  }
                                  return i18n.language === 'ru'
                                    ? `Оплатить выбранные — ${total.toLocaleString()} KRW`
                                    : i18n.language === 'ko'
                                    ? `선택 항목 결제 — ${total.toLocaleString()} KRW`
                                    : `Pay selected — ${total.toLocaleString()} KRW`;
                                }
                              })()}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {myPagePackages.some(p => p?.paymentStatus !== "unpaid") && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="w-5 h-5 accent-[#111111] cursor-pointer"
                              checked={selectedPaidItems.length > 0 && selectedPaidItems.length === myPagePackages.filter(p => p?.paymentStatus !== "unpaid").length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPaidItems(myPagePackages.filter(p => p?.paymentStatus !== "unpaid").map(p => p.id));
                                } else {
                                  setSelectedPaidItems([]);
                                }
                              }}
                            />
                            <h4 className="font-bold text-[#5f6368]">{i18n.language === 'ru' ? 'Мои заказы' : i18n.language === 'ko' ? '내 주문' : 'My orders'}</h4>
                          </div>
                          {selectedPaidItems.length > 0 && (
                            <button
                              onClick={async () => {
                                if (window.confirm(i18n.language === 'ru' ? `Удалить выбранные заявления (${selectedPaidItems.length} шт.)?` : i18n.language === 'ko' ? `선택한 신청서 (${selectedPaidItems.length}개)를 삭제하시겠습니까?` : `Delete selected applications (${selectedPaidItems.length})?`)) {
                                  setMyPagePackages(prev => prev.filter(p => !selectedPaidItems.includes(p.id)));
                                  const itemsToDelete = [...selectedPaidItems];
                                  setSelectedPaidItems([]);
                                  
                                  for (const id of itemsToDelete) {
                                    try {
                                      await fetch(`/api/user/packages/${id}?force=true`, { method: 'DELETE', credentials: "include" });
                                    } catch(e) {
                                      console.error(e);
                                    }
                                  }
                                  const d = await fetch("/api/user/packages", { credentials: "include" }).then(r => r.json());
                                  if (d.ok) setMyPagePackages(d.packages || []);
                                }
                              }}
                              className="px-3 py-1.5 text-sm font-bold border border-[#ffcccc] text-[#e15241] rounded-full hover:bg-[#fff5f5] transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              {i18n.language === 'ru' ? `Удалить выбранные (${selectedPaidItems.length})` : i18n.language === 'ko' ? `선택 항목 삭제 (${selectedPaidItems.length})` : `Delete selected (${selectedPaidItems.length})`}
                            </button>
                          )}
                        </div>
                        <div className="grid gap-4">
                          {myPagePackages.filter(p => p?.paymentStatus !== "unpaid").map(pkg => (
                            <PackageErrorBoundary key={pkg.id}>
                              <div className="bg-white border border-[#e7e5e2] rounded-2xl p-5 hover:border-[#2f3437] transition-all group flex gap-3">
                                <div className="pt-2 pl-1 flex-shrink-0">
                                  <input 
                                    type="checkbox" 
                                    className="w-5 h-5 accent-[#111111] cursor-pointer"
                                    checked={selectedPaidItems.includes(pkg.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedPaidItems(prev => [...prev, pkg.id]);
                                      else setSelectedPaidItems(prev => prev.filter(id => id !== pkg.id));
                                    }}
                                  />
                                </div>
                                <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase px-2 py-0.5 bg-[#f7f7f5] rounded-md text-[#5f6368]">
                                      {pkg.visaType}
                                    </span>
                                    <span className="text-xs text-[#999]">{formatDateTime(pkg.createdAt, i18n)}</span>
                                    <span className="text-xs font-bold text-[#1a7a3a] border border-[#1a7a3a]/30 px-2 rounded-full">{i18n.language === 'ru' ? 'Оплачено' : i18n.language === 'ko' ? '결제완료' : 'Paid'}</span>
                                    {pkg.faxReceiptNum && (
                                      <span className={`text-xs font-bold border px-2 rounded-full flex items-center gap-1 ${
                                        pkg.faxStatus === 'success' ? 'text-green-600 border-green-600/30 bg-green-50' :
                                        pkg.faxStatus === 'failed' ? 'text-red-600 border-red-600/30 bg-red-50' :
                                        'text-yellow-600 border-yellow-600/30 bg-yellow-50'
                                      }`}>
                                        {pkg.faxStatus === 'pending' && <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>}
                                        {pkg.faxStatus === 'success' && <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                        {pkg.faxStatus === 'failed' && <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                                        {pkg.faxStatus === 'success' ? (i18n.language === 'ru' ? 'Факс доставлен' : 'Fax Delivered') :
                                         pkg.faxStatus === 'failed' ? (i18n.language === 'ru' ? 'Ошибка факса' : 'Fax Failed') :
                                         (i18n.language === 'ru' ? 'Факс отправляется...' : 'Fax Sending...')}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="font-bold text-[#1a1c1d]">
                                    {(pkg.applicant?.surname || pkg.applicant?.givenNames) ? `${pkg.applicant?.surname || ''} ${pkg.applicant?.givenNames || ''}`.trim() : (t('appType.unspecified') || 'Not specified')}
                                  </h4>
                                  <p className="text-sm text-[#5f6368]">
                                    {getSimpleActionLabel(pkg.action, t)}
                                  </p>
                                  {(!PAYMENT_ENABLED || user?.role === "b2b") ? (
                                    <p className="text-sm font-semibold text-[#1a1c1d] mt-1">
                                      {i18n.language === 'ru' ? `Списано: ${getPackageCredits(pkg)} кредит(ов)` : i18n.language === 'ko' ? `차감됨: ${getPackageCredits(pkg)} 크레딧` : `Used: ${getPackageCredits(pkg)} credits`}
                                      <span className="text-xs text-[#999] ml-1">({getOfficialFormCount(pkg)} {getOfficialFormCount(pkg) === 1 ? (i18n.language === 'ru' ? 'форма' : i18n.language === 'ko' ? '서식' : 'form') : (i18n.language === 'ru' ? (getOfficialFormCount(pkg) < 5 ? 'формы' : 'форм') : i18n.language === 'ko' ? '서식' : 'forms')})</span>
                                    </p>
                                  ) : (
                                    <p className="text-sm font-semibold text-[#1a1c1d] mt-1">
                                      {(pkg.priceKRW || calculateSinglePrice(pkg, user)).toLocaleString()} KRW
                                      <span className="text-xs text-[#999] ml-1">({getOfficialFormCount(pkg)} {getOfficialFormCount(pkg) === 1 ? (i18n.language === 'ru' ? 'форма' : i18n.language === 'ko' ? '서식' : 'form') : (i18n.language === 'ru' ? (getOfficialFormCount(pkg) < 5 ? 'формы' : 'форм') : i18n.language === 'ko' ? '서식' : 'forms')})</span>
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={async () => {
                                      if (pkg.paymentStatus !== "paid") {
                                        alert(i18n.language === 'ru' ? 'Для отправки документа на почту необходимо сначала оплатить его.' : 'Please pay for the document before sending it to email.');
                                        return;
                                      }
                                      setPdfStatus("loading");
                                      try {
                                        const res = await fetch("/api/generate/package-email", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ packageId: pkg.id }),
                                          credentials: "include"
                                        });
                                        const data = await res.json();
                                        if (res.ok && data.ok) {
                                          alert(i18n.language === 'ru' ? 'Письмо с документами успешно отправлено!' : 'Email with documents successfully sent!');
                                        } else {
                                          alert((i18n.language === 'ru' ? 'Ошибка отправки: ' : 'Failed to send: ') + (data.message || data.error || 'Unknown error'));
                                        }
                                      } catch (err) {
                                        console.error(err);
                                        alert(i18n.language === 'ru' ? 'Сетевая ошибка при отправке письма.' : 'Network error while sending email.');
                                      } finally {
                                        setPdfStatus("idle");
                                      }
                                    }}
                                    disabled={pdfStatus === "loading"}
                                    className="px-4 py-2 text-sm font-bold border border-[#e7e5e2] rounded-full hover:bg-[#f7f7f5] transition-all disabled:opacity-50"
                                  >
                                    {t('myPage.sendEmail')}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (pkg.action === "extension" && !pkg.payload?.submissionMethod && !pkg.submissionMethod && pkg.paymentStatus !== "paid") {
                                        setMissingSubmissionMethodPkg({ ...pkg, onMethodSelected: async (method) => {
                                          const updatedPkg = { ...pkg, payload: { ...(pkg.payload || {}), submissionMethod: method } };
                                          
                                          try {
                                            await fetch("/api/generate/package-draft", {
                                              method: "POST",
                                              body: (() => {
                                                const fd = new FormData();
                                                fd.append("payload", JSON.stringify(updatedPkg.payload));
                                                fd.append("draftId", pkg.id);
                                                return fd;
                                              })(),
                                              credentials: "include"
                                            });
                                            setMyPagePackages(prev => prev.map(p => p?.id === pkg.id ? updatedPkg : p));
                                          } catch(e) {
                                            console.error("Failed to update method", e);
                                          }
                                          // Note: Since this is already paid, we should just run the performDownload with the updated package
                                          // but we need to trigger it. The easiest way is to let the state update trigger a re-render and the user clicks download again.
                                          alert(i18n.language === 'ru' ? 'Способ подачи обновлен. Нажмите скачать еще раз.' : 'Submission method updated. Click download again.');
                                        }});
                                        return;
                                      }

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
                                              paymentConfirmed: true,
                                              isStudent: pkg.applicant?.isStudent !== undefined ? pkg.applicant.isStudent : null,
                                              schoolName: pkg.applicant?.schoolName || ''
                                            }),
                                            credentials: "include"
                                          });
                                          if (!res.ok) {
                                            const j = await res.json().catch(() => ({}));
                                            if (j.error === "LOGIN_REQUIRED" || j.error === "PAYMENT_REQUIRED") {
                                              setPendingAction(() => performDownload);
                                              if (j.error === "PAYMENT_REQUIRED") {
                                                if (!PAYMENT_ENABLED) {
                                                  alert(i18n.language === 'ru' ? 'Недостаточно кредитов' : i18n.language === 'ko' ? '크레딧이 부족합니다' : 'Not enough credits');
                                                } else {
                                                  setPaymentCount(1);
                                                  setPaymentAmount(pkg.priceKRW || calculateSinglePrice(pkg, user));
                                                  setPaymentModalOpen(true);
                                                }
                                              }
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
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(i18n.language === 'ru' ? 'Вы уверены, что хотите удалить это заявление из истории?' : i18n.language === 'ko' ? '기록에서 이 서식을 삭제하시겠습니까?' : 'Are you sure you want to remove this application from history?')) {
                                        setMyPagePackages(prev => prev.filter(p => p?.id !== pkg.id));
                                        
                                        try {
                                          await fetch(`/api/user/packages/${pkg.id}?force=true`, { method: 'DELETE', credentials: "include" });
                                          const d = await fetch("/api/user/packages", { credentials: "include" }).then(r => r.json());
                                          if (d.ok) setMyPagePackages(d.packages || []);
                                        } catch(e) {
                                          console.error(e);
                                        }
                                      }
                                    }}
                                    disabled={pdfStatus === "loading"}
                                    className="px-3 py-2 text-sm font-bold border border-[#ffcccc] text-[#e15241] rounded-full hover:bg-[#fff5f5] transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
                                    title={i18n.language === 'ru' ? 'Удалить' : i18n.language === 'ko' ? '삭제' : 'Remove'}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                            </PackageErrorBoundary>
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
                  : legalModal.type === "refund"
                  ? t('footer.refundPolicy')
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
              {renderLegalContent(legalModal.type === "privacy" ? privacyPolicy : legalModal.type === "refund" ? refundPolicy : termsOfService, i18n.language)}
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


      {/* ── Cart Prompt Modal ── */}
      {cartPromptModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col p-6 text-center space-y-6">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            
            {cartAddedSuccess ? (
              <>
                <div>
                  <h3 className="text-xl font-bold text-[#1a1c1d] mb-2">{i18n.language === 'ru' ? 'Заявление добавлено в корзину' : i18n.language === 'ko' ? '신청서가 장바구니에 추가되었습니다' : 'Application added to cart'}</h3>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setCartPromptModalOpen(false);
                      setCartAddedSuccess(false);
                      navigateToStep("my-page");
                      const startTime = Date.now();
                      const interval = setInterval(() => {
                        const loader = document.getElementById('packages-loader');
                        if (!loader) {
                          const el = document.getElementById('actual-cart-section') || document.getElementById('cart-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          clearInterval(interval);
                        } else if (Date.now() - startTime > 5000) {
                          clearInterval(interval);
                        }
                      }, 100);
                    }}
                    className="w-full py-3.5 bg-[#111111] text-white rounded-[10px] font-bold shadow-md hover:bg-[#2f2f2f] transition-colors"
                  >
                    {i18n.language === 'ru' ? 'Перейти в корзину' : i18n.language === 'ko' ? '장바구니로 이동' : 'Go to Cart'}
                  </button>
                  <button
                    onClick={() => {
                      setCartPromptModalOpen(false);
                      setCartAddedSuccess(false);
                      startOver(true);
                    }}
                    className="w-full py-3.5 bg-white border-2 border-[#111111] text-[#111111] rounded-[10px] font-bold hover:bg-[#f7f7f5] transition-colors"
                  >
                    {i18n.language === 'ru' ? 'Вернуться на главную страницу' : i18n.language === 'ko' ? '홈으로 돌아가기' : 'Return to Home Page'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h3 className="text-xl font-bold text-[#1a1c1d] mb-2">{t('cartPrompt.title') || 'Payment Required'}</h3>
                  <p className="text-[#5f6368] text-sm">
                    {(() => {
                      const isCartMode = !!cartPromptData;
                      const currentPrice = isCartMode ? calculateCartPrice(cartPromptData.items, myPagePackages, user) : calculateSinglePrice({ visaType, action, housingType, isStudent: applicant.isStudent, birthDate: applicant.birthDate, schoolName: applicant.schoolName }, user);

                      if (user?.isB2B) {
                        const cost = isCartMode ? cartPromptData.totalCredits : getPackageCredits(getPayload());
                        const available = user?.paidGenerationsRemaining || 0;
                        const used = Math.min(cost, available);

                        const baseMsg = i18n.language === 'ru' ? `Стоимость: ${cost} кредитов` : i18n.language === 'ko' ? `비용: ${cost} 크레딧` : `Cost: ${cost} credits`;
                        const creditMsg = i18n.language === 'ru' ? `Списано кредитов: ${used}` : i18n.language === 'ko' ? `사용된 크레딧: ${used}` : `Credits used: ${used}`;
                        const finalMsg = i18n.language === 'ru' ? `К оплате: ${currentPrice.toLocaleString()} KRW` : i18n.language === 'ko' ? `결제 금액: ${currentPrice.toLocaleString()} KRW` : `To pay: ${currentPrice.toLocaleString()} KRW`;

                        return (
                          <div className="flex flex-col gap-2 mt-2">
                             <span className="text-[#111111] font-medium">{baseMsg}</span>
                             <span className="text-[#1a7a3a]">{creditMsg}</span>
                             {currentPrice > 0 ? (
                               <span className="text-[#d93025] font-bold text-[16px]">{finalMsg}</span>
                             ) : (
                               <span className="text-[#111111] font-bold text-[16px]">{finalMsg}</span>
                             )}
                          </div>
                        );
                      } else {
                        // Retail user
                        const isFree = !user?.freeGenerationUsed;
                        const finalMsg = i18n.language === 'ru' ? `К оплате: ${currentPrice.toLocaleString()} KRW` : i18n.language === 'ko' ? `결제 금액: ${currentPrice.toLocaleString()} KRW` : `To pay: ${currentPrice.toLocaleString()} KRW`;
                        const freeMsg = i18n.language === 'ru' ? `Применена бесплатная генерация!` : i18n.language === 'ko' ? `무료 생성 적용됨!` : `Free generation applied!`;

                        return (
                          <div className="flex flex-col gap-2 mt-2">
                             {isFree && <span className="text-[#1a7a3a] font-bold">{freeMsg}</span>}
                             <span className={currentPrice > 0 ? "text-[#d93025] font-bold text-[16px]" : "text-[#111111] font-bold text-[16px]"}>{finalMsg}</span>
                          </div>
                        );
                      }
                    })()}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {(() => {
                    const isCartMode = !!cartPromptData;
                    const available = user?.paidGenerationsRemaining || 0;
                    const currentPrice = isCartMode ? calculateCartPrice(cartPromptData.items, myPagePackages, user) : calculateSinglePrice({ visaType, action, housingType, isStudent: applicant.isStudent, birthDate: applicant.birthDate, schoolName: applicant.schoolName }, user);
                    
                    if (currentPrice === 0) {
                      return (
                        <button
                          onClick={() => {
                            setCartPromptModalOpen(false);
                            if (isCartMode && cartPromptData.runDownloads) {
                              cartPromptData.runDownloads(true);
                            } else {
                              if (cartActionType === "fax") {
                                executeSendFax();
                              } else {
                                executeDownloadPDF();
                              }
                            }
                            setCartPromptData(null);
                          }}
                          className="w-full py-3.5 bg-[#111111] text-white rounded-[10px] font-bold shadow-md hover:bg-[#2f2f2f] transition-colors"
                        >
                          {cartActionType === "fax" ? (i18n.language === 'ru' ? 'Отправить заявление' : i18n.language === 'ko' ? '신청서 전송' : 'Send Application') : (t('gen.generate') || 'Скачать PDF')}
                        </button>
                      );
                    }
                    
                    return PAYMENT_ENABLED ? (
                      <button
                        onClick={() => {
                          setCartPromptModalOpen(false);
                          if (isCartMode) {
                            setPaymentCount(cartPromptData.items.length);
                            if (cartPromptData.runDownloads) {
                              setPendingAction(() => () => cartPromptData.runDownloads(false));
                            }
                          } else {
                            setPaymentCount(1);
                            if (cartActionType === "fax") {
                                setPendingAction(() => executeSendFax);
                            } else {
                                setPendingAction(() => executeDownloadPDF);
                            }
                          }
                          setPaymentAmount(currentPrice);
                          setPaymentModalOpen(true);
                        }}
                        className="w-full py-3.5 bg-[#111111] text-white rounded-[10px] font-bold shadow-md hover:bg-[#2f2f2f] transition-colors"
                      >
                        {cartActionType === "fax" ? 
                         (i18n.language === 'ru' ? `Оплатить ${currentPrice.toLocaleString()} KRW и отправить факсом` :
                          i18n.language === 'ko' ? `${currentPrice.toLocaleString()} KRW 결제 및 팩스 전송` :
                          `Pay ${currentPrice.toLocaleString()} KRW and send by Fax`) :
                         (i18n.language === 'ru' ? `Оплатить ${currentPrice.toLocaleString()} KRW и скачать` :
                         i18n.language === 'ko' ? `${currentPrice.toLocaleString()} KRW 결제 및 다운로드` :
                         `Pay ${currentPrice.toLocaleString()} KRW and download`)}
                      </button>
                    ) : null;
                  })()}
                  {!cartPromptData && (
                    <button
                      onClick={async () => {
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
  
                          if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            throw new Error(errData.error || `Server error ${res.status}`);
                          }
  
                          const data = await res.json();
                          if (data.packageId) setDraftId(data.packageId);
  
                          // Refresh packages list
                          fetch("/api/user/packages", { credentials: "include" })
                            .then(r => r.json())
                            .then(d => { if (d.ok) setMyPagePackages(d.packages || []); });
  
                          setCartAddedSuccess(true);
                        } catch (err) {
                          console.error("Add to cart failed:", err);
                          alert(
                            i18n.language === 'ru' ? 'Не удалось добавить в корзину. Попробуйте ещё раз.' :
                            i18n.language === 'ko' ? '장바구니에 추가하지 못했습니다. 다시 시도해 주세요.' :
                            'Failed to add to cart. Please try again.'
                          );
                        }
                      }}
                      className="w-full py-3.5 bg-white border-2 border-[#111111] text-[#111111] rounded-[10px] font-bold hover:bg-[#f7f7f5] transition-colors"
                    >
                      {t('cartPrompt.addToCart') || 'Add to cart'}
                    </button>
                  )}
                  <button
                    onClick={() => { setCartPromptModalOpen(false); setCartPromptData(null); }}
                    className="w-full py-3 text-sm font-bold text-[#5f6368] hover:text-[#111111] transition-colors"
                  >
                    {t('cartPrompt.cancel') || 'Cancel'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Simulated Payment Modal ── */}
      {PAYMENT_ENABLED && paymentModalOpen && (
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

            <div className="px-6 py-8 text-center flex flex-col items-center">
              {virtualAccountResult ? (
                <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-sm w-full text-left">
                  <p className="font-bold text-green-800 mb-2">✅ {t('virtualAccountIssued') || "Virtual Account Issued!"}</p>
                  <p><strong>Bank:</strong> {virtualAccountResult.bankName}</p>
                  <p><strong>Account:</strong> {virtualAccountResult.accountNumber}</p>
                  <p className="text-xs mt-2 text-green-700">Please transfer the exact amount. The document will be generated automatically upon deposit.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-[#111] border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 font-medium text-[#111]">
                    {i18n.language === 'ru' ? 'Открытие окна оплаты...' : i18n.language === 'ko' ? '결제창을 여는 중입니다...' : 'Opening payment window...'}
                  </p>
                </div>
              )}
            </div>

            {virtualAccountResult && (
              <div className="px-6 py-5 border-t border-[#e7e5e2] flex flex-col gap-3 bg-[#fbfbfa]">
                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="w-full py-3 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm bg-[#111111] hover:bg-[#2f2f2f]"
                >
                  {t('pay.close') || "Close"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ── PDF Preview Modal ── */}
      {pdfPreviewModalOpen && pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ height: '90vh' }}>
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg">{i18n.language === 'ru' ? 'Предварительный просмотр' : i18n.language === 'ko' ? '미리보기' : 'Preview'}</h3>
              <button 
                onClick={() => {
                  setPdfPreviewModalOpen(false);
                  setPdfPreviewContext(null);
                  if (pdfPreviewUrl) {
                    URL.revokeObjectURL(pdfPreviewUrl);
                    setPdfPreviewUrl(null);
                  }
                }} 
                className="text-gray-500 hover:text-black transition-colors"
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 w-full bg-gray-100">
              <iframe src={`${pdfPreviewUrl}#view=FitH`} className="w-full h-full" title="PDF Preview"></iframe>
            </div>
            {pdfPreviewContext === 'wizard' && (
              <div className="flex flex-col sm:flex-row gap-3 p-4 border-t bg-white">
                <button 
                  onClick={() => {
                    setPdfPreviewModalOpen(false);
                    setPdfPreviewContext(null);
                    if (pdfPreviewUrl) {
                      URL.revokeObjectURL(pdfPreviewUrl);
                      setPdfPreviewUrl(null);
                    }
                    if (action === "password_recovery") {
                      handleSendFax();
                    } else {
                      handleDownloadPDF();
                    }
                  }}
                  className="flex-1 py-3 bg-[#111111] text-white rounded-[10px] font-bold shadow-md hover:bg-[#2f2f2f] transition-colors"
                >
                  {i18n.language === 'ru' ? 'Подтвердить верность написания и перейти к генерации документа' : i18n.language === 'ko' ? '올바르게 작성되었는지 확인하고 문서 생성을 진행합니다' : 'Confirm correctness of spelling and proceed to document generation'}
                </button>
                <button 
                  onClick={() => {
                    setPdfPreviewModalOpen(false);
                    setPdfPreviewContext(null);
                    if (pdfPreviewUrl) {
                      URL.revokeObjectURL(pdfPreviewUrl);
                      setPdfPreviewUrl(null);
                    }
                  }}
                  className="flex-1 py-3 bg-white border-2 border-[#111111] text-[#111111] rounded-[10px] font-bold hover:bg-[#f7f7f5] transition-colors"
                >
                  {i18n.language === 'ru' ? 'Вернуться назад для редактирования' : i18n.language === 'ko' ? '편집을 위해 돌아가기' : 'Go back for editing'}
                </button>
              </div>
            )}
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
        onSuccess={async (userData) => {
          // Immediately set user from login response so UI updates
          setUser(userData);
          userRef.current = userData;
          setAuthModal({ open: false, type: "", subtitle: "" });

          if (pendingAction) {
            const action = pendingAction;
            setPendingAction(null);

            // Re-fetch canonical user data from server before running
            // the pending action — ensures access/payment state is accurate
            // and not stale from the login response snapshot.
            try {
              const meRes = await fetch("/api/auth/me", { credentials: "include" });
              const meData = await meRes.json();
              if (meData.user) {
                setUser(meData.user);
                userRef.current = meData.user;
              }
            } catch (e) {
              // If /api/auth/me fails, proceed with the login response data
            }

            // Run pending action after state is updated with canonical data
            setTimeout(() => action(), 0);
          }
          // If user is mid-application flow, stay on the current step.
          // All state (visa, action, form data, OCR, files) is preserved in memory.
          // Only navigate to my-page if user logged in from visa selection (home).
          else if (step === "visa") {
            navigateToStep("my-page");
          }
          // Otherwise: do nothing — stay on current step with all data intact.
        }}
      />

      {successModalData?.open && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 className="text-lg font-bold text-[#1a1c1d] mb-2">
              {i18n.language === 'ru' ? "Успешно" : i18n.language === 'ko' ? "성공" : "Success"}
            </h3>
            <p className="text-sm text-[#5f6368] mb-6 whitespace-pre-wrap leading-relaxed">
              {successModalData.isFax
                ? (i18n.language === 'ru'
                  ? `Заявление успешно отправлено по факсу на номер 050-4466-4550.\n\nСписано кредитов: ${successModalData.used}\nОсталось кредитов: ${successModalData.remaining}`
                  : i18n.language === 'ko'
                  ? `신청서가 팩스(050-4466-4550)로 성공적으로 전송되었습니다.\n\n차감된 크레딧: ${successModalData.used}\n남은 크레딧: ${successModalData.remaining}`
                  : `Application successfully sent by fax to 050-4466-4550.\n\nCredits used: ${successModalData.used}\nCredits remaining: ${successModalData.remaining}`)
                : (i18n.language === 'ru'
                  ? `Заявление успешно сформировано и скачано на ваше устройство.\n\nСписано кредитов: ${successModalData.used}\nОсталось кредитов: ${successModalData.remaining}`
                  : i18n.language === 'ko'
                  ? `신청서가 성공적으로 생성되어 기기에 다운로드되었습니다.\n\n차감된 크레딧: ${successModalData.used}\n남은 크레딧: ${successModalData.remaining}`
                  : `The application was successfully generated and downloaded to your device.\n\nCredits used: ${successModalData.used}\nCredits remaining: ${successModalData.remaining}`)}
            </p>
            <button
              onClick={() => {
                setSuccessModalData(null);
                fetch("/api/auth/me", { credentials: "include" })
                  .then(r => r.json())
                  .then(d => { if(d.ok && d.user) { setUser(d.user); userRef.current = d.user; } });
                fetchMyPagePackages();
                navigateToStep("my-page");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full py-3 bg-[#2f3437] text-white rounded-xl font-bold hover:bg-[#1a1c1d] transition-colors"
            >
              {i18n.language === 'ru' ? "ОК" : i18n.language === 'ko' ? "확인" : "OK"}
            </button>
          </div>
        </div>
      )}


      <SignaturePadModal 
        isOpen={!!activeSignatureRole} 
        onClose={() => setActiveSignatureRole(null)}
        title={
          activeSignatureRole === "applicant" ? (t("sig_applicant") || "Add applicant signature") :
          activeSignatureRole === "guarantor" ? (t("sig_guarantor") || "Add guarantor signature") :
          activeSignatureRole === "accommodationProvider" ? (t("sig_provider") || "Add provider signature") :
          (t("sig_title") || "Add signature")
        }
        onSave={(dataUrl) => {
          if (activeSignatureRole) {
            setSignatures(prev => ({
              ...prev,
              [activeSignatureRole]: { ...prev[activeSignatureRole], completed: true, imageBase64: dataUrl }
            }));
          }
          setActiveSignatureRole(null);
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

      {/* ── Pricing Section ── */}
      {PAYMENT_ENABLED && (
        <section id="pricing-section" className="w-full max-w-3xl bg-white border border-[#e7e5e2] rounded-[24px] p-6 md:p-10 shadow-sm mt-12 animate-in fade-in duration-300">
          <h2 className="text-xl font-bold tracking-[-0.03em] text-[#111111] mb-6">
            {t('pricing.title')}
          </h2>
          <div className="space-y-3.5 text-[#37352f] text-[15px] font-normal leading-relaxed">
            <p>{t('pricing.tier1')} - <span className="font-semibold text-[#111111]">3,000 KRW</span></p>
            <p>{t('pricing.tier2')} - <span className="font-semibold text-[#111111]">4,000 KRW</span></p>
            <p>{t('pricing.tier3')} - <span className="font-semibold text-[#111111]">5,000 KRW</span></p>
          </div>
        </section>
      )}

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
          v2.1
        </div>
      </footer>

      {/* Missing Submission Method Modal */}
      {missingSubmissionMethodPkg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 duration-300 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-[#1a1c1d]">{t("step.submission_method")}</h3>
              <p className="text-[#5f6368]">{t("step.submission_method_desc")}</p>
            </div>
            <div className="grid gap-4">
              <button
                onClick={() => {
                  missingSubmissionMethodPkg.onMethodSelected("online");
                  setMissingSubmissionMethodPkg(null);
                }}
                className="w-full py-3.5 bg-white border-2 border-[#111111] text-[#111111] rounded-[10px] font-bold shadow-sm hover:bg-[#f7f7f5] transition-colors"
              >
                {t("method.online")}
              </button>
              <button
                onClick={() => {
                  missingSubmissionMethodPkg.onMethodSelected("office");
                  setMissingSubmissionMethodPkg(null);
                }}
                className="w-full py-3.5 bg-white border-2 border-[#111111] text-[#111111] rounded-[10px] font-bold shadow-sm hover:bg-[#f7f7f5] transition-colors"
              >
                {t("method.office")}
              </button>
            </div>
            <button
              onClick={() => setMissingSubmissionMethodPkg(null)}
              className="w-full py-3 text-sm font-bold text-[#5f6368] hover:text-[#111111] transition-colors"
            >
              {t("cartPrompt.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* PDF Loading Overlay */}
      {pdfStatus === "loading" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-[24px] p-8 max-w-[320px] w-full text-center shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <svg className="animate-spin text-[#111111] w-12 h-12 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <h3 className="text-[18px] font-bold text-[#111111] mb-2">{t("str_152")}</h3>
            <p className="text-[13px] text-[#787774] leading-relaxed">
              {i18n.language === 'ru' ? 'Подождите, идет подготовка документа. Это может занять до 10-15 секунд...' : 
               i18n.language === 'ko' ? '문서 준비 중입니다. 최대 10~15초 정도 소요될 수 있습니다...' : 
               'Please wait, document is being generated. This may take up to 10-15 seconds...'}
            </p>
          </div>
        </div>
      )}

    </div>
  </>;
}
function Card({
  title,
  subtitle,
  children
}) {
  return <section className="bg-white border border-[#e7e5e2] rounded-[20px] md:rounded-[24px] px-3 py-4 md:p-10 shadow-sm relative overflow-hidden w-full">
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#e7e5e2] to-transparent"></div>
    <h2 className="text-[24px] md:text-[32px] leading-tight font-semibold tracking-[-0.03em] text-[#111111]">{title}</h2>
    {subtitle && <p className="text-[#5f6368] md:text-[#787774] mt-2 md:mt-3 mb-6 md:mb-8 leading-relaxed font-medium md:font-normal text-[16px] md:text-[15px]">{subtitle}</p>}
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
        <div className="text-[16px] md:text-[22px] leading-tight font-semibold tracking-[-0.03em] text-[#111111]">{label}</div>
      </div>
      <div className="text-[13px] md:text-[14px] leading-relaxed text-[#787774]">{description}</div>
    </div>
    {tag && <div className="mt-4"><span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${selected ? "bg-[#111111] text-white" : "bg-[#f1f1ef] text-[#787774]"}`}>{tag}</span></div>}
  </button>;
}
function UploadChoiceModal({ open, onClose, onCamera, onGallery }) {
  const { t, i18n } = useTranslation();
  if (!open) return null;

  const takePhotoText = i18n.language === 'ru' ? 'Сделать фото' : i18n.language === 'ko' ? '사진 촬영' : 'Take photo';
  const galleryText = i18n.language === 'ru' ? 'Выбрать из галереи' : i18n.language === 'ko' ? '갤러리에서 선택' : 'Choose from gallery';
  const cancelText = i18n.language === 'ru' ? 'Отмена' : i18n.language === 'ko' ? '취소' : 'Cancel';

  return <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/50 p-4 animate-in fade-in" onClick={onClose}>
    <div className="bg-white w-full max-w-sm rounded-2xl md:rounded-3xl overflow-hidden shadow-xl animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:zoom-in-95" onClick={e => e.stopPropagation()}>
      <div className="flex flex-col">
        <button onClick={() => { onClose(); onCamera(); }} className="py-4 px-6 text-[16px] md:text-[17px] font-medium text-[#111111] hover:bg-[#f1f1ef] active:bg-[#e7e5e2] flex items-center gap-3 transition-colors text-left border-b border-[#f1f1ef]">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
          {takePhotoText}
        </button>
        <button onClick={() => { onClose(); onGallery(); }} className="py-4 px-6 text-[16px] md:text-[17px] font-medium text-[#111111] hover:bg-[#f1f1ef] active:bg-[#e7e5e2] flex items-center gap-3 transition-colors text-left border-b border-[#f1f1ef]">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          {galleryText}
        </button>
        <button onClick={onClose} className="py-4 px-6 text-[16px] md:text-[17px] font-semibold text-[#c0504d] hover:bg-[#fff0f0] active:bg-[#fce8e8] flex items-center justify-center transition-colors">
          {cancelText}
        </button>
      </div>
    </div>
  </div>;
}

function SchoolUploadButton({ t, file, onFile, ocrStatus }) {
  const cameraRef = React.useRef(null);
  const galleryRef = React.useRef(null);
  const [isAndroid, setIsAndroid] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const isSelectingRef = React.useRef(false);
  React.useEffect(() => { setIsAndroid(/Android/i.test(navigator.userAgent)); }, []);

  const handleClick = (e) => {
    e.preventDefault();
    if (ocrStatus === "loading" || isSelectingRef.current) return;
    if (isAndroid) setShowModal(true);
    else {
      isSelectingRef.current = true;
      galleryRef.current?.click();
      setTimeout(() => { isSelectingRef.current = false; }, 1000);
    }
  };
  
  return <>
    <button type="button" onClick={handleClick} className="h-[48px] px-6 bg-[#111] text-white text-sm font-medium rounded-xl hover:bg-[#2f2f2f] transition flex items-center justify-center cursor-pointer shrink-0">
      {file ? t("str_80") : t("str_81")}
    </button>
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} onClick={e => e.stopPropagation()} />
    <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} onClick={e => e.stopPropagation()} />
    <UploadChoiceModal open={showModal} onClose={() => setShowModal(false)} onCamera={() => {
      isSelectingRef.current = true;
      cameraRef.current?.click();
      setTimeout(() => { isSelectingRef.current = false; }, 1000);
    }} onGallery={() => {
      isSelectingRef.current = true;
      galleryRef.current?.click();
      setTimeout(() => { isSelectingRef.current = false; }, 1000);
    }} />
  </>;
}

function UploadBox({
  title,
  note,
  file,
  onFile,
  ocrStatus,
  ocrError,
  onAdjust,
  bgImage,
  bgPosition,
  loadingText,
  isPasswordRecovery,
  onUnifiedAdjust,
  onUnifiedReplace
}) {
  const { t } = useTranslation();
  const cameraInputRef = React.useRef(null);
  const galleryInputRef = React.useRef(null);
  const isSelectingRef = React.useRef(false);
  const [isIOS, setIsIOS] = React.useState(false);
  const [isAndroid, setIsAndroid] = React.useState(false);
  const [showChoiceModal, setShowChoiceModal] = React.useState(false);

  React.useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
    setIsAndroid(/Android/i.test(navigator.userAgent));
  }, []);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const uploaded = !!file;
  const isLoading = ocrStatus === "loading" || isCompressing;
  const isSuccess = ocrStatus === "success";
  const isError = ocrStatus === "error";

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
          maxSizeMB: 1.5,
          maxWidthOrHeight: 2000,
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
  const handleCardClick = () => {
    if (isLoading || isSelectingRef.current) return;
    if (isAndroid) {
      setShowChoiceModal(true);
    } else {
      isSelectingRef.current = true;
      galleryInputRef.current?.click();
      setTimeout(() => { isSelectingRef.current = false; }, 1000);
    }
  };

  const handleCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  const truncate = (name, max = 26) => name.length > max ? name.slice(0, max - 1) + "…" : name;
  const isWarning = ocrStatus === "warning";
  return <div className={`relative h-full border rounded-[16px] md:rounded-[20px] transition-all duration-200 text-center flex flex-col items-center select-none overflow-hidden cursor-pointer
                ${uploaded ? isError ? "border-[#e07a7a] bg-[#fff6f6]" : isWarning ? "border-[#d97706] bg-[#fffbef]" : "border-[#2d7a2d] bg-[#f0faf0]" : "border-dashed border-[#d9d7d3] bg-white hover:bg-[#fbfbfa] p-4 md:p-8 justify-center"}
                ${!uploaded ? "min-h-[140px] md:min-h-[180px]" : ""}`} 
                onClick={handleCardClick}
                onKeyDown={handleCardKeyDown}
                role="button"
                tabIndex={0}
                >
    {/* Watermark background if not uploaded */}
    {!uploaded && bgImage && (
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.35]" 
        style={{ 
          backgroundImage: `url(${bgImage})`, 
          backgroundSize: '100% auto', 
          backgroundPosition: bgPosition || 'center',
          backgroundRepeat: 'no-repeat'
        }} 
      />
    )}
    
    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} disabled={isLoading} onClick={e => e.stopPropagation()} />
    <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={isLoading} onClick={e => e.stopPropagation()} />

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

        {/* Adjust Image badge & Choose another photo - Only for password recovery */}
        {!isLoading && isPasswordRecovery && (
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
          <span className="text-white text-[11px] font-medium text-center px-4">{loadingText || (!isPasswordRecovery && isCompressing ? t("upload.processingPhoto") : isCompressing ? (t("str_162") || "Processing...") : t("str_162"))}</span>
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
      {isError && ocrError && isPasswordRecovery && (
        <div className="w-full px-3 pb-2.5 md:px-4">
          <div className="bg-[#fff0f0] border border-[#f5c6c6] rounded-[10px] px-3 py-2 flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c0504d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            <p className="text-[11px] text-[#c0504d] leading-snug">{ocrError}</p>
          </div>
        </div>
      )}
      
      {/* Unified Actions State */}
      {!isLoading && !isPasswordRecovery && (
        <div className="w-full px-3 pb-3 md:px-4 space-y-3 mt-1">
          {isError && ocrError && (
            <div className="bg-[#fff0f0] border border-[#f5c6c6] rounded-[10px] px-3 py-2 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c0504d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
              <p className="text-[11px] text-[#c0504d] leading-snug font-medium">
                {ocrError || t("upload.autoProcessFailed") || "Photo could not be processed automatically."}
              </p>
            </div>
          )}
          <div className="flex gap-2">
             <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (onUnifiedReplace) onUnifiedReplace();
                  else {
                    if (isAndroid) setShowChoiceModal(true);
                    else galleryInputRef.current?.click();
                  }
                }}
                className="flex-[1] flex items-center justify-center py-2.5 rounded-xl text-[13px] font-semibold bg-[#f4f4f4] text-[#333] active:scale-95 transition-all border border-[#e5e5e5]"
             >
                {t("upload.replacePhotoBig") || "Replace photo"}
             </button>
             <button
                onClick={(e) => { e.stopPropagation(); onUnifiedAdjust?.(); }}
                className="flex-[1.5] flex items-center justify-center py-2.5 rounded-xl text-[13px] font-semibold text-white active:scale-95 transition-all"
                style={{ background: "linear-gradient(135deg, #4f7cff 0%, #3d6ae8 100%)" }}
             >
                {t("upload.adjustImageBig") || "Adjust image"}
             </button>
          </div>
        </div>
      )}
    </> : <>
      <div className="relative z-10 flex flex-col items-center">
        <div className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-lg shadow-sm border border-white/50 mb-1">
          <div className="text-[15px] md:text-[17px] font-semibold text-[#111111]">{title}</div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center mt-2 gap-2 pointer-events-none">
        <button
          type="button"
          disabled={isLoading}
          className="py-1.5 md:py-2 flex items-center justify-center group"
        >
          <div className="inline-flex items-center justify-center gap-2 text-xs md:text-sm font-medium text-[#111111] bg-white/95 backdrop-blur-md px-4 py-2 rounded-[12px] shadow-sm border border-white/80 group-hover:bg-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            {t("upload.uploadPhoto") || (i18n.language === 'ru' ? 'Загрузить фото' : i18n.language === 'ko' ? '사진 업로드' : 'Upload photo')}
          </div>
        </button>
      </div>

      {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-[16px] md:rounded-[20px]">
        <svg className="animate-spin mb-1.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#787774" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span className="text-[#787774] text-[11px] font-medium text-center px-4">{loadingText || (!isPasswordRecovery && isCompressing ? t("upload.processingPhoto") : isCompressing ? (t("str_162") || "Processing...") : t("str_162"))}</span>
      </div>}
    </>}

    <UploadChoiceModal 
      open={showChoiceModal} 
      onClose={() => setShowChoiceModal(false)}
      onCamera={() => {
        isSelectingRef.current = true;
        cameraInputRef.current?.click();
        setTimeout(() => { isSelectingRef.current = false; }, 1000);
      }}
      onGallery={() => {
        isSelectingRef.current = true;
        galleryInputRef.current?.click();
        setTimeout(() => { isSelectingRef.current = false; }, 1000);
      }}
    />
  </div>;
}
function FieldGrid({
  children,
  cols
}) {
  return <div className={`grid ${cols === "3" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-x-5 gap-y-3 md:gap-y-4`}>{children}</div>;
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
      <span className="block text-[15px] md:text-[13px] font-semibold text-[#5f6368] md:text-[#787774] mb-1 md:mb-2 ml-1">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className={`w-full h-[42px] md:h-[46px] border rounded-xl px-4 bg-white text-[#111111] text-lg font-medium md:font-normal md:text-[15px] outline-none transition shadow-sm focus:border-[#111111] focus:ring-4 focus:ring-[#111111]/5 ${required && !value ? "border-[#e07a7a] bg-[#fffcfc]" : "border-[#d9d7d3]"}`} placeholder={placeholder} />
    </label>
    {helperText && <div className="text-[13px] md:text-[11.5px] text-[#5f6368] md:text-[#787774] mt-2 ml-1 leading-relaxed">{helperText}</div>}
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
    <span className="block text-[15px] md:text-[13px] font-semibold text-[#5f6368] md:text-[#787774] mb-2 ml-1">
      {label} {required && <span className="text-red-400">*</span>}
    </span>
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={`w-full h-14 md:h-[46px] border rounded-xl px-4 bg-white text-[#111111] text-lg font-medium md:font-normal md:text-[15px] outline-none transition shadow-sm focus:border-[#111111] focus:ring-4 focus:ring-[#111111]/5 appearance-none cursor-pointer ${required && !value ? "border-[#e07a7a] bg-[#fffcfc]" : "border-[#d9d7d3]"}`}>
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
      <span className="block text-[15px] md:text-[13px] font-semibold text-[#5f6368] md:text-[#787774] mb-2 ml-1">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-[#d9d7d3] rounded-xl px-4 py-4 min-h-[120px] bg-white text-[#111111] text-lg font-medium md:font-normal md:text-[15px] outline-none transition shadow-sm focus:border-[#111111] focus:ring-4 focus:ring-[#111111]/5 resize-y" />
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
}
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

  const timeoutRef = React.useRef(null);

  const startDrawing = (e) => {
    e.preventDefault();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        onChange(dataUrl);
      }
    }, 2000);
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

function SignaturePadModal({ isOpen, onClose, onSave, title }) {
  const { t } = useTranslation();
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Make it full width of container, fixed height
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 240;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Transparent background
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
    // Prevent default on touch devices to avoid scrolling
    if (e.type.startsWith('touch')) e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
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
      // Nothing drawn, can return null or alert
      alert(t("sig_draw_required") || "Please draw a signature");
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
    
    // Save as PNG transparent
    const dataUrl = croppedCanvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e7e5e2]">
          <h3 className="text-lg font-bold text-[#1a1c1d]">{title || t("sig_title") || "Add signature"}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f3f1ee] transition-colors text-[#555]">
            ✕
          </button>
        </div>
        
        <div className="p-6 flex-1 flex flex-col bg-[#f8f8f6]">
          <div className="bg-white border-2 border-dashed border-[#d9d7d3] rounded-xl overflow-hidden relative touch-none" style={{ height: "240px" }}>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <span className="text-xl font-bold">{t("sig_draw_here") || "Draw here"}</span>
            </div>
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
        </div>

        <div className="px-6 py-4 border-t border-[#e7e5e2] bg-white flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleClear}
            className="flex-1 py-3 text-[15px] font-bold text-[#1a1c1d] bg-white border border-[#d9d7d3] rounded-xl hover:bg-[#f1f1ef] transition-colors"
          >
            {t("sig_clear") || "Clear"}
          </button>
          <button
            onClick={cropAndSave}
            className="flex-1 py-3 text-[15px] font-bold text-white bg-[#111111] rounded-xl hover:bg-[#2c2c2c] transition-colors"
          >
            {t("sig_save") || "Save signature"}
          </button>
        </div>
      </div>
    </div>
  );
}
