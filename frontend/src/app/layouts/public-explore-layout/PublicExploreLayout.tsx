import { Outlet } from 'react-router-dom';

import styles from './PublicExploreLayout.module.css';

const PublicExploreLayout = () => (
  <div className={styles.layout}>
    <Outlet />
  </div>
);
export default PublicExploreLayout;
