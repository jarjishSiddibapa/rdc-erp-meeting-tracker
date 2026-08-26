import { useState } from 'react';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';

const { Title, Text } = Typography;
const BRAND = '#00B51A';

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function onFinish({ email }) {
    setLoading(true);
    setError('');
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Segoe UI, sans-serif', border: `10px solid ${BRAND}`, boxSizing: 'border-box',
      background: '#f6faf7',
    }}>
      <div style={{
        width: 420, background: '#fff', borderRadius: 16, padding: '40px 36px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
      }}>
        <Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>Forgot Password</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Enter the email address on your account and we'll send you a link to reset your password.
        </Text>

        <div style={{ marginTop: 24 }}>
          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
          {sent ? (
            <Alert
              type="success"
              showIcon
              message="Check your inbox"
              description="If that email is registered, a reset link is on its way. It expires in 1 hour."
              style={{ marginBottom: 8 }}
            />
          ) : (
            <Form layout="vertical" onFinish={onFinish} autoComplete="off">
              <Form.Item
                name="email"
                label={<Text strong>Email</Text>}
                rules={[{ required: true, message: 'Please enter your email' }, { type: 'email', message: 'Enter a valid email' }]}
              >
                <Input prefix={<MailOutlined style={{ color: '#9ca3af' }} />} placeholder="you@rdc.in" size="large" />
              </Form.Item>
              <Button
                type="primary" htmlType="submit" block size="large" loading={loading}
                style={{ background: BRAND, borderColor: BRAND, fontWeight: 600, height: 46 }}
              >
                Send Reset Link
              </Button>
            </Form>
          )}
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link to="/login" style={{ fontSize: 13, color: BRAND }}>
            <ArrowLeftOutlined /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
