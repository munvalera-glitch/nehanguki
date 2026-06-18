import re

with open("src/ImmigrationMVP.jsx", "r") as f:
    code = f.read()

# Add ErrorBoundary class
error_boundary = """
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col min-h-screen items-center justify-center p-8 bg-[#fff0f0] text-[#8a0000]">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <p className="mb-4">An error occurred while rendering the page.</p>
          <pre className="text-xs bg-white p-4 rounded shadow max-w-full overflow-auto text-left">
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-[#8a0000] text-white rounded font-bold">Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
"""
code = code.replace("export default function ImmigrationMVP() {", error_boundary + "\nexport default function ImmigrationMVP() {")

# Add state
code = code.replace("const [loadingPackages, setLoadingPackages] = useState(false);", "const [loadingPackages, setLoadingPackages] = useState(false);\n  const [selectedCartItems, setSelectedCartItems] = useState([]);\n  const [draftId, setDraftId] = useState(null);")
code = code.replace("const [paymentModalOpen, setPaymentModalOpen] = useState(false);", "const [paymentModalOpen, setPaymentModalOpen] = useState(false);\n  const [cartPromptModal, setCartPromptModal] = useState(false);")

# Wrap return with ErrorBoundary
code = code.replace("return <>", "return <ErrorBoundary><>")
# Find the exact closing fragment before the modals (there is only one `</>;` in the file)
code = code.replace("        </>;\n}", "        </></ErrorBoundary>;\n}")

# Update ensureGenerationAccess
ensure_gen_old = """  async function ensureGenerationAccess(actionType) {
    if (!user) {
      setAuthModal({
        open: true,
        type: "login",
        subtitle: t("loginRequiredForGeneration") || "Log in to save and download documents."
      });
      return false;
    }
    if (user.freeDownloadsUsed === 0 || user.paidGenerationsRemaining > 0) {
      return true;
    }
    setPaymentModalOpen(true);
    return false;
  }"""
ensure_gen_new = """  async function ensureGenerationAccess(actionType, skipCartPrompt = false) {
    if (!user) {
      setAuthModal({
        open: true,
        type: "login",
        subtitle: t("loginRequiredForGeneration") || "Log in to save and download documents."
      });
      return false;
    }
    if (user.freeDownloadsUsed === 0 || user.paidGenerationsRemaining > 0 || (user.subscriptions && user.subscriptions.some(s => s.type === "unlimited_7d" && new Date(s.expiresAt) > new Date()))) {
      return true;
    }
    if (skipCartPrompt) {
      setPaymentModalOpen(true);
    } else {
      setCartPromptModal(true);
    }
    return false;
  }"""
code = code.replace(ensure_gen_old, ensure_gen_new)

# Add skipCartPrompt to direct usage
code = code.replace("ensureGenerationAccess(handleDownloadPDF)", "ensureGenerationAccess(handleDownloadPDF, false)")

# Update Card download to Resume
download_button = """<button 
                                                            onClick={async () => {
                                                                const isPaid = pkg.paymentStatus === "paid";
                                                                const performDownload = async () => {"""
resume_button = """{pkg.paymentStatus !== "paid" ? (
                                                            <button
                                                              onClick={() => {
                                                                setVisaType(pkg.visaType || "");
                                                                setAction(pkg.action || "");
                                                                setHousingType(pkg.housingType || "");
                                                                setApplicant(pkg.applicant || {});
                                                                setGuarantor(pkg.guarantor || {});
                                                                setProvider(pkg.provider || {});
                                                                setAddress(pkg.address || "");
                                                                setDraftId(pkg.id);
                                                                setPassportFile(null);
                                                                setIdCardFile(null);
                                                                setContractFile(null);
                                                                setProviderIdFile(null);
                                                                setGuarantorFile(null);
                                                                setSchoolFile(null);
                                                                navigateToStep("generate");
                                                              }}
                                                              className="px-4 py-2 text-sm font-bold border border-[#e7e5e2] rounded-full hover:bg-[#f7f7f5] transition-all text-[#2f3437]"
                                                            >
                                                              {t('myPage.resume') || 'Resume'}
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={async () => {
                                                                    const isPaid = pkg.paymentStatus === "paid";
                                                                    const performDownload = async () => {"""
code = code.replace(download_button, resume_button)

# Add closing paren for Resume conditional
code = code.replace("""                                                            {t('myPage.download')}
                                                        </button>
                                                    </div>
                                                </div>""", """                                                            {t('myPage.download')}
                                                        </button>
                                                        )}
                                                    </div>
                                                </div>""")

# Add checkbox to cart item
cart_item_top = """                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold uppercase px-2 py-0.5 bg-[#f7f7f5] rounded-md text-[#5f6368]">"""
cart_item_top_new = """                                                    <div className="flex items-start gap-4">
                                                        {pkg.paymentStatus !== "paid" && (
                                                            <input 
                                                                type="checkbox" 
                                                                className="mt-1 w-5 h-5 accent-[#111111] cursor-pointer"
                                                                checked={selectedCartItems.includes(pkg.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedCartItems(prev => [...prev, pkg.id]);
                                                                    else setSelectedCartItems(prev => prev.filter(id => id !== pkg.id));
                                                                }}
                                                            />
                                                        )}
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold uppercase px-2 py-0.5 bg-[#f7f7f5] rounded-md text-[#5f6368]">"""
code = code.replace(cart_item_top, cart_item_top_new)

