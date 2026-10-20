import type { ComponentProps } from 'react';

import MapPropertyList from '../map-property-list/MapPropertyList';

import styles from './MapPropertyPanel.module.css';

type MapPropertyPanelProps = ComponentProps<typeof MapPropertyList> & { className?: string };

/** 데스크탑 인프라 지도 왼쪽 칸의 매물 목록. 바텀시트와 달리 끌지 않고 늘 펼쳐 둔다. */
const MapPropertyPanel = ({ className, ...listProps }: MapPropertyPanelProps) => (
  <section className={`${styles.panel} ${className ?? ''}`.trim()} aria-label="지도 주변 매물 목록">
    <div className={styles.panelBody}>
      <MapPropertyList {...listProps} />
    </div>
  </section>
);

export default MapPropertyPanel;
