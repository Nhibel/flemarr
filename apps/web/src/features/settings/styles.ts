import { css } from '@/styled-system/css';

export const inputClass = css({
  px: '3',
  py: '1.5',
  fontSize: 'sm',
  border: '1px solid',
  borderColor: 'bd.strong',
  borderRadius: 'lg',
  outline: 'none',
  bg: 'bg.page',
  color: 'fg.default',
  _focusVisible: { borderColor: 'accent.hover', ring: '2px', ringColor: 'accent.subtleBorder' },
});

export const sectionClass = css({
  pb: '6',
  mb: '6',
  borderBottom: '1px solid',
  borderColor: 'bd.subtle',
  _last: { borderBottom: 'none', mb: '0', pb: '0' },
});