# Add closing div for flex items-start gap-4
cart_item_bottom = """                                                            <p className="text-sm text-[#5f6368]">{pkg.address}</p>
                                                        </div>"""
cart_item_bottom_new = """                                                            <p className="text-sm text-[#5f6368]">{pkg.address}</p>
                                                            </div>
                                                        </div>"""
code = code.replace(cart_item_bottom, cart_item_bottom_new)

# Add Multiselect Bar
multiselect_bar = """                                        {myPagePackages.map(pkg => ("""
multiselect_bar_new = """                                        {selectedCartItems.length > 0 && (
                                          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border border-[#e7e5e2] p-5 rounded-2xl shadow-sm mb-4">
                                            <div>
                                              <p className="text-sm font-semibold text-[#5f6368] mb-0.5">{t('myPage.selectedLabel') || 'Selected'}: {selectedCartItems.length} items</p>
                                              <p className="text-lg font-bold text-[#111111]">{(() => {
                                                const dbUser = user || {};
                                                const subscriptions = dbUser.subscriptions || [];
                                                const unlimitedSub = subscriptions.find(s => s.type === "unlimited_7d");
                                                const unlimited = unlimitedSub ? new Date(unlimitedSub.expiresAt) : null;
                                                const isUnlimitedActive = unlimited && unlimited > new Date();
                                                return isUnlimitedActive ? 0 : selectedCartItems.length;
                                              })()} {t('myPage.creditsRequiredLabel') || 'Credits required'}</p>
                                            </div>
                                            <div className="flex w-full sm:w-auto gap-3">
                                              <button
                                                onClick={async () => {
                                                  const access = await ensureGenerationAccess("batch", true);
                                                  if (!access) return;
                                                  setPaymentModalOpen(true);
                                                }}
                                                className="flex-1 sm:flex-none px-6 py-2.5 bg-[#111111] text-white font-bold rounded-xl hover:bg-[#2f2f2f] transition-all"
                                              >
                                                {t('myPage.paySelected') || 'Pay selected'}
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                        {myPagePackages.map(pkg => ("""
code = code.replace(multiselect_bar, multiselect_bar_new)

# Add Cart Prompt Modal
cart_prompt = """      {/* ── Auth Modal ── */}"""
cart_prompt_new = """      {cartPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCartPromptModal(false)} />
          <div className="relative bg-white rounded-[24px] w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            </div>
            <h2 className="text-xl font-bold text-[#1a1c1d] mb-2">{t("cartPrompt.title") || "Payment Required"}</h2>
            <p className="text-[#5f6368] text-sm mb-6">{t("cartPrompt.desc") || "You do not have enough credits to generate this PDF. You can pay now or add to cart to pay later."}</p>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => {
                  setCartPromptModal(false);
                  setPaymentModalOpen(true);
                }}
                className="w-full py-3 bg-[#111111] text-white rounded-xl font-bold hover:bg-[#2f2f2f] transition-all shadow-md"
              >
                {t("cartPrompt.payNow") || "Pay Now"}
              </button>
              <button
                onClick={async () => {
                  setCartPromptModal(false);
                  try {
                    const formData = new FormData();
                    formData.append("payload", JSON.stringify(getPayload()));
                    formData.append("isDraft", "true");
                    if (draftId) formData.append("draftId", draftId);
                    if (passportFile) formData.append("passportFile", passportFile);
                    if (idCardFile) formData.append("idCardFile", idCardFile);
                    if (contractFile) formData.append("contractFile", contractFile);
                    if (providerIdFile) formData.append("providerIdFile", providerIdFile);
                    if (guarantorFile) formData.append("guarantorFile", guarantorFile);
                    if (schoolFile) formData.append("schoolFile", schoolFile);
                    
                    const res = await fetch("/api/document/save", { method: "POST", body: formData, credentials: "include" });
                    if (res.ok) {
                      alert(t("cartPrompt.addedSuccess") || "Application added to cart");
                      startOver(true);
                    }
                  } catch(e) {
                    console.error(e);
                  }
                }}
                className="w-full py-3 border border-[#e7e5e2] text-[#2f3437] rounded-xl font-bold hover:bg-[#f7f7f5] transition-all"
              >
                {t("cartPrompt.addToCart") || "Add to Cart"}
              </button>
              <button
                onClick={() => setCartPromptModal(false)}
                className="w-full py-3 text-[#5f6368] font-bold hover:bg-[#f7f7f5] rounded-xl transition-all"
              >
                {t("cartPrompt.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Auth Modal ── */}"""
code = code.replace(cart_prompt, cart_prompt_new)

with open("src/ImmigrationMVP.jsx", "w") as f:
    f.write(code)

print("Patched ImmigrationMVP.jsx!")
