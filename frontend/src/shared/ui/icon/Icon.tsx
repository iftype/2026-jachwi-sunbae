import type { ComponentType } from 'react';

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BedIcon,
  ChecklistIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  DropletIcon,
  EditIcon,
  ExternalLinkIcon,
  HomeIcon,
  ImageIcon,
  InboxIcon,
  InfoIcon,
  LinkIcon,
  LocateIcon,
  LockIcon,
  MapIcon,
  MinusIcon,
  MoreVerticalIcon,
  PlusIcon,
  RefreshIcon,
  ReplaceIcon,
  SearchIcon,
  SparklesIcon,
  TargetIcon,
  TrashIcon,
  UserIcon,
  WindowIcon,
} from './icons';

export type IconName =
  | 'bed'
  | 'droplet'
  | 'lock'
  | 'window'
  | 'arrow-left'
  | 'arrow-right'
  | 'checklist'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'close'
  | 'edit'
  | 'home'
  | 'image'
  | 'inbox'
  | 'info'
  | 'external-link'
  | 'link'
  | 'locate'
  | 'map'
  | 'minus'
  | 'more-vertical'
  | 'plus'
  | 'refresh'
  | 'replace'
  | 'search'
  | 'sparkles'
  | 'target'
  | 'trash'
  | 'user';

export type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

type IconComponentProps = Omit<IconProps, 'name'>;

const iconComponents: Record<IconName, ComponentType<IconComponentProps>> = {
  bed: BedIcon,
  droplet: DropletIcon,
  lock: LockIcon,
  window: WindowIcon,
  'arrow-left': ArrowLeftIcon,
  'arrow-right': ArrowRightIcon,
  checklist: ChecklistIcon,
  'chevron-down': ChevronDownIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  'chevron-up': ChevronUpIcon,
  close: CloseIcon,
  edit: EditIcon,
  'external-link': ExternalLinkIcon,
  home: HomeIcon,
  image: ImageIcon,
  inbox: InboxIcon,
  info: InfoIcon,
  link: LinkIcon,
  locate: LocateIcon,
  map: MapIcon,
  minus: MinusIcon,
  'more-vertical': MoreVerticalIcon,
  plus: PlusIcon,
  refresh: RefreshIcon,
  replace: ReplaceIcon,
  search: SearchIcon,
  sparkles: SparklesIcon,
  target: TargetIcon,
  trash: TrashIcon,
  user: UserIcon,
};

/** 기존 name API와 개별 아이콘 컴포넌트를 함께 지원하는 호환용 렌더러. */
const Icon = ({ name, ...props }: IconProps) => {
  const IconComponent = iconComponents[name];
  return <IconComponent {...props} />;
};

export default Icon;
