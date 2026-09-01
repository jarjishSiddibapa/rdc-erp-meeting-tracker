import { Button } from 'antd';

const BRAND = '#00B51A';

// A focused Ant Design button using the company color. Keeping it native avoids wrapper
// transforms around popovers/forms and gives immediate keyboard, pointer and loading states.
export default function BrandButton({ variant = 'primary', style, block, ...props }) {
  const shared = {
    borderRadius: 8,
    height: 40,
    paddingInline: 20,
    fontWeight: 600,
    display: block ? 'flex' : 'inline-flex',
    width: block ? '100%' : undefined,
    justifyContent: 'center',
  };

  const variants = {
    primary: {
      ...shared,
      background: BRAND,
      borderColor: BRAND,
      color: '#fff',
      boxShadow: '0 4px 12px rgba(0,181,26,0.18)',
    },
    ghost: {
      ...shared,
      background: 'transparent',
      border: `1px solid ${BRAND}55`,
      color: BRAND,
      boxShadow: 'none',
    },
  };

  return <Button type={variant === 'primary' ? 'primary' : 'default'} block={block} style={{ ...variants[variant], ...style }} {...props} />;
}
