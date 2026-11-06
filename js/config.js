/* app/js/config.js — Lo único que cambia entre demostración y producción.
   BACKEND_URL vacío = modo demostración: todo se guarda solo en este navegador, con instituciones de ejemplo.
   En producción se pega aquí la URL /exec del Web App de Apps Script (backend/README.md, paso 6). */
window.CONFIG = {
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbzjdY_jQW8ephSuKp8s-2Uv-PAoTdvq37DdoyQugJ37x_WQ8tWyFKBE98HBmrUZfBme/exec',
  TITULO: 'Conmemoración del Día Mundial de Eliminación de las Violencias contra las Mujeres',
  CAMPANA: 'Cambia el guion',
  LEMA: 'que la violencia no sea parte de tu historia',
  // 25 de noviembre y los 16 días de activismo, que terminan el 10 de diciembre (orientaciones, «Otras propuestas», a).
  DIA: '2026-11-25',
  FIN: '2026-12-10',
  // Geometría pública de los municipios (DANE, MGN). Solo se usa para nombrar los municipios; no contiene datos de instituciones.
  MAPA_URL: 'data/caldas_mapa.json?v=1',
  // El nombre se repite en backend/Codigo.gs (ACTIVIDADES): si cambia uno, cambia el otro. El resto es texto de pantalla;
  // «cuidado» viene de la sección «Cuidado y enfoque de derechos» de cada actividad en las orientaciones.
  ACTIVIDADES: [
    { nombre: 'Cambia la frase', que: 'Mural o tendedero con las frases que se dejan atrás y las que se eligen.',
      pista: 'Foto general del mural, sin datos personales.',
      cuidado: 'No reproducir frases con datos que permitan identificar a una persona. Evitar debates que justifiquen o minimicen la violencia.' },
    { nombre: 'Pausa la escena', que: 'Escenas ficticias breves y alternativas respetuosas para cambiar el final.',
      pista: 'Fotos del espacio o registro de la actividad, sin rostros identificables.',
      cuidado: 'Usar situaciones ficticias y no pedir que se representen agresiones explícitas. No dramatizar experiencias reales de participantes.' },
    { nombre: 'El tráiler de una historia distinta', que: 'Video vertical de 15 a 30 segundos con los mensajes de la campaña.',
      pista: 'Enlace al video publicado o captura de la publicación.',
      cuidado: 'Contar con autorización informada para grabar y publicar; para niñas, niños y adolescentes, aplicar las salvaguardas correspondientes. No publicar testimonios ni información sensible.' },
    { nombre: 'El muro de los compromisos', que: 'Tarjetas con «Yo cambio el guion cuando…» en un muro o árbol simbólico.',
      pista: 'Foto general del muro.',
      cuidado: 'Promover compromisos realistas, sin exponer ni señalar a personas.' },
    { nombre: 'Saber dónde acudir: la ruta de atención', que: 'Punto informativo con la ruta municipal de atención y sus contactos.',
      pista: 'Foto del punto informativo y del volante o la ruta usada.',
      cuidado: 'Verificar todos los contactos antes de imprimir y manejar la información con reserva.' },
    { nombre: 'Otra actividad de la campaña', que: 'Cualquier otra acción hecha en el marco del 25 de noviembre.',
      pista: 'Lo que muestre con claridad qué se hizo.',
      cuidado: 'No incluir datos que identifiquen a personas ni relatos de casos reales.' }
  ]
};
