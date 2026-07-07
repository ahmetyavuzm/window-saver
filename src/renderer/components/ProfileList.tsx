import { useState } from 'react';
import type { Profile } from '../../shared/types';

interface Props {
  profiles: Profile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  onSaveWindows: () => void;
}

export function ProfileList({ profiles, selectedId, onSelect, onCreate, onDelete, onOpenSettings, onSaveWindows }: Props) {
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');

  function submit() {
    const name = draftName.trim();
    if (name) onCreate(name);
    setDraftName('');
    setAdding(false);
  }

  return (
    <div className="profile-list">
      <div className="profile-list-header">
        <h2>Profiles</h2>
        <div className="profile-list-actions">
          <button
            className="secondary"
            title="Create a profile from the windows currently open on screen"
            onClick={onSaveWindows}
          >
            Save Windows
          </button>
          <button onClick={() => setAdding(true)}>+ New</button>
        </div>
      </div>
      {adding && (
        <input
          autoFocus
          className="new-profile-input"
          placeholder="Profile name"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
              setDraftName('');
              setAdding(false);
            }
          }}
        />
      )}
      <ul>
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className={profile.id === selectedId ? 'selected' : ''}
            onClick={() => onSelect(profile.id)}
          >
            <span>{profile.name}</span>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(profile.id);
              }}
            >
              ×
            </button>
          </li>
        ))}
        {profiles.length === 0 && <li className="empty">No profiles yet</li>}
      </ul>
      <button className="settings-trigger" onClick={onOpenSettings}>
        <span className="settings-gear" aria-hidden="true">⚙</span> Settings
      </button>
    </div>
  );
}
