/** 계정·데이터 삭제 요청을 받는 운영 이메일. 개인정보 처리방침과 마이 화면이 함께 쓴다. */
export const ACCOUNT_DELETION_EMAIL = 'conditionaltype@gmail.com';

export const ACCOUNT_DELETION_SUBJECT = '자취선배 계정 및 데이터 삭제 요청';

/**
 * 익명 회원은 닉네임이 없으므로 회원 번호를 본문에 미리 넣어, 사용자가 메일을 그대로 보내기만 하면 되게 한다.
 * 회원 번호를 모르면(로그인 전 등) 본문 없이 제목만 채운다.
 */
export const createAccountDeletionMailto = (memberId?: number) => {
  const params = new URLSearchParams({ subject: ACCOUNT_DELETION_SUBJECT });
  if (memberId !== undefined) {
    params.set(
      'body',
      `회원 번호: ${memberId}\n삭제 범위: 계정 전체와 연결된 모든 기록\n\n이 메일을 그대로 보내 주세요.`,
    );
  }
  // URLSearchParams는 공백을 '+'로 바꾸지만 mailto는 '%20'을 써야 메일 앱에서 그대로 보인다.
  return `mailto:${ACCOUNT_DELETION_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
};
