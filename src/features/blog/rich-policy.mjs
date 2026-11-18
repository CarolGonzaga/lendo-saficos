export const richTags = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'code', 'pre', 'hr',
  'span', 'font', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote'];

export const richAttributes = {
  a: ['href', 'target', 'rel'], span: ['style'], font: ['color', 'size'], ol: ['start'],
  p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'],
};

const colors = [/^#[a-f\d]{3,8}$/i, /^[a-z]+$/i, /^(?:rgba?|hsla?)\([\d.,%\s]+\)$/i];
const length = /^\d{1,3}(?:\.\d+)?(?:px|em|rem|%)$/i;
export const richStyles = {
  color: colors,
  'background-color': colors,
  'font-size': [length],
  'font-family': [/^(?:["']?(?:DM Sans|Playfair Display)["']?(?:\s*,\s*(?:serif|sans-serif))?|serif|sans-serif)$/i],
  'font-weight': [/^(?:normal|bold|[1-9]00)$/i],
  'text-align': [/^(?:left|right|center|justify)$/i],
  'line-height': [/^(?:[0-4](?:\.\d+)?|5)$/, length],
  'letter-spacing': [/^-?(?:\d(?:\.\d+)?|0\.\d+)(?:px|em|rem)$/i],
  'margin-top': [length, /^0$/],
  'margin-bottom': [length, /^0$/],
};

export function cleanRichStyle(style) {
  return style.split(';').flatMap(declaration => {
    const colon = declaration.indexOf(':');
    if (colon < 0) return [];
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    return Object.hasOwn(richStyles, property) && richStyles[property].some(rule => rule.test(value))
      ? [`${property}:${value}`] : [];
  }).join(';');
}

