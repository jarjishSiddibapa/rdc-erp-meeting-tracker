import { useState } from 'react';
import { Form, Input, Card, Alert, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Reveal } from '../components/ui/Reveal';
import BrandButton from '../components/ui/BrandButton';

const { Title, Text } = Typography;
export default function ChangePassword() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  async function onFinish({ current_password, new_password }) {
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await authAPI.changePassword({ current_password, new_password });
      setSuccess(true);
      form.resetFields();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Reveal>
      <Card className="shadow-soft" style={{ maxWidth: 480, borderRadius: 10, position: 'relative', overflow: 'hidden' }}>
        <Title level={5}>Change Password</Title>
        <Text type="secondary">Logged in as: {user?.full_name} ({user?.email})</Text>

        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
          {success && <Alert message="Password changed successfully" type="success" showIcon style={{ marginBottom: 16 }} />}

          <Form.Item name="current_password" label="Current Password" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="New Password"
            rules={[{ required: true }, { min: 6, message: 'Minimum 6 characters' }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Confirm New Password"
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
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <BrandButton htmlType="submit" loading={loading}>Change Password</BrandButton>
        </Form>
      </Card>
    </Reveal>
  );
}
