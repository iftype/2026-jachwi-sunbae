import { describe, expect, it } from 'vitest';

import { ACCOUNT_DELETION_EMAIL, createAccountDeletionMailto } from '@/shared/config/accountDeletion';

const parse = (mailto: string) => new URLSearchParams(mailto.split('?')[1]);

describe('계정 삭제 요청 메일', () => {
  it('회원 번호와 삭제 범위를 본문에 미리 채운다', () => {
    const mailto = createAccountDeletionMailto(42);
    expect(mailto.startsWith(`mailto:${ACCOUNT_DELETION_EMAIL}?`)).toBe(true);
    expect(parse(mailto).get('subject')).toBe('자취선배 계정 및 데이터 삭제 요청');
    expect(parse(mailto).get('body')).toContain('회원 번호: 42');
  });

  it('메일 앱에서 공백이 +로 보이지 않도록 %20으로 인코딩한다', () => {
    expect(createAccountDeletionMailto(42)).not.toContain('+');
  });

  it('회원 번호가 없으면 제목만 채운다', () => {
    expect(parse(createAccountDeletionMailto()).has('body')).toBe(false);
  });
});
