import React, { useState, useEffect, useCallback } from "react";

const ADMIN_EMAIL = "munvalera@gmail.com";

function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toInputDate(iso) {
    if (!iso) return "";
    return iso.slice(0, 10);
}

function StatusBadge({ user }) {
    const now = new Date();
    const unlimited = user.unlimitedAccessExpiresAt ? new Date(user.unlimitedAccessExpiresAt) : null;
    const tmpExpiry = user.temporaryCreditsExpiresAt ? new Date(user.temporaryCreditsExpiresAt) : null;

    if (unlimited && unlimited > now) return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">∞ Безлимит</span>;
    if ((user.temporaryCredits || 0) > 0 && tmpExpiry && tmpExpiry > now) return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold">⏱ Врем.</span>;
    if ((user.permanentCredits || 0) > 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">✓ Активен</span>;
    if (user.freeDownloadsUsed === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">1 бесплатно</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">Нет доступа</span>;
}

function EditModal({ user, onClose, onSave }) {
    const [permanentCredits, setPermanentCredits] = useState(user.permanentCredits ?? user.paidGenerationsRemaining ?? 0);
    const [temporaryCredits, setTemporaryCredits] = useState(user.temporaryCredits || 0);
    const [tmpExpiry, setTmpExpiry] = useState(toInputDate(user.temporaryCreditsExpiresAt));
    const [unlimitedExpiry, setUnlimitedExpiry] = useState(toInputDate(user.unlimitedAccessExpiresAt));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/admin/update-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    userId: user.id,
                    permanentCredits: Number(permanentCredits),
                    temporaryCredits: Number(temporaryCredits),
                    temporaryCreditsExpiresAt: tmpExpiry ? new Date(tmpExpiry).toISOString() : null,
                    unlimitedAccessExpiresAt: unlimitedExpiry ? new Date(unlimitedExpiry).toISOString() : null,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Ошибка сохранения");
            onSave(data.user);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const Section = ({ label, color, children }) => (
        <div className={`rounded-xl border p-4 space-y-3 ${color}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#5f6368]">{label}</p>
            {children}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-bold text-[#1a1c1d] text-lg">Доступ пользователя</h3>
                        <p className="text-sm text-[#5f6368] mt-0.5">{user.email}</p>
                        {user.name && <p className="text-xs text-[#999]">{user.name}</p>}
                    </div>
                    <button onClick={onClose} className="text-[#999] hover:text-[#111] p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                {/* Section 1: Permanent credits */}
                <Section label="🔑 Постоянные кредиты (не истекают)" color="bg-green-50 border-green-200">
                    <div className="flex items-center gap-3">
                        <input
                            type="number" min="0" max="9999" value={permanentCredits}
                            onChange={e => setPermanentCredits(e.target.value)}
                            className="w-28 px-3 py-2 border border-[#e7e5e2] rounded-xl text-[15px] font-bold focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none"
                        />
                        <span className="text-sm text-[#5f6368]">кредитов</span>
                    </div>
                </Section>

                {/* Section 2: Temporary credits */}
                <Section label="⏱ Временные кредиты (истекают)" color="bg-blue-50 border-blue-200">
                    <div className="flex items-center gap-3">
                        <input
                            type="number" min="0" max="9999" value={temporaryCredits}
                            onChange={e => setTemporaryCredits(e.target.value)}
                            className="w-28 px-3 py-2 border border-[#e7e5e2] rounded-xl text-[15px] font-bold focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                        />
                        <span className="text-sm text-[#5f6368]">кредитов</span>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[#5f6368]">Действуют до:</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date" value={tmpExpiry}
                                onChange={e => setTmpExpiry(e.target.value)}
                                className="flex-1 px-3 py-2 border border-[#e7e5e2] rounded-xl text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                            />
                            {tmpExpiry && <button onClick={() => { setTemporaryCredits(0); setTmpExpiry(""); }} className="text-xs text-red-400 hover:text-red-600 underline">Сбросить</button>}
                        </div>
                    </div>
                </Section>

                {/* Section 3: Unlimited access */}
                <Section label="∞ Безлимитный доступ до даты" color="bg-purple-50 border-purple-200">
                    <div className="space-y-1">
                        <label className="text-xs text-[#5f6368]">Безлимит до:</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date" value={unlimitedExpiry}
                                onChange={e => setUnlimitedExpiry(e.target.value)}
                                className="flex-1 px-3 py-2 border border-[#e7e5e2] rounded-xl text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                            />
                            {unlimitedExpiry && <button onClick={() => setUnlimitedExpiry("")} className="text-xs text-red-400 hover:text-red-600 underline whitespace-nowrap">Убрать</button>}
                        </div>
                        <p className="text-xs text-[#999]">Постоянные кредиты не расходуются во время безлимита</p>
                    </div>
                </Section>

                {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

                <div className="flex gap-3 pt-1">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-[#e7e5e2] rounded-xl font-semibold text-[#5f6368] hover:bg-[#f7f7f5] transition-all">
                        Отмена
                    </button>
                    <button
                        onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 bg-[#2f3437] text-white rounded-xl font-bold hover:bg-[#1a1c1d] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0"/></svg>}
                        {saving ? "Сохраняю..." : "Сохранить"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminPanel({ user, onBack }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [editingUser, setEditingUser] = useState(null);

    const isAdminUser = (user?.email || "").toLowerCase() === ADMIN_EMAIL;

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/users", { credentials: "include" });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Ошибка загрузки");
            setUsers(data.users);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    if (!isAdminUser) {
        return (
            <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-10 text-center space-y-3 shadow-sm max-w-sm">
                    <div className="text-4xl">🔒</div>
                    <h2 className="font-bold text-xl text-[#1a1c1d]">Доступ запрещён</h2>
                    <p className="text-[#5f6368]">Эта страница доступна только администраторам.</p>
                    <button onClick={onBack} className="mt-4 px-6 py-2.5 bg-[#2f3437] text-white rounded-full font-bold hover:bg-[#1a1c1d] transition-all">Назад</button>
                </div>
            </div>
        );
    }

    const filtered = users.filter(u =>
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.name?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSaved = (updatedUser) => {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
        setEditingUser(null);
    };

    return (
        <div className="min-h-screen bg-[#f7f7f5]">
            {/* Header */}
            <div className="bg-white border-b border-[#e7e5e2] px-4 py-4 md:px-8">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="text-[#5f6368] hover:text-[#111] p-1.5 rounded-lg hover:bg-[#f7f7f5] transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 12H5m7-7-7 7 7 7"/></svg>
                        </button>
                        <div>
                            <h1 className="font-bold text-xl text-[#1a1c1d]">Панель администратора</h1>
                            <p className="text-xs text-[#5f6368]">HiKorea Forms · {users.length} пользователей</p>
                        </div>
                    </div>
                    <button onClick={loadUsers} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#5f6368] border border-[#e7e5e2] rounded-xl hover:bg-[#f7f7f5] transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Обновить
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-5">
                {/* Search */}
                <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input type="text" placeholder="Поиск по email или имени..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-[#e7e5e2] rounded-xl text-[14px] focus:border-[#2f3437] focus:ring-1 focus:ring-[#2f3437] outline-none" />
                </div>

                {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-[#2f3437] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-[#5f6368]">Пользователи не найдены</div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(u => {
                            const now = new Date();
                            const unlimited = u.unlimitedAccessExpiresAt ? new Date(u.unlimitedAccessExpiresAt) : null;
                            const tmpExpiry = u.temporaryCreditsExpiresAt ? new Date(u.temporaryCreditsExpiresAt) : null;
                            const permC = u.permanentCredits || 0;
                            const tmpC = u.temporaryCredits || 0;

                            return (
                                <div key={u.id} className="bg-white border border-[#e7e5e2] rounded-2xl p-4 md:p-5 hover:border-[#2f3437] transition-all">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        {/* User info */}
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4f7cff] to-[#2f3437] flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                {(u.name || u.email || "?")[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-bold text-[#1a1c1d] text-sm truncate">{u.email}</p>
                                                    <StatusBadge user={u} />
                                                    {u.googleId && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-semibold">G</span>}
                                                </div>
                                                {u.name && <p className="text-xs text-[#5f6368] truncate">{u.name}</p>}
                                                <p className="text-xs text-[#999] mt-0.5 space-x-2">
                                                    <span>С: {formatDate(u.createdAt)}</span>
                                                    {unlimited && unlimited > now && <span className="text-purple-600">∞ до {formatDate(u.unlimitedAccessExpiresAt)}</span>}
                                                    {tmpC > 0 && tmpExpiry && tmpExpiry > now && <span className="text-blue-600">⏱ {tmpC} до {formatDate(u.temporaryCreditsExpiresAt)}</span>}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Credits summary */}
                                        <div className="flex items-center gap-4 text-sm shrink-0">
                                            <div className="text-center">
                                                <p className="font-bold text-[#1a1c1d]">{permC}</p>
                                                <p className="text-[10px] text-[#999] uppercase">постоян.</p>
                                            </div>
                                            <div className="text-center">
                                                <p className={`font-bold ${tmpC > 0 && tmpExpiry && tmpExpiry > now ? "text-blue-600" : "text-[#ccc]"}`}>{tmpC}</p>
                                                <p className="text-[10px] text-[#999] uppercase">временн.</p>
                                            </div>
                                            <div className="text-center">
                                                <p className={`font-bold text-lg ${unlimited && unlimited > now ? "text-purple-600" : "text-[#ccc]"}`}>∞</p>
                                                <p className="text-[10px] text-[#999] uppercase">безлим.</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setEditingUser(u)}
                                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold border border-[#e7e5e2] rounded-xl hover:bg-[#f7f7f5] hover:border-[#2f3437] transition-all shrink-0"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                            Изменить
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Stats footer */}
                {!loading && users.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 pt-2">
                        {[
                            { label: "Всего", value: users.length },
                            { label: "Постоянные", value: users.filter(u => (u.permanentCredits || 0) > 0).length },
                            { label: "Временные", value: users.filter(u => { const e = u.temporaryCreditsExpiresAt ? new Date(u.temporaryCreditsExpiresAt) : null; return (u.temporaryCredits || 0) > 0 && e && e > new Date(); }).length },
                            { label: "Безлимит", value: users.filter(u => u.unlimitedAccessExpiresAt && new Date(u.unlimitedAccessExpiresAt) > new Date()).length },
                        ].map(stat => (
                            <div key={stat.label} className="bg-white border border-[#e7e5e2] rounded-2xl p-4 text-center">
                                <p className="text-2xl font-bold text-[#1a1c1d]">{stat.value}</p>
                                <p className="text-xs text-[#999] mt-0.5">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {editingUser && <EditModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSaved} />}
        </div>
    );
}
