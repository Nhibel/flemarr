import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { css } from '@/styled-system/css';

/**
 * A modal, on the native `<dialog>` element.
 *
 * Native rather than a positioned div, because `showModal()` brings the
 * things a hand-rolled modal gets wrong: focus is trapped inside, the rest
 * of the page is inert, Escape closes it, and it sits in the top layer so
 * no z-index can cover it. None of that is worth reimplementing.
 *
 * jsdom implements neither `showModal` nor `close`, so both are called
 * defensively and fall back to the `open` attribute — the dialog still
 * renders, and closes, which is what the tests need.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (open) {
      if (typeof el.showModal === 'function') {
        if (!el.open) el.showModal();
      } else {
        el.setAttribute('open', '');
      }
    } else if (el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      // `cancel` is Escape. Routing it through onClose keeps the parent's
      // state the single source of truth — letting the element close itself
      // would leave `open` true and the dialog unreopenable.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // A click that lands on the dialog element itself is a backdrop
      // click: its own content is inside children, so any click on
      // something real has a deeper target.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={css({
        p: '0',
        border: 'none',
        bg: 'transparent',
        maxW: 'none',
        maxH: 'none',
        w: 'full',
        h: 'full',
        '&::backdrop': { bg: 'rgba(0, 0, 0, 0.55)' },
      })}
    >
      {/* The panel. Separate from <dialog> itself so the element can span
          the viewport and have its own padding act as the clickable
          backdrop area. */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '4',
          maxW: '3xl',
          maxH: '85vh',
          mx: 'auto',
          mt: '10vh',
          p: '5',
          bg: 'bg.surface',
          borderRadius: '18px',
          shadow: 'lg',
          overflowY: 'auto',
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
          <h2
            className={css({
              flex: '1',
              minW: '0',
              fontSize: 'lg',
              fontWeight: 'bold',
              color: 'fg.heading',
            })}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={css({
              flexShrink: 0,
              w: '32px',
              h: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: 'bg.muted',
              border: 'none',
              borderRadius: '10px',
              color: 'fg.subtle',
              cursor: 'pointer',
              fontSize: 'base',
              _hover: { color: 'fg.default' },
            })}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
