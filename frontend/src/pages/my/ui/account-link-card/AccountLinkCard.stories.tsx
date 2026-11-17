import type { Meta, StoryObj } from '@storybook/react-webpack5';

import { saveLinkedProvider } from '@/features/auth/model/oauthLink';

import AccountLinkCard from './AccountLinkCard';

/** 연결 상태는 이 기기의 저장소에 회원 번호와 함께 기억한다. 연결한 스토리는 다른 회원 번호를 써서 서로 섞이지 않는다. */
const LINKED_MEMBER_ID = 2048;

const meta = {
  title: '페이지/마이/공통/AccountLinkCard',
  component: AccountLinkCard,
  args: {
    memberId: 1,
    reloadPage: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '24rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountLinkCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 익명 회원. 카카오와 Apple 로그인 버튼을 보인다. */
export const Default: Story = {};

/** 카카오 계정으로 로그인한 회원. 프로필 줄과 로그아웃 알약만 보인다. */
export const KakaoLinked: Story = {
  args: {
    memberId: LINKED_MEMBER_ID,
  },
  decorators: [
    (Story) => {
      try {
        saveLinkedProvider(LINKED_MEMBER_ID, 'KAKAO');
      } catch {
        // 저장소를 못 쓰면 연결 전 화면으로 그린다.
      }
      return <Story />;
    },
  ],
};
