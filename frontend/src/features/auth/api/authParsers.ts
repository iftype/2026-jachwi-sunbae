import type { LoginResponseDto } from './dtos/AuthDto';
import type { MemberDto } from './dtos/MemberDto';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isMemberId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const parseMember = (value: unknown): MemberDto => {
  if (!isRecord(value) || !isMemberId(value.id)) throw new Error('현재 회원 응답 형식이 올바르지 않습니다.');
  return { memberId: value.id };
};

const parseLoginMember = (value: unknown): MemberDto => {
  if (!isRecord(value) || !isMemberId(value.memberId)) throw new Error('로그인 회원 응답 형식이 올바르지 않습니다.');
  return { memberId: value.memberId };
};

export const parseMemberDto = (value: unknown): MemberDto => parseMember(value);

export const parseLoginResponseDto = (value: unknown): LoginResponseDto => {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== 'string' ||
    value.accessToken.length === 0 ||
    value.tokenType !== 'Bearer' ||
    typeof value.expiresIn !== 'number' ||
    !Number.isFinite(value.expiresIn) ||
    value.expiresIn <= 0
  ) {
    throw new Error('로그인 응답 형식이 올바르지 않습니다.');
  }

  return {
    accessToken: value.accessToken,
    tokenType: value.tokenType,
    expiresIn: value.expiresIn,
    newMember: typeof value.newMember === 'boolean' ? value.newMember : false,
    member: parseLoginMember(value.member),
  };
};
