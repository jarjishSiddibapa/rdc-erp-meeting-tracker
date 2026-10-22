import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

// The search box that sits above a table; the page filters its own rows with matchesSearch().
export default function TableSearch({ value, onChange, placeholder = 'Search...', width = 260, style }) {
  return (
    <Input
      allowClear prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
      placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
      style={{ width, maxWidth: '100%', ...style }}
    />
  );
}
