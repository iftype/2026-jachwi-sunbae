import { useEffect, useRef, useState } from 'react';

import { fetchPropertyComparisonPdf } from '@/features/property/api/propertyApi';
import { useRecordPropertyComparisonView } from '@/features/property/api/usePropertyMutations';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

export const MIN_SELECTION = 2;
export const MAX_SELECTION = 5;

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** 비교할 매물을 고르고, 고른 매물의 기록을 PDF로 내려받는다. */
const usePropertyComparison = () => {
  const config = usePublicConfig();
  const hasRecordedView = useRef(false);
  const { mutate: recordComparisonView } = useRecordPropertyComparisonView();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const selectedIdsRef = useRef<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [hasExportError, setHasExportError] = useState(false);

  useEffect(() => {
    if (hasRecordedView.current) return;
    hasRecordedView.current = true;
    trackPostHogEvent('property_comparison_started');
    recordComparisonView();
  }, [recordComparisonView]);

  const toggle = (propertyId: number) => {
    setHasExportError(false);
    const current = selectedIdsRef.current;
    const isSelected = current.includes(propertyId);
    if (!isSelected && current.length >= MAX_SELECTION) return;
    const next = isSelected ? current.filter((id) => id !== propertyId) : [...current, propertyId];
    selectedIdsRef.current = next;
    setSelectedIds(next);
    trackPostHogEvent('property_selected_for_comparison', {
      selected: !isSelected,
      selected_count: next.length,
    });
  };

  const downloadPdf = async () => {
    if (selectedIds.length < MIN_SELECTION || selectedIds.length > MAX_SELECTION) return;
    setIsExporting(true);
    setHasExportError(false);
    trackPostHogEvent('property_comparison_pdf_export_started', { selected_count: selectedIds.length });
    try {
      const blob = await fetchPropertyComparisonPdf(config, selectedIds);
      downloadBlob(blob, `jachwi-sunbae-property-comparison-${new Date().toISOString().slice(0, 10)}.pdf`);
      trackPostHogEvent('property_comparison_pdf_exported', { count: selectedIds.length });
    } catch {
      trackPostHogEvent('property_comparison_pdf_export_failed', {
        selected_count: selectedIds.length,
        error_kind: 'request',
      });
      setHasExportError(true);
    } finally {
      setIsExporting(false);
    }
  };

  return { selectedIds, isExporting, hasExportError, toggle, downloadPdf };
};

export default usePropertyComparison;
