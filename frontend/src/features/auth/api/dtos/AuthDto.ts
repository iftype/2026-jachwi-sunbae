import type { MemberDto } from './MemberDto';

export type LoginResponseDto = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  newMember: boolean;
  member: MemberDto;
};
