import re

with open("src/ImmigrationMVP.jsx", "r") as f:
    code = f.read()

# 1. Update ErrorBoundary
error_boundary_old = """class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

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
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-4 py-2 bg-[#8a0000] text-white rounded font-bold"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}"""
error_boundary_new = """class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    // Optionally log to server here
    try {
      fetch("/api/log/error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: error.toString(), componentStack: errorInfo.componentStack })
      }).catch(() => {});
    } catch(e) {}
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const lang = this.props.lang || 'en';
      const title = lang === 'ru' ? 'Произошла ошибка. Попробуйте обновить страницу.' :
                    lang === 'ko' ? '오류가 발생했습니다. 페이지를 새로고침해 주세요.' :
                    'Something went wrong. Please refresh page.';
      
      return (
        <div className="flex flex-col min-h-screen items-center justify-center p-8 bg-[#fff0f0] text-[#8a0000]">
          <h1 className="text-2xl font-bold mb-4">{title}</h1>
          <pre className="text-xs bg-white p-4 rounded shadow max-w-full overflow-auto text-left">
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-4 py-2 bg-[#8a0000] text-white rounded font-bold"
          >
            {lang === 'ru' ? 'Обновить' : lang === 'ko' ? '새로고침' : 'Reload Page'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}"""
code = code.replace(error_boundary_old, error_boundary_new)

# Update <ErrorBoundary> to <ErrorBoundary lang={i18n.language}>
code = code.replace("<ErrorBoundary>", "<ErrorBoundary lang={i18n.language}>")

# 2. Add cartSuccessModal state
code = code.replace("const [cartPromptModal, setCartPromptModal] = useState(false);", "const [cartPromptModal, setCartPromptModal] = useState(false);\n  const [cartSuccessModal, setCartSuccessModal] = useState(false);")

# 3. Change Add to Cart behavior
add_to_cart_old = """                    if (res.ok) {
                      alert(t("cartPrompt.addedSuccess") || "Application added to cart");
                      startOver(true);
                    }"""
add_to_cart_new = """                    if (res.ok) {
                      setCartSuccessModal(true);
                    }"""
code = code.replace(add_to_cart_old, add_to_cart_new)

# 4. Add Cart Success Modal UI
cart_success_ui = """      {cartSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-[24px] w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl font-bold text-[#1a1c1d] mb-6">
              {i18n.language === 'ru' ? 'Заявление добавлено в корзину' : 
               i18n.language === 'ko' ? '신청서가 장바구니에 추가되었습니다' : 
               'Application added to cart'}
            </h2>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => {
                  setCartSuccessModal(false);
                  navigateToStep("my-page");
                }}
                className="w-full py-3 bg-[#111111] text-white rounded-xl font-bold hover:bg-[#2f2f2f] transition-all shadow-md"
              >
                {i18n.language === 'ru' ? 'Перейти в корзину' : 
                 i18n.language === 'ko' ? '장바구니 이동' : 
                 'Go to cart'}
              </button>
              <button
                onClick={() => {
                  setCartSuccessModal(false);
                }}
                className="w-full py-3 border border-[#e7e5e2] text-[#2f3437] rounded-xl font-bold hover:bg-[#f7f7f5] transition-all"
              >
                {i18n.language === 'ru' ? 'Продолжить редактирование' : 
                 i18n.language === 'ko' ? '계속 수정' : 
                 'Continue editing'}
              </button>
            </div>
          </div>
        </div>
      )}"""

code = code.replace("{/* ── Auth Modal ── */}", cart_success_ui + "\n\n      {/* ── Auth Modal ── */}")

with open("src/ImmigrationMVP.jsx", "w") as f:
    f.write(code)

print("Patched cart success modal!")
