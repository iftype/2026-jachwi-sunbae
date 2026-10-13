import IconBase, { type IconProps } from '../IconBase';

const RefreshIcon = (props: Omit<IconProps, 'children'>) => (
  <IconBase {...props}>
    <path d="M20 7a8 8 0 1 0 1 5" />
    <path d="m17 3 4 4-5 1" />
  </IconBase>
);

export default RefreshIcon;
