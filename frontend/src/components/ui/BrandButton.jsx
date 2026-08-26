import { Button } from 'antd';
import MagneticButton from './MagneticButton';

const BRAND = '#00B51A';
const BRAND_DEEP = '#048a17';

// A pill-shaped, gradient CTA button with a soft colored glow — ported from the
// portfolio site's Hero buttons — wrapping antd's Button so all its usual props
// (htmlType, loading, icon, disabled, block...) keep working.
export default function BrandButton({ variant = 'primary', style, block, ...props }) {
  const shared = {
    borderRadius: 999,
    height: 44,
    paddingInline: 26,
    fontWeight: 600,
    border: 'none',
    display: block ? 'flex' : 'inline-flex',
    width: block ? '100%' : undefined,
    justifyContent: 'center',
  };

  const variants = {
    primary: {
      ...shared,
      background: `linear-gradient(100deg, ${BRAND_DEEP}, ${BRAND})`,
      color: '#fff',
      boxShadow: '0 8px 20px rgba(0,181,26,0.32)',
    },
    ghost: {
      ...shared,
      background: 'transparent',
      border: `1px solid ${BRAND}55`,
      color: BRAND,
      boxShadow: 'none',
    },
  };

  return (
    <MagneticButton style={{ display: block ? 'block' : 'inline-block' }}>
      <Button type={variant === 'primary' ? 'primary' : 'default'} block={block} style={{ ...variants[variant], ...style }} {...props} />
    </MagneticButton>
  );
}
