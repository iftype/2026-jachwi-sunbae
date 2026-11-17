import cheapMealsMobileScreen from '@/shared/assets/app-screens/cheap-meals-mobile.webp';
import checklistMobileScreen from '@/shared/assets/app-screens/checklist-mobile.webp';
import compareMobileScreen from '@/shared/assets/app-screens/compare-mobile.webp';
import exploreMobileScreen from '@/shared/assets/app-screens/explore-mobile.webp';
import recordsMobileScreen from '@/shared/assets/app-screens/records-mobile.webp';

import cheapMealsScreen from '../assets/landing-cheap-meals.webp';
import checklistScreen from '../assets/landing-checklist.webp';
import compareScreen from '../assets/landing-compare.webp';
import exploreScreen from '../assets/landing-explore.webp';
import memoScreen from '../assets/landing-memo.webp';
import recordsScreen from '../assets/landing-records.webp';

/** 서비스의 두 축. 자취할 동네를 찾는 것과, 직접 본 방을 기록하고 비교하는 것. */
export const HERO_TITLE = ['자취할 동네를 찾고,', '본 방은 기록하고 비교해요'] as const;

export const HERO_LEAD =
  '회사나 학교에서 가까운 동네부터 찾아보고, 집을 보러 가면 체크리스트로 꼼꼼히 남겨 두세요. 직접 본 방들은 나란히 놓고 비교할 수 있어요.';

export const TECH_LEAD =
  '동네를 한 번에 칠하려면 검색할 때마다 전국 버스, 지하철 117만 구간을 다 따라가야 해요. 그래도 기다리지 않게 만드는 게 제일 어려웠어요.';

export const VIDEO_LABEL =
  '통근 시간으로 동네를 찾고, 거리 메모를 보고, 본 방을 기록하고 체크리스트로 살핀 뒤 비교해 PDF로 받는 흐름을 보여주는 영상';

/** 소개 영상(`landing-intro.mp4`)의 원본 크기. 영상을 받기 전에도 칸이 이 비율로 잡혀 아래 내용이 밀리지 않는다. */
export const VIDEO_SIZE = { width: 1920, height: 1080 } as const;

export const APP_STORES = [
  {
    store: 'app_store',
    label: 'App Store에서 받기',
    href: 'https://apps.apple.com/us/app/%EC%9E%90%EC%B7%A8%EC%84%A0%EB%B0%B0/id6816321229',
  },
  {
    store: 'google_play',
    label: 'Google Play에서 받기',
    href: 'https://play.google.com/store/apps/details?id=com.jachwisunbae',
  },
] as const;

/**
 * 섹션 제목 왼쪽 색 막대로 어느 축의 이야기인지 알린다.
 * 동네 찾기는 브랜드 파랑, 본 방 기록은 브랜드 노랑, 만든 이야기는 글자색이다.
 */
export type StoryTone = 'neighborhood' | 'record' | 'tech';

export const STORY_TONE_COLOR: Record<StoryTone, string> = {
  neighborhood: 'var(--color-brand-blue)',
  record: 'var(--color-brand-yellow)',
  tech: 'var(--color-ink)',
};

/** 목록 한 줄. 앞 설명 뒤에 핵심어를 굵게 붙인다. 예: '통근 시간, 환승 횟수, 월세로 **조건 걸러 보기**' */
export type StoryPoint = { lead: string; strong: string; tail?: string };

export type Story = {
  id: string;
  tone: StoryTone;
  title: string;
  description: string;
  points: StoryPoint[];
  screen: string;
  /** 휴대폰에서 보여줄 같은 화면의 휴대폰 캡처 */
  mobileScreen: string;
  screenAlt: string;
};

