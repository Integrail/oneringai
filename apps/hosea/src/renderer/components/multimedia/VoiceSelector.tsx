/**
 * VoiceSelector - Visual grid for selecting TTS voices
 */

import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  style?: string;
  previewUrl?: string;
  isDefault?: boolean;
  accent?: string;
  age?: 'child' | 'young' | 'adult' | 'senior';
}

interface VoiceSelectorProps {
  voices: VoiceInfo[];
  selectedVoice: string | null;
  onVoiceSelect: (voiceId: string) => void;
  disabled?: boolean;
}

const genderIcon = (gender: VoiceInfo['gender']) => {
  switch (gender) {
    case 'male':
      return '\u2642'; // Male symbol
    case 'female':
      return '\u2640'; // Female symbol
    default:
      return '\u26A5'; // Neutral symbol
  }
};

export function VoiceSelector({
  voices,
  selectedVoice,
  onVoiceSelect,
  disabled = false,
}: VoiceSelectorProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVoices = useMemo(() => {
    if (!searchQuery.trim()) return voices;
    const query = searchQuery.toLowerCase();
    return voices.filter(
      (voice) =>
        voice.name.toLowerCase().includes(query) ||
        voice.gender.toLowerCase().includes(query) ||
        (voice.accent && voice.accent.toLowerCase().includes(query))
    );
  }, [voices, searchQuery]);

  if (voices.length === 0) {
    return (
      <div className="voice-selector">
        <div className="voice-selector__label">Voice</div>
        <div className="voice-selector__empty">No voices available for this model</div>
      </div>
    );
  }

  return (
    <div className="voice-selector">
      <div className="voice-selector__header">
        <span className="voice-selector__label">Voice</span>
        <span className="voice-selector__count">{voices.length} available</span>
      </div>

      {voices.length > 8 && (
        <div className="voice-selector__search">
          <Search size={14} className="voice-selector__search-icon" />
          <input
            type="text"
            placeholder="Search voices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="voice-selector__search-input"
            disabled={disabled}
          />
        </div>
      )}

      <div className="voice-selector__grid">
        {filteredVoices.map((voice) => (
          <button
            key={voice.id}
            type="button"
            className={`voice-selector__item ${selectedVoice === voice.id ? 'voice-selector__item--selected' : ''}`}
            onClick={() => onVoiceSelect(voice.id)}
            disabled={disabled}
            title={`${voice.name} (${voice.gender})${voice.accent ? ` - ${voice.accent}` : ''}`}
          >
            <span className="voice-selector__item-icon">{genderIcon(voice.gender)}</span>
            <span className="voice-selector__item-name">{voice.name}</span>
            {voice.isDefault && (
              <span className="voice-selector__item-badge">Default</span>
            )}
            {voice.accent && (
              <span className="voice-selector__item-accent">{voice.accent}</span>
            )}
          </button>
        ))}
      </div>

      {searchQuery && filteredVoices.length === 0 && (
        <div className="voice-selector__no-results">
          No voices match "{searchQuery}"
        </div>
      )}
    </div>
  );
}
