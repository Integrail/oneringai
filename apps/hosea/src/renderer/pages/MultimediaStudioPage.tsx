/**
 * Multimedia Studio Page - Generate images, videos, audio with AI
 */

import React, { useState } from 'react';
import { Image, Video, Volume2, Mic } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { ImageTab, VideoTab } from '../components/multimedia';

type TabId = 'image' | 'video' | 'tts' | 'stt';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  available: boolean;
}

const tabs: Tab[] = [
  { id: 'image', label: 'Image', icon: <Image size={16} />, available: true },
  { id: 'video', label: 'Video', icon: <Video size={16} />, available: true },
  { id: 'tts', label: 'Text to Speech', icon: <Volume2 size={16} />, available: false },
  { id: 'stt', label: 'Speech to Text', icon: <Mic size={16} />, available: false },
];

export function MultimediaStudioPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('image');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'image':
        return <ImageTab />;
      case 'video':
        return <VideoTab />;
      case 'tts':
      case 'stt':
        return (
          <div className="coming-soon">
            <div className="coming-soon__icon">
              {tabs.find((t) => t.id === activeTab)?.icon}
            </div>
            <h3 className="coming-soon__title">Coming Soon</h3>
            <p className="coming-soon__description">
              {activeTab === 'tts' && 'Text-to-speech synthesis will be available soon.'}
              {activeTab === 'stt' && 'Speech-to-text transcription will be available soon.'}
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="page multimedia-studio">
      <PageHeader
        title="Multimedia Studio"
        subtitle="Create images, videos, and audio with AI"
      />

      <div className="page__content">
        {/* Tab Navigation */}
        <div className="multimedia-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`multimedia-tabs__item ${activeTab === tab.id ? 'multimedia-tabs__item--active' : ''} ${!tab.available ? 'multimedia-tabs__item--disabled' : ''}`}
              onClick={() => tab.available && setActiveTab(tab.id)}
              disabled={!tab.available}
              type="button"
            >
              <span className="multimedia-tabs__icon">{tab.icon}</span>
              <span className="multimedia-tabs__label">{tab.label}</span>
              {!tab.available && <span className="multimedia-tabs__badge">Soon</span>}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="multimedia-content">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
