// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { roomOptionLabels, utilityOptionLabels } from '@/features/property/model/propertyOptions';

describe('매물 부가 정보 표시', () => {
  it('Swagger enum 값을 화면 표시 순서의 한글 이름으로 바꾼다', () => {
    expect(roomOptionLabels(['REFRIGERATOR', 'AIR_CONDITIONER'])).toBe('에어컨, 냉장고');
    expect(utilityOptionLabels(['INTERNET', 'WATER'])).toBe('수도세, 인터넷');
  });

  it('선택값이 없으면 빈 문자열을 반환한다', () => {
    expect(roomOptionLabels([])).toBe('');
    expect(utilityOptionLabels([])).toBe('');
  });
});
