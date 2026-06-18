import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function AuthModal({ open, initialType, onClose, onSuccess, subtitle }) {
  const { t } = useTranslation();
  const [type, setType] = useState(initialType || "login");
  const [authStep, setAuthStep] = useState(1);
  const [authData, setAuthData] = useState({ email: "", password: "", confirmPassword: "", code: "" });
  const [authError, setAuthError] = useState("");
  const [authStatus, setAuthStatus] = useState("idle");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setType(initialType || "login");
      setAuthStep(1);
      setAuthData({ email: "", password: "", confirmPassword: "", code: "" });
      setAuthError("");
      setAuthStatus("idle");
      setShowPassword(false);
    }
  }, [open, initialType]);

  if (!open) return null;

  const handleClose = () => {
    onClose();
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthStatus("loading");
    
    try {
        let endpoint = "";
        let body = {};
        
        const trimmedEmail = (authData.email || "").trim();
        
        if (type === "login") {
            endpoint = "/api/auth/email/login";
            body = { email: trimmedEmail, password: authData.password };
        } else if (type === "register") {
            if (authStep === 1) {
                endpoint = "/api/auth/email/register/request-code";
                body = { email: trimmedEmail };
            } else if (authStep === 2) {
                endpoint = "/api/auth/email/register/verify-code";
                body = { email: trimmedEmail, code: authData.code };
            } else if (authStep === 3) {
                endpoint = "/api/auth/email/register/complete";
                body = { email: trimmedEmail, password: authData.password, confirmPassword: authData.confirmPassword };
            }
        } else if (type === "forgot") {
            if (authStep === 1) {
                endpoint = "/api/auth/email/password-reset/request-code";
                body = { email: trimmedEmail };
            } else if (authStep === 2) {
                endpoint = "/api/auth/email/password-reset/verify-code";
                body = { email: trimmedEmail, code: authData.code };
            } else if (authStep === 3) {
                endpoint = "/api/auth/email/password-reset/complete";
                body = { email: trimmedEmail, password: authData.password, confirmPassword: authData.confirmPassword };
            }
        }

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            credentials: "include"
        });
        const data = await res.json();
        
        if (!data.success) {
            setAuthError(t(`auth.${data.error}`) !== `auth.${data.error}` ? t(`auth.${data.error}`) : (data.error || "An error occurred"));
            setAuthStatus("idle");
            return;
        }

        if (type === "login") {
            onSuccess(data.user);
        } else if (type === "register") {
            if (authStep === 1) setAuthStep(2);
            else if (authStep === 2) setAuthStep(3);
            else if (authStep === 3) {
                onSuccess(data.user);
            }
        } else if (type === "forgot") {
            if (authStep === 1) setAuthStep(2);
            else if (authStep === 2) setAuthStep(3);
            else if (authStep === 3) {
                setType("login");
                setAuthStep(1);
                setAuthData({ email: "", password: "", confirmPassword: "", code: "" });
            }
        }
        setAuthStatus("idle");
    } catch (err) {
        setAuthError("Network error");
        setAuthStatus("idle");
    }
  };

  const switchType = (newType) => {
      setType(newType);
      setAuthError("");
      setAuthStep(1);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
        <div className="bg-white rounded-[24px] max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden relative">
            <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-[#787774] hover:text-[#111111] bg-[#f7f7f5] rounded-full hover:bg-[#ebebe9] transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
            
            <div className="p-8 pb-10 overflow-y-auto">
                <h3 className="text-2xl font-bold text-[#111111] mb-6 text-center">
                    {type === "login" ? t("auth.signIn") : type === "register" ? t("auth.createAccount") : t("auth.resetPassword")}
                </h3>
                {subtitle && (
                    <div className="text-sm text-center text-[#5f6368] -mt-4 mb-6 px-2 font-medium bg-[#f8f9fa] py-2.5 rounded-xl border border-[#ebebeb]">
                        {subtitle}
                    </div>
                )}
                
                {authError && <div className="mb-6 p-3 rounded-xl bg-[#fff5f5] border border-[#f5c6cb] text-[#d93025] text-[13px] text-center font-medium">{authError}</div>}
                
                {(type === "login" && authStep === 1) && (
                    <div className="mb-6">
                        <button
                            type="button"
                            onClick={() => {
                                const w = 500, h = 600;
                                const left = window.screenX + (window.outerWidth - w) / 2;
                                const top = window.screenY + (window.outerHeight - h) / 2;
                                const popup = window.open(
                                    '/auth/google?popup=1',
                                    'google-auth',
                                    `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
                                );
                                const onMessage = (e) => {
                                    if (e.data === 'google-auth-success') {
                                        window.removeEventListener('message', onMessage);
                                        // Fetch authenticated user and call onSuccess
                                        fetch('/api/auth/me', { credentials: 'include' })
                                            .then(r => r.json())
                                            .then(d => {
                                                if (d.user) onSuccess(d.user);
                                            });
                                    } else if (e.data === 'google-auth-failed') {
                                        window.removeEventListener('message', onMessage);
                                        setAuthError(t('auth.googleSignInFailed') || 'Google sign-in failed');
                                    }
                                };
                                window.addEventListener('message', onMessage);
                                // Fallback: clean up listener if popup is closed without completing
                                const checkClosed = setInterval(() => {
                                    if (popup && popup.closed) {
                                        clearInterval(checkClosed);
                                        window.removeEventListener('message', onMessage);
                                    }
                                }, 500);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white text-[#2f3437] border border-[#e7e5e2] hover:shadow-md transition-all font-bold cursor-pointer"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            {t("auth.signInWithGoogle")}
                        </button>
                        <div className="flex items-center gap-3 my-6">
                            <div className="flex-1 h-px bg-[#e7e5e2]"></div>
                            <span className="text-[13px] text-[#9b9a97] font-medium px-2">{t("auth.or")}</span>
                            <div className="flex-1 h-px bg-[#e7e5e2]"></div>
                        </div>
                    </div>
                )}
                
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                    {(type === "login" || authStep === 1) && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[13px] font-semibold text-[#5f6368] mb-1.5 ml-1">{t("auth.email")}</label>
                                <input type="email" value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-[#e7e5e2] focus:border-[#2f3437] focus:ring-1 focus:ring-[#2f3437] outline-none text-[15px] bg-[#fbfbfa] focus:bg-white transition-all placeholder-[#9b9a97]" placeholder="example@email.com" required />
                            </div>
                            {type === "login" && (
                                <div>
                                    <div className="flex justify-between items-center mb-1.5 ml-1 mr-1">
                                        <label className="block text-[13px] font-semibold text-[#5f6368]">{t("auth.password")}</label>
                                        <button type="button" onClick={() => switchType("forgot")} className="text-[12px] font-medium text-[#4285F4] hover:underline">{t("auth.forgotPassword")}</button>
                                    </div>
                                    <input type={showPassword ? "text" : "password"} value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-[#e7e5e2] focus:border-[#2f3437] focus:ring-1 focus:ring-[#2f3437] outline-none text-[15px] bg-[#fbfbfa] focus:bg-white transition-all placeholder-[#9b9a97]" placeholder="••••••••" required />
                                    <label className="flex items-center mt-2 gap-2 cursor-pointer ml-1">
                                        <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} className="w-4 h-4 rounded accent-[#111111]" />
                                        <span className="text-[12px] font-medium text-[#5f6368]">{t("auth.showPassword")}</span>
                                    </label>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {authStep === 2 && (
                        <div>
                            <div className="text-[14px] text-[#5f6368] text-center mb-4">{t("auth.codeSent")}</div>
                            <label className="block text-[13px] font-semibold text-[#5f6368] mb-1.5 ml-1">{t("auth.verificationCode")}</label>
                            <input type="text" value={authData.code} onChange={e => setAuthData({...authData, code: e.target.value})} className="w-full text-center tracking-widest px-4 py-3 rounded-xl border border-[#e7e5e2] focus:border-[#2f3437] focus:ring-1 focus:ring-[#2f3437] outline-none text-[18px] font-bold bg-[#fbfbfa] focus:bg-white transition-all placeholder-[#9b9a97]" placeholder="000000" required />
                        </div>
                    )}
                    
                    {authStep === 3 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[13px] font-semibold text-[#5f6368] mb-1.5 ml-1">{type === "forgot" ? t("auth.newPassword") : t("auth.createPassword")}</label>
                                <input type={showPassword ? "text" : "password"} value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-[#e7e5e2] focus:border-[#2f3437] focus:ring-1 focus:ring-[#2f3437] outline-none text-[15px] bg-[#fbfbfa] focus:bg-white transition-all placeholder-[#9b9a97]" placeholder="••••••••" required minLength={8} />
                            </div>
                            <div>
                                <label className="block text-[13px] font-semibold text-[#5f6368] mb-1.5 ml-1">{t("auth.repeatPassword")}</label>
                                <input type={showPassword ? "text" : "password"} value={authData.confirmPassword} onChange={e => setAuthData({...authData, confirmPassword: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-[#e7e5e2] focus:border-[#2f3437] focus:ring-1 focus:ring-[#2f3437] outline-none text-[15px] bg-[#fbfbfa] focus:bg-white transition-all placeholder-[#9b9a97]" placeholder="••••••••" required minLength={8} />
                            </div>
                            <label className="flex items-center mt-1 gap-2 cursor-pointer ml-1">
                                <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} className="w-4 h-4 rounded accent-[#111111]" />
                                <span className="text-[12px] font-medium text-[#5f6368]">{t("auth.showPassword")}</span>
                            </label>
                        </div>
                    )}
                    
                    <button type="submit" disabled={authStatus === "loading"} className="w-full mt-6 py-3.5 bg-[#111111] text-white rounded-xl font-bold hover:bg-[#2f3437] transition-all flex items-center justify-center disabled:opacity-50">
                        {authStatus === "loading" ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            type === "login" ? t("auth.signIn") : 
                            authStep === 1 ? t("auth.sendCode") : 
                            authStep === 2 ? t("auth.verify") : 
                            type === "forgot" ? t("auth.saveNewPassword") : t("auth.completeRegistration")
                        )}
                    </button>
                    
                    {authStep === 2 && (
                        <button type="button" onClick={() => setAuthStep(1)} className="w-full mt-4 py-2 text-[13px] font-medium text-[#5f6368] hover:text-[#111111] transition-all">
                            {t("auth.resendCode")}
                        </button>
                    )}
                </form>
                
                {type === "login" && (
                    <div className="mt-6 text-[14px] text-[#5f6368] flex flex-wrap items-center justify-center gap-1.5">
                        <span className="whitespace-nowrap">{t("auth.noAccount")}</span>
                        <button type="button" onClick={() => switchType("register")} className="font-bold text-[#111111] hover:underline whitespace-nowrap">{t("auth.createAccount")}</button>
                    </div>
                )}
                {type === "register" && (
                    <div className="mt-6 text-[14px] text-[#5f6368] flex flex-wrap items-center justify-center gap-1.5">
                        <span className="whitespace-nowrap">{t("auth.alreadyHaveAccount")}</span>
                        <button type="button" onClick={() => switchType("login")} className="font-bold text-[#111111] hover:underline whitespace-nowrap">{t("auth.signIn")}</button>
                    </div>
                )}
                {type === "forgot" && (
                    <div className="mt-6 text-center text-[14px] text-[#5f6368]">
                        <button type="button" onClick={() => switchType("login")} className="font-bold text-[#111111] hover:underline ml-1">{t("auth.backToSignIn")}</button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
