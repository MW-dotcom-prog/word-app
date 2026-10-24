import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const TABS: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/', label: '今日', icon: 'home', end: true },
  { to: '/lists', label: '词库', icon: 'book' },
  { to: '/dictionary', label: '词典', icon: 'search' },
  { to: '/favorites', label: '收藏', icon: 'bookmark' },
  { to: '/profile', label: '我的', icon: 'user' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
        >
          <span className="nav-icon">
            <Icon name={tab.icon} size={23} />
          </span>
          <span className="nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
