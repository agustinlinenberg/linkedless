/**
 * LinkedLess — Spanish phrase banks
 *
 * The genre list is shared: ids, families, intents and precedence all live in
 * genres.js and are never translated. This file supplies, per genre, the
 * Spanish `detect` block for genres whose recognition depends on wording.
 *
 * There is no output text here. Cards are written by compress.js from the
 * post's own sentences, so a Spanish post produces a Spanish card by
 * construction, with nothing to translate.
 *
 * Genres absent from this file keep the English phrases. That is correct for
 * anything detected from DOM flags or post shape, and harmless otherwise:
 * English phrases simply rarely match Spanish text.
 *
 * The eight rail genres are complete and must stay that way. A rail gap in
 * any supported language is a release blocker, and `npm run coverage` exits
 * non-zero when recall drops below 100%.
 *
 * Vocabulary covers both Rioplatense and peninsular forms, since a feed mixes
 * them freely: "comentá" and "comenta", "acá" and "aquí".
 *
 * JavaScript's \b is ASCII-only, so /\bcomentá\b/ never matches — the accent
 * is not a word character and the boundary assertion fails right where the
 * verb ends. Use (?:^|[^\wÀ-ÿ]) and (?![\wÀ-ÿ]) instead. That bug silently
 * disabled several genres here before the corpus caught it.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  var OVERLAY = {

    // ── F0 · rail. Complete by definition: a rail gap in any supported
    // language is a release blocker, not a coverage statistic. ────────────
    bereavement: {
      detect: { any: [
        { phrase: ["descanse en paz", "q.e.p.d", "qepd", "su partida",
                   "sentido pésame", "mis condolencias", "nuestras condolencias",
                   "falleció", "fallecimiento", "en paz descanse"] },
        { and: [
          { regex: "(?:^|[^\\wÀ-ÿ])(muri[oó]|muerte|nos dej[oó]|perdimos a|su partida|falleci)(?![\\wÀ-ÿ])" },
          { phrase: ["tristeza", "dolor", "condolencias", "descanse", "abrazo a la familia",
                     "lo vamos a extrañar", "la vamos a extrañar", "gran pérdida",
                     "triste noticia", "consternados", "luto"] },
        ] },
      ] },
      examples: ["Con mucha tristeza compartimos que nuestro colega falleció el martes. Lo vamos a extrañar."],
    },
    illness_health: {
      detect: {
        all: [{ structure: { firstPerson: true } }],
        any: [
          { phrase: ["me diagnosticaron", "mi diagnóstico", "quimioterapia", "mi operación",
                     "mi cirugía", "mi recuperación", "licencia médica", "crisis de salud mental",
                     "mi burnout", "me internaron", "estuve internado", "estuve internada"] },
          { regex: "(?:^|[^\\wÀ-ÿ])(un acv|infarto|tumor|c[aá]ncer|leucemia|terapia intensiva|trasplante|convulsiones|reca[ií]da|enfermedad cr[oó]nica|cuidados paliativos)(?![\\wÀ-ÿ])" },
        ],
        none: [{ phrase: ["mi papá", "mi padre", "mi mamá", "mi madre", "mi esposa", "mi esposo",
                          "mi pareja", "mi hijo", "mi hija", "cuidando a mi"] }],
      },
      examples: ["Hace tres meses me diagnosticaron un linfoma. El lunes empiezo la quimioterapia."],
    },
    layoff_self: {
      detect: {
        all: [{ structure: { firstPerson: true } }],
        any: [{ phrase: ["me despidieron", "fui desvinculado", "fui desvinculada", "quedé sin trabajo",
                         "mi puesto fue eliminado", "parte de los despidos", "afectado por los despidos",
                         "afectada por los despidos", "me tocó salir", "cerré mi etapa de forma inesperada"] }],
      },
      examples: ["Después de 6 años me despidieron en la última ronda de recortes. Abierto a lo que venga."],
    },
    layoff_company: {
      detect: { any: [
        { and: [
          { phrase: ["despidos", "reducción de personal", "reestructuración", "difícil decisión",
                     "desvincular", "recorte de personal", "achicar el equipo"] },
          { regex: "\\b(hoy|ayer|nosotros|nuestro equipo|la empresa|la compañía)\\b" },
        ] },
        { and: [
          { phrase: ["nos despedimos de", "tuvimos que despedir", "dejamos ir a"] },
          { regex: "\\b(\\d+|muchos|varios|decenas de|cientos de)\\s+(colegas|compañeros|personas|empleados|puestos)\\b" },
        ] },
      ] },
      examples: ["Ayer nos despedimos de 120 colegas. La decisión es mía, no de ellos."],
    },
    personal_crisis: {
      detect: {
        all: [{ structure: { firstPerson: true } }],
        any: [{ phrase: ["mi divorcio", "mi separación", "cuidando a mi", "mi papá está",
                         "mi mamá está", "toqué fondo", "perdí mi casa", "estoy de licencia"] }],
      },
      examples: ["Mi papá entró en cuidados paliativos el viernes. Estoy cuidando a mi mamá y bajo el ritmo un tiempo."],
    },
    tribute_memorial: {
      detect: { any: [{ phrase: ["en memoria de", "homenaje a", "a un año de su partida",
                                 "recordando a", "hoy se cumple un año sin"] }] },
      examples: ["En memoria de Ana Duarte, que le enseñó a editar a media industria."],
    },
    disaster_solidarity: {
      detect: { all: [
        { phrase: ["terremoto", "inundaciones", "inundación", "incendios", "el tiroteo",
                   "la guerra en", "crisis humanitaria", "la tragedia de", "el atentado"] },
        { phrase: ["solidaridad", "nuestros pensamientos", "donaciones", "donar", "ayuda",
                   "afectados", "víctimas", "acompañamos"] },
      ] },
      examples: ["Imágenes devastadoras de las inundaciones en Valencia. Acompañamos a todos los afectados."],
    },
    tragedy_lesson: {
      detect: {
        all: [
          { or: [
            { phrase: ["falleció", "su muerte", "su fallecimiento", "el tiroteo", "el terremoto",
                       "el accidente", "la tragedia de", "perdió la vida"] },
            { regex: "\\b(la (muerte|partida) de) [A-ZÀ-Þ]" },
          ] },
          { phrase: ["me enseñó", "nos enseña", "nos recuerda", "me recordó", "lección",
                     "liderazgo", "legado", "los founders", "en los negocios", "tres cosas"] },
        ],
      },
      examples: ["La muerte de Kobe Bryant me recordó lo que los founders entienden mal sobre el legado."],
    },

    // ── F1 · native formats. Detection is DOM-driven and needs no
    // translation, so these only supply Spanish templates. ────────────────
    event_promo: {
      detect: { any: [{ native: "event" },
                      { phrase: ["inscribite", "inscríbete", "reservá tu lugar", "reserva tu lugar",
                                 "cupos limitados", "te esperamos", "nos vemos el", "sumate al evento"] }],
                none: [{ phrase: ["webinar", "masterclass", "capacitación gratuita", "taller gratuito"] }] },
      examples: ["Nos vemos el 14 de octubre para desarmar cinco onboardings B2B. Cupos limitados, inscribite acá."],
    },
    celebration_template: {
      detect: { any: [{ native: "celebration" },
                      { phrase: ["felicitaciones a", "felicidades a", "démosle la bienvenida a",
                                 "sumamos a", "le damos la bienvenida a"] }] },
      examples: ["Démosle la bienvenida a Marta Ruiz como nueva Head of Design."],
    },

    // ── F2 · announcements ────────────────────────────────────────────────
    new_job_announce: {
      detect: {
        all: [{ phrase: ["me sumo a", "me sumé a", "nueva etapa", "nuevo desafío", "nuevo capítulo",
                         "feliz de compartir", "contento de compartir", "contenta de compartir",
                         "emocionado de anunciar", "emocionada de anunciar", "orgulloso de compartir",
                         "orgullosa de compartir", "arranco en", "empiezo en", "mi primer día en"] }],
        none: [{ phrase: ["buscamos", "estamos contratando", "vacante"] }],
      },
      examples: ["Feliz de compartir que me sumo a Stripe como Staff Product Designer."],
    },
    promotion_announce: {
      detect: { any: [{ phrase: ["me ascendieron", "fui promovido", "fui promovida", "asumo el rol de",
                                 "asumí el rol de", "ahora lidero", "paso a liderar"] }] },
      examples: ["Con humildad comparto que me ascendieron a Directora de Ingeniería en Acme."],
    },
    work_anniversary: {
      detect: { all: [{ phrase: ["aniversario", "años en", "años con", "años acá", "años aquí",
                                 "hoy se cumplen"] }, { capture: "DURATION" }] },
      examples: ["Hoy se cumplen 5 años en Datadog. Qué viaje."],
    },
    funding_announce: {
      detect: {
        all: [{ phrase: ["levantamos", "cerramos nuestra", "ronda de inversión", "ronda liderada",
                         "nos financió", "recibimos una inversión", "nuestra serie", "nuestro seed"] }],
        any: [{ capture: "MONEY" }, { capture: "ROUND" }],
      },
      examples: ["Levantamos una Serie A de $12M liderada por Sequoia para rehacer el onboarding B2B."],
    },
    acquisition_announce: {
      detect: { any: [{ phrase: ["fue adquirida", "fue adquirido", "nos adquirió", "adquirimos",
                                 "nos compró", "se une a", "cerramos la adquisición"] }] },
      examples: ["Noticia grande: Loom fue adquirida por Atlassian."],
    },
    award_recognition: {
      detect: { any: [{ phrase: ["me eligieron", "fui reconocido", "fui reconocida", "premio",
                                 "galardón", "quedé entre los", "entramos en el ranking",
                                 "top 50", "top 100", "30 under 30"] }] },
      examples: ["Con humildad comparto que quedé entre los 30 under 30 de Forbes este año."],
    },
    certification_course: {
      detect: { any: [{ phrase: ["me certifiqué", "obtuve mi certificación", "terminé el curso",
                                 "aprobé el examen", "completé el programa", "me recibí de"] }] },
      examples: ["Obtuve mi certificación de AWS Solutions Architect después de tres meses de estudio."],
    },
    milestone_metric: {
      detect: {
        all: [{ phrase: ["llegamos a", "superamos", "cruzamos", "alcanzamos", "hito", "ya somos"] }],
        any: [{ capture: "MONEY" }, { capture: "PERCENT" }, { capture: "NUMBER" }],
      },
      examples: ["Superamos el millón de ARR, 26 meses después del lanzamiento."],
    },
    launch_announce: {
      detect: { any: [{ phrase: ["lanzamos", "ya está disponible", "presentamos", "salió",
                                 "estrenamos", "disponible desde hoy"] }] },
      examples: ["Presentamos Acme Flow, la forma más rápida de armar una cadena de aprobaciones. Ya está disponible."],
    },
    speaking_appearance: {
      detect: { any: [{ phrase: ["voy a hablar en", "estaré en", "doy una charla", "keynote",
                                 "me sumo al panel", "nos vemos en el evento"] }] },
      examples: ["Voy a hablar en SaaStr el mes que viene sobre pricing para empresas PLG."],
    },
    press_feature: {
      detect: { any: [{ phrase: ["salimos en", "me entrevistaron", "nota en", "nos publicó",
                                 "aparecimos en"] }] },
      examples: ["Agradecido por la nota en TechCrunch de esta mañana sobre la ronda."],
    },

    // ── F3 · hiring. The headline-vs-body company comparison is
    // language-independent, so it carries over unchanged. ─────────────────
    third_party_referral: {
      detect: {
        all: [{ phrase: ["está buscando", "están buscando", "busca un", "busca una", "vacante",
                         "oportunidad", "se suma al equipo de", "puesto en"] }],
        any: [
          { flag: "companyMismatch" },
          { phrase: ["el equipo de un amigo", "una amiga mía", "un cliente mío", "una empresa que conozco",
                     "una empresa del portfolio", "alguien de mi red", "una empresa amiga"] },
        ],
        none: [{ phrase: ["estamos buscando", "estamos contratando", "sumate a nuestro equipo",
                          "nuestro equipo crece", "vení a trabajar con nosotros"] }],
      },
      examples: ["Una empresa que conozco, Halcyon Labs, está buscando un Head of Data. Puedo referir a quien quiera."],
    },
    we_are_hiring: {
      detect: { all: [{ phrase: ["estamos contratando", "estamos buscando", "sumate a nuestro equipo",
                                 "buscamos", "abrimos una búsqueda", "tenemos una vacante",
                                 "nuestro equipo crece"] }] },
      examples: ["Estamos buscando dos ingenieros de plataforma senior en Northwind. Remoto en toda la UE."],
    },
    open_to_work: {
      detect: {
        all: [{ structure: { firstPerson: true } }],
        any: [{ phrase: ["#opentowork", "busco trabajo", "abierto a oportunidades", "abierta a oportunidades",
                         "en búsqueda activa", "disponibilidad inmediata", "busco mi próximo desafío",
                         "vuelvo al mercado", "si saben de alguna búsqueda"] }],
      },
      examples: ["Después de once años vuelvo al mercado. Abierta a roles de VP de Ingeniería, remoto o Lisboa."],
    },
    recruiter_pitch: {
      detect: { any: [{ phrase: ["mandame tu cv", "envíame tu cv", "mándenme su cv", "tengo una búsqueda",
                                 "estoy reclutando para", "dejá tu perfil"] }] },
      examples: ["Tengo una búsqueda de Staff iOS Engineer en Ámsterdam. Mandame tu CV por privado."],
    },
    referral_request: {
      detect: { any: [{ phrase: ["alguna referencia", "me pueden referir", "alguien contratando",
                                 "conocen a alguien en", "agradezco cualquier contacto"] }] },
      examples: ["¿Alguien contratando PMs en fintech? Agradezco cualquier contacto en Mercado Pago o Ualá."],
    },

    // ── F4 · reach farming ────────────────────────────────────────────────
    comment_bait: {
      detect: { all: [
        { phrase: ["comentá", "comenta", "escribí", "escribe", "poné", "pone ", "dejá la palabra",
                   "respondé", "responde"] },
        { phrase: ["te lo mando", "te lo envío", "te la mando", "y te lo paso", "por privado",
                   "te mando", "te envío", "y te comparto", "te paso"] },
      ] },
      examples: ["Comentá GUIA y te mando por privado mi playbook de prospección de 47 páginas."],
    },
    tag_bait: {
      detect: { any: [{ phrase: ["etiquetá a", "etiqueta a", "mencioná a", "menciona a",
                                 "quién necesita leer esto", "taggeá a"] }] },
      examples: ["Etiquetá a alguien que necesite leer esto hoy."],
    },
    repost_bait: {
      detect: { any: [{ phrase: ["compartí para", "comparte para", "ayudanos a llegar", "difundí",
                                 "difunde", "repostealo", "ayudá a que llegue"] }] },
      examples: ["Compartí para que llegue a alguien que esté contratando. Toma dos segundos."],
    },
    follow_bait: {
      detect: { any: [{ phrase: ["seguime para", "sígueme para", "publico todos los días",
                                 "activá la campanita", "dale seguir", "seguime si"] }] },
      examples: ["Publico todos los días sobre growth B2B. Seguime para más."],
    },

    // ── F5 · narrative ────────────────────────────────────────────────────
    parable_stranger: {
      detect: { all: [
        { regex: "\\b(un|una|el|la) (desconocido|desconocida|señor|señora|hombre|mujer|chico|chica|pibe|conserje|portero|barrendero|mozo|moza|taxista|cadete|pasajero|pasajera|cliente|becario|becaria|candidato|candidata)\\b" },
        { phrase: ["resultó ser", "era el ceo", "era la ceo", "era el dueño", "era la dueña",
                   "adiviná quién", "al día siguiente", "dos semanas después", "una semana después",
                   "resultó que era"] },
      ] },
      examples: ["A una señora se le rompió el auto.\n\nMe frené a ayudarla.\n\nDos semanas después entré a una reunión.\n\nEra la socia principal."],
    },
    hardship_to_success: {
      detect: { all: [
        { regex: "\\b(hace\\s+(\\d+|un|dos|tres|cuatro|cinco|seis|diez)\\s+(años?|meses?))\\b|\\bcuando toqué fondo\\b" },
        { phrase: ["no tenía nada", "estaba quebrado", "estaba quebrada", "no llegaba a fin de mes",
                   "dormía en", "no podía pagar", "me habían echado", "sin un peso"] },
      ] },
      examples: ["Hace cuatro años no llegaba a fin de mes.\n\nNo tenía nada.\n\nEl trimestre pasado pasamos los 4M de ARR."],
    },
    child_wisdom: {
      detect: { all: [
        { regex: "\\bmi (hijo|hija|nene|nena|sobrino|sobrina)\\b|\\bmi hij[ao] de \\d+\\b" },
        { phrase: ["me preguntó", "me dijo", "me enseñó", "cambió mi forma", "no supe qué responder"] },
      ] },
      examples: ["Mi hija de 6 años me preguntó por qué trabajo los fines de semana.\n\nNo supe qué responder."],
    },
    mundane_business_lesson: {
      detect: { all: [
        { phrase: ["mi barbero", "mi peluquera", "el taxista", "el mozo", "la moza", "mi verdulero",
                   "el del kiosco", "mi entrenador", "el chofer", "la cajera"] },
        { phrase: ["me enseñó", "me recordó", "es igual que", "sobre liderazgo", "sobre ventas",
                   "sobre negocios", "sobre marketing", "sobre gestión"] },
      ] },
      examples: ["Mi peluquera tiene 94% de recompra y ningún CRM. Me enseñó más de retención que tres años de conferencias."],
    },
    gratitude_spiral: {
      detect: {
        all: [{ regex: "(gracias|agradecid|agradezco|bendecid)" }, { structure: { wordCount: { min: 25 } } }],
        none: [{ capture: "MONEY" }, { capture: "PERCENT" }, { capture: "DATE" }],
      },
      examples: ["Agradecida por este equipo.\n\nAgradecida por este camino.\n\nBendecida de estar rodeada de gente que aparece todos los días."],
    },

    // ── F6 · opinion ──────────────────────────────────────────────────────
    hot_take: {
      detect: { any: [{ phrase: ["opinión impopular", "opinión polémica", "lo voy a decir",
                                 "alguien tenía que decirlo", "me van a putear por esto",
                                 "sé que no va a gustar"] }] },
      examples: ["Opinión impopular: la mayoría de los frameworks de OKR son teatro trimestral."],
    },
    false_dichotomy: {
      detect: { all: [
        { phrase: ["no se trata de", "no es sobre", "no va de"] },
        { phrase: ["se trata de", "es sobre", "va de"] },
      ] },
      examples: ["El liderazgo no se trata de títulos.\n\nSe trata de servir.\n\nLeelo de nuevo."],
    },
    nobody_talks_about: {
      detect: { any: [{ phrase: ["nadie habla de", "nadie te cuenta", "nadie te dice",
                                 "la mayoría no se da cuenta", "lo que no te cuentan"] }] },
      examples: ["Nadie habla de lo solo que se siente el primer año de fundar una empresa."],
    },
    if_you_are_not: {
      detect: { all: [
        { regex: "(?:^|[^\\wÀ-ÿ])si (tu \\w+ |tus \\w+ )?(todav[ií]a |a[uú]n )?no(?![\\wÀ-ÿ])" },
        { phrase: ["ya estás atrasado", "ya estás atrasada", "te quedaste atrás", "lo estás haciendo mal",
                   "te lo vas a perder", "vas a quedar afuera"] },
      ] },
      examples: ["Si tu equipo todavía no escribe evals para sus prompts, ya estás atrasado y lo vas a sentir en Q1."],
    },
    prediction: {
      detect: { any: [{ regex: "\\bpara (20\\d{2})\\b" },
                      { phrase: ["está muerto", "va a desaparecer", "va a reemplazar", "el futuro de",
                                 "el fin de"] }] },
      examples: ["Para 2029 el rol de desarrollador junior como lo conocemos no va a existir."],
    },

    // ── F8 · promotion ────────────────────────────────────────────────────
    webinar_lead_magnet: {
      detect: { any: [{ phrase: ["webinar", "masterclass", "capacitación gratuita", "taller gratuito",
                                 "clase gratuita", "reservá tu lugar", "cupos limitados"] }],
                none: [{ phrase: ["cohorte", "cierra la inscripción", "mi curso"] }] },
      examples: ["Masterclass gratuita el jueves: el desarme de pricing que hacemos solo con clientes. Cupos limitados."],
    },
    course_cohort_promo: {
      detect: { any: [{ phrase: ["cohorte", "cierra la inscripción", "últimos cupos", "mi curso",
                                 "abrimos inscripciones", "precio early bird"] }] },
      examples: ["La cohorte 4 de mi curso de Posicionamiento abre el lunes. Quedan 12 cupos."],
    },
    cold_outreach_public: {
      detect: { any: [{ phrase: ["escribime por privado", "mandame un mensaje", "agendá una llamada",
                                 "agenda una llamada", "mi calendly", "hablemos, te dejo el link"] }] },
      examples: ["Si el pipeline es tu cuello de botella, escribime por privado y agendamos una llamada."],
    },
    product_pitch: {
      detect: { any: [{ phrase: ["probalo gratis", "pruébalo gratis", "link en comentarios",
                                 "nuestro producto", "lo construimos", "registrate hoy"] }] },
      examples: ["Construimos Acme Flow porque las cadenas de aprobación están rotas. Probalo gratis, link en comentarios."],
    },
    testimonial_client_win: {
      detect: {
        all: [{ phrase: ["un cliente", "nuestro cliente", "lo llevamos de", "pasaron de", "los ayudamos a"] }],
        any: [{ capture: "PERCENT" }, { capture: "MONEY" }],
      },
      examples: ["Llevamos a un cliente del 2% al 11% de tasa de respuesta en seis semanas. Misma lista, mejor copy."],
    },

    // ── F9 · substance. Summarised straight, never mocked. ────────────────
    technical_explainer: {
      detect: {
        all: [
          { regex: "\\b(latencia|rendimiento|p9[59]|kubernetes|postgres|redis|typescript|python|rust|golang|api|sdk|inferencia|caché|cache|esquema|migración|despliegue|deploy|compilador|runtime|endpoint)\\b" },
          { structure: { wordCount: { min: 25 } } },
        ],
      },
      examples: ["Cambiamos el store de sesiones de Redis por un LRU en memoria y bajamos el p99 de 410ms a 88ms. El costo es una ventana de 30 segundos de datos viejos."],
    },
    data_research: {
      detect: {
        all: [{ phrase: ["el estudio", "un estudio", "estudio de", "la encuesta", "una encuesta",
                         "encuesta de", "el informe", "según", "los datos muestran",
                         "el paper", "la investigación", "la muestra", "encuestados"] }],
        any: [{ capture: "PERCENT" }, { capture: "NUMBER" }],
      },
      examples: ["Un estudio de Stanford con 4.800 desarrolladores: la asistencia de IA subió el throughput 21% pero el tiempo de revisión 34%."],
    },
    case_study_numbers: {
      detect: {
        all: [
          { regex: "\\bde\\s+[\\d$€£][\\d.,]*\\s*[%\\w]*\\s+a\\s+[\\d$€£][\\d.,]*" },
          { structure: { wordCount: { min: 25 } } },
        ],
      },
      examples: ["Subimos la conversión de checkout de 2,4% a 3,9% en once semanas. Sacar el registro obligatorio hizo casi todo."],
    },
    tutorial_howto: {
      detect: { all: [
        { phrase: ["así lo hacemos", "paso 1", "paso uno", "cómo hacer", "el proceso es", "te cuento cómo"] },
        { structure: { numeralLedLineCount: { min: 3 } } },
      ] },
      examples: ["Así hacemos una revisión de incidentes en 45 minutos:\n1. Línea de tiempo sin culpables\n2. Factores que contribuyeron\n3. Dos acciones con responsable"],
    },
  };

  ns.catalogEs = { OVERLAY: OVERLAY };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.catalogEs;
  }
})();
