import { useState } from 'react';
import { Form, Input, Button, Typography, Alert, Result } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';

const { Title, Text } = Typography;
const BRAND = '#00B51A';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function onFinish({ new_password }) {
    setLoading(true);
    setError('');
    try {
      await authAPI.resetPassword({ token, new_password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  const shell = (children) => (
    <div style={{
      display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Segoe UI, sans-serif', border: `10px solid ${BRAND}`, boxSizing: 'border-box',
      background: '#f6faf7',
    }}>
      <div style={{
        width: 420, background: '#fff', borderRadius: 16, padding: '40px 36px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
      }}>
        {children}
      </div>
    </div>
  );

  if (!token) {
    return shell(
      <Result
        status="warning"
        title="Missing reset link"
        subTitle="This page needs a valid reset link from your email."
        extra={<Link to="/forgot-password"><Button type="primary" style={{ background: BRAND, borderColor: BRAND }}>Request a new link</Button></Link>}
      />
    );
  }

  if (done) {
    return shell(
      <Result
        status="success"
        title="Password reset!"
        subTitle="Redirecting you to sign in..."
      />
    );
  }

  return shell(
    <>
      <Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>Reset Password</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Choose a new password for your account.</Text>

      <div style={{ marginTop: 24 }}>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="new_password"
            label={<Text strong>New Password</Text>}
            rules={[{ required: true }, { min: 6, message: 'Minimum 6 characters' }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#9ca3af' }} />} size="large" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label={<Text strong>Confirm New Password</Text>}
            dependencies={['new_password']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                  return Promise.reject(new Error('Passwords do not match'));
                }
              })
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#9ca3af' }} />} size="large" />
          </Form.Item>
          <Button
            type="primary" htmlType="submit" block size="large" loading={loading}
            style={{ background: BRAND, borderColor: BRAND, fontWeight: 600, height: 46 }}
          >
            Reset Password
          </Button>
        </Form>
      </div>
    </>
  );
}
