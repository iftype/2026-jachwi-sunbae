import type { Meta, StoryObj } from '@storybook/react-webpack5';
import type { CSSProperties } from 'react';

import propertyPhoto from '@/shared/assets/landing/property-detail.jpg';

import type { MapMarker } from '../../model/Map';
import MapMarkerView from './MapMarkerView';

import styles from './MapMarkerView.stories.module.css';

const sampleMarkers: Array<{ name: string; marker: MapMarker }> = [
  {
    name: '매물',
    marker: {
      id: 'property',
      latitude: 37.5,
      longitude: 126.9,
      label: '햇살 좋은 원룸',
      caption: '햇살 좋은 원룸',
      tone: 'property',
    },
  },
  {
    name: '선택됨',
    marker: {
      id: 'selected',
      latitude: 37.5,
      longitude: 126.9,
      label: '선택한 매물',
      caption: '선택한 매물',
      tone: 'selected',
    },
  },
  {
    name: '현재 위치',
    marker: { id: 'current', latitude: 37.5, longitude: 126.9, label: '현재 위치', tone: 'current' },
  },
  {
    name: '시설',
    marker: { id: 'place', latitude: 37.5, longitude: 126.9, label: '병원', tone: 'place', category: 'HOSPITAL' },
  },
  {
    name: '시설 군집',
    marker: {
      id: 'cluster',
      latitude: 37.5,
      longitude: 126.9,
      label: '주변 시설 12개',
      tone: 'cluster',
      category: 'CONVENIENCE',
      count: 12,
    },
  },
  {
    name: '매물 군집',
    marker: {
      id: 'property-cluster',
      latitude: 37.5,
      longitude: 126.9,
      label: '매물 8개',
      tone: 'propertyCluster',
      count: 8,
    },
  },
];

const meta = {
  title: '지도/MapMarkerView',
  component: MapMarkerView,
  argTypes: {
    marker: { control: false },
    onSelectMarker: { action: 'select marker' },
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MapMarkerView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  args: {
    marker: sampleMarkers[0].marker,
  },
  render: () => (
    <div className={styles.stage}>
      <div className={styles.grid}>
        {sampleMarkers.map(({ name, marker }) => (
          <div className={styles.item} key={marker.id}>
            <MapMarkerView marker={marker} />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Actionable: Story = {
  args: {
    marker: {
      id: 'actionable',
      latitude: 37.5,
      longitude: 126.9,
      label: '선택 가능한 매물',
      caption: '선택 가능한 매물',
      tone: 'property',
      actionable: true,
    },
  },
};

export const Active: Story = {
  args: {
    marker: sampleMarkers[0].marker,
    selectedMarkerId: 'property',
  },
};

export const PhotoPin: Story = {
  args: {
    marker: { ...sampleMarkers[0].marker, photoUrl: propertyPhoto },
  },
};

export const ZoomSizes: Story = {
  args: { marker: sampleMarkers[0].marker },
  render: (args) => (
    <div className={styles.stage}>
      <div className={styles.grid}>
        {[0.7, 1, 1.36].map((scale) => (
          <div key={scale} className={styles.item} style={{ '--map-marker-scale': scale } as CSSProperties}>
            <MapMarkerView {...args} />
            <span>{scale}배</span>
          </div>
        ))}
      </div>
    </div>
  ),
};