/** 실제 운영 화면을 한 스크롤에 하나씩 보여주며 프로젝트가 푼 문제를 순서대로 설명한다. */
export const STORIES: Story[] = [
  {
    id: 'explore',
    tone: 'neighborhood',
    title: '회사에서 60분, 어느 동네까지 될까요?',
    description: '회사나 학교를 넣으면 대중교통으로 갈 수 있는 동네가 걸리는 시간별로 칠해져요.',
    points: [
      { lead: '통근 시간, 환승 횟수, 월세로 ', strong: '조건 걸러 보기' },
      { lead: '출발역, 월세 시세와 함께 ', strong: '가까운 동네부터 정렬' },
      { lead: '경로, 주변 중개사까지 ', strong: '동네 상세 보기' },
    ],
    screen: exploreScreen,
    mobileScreen: exploreMobileScreen,
    screenAlt: '판교역에서 통근 시간이 짧은 동네 순위와 시간대별로 칠한 행정동 지도',
  },
  {
    id: 'cheap-meals',
    tone: 'neighborhood',
    title: '그 동네 한 끼 값도 미리 봐요',
    description: '위치만 정하면 식비 아낄 방법을 세 가지로 모아 보여줘요.',
    points: [
      { lead: '주변 가게 메뉴 가격으로 ', strong: '착한가격업소 찾기' },
      { lead: '이마트24, 세븐일레븐 ', strong: '편의점 행사상품 보기' },
      { lead: '배민, 쿠팡이츠 ', strong: '배달 할인 모아보기' },
    ],
    screen: cheapMealsScreen,
    mobileScreen: cheapMealsMobileScreen,
    screenAlt: '판교역 주변 착한가격업소가 지도와 목록에 메뉴 가격과 함께 보이는 화면',
  },
  {
    id: 'records',
    tone: 'record',
    title: '본 방은 지도 위에 편하게 남겨요',
    description: '본 방과 동네에서 느낀 점을 지도 한곳에 모아 둬요.',
    points: [
      { lead: '보증금, 월세, 사진까지 ', strong: '지도에서 바로 매물 등록' },
      { lead: '병원, 교통, 편의점을 ', strong: '반경별 주변 시설 분석' },
      { lead: '다시 와도 그대로 이어지는 ', strong: '로그인 없이 시작' },
    ],
    screen: recordsScreen,
    mobileScreen: recordsMobileScreen,
    screenAlt: '본 방 목록과 지도 위 매물 핀이 함께 보이는 기록 화면',
  },
  {
    id: 'memo',
    tone: 'record',
    title: '동네에서 느낀 점은 거리 메모로 나눠요',
    description: '지도에서 그 자리를 누르고 좋아요, 싫어요와 한 줄 메모를 남기면 자취선배를 쓰는 모두에게 보여요.',
    points: [
      { lead: '밤길, 정류장, 시장처럼 ', strong: '그 자리에 바로 메모' },
      { lead: '좋아요는 파랑, 싫어요는 빨강 ', strong: '말풍선으로 한눈에' },
      { lead: '다른 사람이 남긴 메모로 ', strong: '가 보기 전에 동네 미리 보기' },
    ],
    screen: memoScreen,
    // 휴대폰 메모 캡처가 아직 없어 같은 지도 화면인 본 방 기록 휴대폰 캡처를 쓴다.
    mobileScreen: recordsMobileScreen,
    screenAlt: '망원동 지도 위 좋아요, 싫어요 메모 말풍선과 새 메모를 쓰는 평가 칸이 열린 화면',
  },
  {
    id: 'checklist',
    tone: 'record',
    title: '놓친 게 없는지 하나씩 확인해요',
    description: '항목마다 괜찮음, 주의를 고르면 고르지 않은 건 미확인으로 남아요.',
    points: [
      { lead: '채광, 소음부터 등기, 특약까지 ', strong: '단계별 체크리스트' },
      { lead: '항목을 넣고 빼서 ', strong: '내 순서대로 편집' },
    ],
    screen: checklistScreen,
    mobileScreen: checklistMobileScreen,
    screenAlt: '매물 상세에서 체크리스트 항목마다 괜찮음과 주의를 고른 화면',
  },
  {
    id: 'compare',
    tone: 'record',
    title: '고민되는 방은 나란히 놓고 골라요',
    description: '후보를 최대 5개까지 한 표에 놓고 봐요.',
    points: [
      { lead: '보증금, 월세, 체크 진행을 ', strong: '한 표로 비교' },
      { lead: '월세 구간, 체크 여부로 ', strong: '후보 필터' },
      { lead: '고른 방 기록을 ', strong: 'PDF로 내보내기' },
    ],
    screen: compareScreen,
    mobileScreen: compareMobileScreen,
    screenAlt: '두 매물을 골라 보증금, 월세, 체크 진행을 비교하는 화면',
  },
];

/** 왜 만들었는지. 동네 찾기 쪽 이야기라 제목 막대는 파랑이다. */
export const WHY_LEAD =
  '처음 방을 구할 때 동네 하나하나 지도 앱에 넣어 길찾기를 눌러봤어요. 그걸 한 번에 보고 싶었어요.';

export const WHY_REASONS = [
  { title: '길찾기를 동네마다 누르지 않게', description: '회사 하나만 넣으면 갈 수 있는 동네가 한꺼번에 칠해져요.' },
  { title: '동네 이름을 몰라도 되게', description: '어디가 어딘지 몰라도 출퇴근 시간으로 먼저 좁혀요.' },
  { title: '여러 곳을 바꿔 보게', description: '회사 근처, 본가 근처처럼 목적지를 바꿔 가며 비교해요.' },
];
