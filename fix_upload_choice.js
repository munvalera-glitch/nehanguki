const fs = require('fs');
const file = '/Users/macvalera/Documents/HIkoreaFORMS/src/ImmigrationMVP.jsx';
let content = fs.readFileSync(file, 'utf8');

const modalCode = `function UploadChoiceModal({ open, onClose, onCamera, onGallery }) {
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
`;

content = content.replace(/function UploadBox\(/, modalCode + '\nfunction UploadBox(');
fs.writeFileSync(file, content);
