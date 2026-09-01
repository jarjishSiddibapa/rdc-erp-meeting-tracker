import { useState, useRef } from 'react';
import { Form, Input, Typography, Grid } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandButton from '../components/ui/BrandButton';
import GreenMonster from '../components/ui/GreenMonster';

const { Title, Text } = Typography;
const BRAND = '#00B51A';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  // ── Monster mascot state: face tracks the caret while typing the email, arms cover the
  // eyes while the password field is focused, fingers spread if "show password" is on. ──
  const monsterWrapRef = useRef(null);
  const emailInputRef = useRef(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function onFinish({ email, password }) {
    setLoading(true);
    setError('');
    // Use the login request's network wait to warm the authenticated shell.
    void import('./Dashboard');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    // Full-bleed, no max-width cap — the page always fills the real viewport at any zoom
    // level or window size. The form panel below uses `clamp()` instead of a flat fixed
    // width so it grows/shrinks *with* the image panel instead of staying rigid while the
    // image panel absorbs 100% of the change — that mismatch was what made the gap between
    // them look increasingly disproportionate as the effective viewport got wider.
    <div style={{
      display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100dvh',
      boxSizing: 'border-box', background: '#fff',
    }}>

      {/* Left panel: keep the existing brand infographic in its lightweight WebP form. */}
      {!isMobile && (
        // Flat, exact-match white — the infographic's own background is the same white,
        // so wherever objectFit:contain leaves letterboxed space, there's no boundary to
        // see at all rather than a seam between two near-but-not-quite-matching whites.
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#ffffff' }}>
          <img
            src="/login-bg.webp"
            alt="Digital RDC: an AI-enabled ecosystem of excellence"
            fetchPriority="high"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}

      {/* Right panel: solid, stable and immediately interactive. */}
      <div
        style={{
          width: isMobile ? '100%' : 'clamp(380px, 28vw, 480px)', flexShrink: 0, position: 'relative', overflow: 'visible',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: isMobile ? '40px 24px' : '48px 40px',
          boxShadow: isMobile ? 'none' : '-8px 0 32px rgba(0,0,0,0.10)',
          background: '#ffffff',
        }}
        className="login-panel"
      >
        {/* RDC Logo + app name — the application's identity comes first, above the mascot */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: 8, position: 'relative', zIndex: 1 }}>
          <img
            src="/rdc-logo.png"
            alt="RDC"
            style={{ maxWidth: 150, height: 'auto', display: 'block', margin: '0 auto 8px' }}
            onError={e => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{
            display: 'none', width: 64, height: 64, borderRadius: 12,
            background: BRAND, color: '#fff', fontSize: 20, fontWeight: 800,
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>RDC</div>
          <Title level={4} style={{ margin: 0, color: '#047d16' }}>
            RDC Digitization Review
          </Title>
        </div>

        {/* Speech bubble — when login fails, the mascot says the error out loud instead of
            a plain form alert. Tail points down into his head. */}
        {error && (
          <div
            key={error}
            style={{
              position: 'relative', maxWidth: 300, margin: '0 auto 12px', zIndex: 2,
              background: '#fff5f5', border: '1.5px solid #ff4d4f', borderRadius: 16,
              padding: '9px 16px', textAlign: 'center',
              boxShadow: '0 6px 16px rgba(255,77,79,0.18)',
            }}
          >
            <Text style={{ fontSize: 12.5, color: '#a8071a', fontWeight: 500, lineHeight: 1.4 }}>{error}</Text>
            <div style={{
              position: 'absolute', left: '50%', bottom: -9, transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: '9px solid #ff4d4f',
            }} />
            <div style={{
              position: 'absolute', left: '50%', bottom: -6.3, transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid #fff5f5',
            }} />
          </div>
        )}

        {/* Mascot — watches the caret while you type your email, and covers its eyes with
            its arms while you type your password. Sized close to its native 200px so the
            eyes track proportionally the way they were designed to. */}
        <div
          ref={monsterWrapRef}
          title="I'll keep your password private!"
          style={{
            width: 190, height: 190, margin: '0 auto 12px', position: 'relative', zIndex: 1,
            borderRadius: '50%', overflow: 'hidden', border: `3px solid ${BRAND}`,
          }}
        >
          <GreenMonster
            wrapRef={monsterWrapRef}
            emailInputRef={emailInputRef}
            emailFocused={emailFocused}
            emailValue={emailValue}
            passwordFocused={passwordFocused}
            passwordVisible={passwordVisible}
          />
        </div>

        {/* Form */}
        <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              label={<Text strong>Email</Text>}
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Enter a valid email address' },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#9ca3af' }} />}
                placeholder="you@rdc.in"
                size="large"
                autoComplete="username"
                onFocus={e => { emailInputRef.current = e.target; setEmailFocused(true); }}
                onBlur={() => setEmailFocused(false)}
                onChange={e => { emailInputRef.current = e.target; setEmailValue(e.target.value); }}
              />
            </Form.Item>

            <Form.Item
              label={<Text strong>Password</Text>}
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
              style={{ marginBottom: 8 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                placeholder="Enter password"
                size="large"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                visibilityToggle={{ visible: passwordVisible, onVisibleChange: setPasswordVisible }}
              />
            </Form.Item>

            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <Link to="/forgot-password" style={{ fontSize: 12, color: BRAND }}>Forgot password?</Link>
            </div>

            <BrandButton htmlType="submit" block loading={loading} style={{ fontSize: 15 }}>
              Sign In
            </BrandButton>
          </Form>
        </div>

        <Text type="secondary" style={{ fontSize: 12, marginTop: 32, textAlign: 'center', position: 'relative', zIndex: 1 }}>
          Contact your IT administrator if you need access
        </Text>

        <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 'auto', paddingTop: 32, position: 'relative', zIndex: 1 }}>
          © {new Date().getFullYear()} RDC - We Promise We Deliver
        </Text>
        <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 4, position: 'relative', zIndex: 1 }}>
          updated & maintained by Jarjish :)
        </Text>
      </div>
    </div>
  );
}
