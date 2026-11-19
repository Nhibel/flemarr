import { css } from '@/styled-system/css';
import { plural } from '@/lib/plural.js';

/** Shown only once a scan ran: without one, nothing is known to be owned. */
export function ExcludeOwnedToggle({
  checked,
  onChange,
  ownedCount,
  selectedCount,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ownedCount: number;
  selectedCount: number;
}) {
  return (
    <label
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '2',
        mb: '3',
        fontSize: 'sm',
        color: 'fg.default',
        cursor: 'pointer',
      })}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Exclure les jeux déjà possédés d'après le dernier scan ({ownedCount} sur {selectedCount}{' '}
      {plural(ownedCount, 'possédé')})
    </label>
  );
}
