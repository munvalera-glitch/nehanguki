import re

path = "/Users/macvalera/Documents/HIkoreaFORMS/src/ImmigrationMVP.jsx"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State
state_code = """  const [accommodationOptions, setAccommodationOptions] = useState({ relationship: "", ownershipType: "", residenceType: "" });"""
if "setAccommodationOptions" not in content:
    content = content.replace('const [action, setAction] = useState("");', 'const [action, setAction] = useState("");\n' + state_code)

# 2. Add signature fields to state
# Wait, Applicant already has a signature state? Let's check `getPayload`.
# We need to add `applicantSignatureB64` and `providerSignatureB64` to `getPayload` if they don't exist.
payload_addition = """      accRelationship: accommodationOptions.relationship,
      accOwnershipType: accommodationOptions.ownershipType,
      accResidenceType: accommodationOptions.residenceType,"""
if "accRelationship:" not in content:
    content = content.replace('providerNationality: provider.nationality,', 'providerNationality: provider.nationality,\n' + payload_addition)

# 3. Add UI step
ui_code = """
            {/* ══════════════════════════════════════════════════════════════
                ACCOMMODATION OPTIONS STEP
                ══════════════════════════════════════════════════════════════ */}
            {step === "acc-options" && <Card title={t("acc.title")} subtitle={t("acc.subtitle")}>
              {/* ── Group 1: Relationship ─────────────────────────────────── */}
              <div className="mb-6">
                <p className="text-[14px] font-semibold text-[#1a1c1d] mb-3">{t("acc.relationship")}</p>
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
                <p className="text-[14px] font-semibold text-[#1a1c1d] mb-3">{t("acc.ownershipType")}</p>
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
                <p className="text-[14px] font-semibold text-[#1a1c1d] mb-3">{t("acc.residenceType")}</p>
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
                onClick={() => navigateToStep("generate")}
                disabled={!accommodationOptions.relationship || !accommodationOptions.ownershipType || !accommodationOptions.residenceType}
              >
                {t("str_124")}
              </NextButton>
            </Card>}
"""

if 'step === "acc-options"' not in content:
    # insert before {step === "generate" ...}
    content = content.replace('{step === "generate" && <Card title={t("str_29")}', ui_code + '\n            {step === "generate" && <Card title={t("str_29")}')

# Update Provider NextButton routing
old_btn = '<NextButton onClick={() => navigateToStep("generate")}'
new_btn = '<NextButton onClick={() => navigateToStep(housingType === "other" ? "acc-options" : "generate")}'
content = content.replace(old_btn, new_btn)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("ImmigrationMVP.jsx restored!")
