import { useMutation } from '@tanstack/react-query';

import { queryClient } from '@/shared/api/queryClient';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

import { rememberRecentEdit } from '../lib/recentEdit';
import type { PropertyChecklistDetail, PropertyChecklistItemStatus } from '../model/Property';
import { isPreviewProperty } from '../model/sampleProperties';
import { orPreview } from './previewPropertyApi';
import { updatePropertyChecklistItemMemo, updatePropertyChecklistItemStatus } from './propertyApi';
import { propertyQueryKeys } from './propertyQueryKeys';

const updateChecklistItem = (
  propertyId: number,
  propertyChecklistId: number,
  itemId: number,
  update: (item: PropertyChecklistDetail['items'][number]) => PropertyChecklistDetail['items'][number],
) => {
  queryClient.setQueryData<PropertyChecklistDetail>(
    propertyQueryKeys.checklist(propertyId, propertyChecklistId),
    (current) =>
      current === undefined
        ? current
        : { ...current, items: current.items.map((item) => (item.itemId === itemId ? update(item) : item)) },
  );
  rememberRecentEdit(propertyId, 'checklist');
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: propertyQueryKeys.checklists(propertyId), exact: true }),
    queryClient.invalidateQueries({ queryKey: propertyQueryKeys.lists() }),
  ]);
};

export const usePropertyChecklistItemStatusMutation = (propertyId: number, propertyChecklistId: number) => {
  const config = usePublicConfig();
  return useMutation({
    // 미리보기 매물은 서버에 보내지 않고 화면에서만 바꿔 본다.
    mutationFn: ({ itemId, status }: { itemId: number; status: PropertyChecklistItemStatus }) =>
      orPreview(
        propertyId,
        () => ({ itemId, status }),
        () => updatePropertyChecklistItemStatus(config, propertyId, propertyChecklistId, itemId, status),
      ),
    onSuccess: ({ itemId, status }) => {
      const refresh = updateChecklistItem(propertyId, propertyChecklistId, itemId, (item) => ({ ...item, status }));
      if (status !== 'UNCONFIRMED' && !isPreviewProperty(propertyId)) {
        trackPostHogEvent('checklist_item_checked', {
          property_id: propertyId,
          property_checklist_id: propertyChecklistId,
          item_id: itemId,
          status,
        });
      }
      return refresh;
    },
  });
};

export const usePropertyChecklistItemMemoMutation = (propertyId: number, propertyChecklistId: number) => {
  const config = usePublicConfig();
  return useMutation({
    mutationFn: ({ itemId, memo }: { itemId: number; memo: string }) =>
      orPreview(
        propertyId,
        () => ({ itemId, memo }),
        () => updatePropertyChecklistItemMemo(config, propertyId, propertyChecklistId, itemId, memo),
      ),
    onSuccess: ({ itemId, memo }) => {
      return updateChecklistItem(propertyId, propertyChecklistId, itemId, (item) => ({ ...item, memo }));
    },
  });
};
