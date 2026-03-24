// Generates human-readable access codes in "palabra-palabra" format.
// All words are Spanish, max 6 letters. ~190 words → ~36 000 combinations.

const WORDS = [
  'sol', 'mar', 'luz', 'rio', 'aire', 'agua', 'roca', 'nube', 'luna', 'vela',
  'llama', 'monte', 'campo', 'flor', 'rama', 'hoja', 'brisa', 'calma', 'cielo', 'delta',
  'faro', 'lago', 'miel', 'norte', 'olivo', 'palma', 'playa', 'polvo', 'reina', 'ruta',
  'selva', 'senda', 'tigre', 'torre', 'valle', 'viento', 'vista', 'vuelo', 'zarza', 'abeja',
  'alma', 'ambar', 'ancla', 'arco', 'arena', 'arpa', 'astro', 'atlas', 'cisne', 'cobra',
  'coral', 'costa', 'cueva', 'danza', 'diana', 'duna', 'elfo', 'fiera', 'foca', 'forja',
  'fruta', 'garra', 'gato', 'gema', 'globo', 'golfo', 'gusto', 'hacha', 'hielo', 'hongo',
  'honor', 'humo', 'isla', 'jade', 'jaula', 'joya', 'karma', 'kiwi', 'llano', 'llave',
  'lobo', 'loro', 'loto', 'lucha', 'lince', 'limon', 'libro', 'letra', 'leona', 'leon',
  'lazo', 'lanza', 'mapa', 'marea', 'magia', 'metro', 'mundo', 'nardo', 'negro', 'nicho',
  'nivel', 'noble', 'noche', 'nogal', 'nuez', 'ocaso', 'omega', 'onix', 'orden', 'otono',
  'oveja', 'panda', 'pausa', 'perla', 'plata', 'plomo', 'prado', 'punto', 'queso', 'radar',
  'radio', 'raiz', 'rapaz', 'rayo', 'razon', 'regla', 'reino', 'riada', 'risco', 'ritmo',
  'roble', 'rosca', 'rubio', 'sabia', 'saeta', 'sauce', 'senal', 'siena', 'sigma', 'soplo',
  'surco', 'suelo', 'tabla', 'talon', 'techo', 'tela', 'tema', 'tinto', 'titan', 'totem',
  'trama', 'trigo', 'tropa', 'tubo', 'turno', 'unico', 'vaina', 'vapor', 'varon', 'verde',
  'venus', 'vigor', 'vocal', 'yerba', 'yogur', 'zafir', 'zorro', 'zurdo', 'cima', 'clan',
  'copa', 'ganso', 'grua', 'hiena', 'lapiz', 'nimbo', 'proa', 'rasgo', 'raton', 'rombo',
  'cobre', 'crema', 'cruce', 'cuero', 'dardo', 'falla', 'fibra', 'fleco', 'fosil', 'fuego',
];

function pick() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function generateWordCode() {
  return `${pick()}-${pick()}`;
}

module.exports = { generateWordCode };
