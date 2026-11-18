import IconBase, { type IconProps } from '../IconBase';

const SparklesIcon = (props: Omit<IconProps, 'children'>) => (
  <IconBase {...props}>
    <path fill="currentColor" d="m10 4 1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6z" />
    <path fill="currentColor" d="m18 14 .8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z" />
    <circle cx="18" cy="5" r="1" fill="currentColor" />
  </IconBase>
);

export default SparklesIcon;
