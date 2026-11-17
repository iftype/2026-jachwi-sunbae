import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  blockPreviewSave,
  orPreview,
  previewPropertyChecklistDetail,
  previewPropertyChecklistOverview,
  previewPropertyDetail,
  previewPropertyMemo,
  previewPropertyPhotos,
  skipPreviewSave,
  subscribePreviewNotSaved,
} from '@/features/property/api/previewPropertyApi';
import { SAMPLE_PROPERTIES } from '@/features/property/model/sampleProperties';

const previewId = SAMPLE_PROPERTIES[0].propertyId;
const unsubscribes: (() => void)[] = [];
const listenNotSaved = () => {
  const listener = vi.fn();
  unsubscribes.push(subscribePreviewNotSaved(listener));
  return listener;
};

afterEach(() => {
  unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
});

describe('미리보기 매물 조회', () => {
  it('미리보기 매물은 서버에 묻지 않고 JSON으로 상세, 메모, 체크리스트, 사진을 만든다', async () => {
    const fetchRemote = vi.fn();
    const detail = await orPreview(previewId, previewPropertyDetail, fetchRemote);

    expect(fetchRemote).not.toHaveBeenCalled();
    expect(detail).toEqual(
      expect.objectContaining({
        propertyId: previewId,
        name: SAMPLE_PROPERTIES[0].name,
        location: SAMPLE_PROPERTIES[0].location,
      }),
    );
    expect(previewPropertyMemo(previewId).propertyId).toBe(previewId);
    expect(previewPropertyChecklistOverview(previewId).stages).toEqual(SAMPLE_PROPERTIES[0].stages);
    expect(previewPropertyChecklistDetail(previewId).items.length).toBeGreaterThan(0);
    expect(previewPropertyPhotos(previewId).photos).toHaveLength(SAMPLE_PROPERTIES[0].representativePhoto ? 1 : 0);
  });

  it('실제 매물은 서버 요청을 그대로 쓴다', async () => {
    const fetchRemote = vi.fn().mockResolvedValue('server');
    await expect(orPreview(10, () => 'preview', fetchRemote)).resolves.toBe('server');
    expect(fetchRemote).toHaveBeenCalledOnce();
  });
});

describe('미리보기 매물 저장 막기', () => {
  it('미리보기 매물을 고치면 저장하지 않고 고치기 전 값을 돌려주며 저장되지 않는다고 알린다', async () => {
    const listener = listenNotSaved();
    const save = vi.fn();

    await expect(skipPreviewSave(previewId, () => 'before', save)).resolves.toBe('before');
    expect(save).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('돌려줄 값이 없는 요청은 알린 뒤 실패로 끝낸다', async () => {
    const listener = listenNotSaved();
    const save = vi.fn();

    await expect(blockPreviewSave(previewId, save)).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('실제 매물은 그대로 저장하고 알리지 않는다', async () => {
    const listener = listenNotSaved();
    const save = vi.fn().mockResolvedValue('saved');

    await expect(skipPreviewSave(10, () => 'before', save)).resolves.toBe('saved');
    await expect(blockPreviewSave(10, save)).resolves.toBe('saved');
    expect(listener).not.toHaveBeenCalled();
  });
});
