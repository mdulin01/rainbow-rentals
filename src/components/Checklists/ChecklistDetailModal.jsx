import React, { useState, useRef } from 'react';
import { X, Check, Plus, Trash2, Camera, ChevronDown, ChevronUp, PenTool, Archive } from 'lucide-react';
import SignaturePad from './SignaturePad';

const ChecklistDetailModal = ({
  checklist,
  onClose,
  onToggleItem,
  onAddItem,
  onDeleteItem,
  onUpdateChecklist,
  onUploadPhoto,
  getPropertyName,
  currentUser,
}) => {
  const [newItemText, setNewItemText] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const inputRef = useRef(null);
  const photoInputRefs = useRef({});

  if (!checklist) return null;

  const items = checklist.items || [];
  const uncheckedItems = items.filter(i => !i.checked);
  const checkedItems = items.filter(i => i.checked);
  const totalCount = items.length;
  const checkedCount = checkedItems.length;
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const allComplete = totalCount > 0 && checkedCount === totalCount;

  const propertyName = checklist.linkedTo?.itemId
    ? getPropertyName(checklist.linkedTo.itemId)
    : null;

  const handleAddItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    onAddItem(checklist.id, {
      id: Date.now(),
      text,
      checked: false,
      addedBy: currentUser,
      checkedBy: null,
      checkedAt: null,
      addedAt: new Date().toISOString(),
      photos: [],
    });
    setNewItemText('');
    inputRef.current?.focus();
  };

  const handleItemPhoto = async (itemId, file) => {
    if (!file || !onUploadPhoto) return;
    setUploadingItemId(itemId);
    try {
      const url = await onUploadPhoto(file, 'checklists/photos');
      // Add photo to item's photos array
      const updatedItems = items.map(i => {
        if (i.id !== itemId) return i;
        return {
          ...i,
          photos: [...(i.photos || []), { id: Date.now(), url, addedAt: new Date().toISOString(), addedBy: currentUser }],
        };
      });
      onUpdateChecklist(checklist.id, { items: updatedItems });
    } catch (err) {
      console.error('Photo upload failed:', err);
    }
    setUploadingItemId(null);
  };

  const isArchived = checklist.status === 'archived';
  const toggleArchive = () => {
    onUpdateChecklist(checklist.id, { status: isArchived ? 'active' : 'archived' });
    onClose();
  };

  const handleSignature = (dataUrl, signerName) => {
    onUpdateChecklist(checklist.id, {
      signature: {
        dataUrl,
        signedBy: signerName,
        signedAt: new Date().toISOString(),
      },
    });
    setShowSignaturePad(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end md:items-center justify-center">
      <div className="bg-slate-800 rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-lg border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
        style={{ animation: 'checklistDetailIn 0.25s cubic-bezier(0.16,1,0.3,1) both' }}>

        {/* Header */}
        <div className="shrink-0 border-b border-white/10">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl">{checklist.emoji || '📋'}</span>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{checklist.name}</h3>
                {propertyName && (
                  <div className="text-xs text-teal-400 mt-0.5">🏠 {propertyName}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {confirmArchive ? (
                <button onClick={toggleArchive}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-semibold hover:bg-amber-500/30 transition">
                  {isArchived ? 'Confirm unarchive' : 'Confirm archive'}
                </button>
              ) : (
                <button onClick={() => setConfirmArchive(true)}
                  title={isArchived ? 'Unarchive' : 'Archive'}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/40 hover:text-white">
                  <Archive className="w-4.5 h-4.5" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
              <span>{checkedCount} of {totalCount} completed</span>
              <span className={`font-semibold ${allComplete ? 'text-teal-400' : 'text-white/60'}`}>{progressPercent}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${allComplete ? 'bg-gradient-to-r from-teal-400 to-cyan-400' : 'bg-gradient-to-r from-teal-500 to-teal-400'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Add item */}
          <div className="flex items-center gap-2 p-4 bg-slate-900/30 border-b border-white/5">
            <input
              ref={inputRef}
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              placeholder="Add custom item..."
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none"
            />
            <button onClick={handleAddItem} disabled={!newItemText.trim()}
              className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center disabled:opacity-30 transition">
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Unchecked items */}
          <div className="px-4 py-2">
            {uncheckedItems.length === 0 && totalCount > 0 && (
              <p className="text-center text-teal-400 py-4 text-sm font-medium">All items completed!</p>
            )}
            {uncheckedItems.map(item => (
              <div key={item.id} className="py-2.5 border-b border-white/5 last:border-0">
                <div className="flex items-start gap-3">
                  <button onClick={() => onToggleItem(checklist.id, item.id)}
                    className="shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 border-slate-500 hover:border-teal-400 transition" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{item.text}</span>
                    {/* Photos */}
                    {item.photos?.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {item.photos.map(photo => (
                          <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer"
                            className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-teal-400 transition">
                            <img src={photo.url} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Photo upload button */}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      ref={(el) => { photoInputRefs.current[item.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleItemPhoto(item.id, file);
                        e.target.value = '';
                      }}
                    />
                    <button onClick={() => photoInputRefs.current[item.id]?.click()}
                      disabled={uploadingItemId === item.id}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/30 hover:text-white/60">
                      {uploadingItemId === item.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button onClick={() => onDeleteItem(checklist.id, item.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/20 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Checked items (collapsible) */}
          {checkedItems.length > 0 && (
            <div className="px-4 pb-2">
              <button onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-xs text-white/30 uppercase tracking-wider py-2 hover:text-white/50 transition w-full">
                <span>Completed ({checkedItems.length})</span>
                {showCompleted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showCompleted && checkedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-1.5 opacity-40">
                  <button onClick={() => onToggleItem(checklist.id, item.id)}
                    className="shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </button>
                  <span className="flex-1 text-sm text-white/60 line-through">{item.text}</span>
                  {item.checkedBy && <span className="text-[10px] text-white/30">{item.checkedBy}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Signature section */}
          <div className="p-4 border-t border-white/10">
            {checklist.signature ? (
              <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PenTool className="w-4 h-4 text-teal-400" />
                  <span className="text-sm font-semibold text-teal-400">Signed</span>
                </div>
                <img src={checklist.signature.dataUrl} alt="Signature" className="w-full max-w-[280px] h-auto rounded-lg bg-slate-900 mb-2" />
                <div className="text-xs text-white/50">
                  {checklist.signature.signedBy} — {new Date(checklist.signature.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            ) : (
              <button onClick={() => setShowSignaturePad(true)}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                  allComplete
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/20'
                    : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}>
                <PenTool className="w-4 h-4" />
                {allComplete ? 'Get Tenant Signature' : 'Signature (complete all items first)'}
              </button>
            )}
          </div>
        </div>

        {/* Signature pad modal */}
        {showSignaturePad && (
          <SignaturePad
            title={`${checklist.category === 'move-in' ? 'Move-In' : 'Move-Out'} Acknowledgment`}
            onSave={handleSignature}
            onCancel={() => setShowSignaturePad(false)}
          />
        )}

        <style>{`
          @keyframes checklistDetailIn { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        `}</style>
      </div>
    </div>
  );
};

export default ChecklistDetailModal;
