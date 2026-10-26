import { apiRequest } from '@/features/auth/api/apiClient';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type { ChecklistPresetType, ChecklistStage, LegacyChecklistDetail } from '../model/checklistTypes';
import {
  parseActiveChecklist,
  parseCheckItemPage,
  parseChecklistDetail,
  parseChecklistPage,
  parseCreatedChecklist,
  parseNoChecklistContent,
  toChecklistPreset,
} from './checklistParsers';
import type {
  AssignActiveChecklistRequestDto,
  CreateChecklistRequestDto,
  CreateChecklistV11RequestDto,
  UpdateChecklistRequestDto,
  UpdateChecklistV11RequestDto,
} from './dtos/ChecklistDto';

const toLegacyChecklistDetail = (detail: Awaited<ReturnType<typeof fetchChecklistDetail>>): LegacyChecklistDetail => ({
  ...detail,
  items: detail.items.map((item) => ({
    checkItemId: item.sourceCheckItemId ?? item.checklistItemId,
    stage: detail.stage,
    itemType: item.itemType,
    question: item.question,
    guide: null,
  })),
});

export const fetchCheckItems = (
  config: PublicConfig,
  input: { stage: ChecklistStage; query: string; page?: number; size?: number },
  signal?: AbortSignal,
) => {
  const search = new URLSearchParams({ stage: input.stage });
  const query = input.query.trim();
  if (query.length > 0) search.set('query', query);
  return apiRequest({
    config,
    path: `/api/check-items?${search}`,
    signal,
    parseData: (value) => {
      const result = parseCheckItemPage(value, input.stage);
      if (result.content.some((item) => item.stage !== input.stage)) throw new Error('stage');
      return result;
    },
  });
};

export const fetchChecklistPreset = async (
  config: PublicConfig,
  stage: ChecklistStage,
  selectedPreset: ChecklistPresetType,
  signal?: AbortSignal,
) => {
  const result = await fetchCheckItems(config, { stage, query: '' }, signal);
  return { ...toChecklistPreset(stage, result.content), presetType: selectedPreset };
};

export const fetchChecklists = (
  config: PublicConfig,
  input: { stage: ChecklistStage; page?: number; size?: number },
  signal?: AbortSignal,
) => {
  const search = new URLSearchParams({ stage: input.stage });
  return apiRequest({
    config,
    path: `/api/checklists?${search}`,
    signal,
    parseData: (value) => {
      const result = parseChecklistPage(value);
      if (result.content.some((checklist) => checklist.stage !== input.stage)) throw new Error('stage');
      return result;
    },
  });
};

export const createChecklistV11 = (config: PublicConfig, body: CreateChecklistV11RequestDto) =>
  apiRequest({
    config,
    path: '/api/checklists',
    method: 'POST',
    body,
    parseData: (value) => {
      const result = parseCreatedChecklist(value);
      if (result.stage !== body.stage) throw new Error('stage');
      return result;
    },
  });

/** @deprecated 최종 API 요청 이름으로 전환하기 전 화면 호환 함수다. */
export const createChecklist = (config: PublicConfig, body: CreateChecklistRequestDto) =>
  createChecklistV11(config, {
    name: body.name,
    stage: body.stage,
    items: body.checkItemIds.map((systemCheckItemId) => ({ systemCheckItemId })),
  });

export const fetchChecklistDetail = (config: PublicConfig, checklistId: number, signal?: AbortSignal) =>
  apiRequest({
    config,
    path: `/api/checklists/${checklistId}`,
    signal,
    parseData: (value) => {
      const result = parseChecklistDetail(value);
      if (result.checklistId !== checklistId) throw new Error('checklistId');
      return result;
    },
  });

export const fetchLegacyChecklistDetail = async (
  config: PublicConfig,
  checklistId: number,
  signal?: AbortSignal,
): Promise<LegacyChecklistDetail> => toLegacyChecklistDetail(await fetchChecklistDetail(config, checklistId, signal));

export const updateChecklistV11 = (config: PublicConfig, checklistId: number, body: UpdateChecklistV11RequestDto) =>
  apiRequest({
    config,
    path: `/api/checklists/${checklistId}`,
    method: 'PUT',
    body,
    parseData: (value) => {
      const result = parseChecklistDetail(value);
      if (result.checklistId !== checklistId) throw new Error('checklistId');
      return result;
    },
  });

/** @deprecated 최종 API 요청 이름으로 전환하기 전 화면 호환 함수다. */
export const updateChecklist = async (
  config: PublicConfig,
  checklistId: number,
  body: UpdateChecklistRequestDto,
): Promise<LegacyChecklistDetail> =>
  toLegacyChecklistDetail(
    await updateChecklistV11(config, checklistId, {
      name: body.name,
      items: body.checkItemIds.map((systemCheckItemId) => ({ systemCheckItemId })),
    }),
  );

export const removeChecklist = (config: PublicConfig, checklistId: number) =>
  apiRequest({
    config,
    path: `/api/checklists/${checklistId}`,
    method: 'DELETE',
    parseData: parseNoChecklistContent,
  });

export const assignActiveChecklist = (
  config: PublicConfig,
  propertyId: number,
  stage: ChecklistStage,
  body: AssignActiveChecklistRequestDto,
) =>
  apiRequest({
    config,
    path: `/api/properties/${propertyId}/checklists/${stage}`,
    method: 'PUT',
    body: body.sourceType === 'SYSTEM_DEFAULT' ? body : { sourceType: 'USER', checklistId: body.checklistId },
    parseData: (value) => {
      const result = parseActiveChecklist(value);
      if (
        result.propertyId !== propertyId ||
        result.stage !== stage ||
        (body.sourceType !== 'SYSTEM_DEFAULT' && result.checklistId !== body.checklistId) ||
        (body.sourceType === 'SYSTEM_DEFAULT' && result.checklistId !== null)
      ) {
        throw new Error('active-checklist');
      }
      return result;
    },
  });
