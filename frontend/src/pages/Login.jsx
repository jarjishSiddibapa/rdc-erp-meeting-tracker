import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Form, Input, Typography, Grid } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Squiggle, Sparkle, DashedCircle, BarChart, CheckScribble, Arrow } from '../components/ui/Doodles';
import BrandButton from '../components/ui/BrandButton';
import GreenMonster from '../components/ui/GreenMonster';

// three.js/@react-three/fiber is a heavy dependency (~600kB) only needed for this one
// decorative scene — load it lazily so it doesn't bloat the initial bundle every route pays for.
const LoginScene = lazy(() => import('../components/LoginScene'));

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
      display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh',
      fontFamily: 'Segoe UI, sans-serif', boxSizing: 'border-box', background: '#fff',
    }}>

      {/* ── Left panel: brand infographic over an ambient 3D backdrop (hidden on small screens to keep the form front and center) ── */}
      {!isMobile && (
        // Flat, exact-match white — the infographic's own background is the same white,
        // so wherever objectFit:contain leaves letterboxed space, there's no boundary to
        // see at all rather than a seam between two near-but-not-quite-matching whites.
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#ffffff' }}>
          <motion.img
            src="/login-bg.png"
            alt="Digital RDC — an AI-enabled ecosystem of excellence"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              objectFit: 'contain',
            }}
          />

          {/* The 3D particle field floats above the image (transparent canvas, pointer-events
              off) rather than behind it — sitting behind would only ever be visible in the
              letterboxed gaps, which is exactly the "mismatched backdrop" seam this replaces. */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
            <Suspense fallback={null}>
              <LoginScene />
            </Suspense>
          </div>

          {/* Doodles layered on top of the infographic itself, not just around it — kept to
              the corners so the diagram stays fully legible underneath. */}
          <Sparkle className="doodle-glow" style={{ position: 'absolute', zIndex: 3, top: '6%', left: '4%', color: BRAND, opacity: 0.6 }} />
          <Squiggle className="doodle-float" style={{ position: 'absolute', zIndex: 3, top: '8%', right: '6%', color: BRAND, opacity: 0.45, transform: 'rotate(6deg)' }} />
          <BarChart className="doodle-float" style={{ position: 'absolute', zIndex: 3, bottom: '10%', left: '5%', color: BRAND, opacity: 0.4, animationDelay: '-2s' }} />
          <CheckScribble className="doodle-float" style={{ position: 'absolute', zIndex: 3, bottom: '12%', right: '7%', color: BRAND, opacity: 0.45, animationDelay: '-1s' }} />
          <DashedCircle className="doodle-float" style={{ position: 'absolute', zIndex: 3, top: '46%', left: '2%', color: BRAND, opacity: 0.3, animationDelay: '-3s' }} />
          <Arrow className="doodle-float" style={{ position: 'absolute', zIndex: 3, top: '42%', right: '3%', color: BRAND, opacity: 0.3, transform: 'scaleX(-1)', animationDelay: '-1.5s' }} />
        </div>
      )}

      {/* ── Right panel: login form ── */}
      <motion.div
        initial={{ opacity: 0, x: isMobile ? 0 : 24, y: isMobile ? 16 : 0 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          width: isMobile ? '100%' : 'clamp(380px, 28vw, 480px)', flexShrink: 0, position: 'relative', overflow: 'visible',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: isMobile ? '40px 24px' : '48px 40px',
          boxShadow: isMobile ? 'none' : '-8px 0 32px rgba(0,0,0,0.10)',
          '--panel-bg': '#ffffff',
        }}
        className="glass-panel"
      >
        {/* Doodle accents — kept faint and off to the sides so they never compete with the form */}
        <Squiggle style={{ position: 'absolute', top: 24, left: -8, color: BRAND, opacity: 0.25, transform: 'rotate(-8deg)' }} className="doodle-float" />
        <Sparkle style={{ position: 'absolute', bottom: 90, right: 18, color: BRAND, opacity: 0.35 }} className="doodle-glow" />
        <DashedCircle style={{ position: 'absolute', bottom: -10, left: -14, color: BRAND, opacity: 0.2 }} className="doodle-float" />

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
          <Title level={4} className="text-gradient-brand" style={{ margin: 0 }}>
            RDC Digitization Review
          </Title>
        </div>

        {/* Speech bubble — when login fails, the mascot says the error out loud instead of
            a plain form alert. Tail points down into his head. */}
        {error && (
          <motion.div
            key={error}
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'backOut' }}
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
          </motion.div>
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
              label={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Text strong>Password</Text>
                  <Link to="/forgot-password" style={{ fontSize: 12, color: BRAND }}>Forgot password?</Link>
                </div>
              }
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
              style={{ marginBottom: 24 }}
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

            <BrandButton htmlType="submit" block loading={loading} style={{ fontSize: 15 }}>
              Sign In
            </BrandButton>
          </Form>
        </div>

        <Text type="secondary" style={{ fontSize: 12, marginTop: 32, textAlign: 'center', position: 'relative', zIndex: 1 }}>
          Contact your IT administrator if you need access
        </Text>

        <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 'auto', paddingTop: 32, position: 'relative', zIndex: 1 }}>
          © {new Date().getFullYear()} RDC — We Promise We Deliver
        </Text>
        <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 4, position: 'relative', zIndex: 1 }}>
          updated & maintained by Jarjish :)
        </Text>
      </motion.div>
    </div>
  );
}
