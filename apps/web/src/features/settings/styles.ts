import { css } from '@/styled-system/css';

export const inputClass = css({
  px: '3',
  py: '1.5',
  fontSize: 'sm',
  border: '1px solid',
  borderColor: 'bd.strong',
  borderRadius: 'md',
  outline: 'none',
  bg: 'bg.page',
  color: 'fg.default',
  _focusVisible: { borderColor: 'blue.400', ring: '2px', ringColor: 'blue.100' },
});

export const sectionClass = css({
  pb: '6',
  mb: '6',
  borderBottom: '1px solid',
  borderColor: 'bd.subtle',
  _last: { borderBottom: 'none', mb: '0', pb: '0' },
});
