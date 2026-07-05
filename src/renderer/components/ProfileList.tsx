import type { Profile } from '../../shared/types';

interface Props {
  profiles: Profile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function ProfileList({ profiles, selectedId, onSelect, onCreate, onDelete }: Props) {
  return (
    <div className="profile-list">
      <div className="profile-list-header">
        <h2>Profiles</h2>
        <button onClick={onCreate}>+ New</button>
      </div>
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
    </div>
  );
}
