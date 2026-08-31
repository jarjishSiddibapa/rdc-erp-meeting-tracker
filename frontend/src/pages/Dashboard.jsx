import { useState, useEffect, lazy, Suspense } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Space, Tag, theme, Tooltip, Grid } from 'antd';
import {
  DatabaseOutlined, TeamOutlined, LockOutlined, LogoutOutlined,
  UserOutlined, ProjectOutlined, CloudServerOutlined,
  FileExcelOutlined, DashboardOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import AmbientBackground from '../components/ui/AmbientBackground';
import { LoadingNotice } from '../components/ui/LoadingNotice';
import DashboardHome from './DashboardHome';

// Route-level code splitting: only the landing page (DashboardHome, above) loads eagerly;
// everything else — including UpdateTasks's heavy xlsx dep — loads on first visit.
const SRPage = lazy(() => import('./SRPage'));
const UserManagement = lazy(() => import('./UserManagement'));
const ChangePassword = lazy(() => import('./ChangePassword'));
const UpdateTasks = lazy(() => import('./UpdateTasks'));
const BackupSettings = lazy(() => import('./BackupSettings'));
const Reports = lazy(() => import('./Reports'));

const { Header, Sider, Content, Footer } = Layout;
const { Text } = Typography;
const BRAND = '#00B51A';

const ROLE_COLORS = { admin: 'red', editor: 'blue', viewer: 'green' };

const MENU_ITEMS = [
  { key: 'home',         icon: <DashboardOutlined />,   label: 'Dashboard' },
  { type: 'divider' },
  { key: 'SR',           icon: <DatabaseOutlined />,    label: 'Service Requests' },
  { type: 'divider' },
  { key: 'Digitization', icon: <ProjectOutlined />,     label: 'Digitization Projects' },
  { type: 'divider' },
  { key: 'reports',      icon: <BarChartOutlined />,    label: 'Reports' },
  { type: 'divider' },
  { key: 'update-tasks', icon: <FileExcelOutlined />,   label: 'Update Tasks',      adminOnly: true },
  { key: 'users',        icon: <TeamOutlined />,        label: 'User Management',   adminOnly: true },
  { key: 'backup',       icon: <CloudServerOutlined />, label: 'Backup Settings',   adminOnly: true },
  { key: 'password',     icon: <LockOutlined />,        label: 'Change Password' },
];

const TITLES = {
  home:         'Dashboard',
  SR:           'Service Requests',
  Digitization: 'Digitization Projects',
  reports:      'Reports',
  'update-tasks': 'Update Tasks',
  users:        'User Management',
  backup:       'Backup Settings',
  password:     'Change Password',
};

const ALL_KEYS = [...MENU_ITEMS.filter(i => i.key).map(i => i.key), 'password'];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Which panel was open survives a page refresh (sessionStorage — same scope as the
  // auth token, so it clears on tab close along with the session rather than sticking
  // around forever) instead of always bouncing back to the Dashboard home screen.
  const [activeKey, setActiveKey] = useState(() => {
    const saved = sessionStorage.getItem('activeKey');
    const adminOnlyKeys = MENU_ITEMS.filter(i => i.adminOnly).map(i => i.key);
    if (saved && ALL_KEYS.includes(saved) && (isAdmin || !adminOnlyKeys.includes(saved))) return saved;
    return 'home';
  });
  const [collapsed, setCollapsed] = useState(false);
  const [navTarget, setNavTarget] = useState({ category: null, pendingWith: '' });
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();

  // md breakpoint (>=768px) and up gets the pinned, pushable sidebar; below that the
  // sidebar becomes a full-height overlay so it never squeezes data tables into a sliver.
  const isMobile = !screens.md;

  useEffect(() => { setCollapsed(isMobile); }, [isMobile]);
  useEffect(() => { sessionStorage.setItem('activeKey', activeKey); }, [activeKey]);

  function handleNavigateToSR(category, name) {
    // Filter strictly by the Pending With column (exact match), not a free-text search —
    // otherwise a name that also happens to match Created By pulls in unrelated SRs.
    setNavTarget({ category, pendingWith: name });
    setActiveKey(category);
  }

  const menuItems = MENU_ITEMS
    .filter(item => !item.adminOnly || isAdmin)
    .map(({ key, icon, label, type }) => ({ key, icon, label, type }));

  const userMenu = {
    items: [
      { key: 'password', icon: <LockOutlined />, label: 'Change Password' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
    ],
    onClick: ({ key }) => key === 'logout' ? logout() : setActiveKey(key),
  };

  function selectMenu({ key }) {
    setActiveKey(key);
    if (isMobile) setCollapsed(true);
  }

  function renderContent() {
    switch (activeKey) {
      case 'home':         return <DashboardHome onNavigateToSR={handleNavigateToSR} />;
      case 'SR':           return <SRPage key="SR" category="SR" excludeClosed initialPendingWith={navTarget.category === 'SR' ? navTarget.pendingWith : ''} />;
      case 'Digitization': return <SRPage key="Digitization" category="Digitization" excludeClosed initialPendingWith={navTarget.category === 'Digitization' ? navTarget.pendingWith : ''} />;
      case 'reports':      return <Reports />;
      case 'update-tasks': return <UpdateTasks />;
      case 'users':        return <UserManagement />;
      case 'backup':       return <BackupSettings />;
      case 'password':     return <ChangePassword />;
      default:             return <DashboardHome onNavigateToSR={handleNavigateToSR} />;
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999 }}
        />
      )}

      {/* On mobile, positioning/transform live on this wrapper div rather than the Sider
          itself — antd applies its own !important-heavy inline styles directly to
          .ant-layout-sider for its collapse animation, which silently overrides a
          transform set on that same element. */}
      <div style={isMobile ? {
        position: 'fixed', insetInlineStart: 0, top: 0, bottom: 0, zIndex: 1000, height: '100vh',
        transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.25s ease',
      } : undefined}>
      <Sider
        collapsible collapsed={isMobile ? false : collapsed} onCollapse={setCollapsed} trigger={null}
        style={{
          background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}`,
          height: isMobile ? '100%' : undefined,
        }}
        width={220}
      >
        {/* Logo area */}
        <div style={{
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: collapsed && !isMobile ? '10px 6px' : '10px 14px',
          minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {collapsed && !isMobile ? (
            /* Collapsed: show just the green RDC badge */
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: BRAND,
              color: '#fff', fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>RDC</div>
          ) : (
            /* Expanded: show full logo */
            <>
              <img
                src="/rdc-logo.png"
                alt="RDC"
                style={{ width: '100%', maxHeight: 52, objectFit: 'contain', display: 'block' }}
                onError={e => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              {/* Fallback */}
              <div style={{
                display: 'none', alignItems: 'center', gap: 8, width: '100%'
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: BRAND,
                  color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>RDC</div>
                <div>
                  <Text strong style={{ fontSize: 12, display: 'block', lineHeight: 1.2 }}>RDC Digitization Review</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>We Promise We Deliver</Text>
                </div>
              </div>
            </>
          )}
        </div>

        <Menu
          mode="inline" selectedKeys={[activeKey]}
          onClick={selectMenu}
          items={menuItems}
          style={{ border: 'none', marginTop: 4 }}
        />
      </Sider>
      </div>

      <Layout style={{ minWidth: 0 }}>
        <Header style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <Space size={{ xs: 8, sm: 16 }}>
            <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <motion.div
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                onClick={() => setCollapsed(c => !c)}
                style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  color: token.colorText, background: token.colorFillTertiary, flexShrink: 0,
                }}
              >
                {collapsed ? <MenuUnfoldOutlined style={{ fontSize: 16 }} /> : <MenuFoldOutlined style={{ fontSize: 16 }} />}
              </motion.div>
            </Tooltip>
            <Text strong style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{TITLES[activeKey] || ''}</Text>
          </Space>

          <Space size={{ xs: 10, sm: 20 }}>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
                <Text className="hide-on-mobile">{user?.full_name}</Text>
                <Tag color={ROLE_COLORS[user?.role]}>{user?.role?.toUpperCase()}</Tag>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            position: 'relative', padding: isMobile ? 12 : 20, background: token.colorBgLayout,
            overflowY: 'auto', overflowX: 'hidden', width: '100%',
          }}
        >
          <AmbientBackground />
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', minWidth: 0 }}>
            <AnimatePresence initial={false}>
              <motion.div
                key={activeKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{ gridArea: '1 / 1', minWidth: 0 }}
              >
                <Suspense fallback={<LoadingNotice />}>
                  {renderContent()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </Content>
        <Footer style={{
          textAlign: 'center', padding: '8px 16px', fontSize: 11,
          color: token.colorTextTertiary, background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}>
          updated & maintained by Jarjish :)
        </Footer>
      </Layout>
    </Layout>
  );
}
