/** CSI liturgical colours — see diocese calendar guidance. */
export const LITURGICAL_COLORS = ['white', 'green', 'purple', 'red', 'black'];

export function isValidLiturgicalColor(value) {
  return value === '' || value == null || LITURGICAL_COLORS.includes(value);
}
