import { Link } from 'react-router-dom';

import Icon from '../icon/Icon';

import styles from './AppBar.module.css';

type AppBarProps = {
  /** 가운데에 둘 화면 제목. 없으면 뒤로 가기만 둔다. */
  title?: string;
  backLabel: string;
} & ({ backTo: string; onBack?: never } | { onBack: () => void; backTo?: never });

/** 휴대폰 상단 바. 왼쪽 "<" 뒤로 가기와 가운데 제목으로, 앱 셸과 앱 셸 밖 화면(개인정보 처리방침 등)이 함께 쓴다. */
const AppBar = ({ title, backLabel, backTo, onBack }: AppBarProps) => (
  <header className={styles.bar}>
    {backTo !== undefined ? (
      <Link to={backTo} className={styles.back} aria-label={backLabel}>
        <Icon name="chevron-left" size={24} />
      </Link>
    ) : (
      <button type="button" className={styles.back} aria-label={backLabel} onClick={onBack}>
        <Icon name="chevron-left" size={24} />
      </button>
    )}
    {title && <h1 className={styles.title}>{title}</h1>}
  </header>
);

export default AppBar;
