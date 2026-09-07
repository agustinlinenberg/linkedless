const test = require("node:test");
const assert = require("node:assert/strict");
const lang = require("../src/shared/lang.js");
const match = require("../src/engine/match.js");
const render = require("../src/engine/render-text.js");
const structure = require("../src/engine/structure.js");
const entities = require("../src/engine/entities.js");
const { CATALOG } = require("../src/catalog/genres.js");
const { OVERLAY } = require("../src/catalog/genres.es.js");

const es = (body, headline = "Head of Ops en Northwind") =>
  `Ana Solis\n• 2do\n${headline}\n4 h\n\n${body}`;
const card = (body, headline, native) => render.render(match.classify(es(body, headline), native || {}));

// ── detection ────────────────────────────────────────────────────────────

test("language detection separates Spanish from English", () => {
  assert.equal(lang.detectLang("Cerrando una etapa, y lista para lo que venga en el nuevo equipo."), "es");
  assert.equal(lang.detectLang("We are hiring two senior platform engineers for the team."), "en");
});

test("short posts fall back to the default language rather than guessing", () => {
  assert.equal(lang.detect("Buen día").confident, false);
});

// ── the rail must be complete in every language ──────────────────────────

test("every rail genre is translated", () => {
  const railIds = CATALOG.filter((g) => g.rail).map((g) => g.id);
  const missing = railIds.filter((id) => !OVERLAY[id]);
  assert.deepEqual(missing, [], `rail genres missing from the Spanish overlay: ${missing}`);
});

test("the Spanish rail catches posts about death, illness and layoffs", () => {
  const cases = [
    "Estamos consternados. Nuestro colega Sam Ito murió el martes a la mañana. Tenía 41 años y trabajó nueve con nosotros.",
    "Hace seis semanas tuve un ACV y todavía estoy reaprendiendo a escribir. Vuelvo despacio al trabajo desde octubre.",
    "Ayer nos despedimos de 120 colegas en Northwind. La responsabilidad de la decisión es mía y de nadie más del equipo.",
    "Mi papá entró en cuidados paliativos el viernes. Estoy cuidando a mi mamá y bajo el ritmo con los clientes un tiempo.",
  ];
  for (const body of cases) assert.equal(card(body).rail, true, body);
});

test("Spanish rail posts keep their opening verbatim when trimmed", () => {
  const out = card(
    "Estamos consternados. Nuestro colega Sam Ito murió el martes a la mañana. " +
    "Tenía 41 años y trabajó nueve con nosotros construyendo casi toda la plataforma que usamos hoy. " +
    "Me entrevistó a mí. Discutimos sobre índices de base de datos durante todo 2019 y tenía razón. " +
    "Los detalles del servicio los compartimos esta semana cuando la familia decida. " +
    "Acompañen a su equipo con paciencia estos días."
  );
  assert.equal(out.rail, true);
  assert.equal(out.passthrough, false);
  assert.ok(out.text.startsWith("Estamos consternados"), out.text);
  assert.ok(out.text.length <= 280);
});

test("Spanish death metaphors about work are not railed", () => {
  for (const body of [
    "Nuestro roadmap de Q3 murió lentamente en comité. Tres lecciones sobre decisiones.",
    "Ayer maté nuestra feature más grande. Tenía 4% de adopción y 30% del soporte.",
  ]) {
    assert.notEqual(card(body).rail, true, body);
  }
});

// ── cards render in the language of the post ─────────────────────────────

test("a Spanish post yields Spanish card text", () => {
  const out = card("Cerrando una etapa.\n\nMe sumo a Mercado Libre como Product Design Lead en octubre.\n\nGracias a todos.");
  assert.equal(out.lang, "es");
  assert.ok(out.text.includes("Mercado Libre"), out.text);
  // Card text is the author's own words, so it is Spanish by construction.
  assert.ok(!/reads like|wants you to/i.test(out.text), out.text);
});

// ── the bugs the Spanish corpus exposed ──────────────────────────────────

test("firstPerson is bilingual", () => {
  // An English-only version silently disabled the whole Spanish rail.
  assert.equal(structure.analyze("Estoy cuidando a mi mamá desde marzo.").firstPerson, true);
  assert.equal(structure.analyze("I am caring for my mother.").firstPerson, true);
  assert.equal(structure.analyze("La empresa creció mucho.").firstPerson, false);
});

test("accented verbs match despite JavaScript's ASCII word boundaries", () => {
  // /\bcomentá\b/ never matches: "á" is not a word character, so the trailing
  // boundary assertion fails right where the verb ends.
  assert.equal(entities.baitKeyword("Comentá GUIA y te lo mando."), "GUIA");
  assert.equal(entities.baitKeyword("Escribí SISTEMA abajo y te lo paso."), "SISTEMA");
});

test("entity capture works in Spanish", () => {
  const e = entities.extract("Levantamos una Serie A de $12M liderada por Sequoia.", "Founder en Nimbus");
  assert.equal(e.MONEY, "$12M");
  assert.equal(e.ROUND, "Serie A");
  assert.equal(e.INVESTOR, "Sequoia");
});

test("the headline company check works in Spanish", () => {
  const own = card("Estamos buscando dos ingenieros de plataforma en Northwind.", "Engineering Manager en Northwind");
  const ref = card("Una empresa que conozco, Halcyon Labs, está buscando un Head of Data.", "Engineering Manager en Northwind");
  assert.equal(own.genreId, "we_are_hiring");
  assert.equal(ref.genreId, "third_party_referral");
});

test("Spanish header parsing strips degree, headline and timestamp", () => {
  const utils = require("../src/shared/utils.js");
  const raw = "Publicación\nLucía Ferro\n• 3ro\nProduct Designer en Nébula\n4 h • Editado\n\nCerrando una etapa.";
  assert.equal(utils.extractAuthor(raw), "Lucía Ferro");
  assert.equal(utils.extractHeadline(raw), "Product Designer en Nébula");
  assert.equal(utils.extractBody(raw), "Cerrando una etapa.");
});

test("job titles come from hiring context, not from a stray verb", () => {
  assert.equal(entities.jobTitle("Aldergrove is hiring a Head of Visual Merchandising! This person will lead the way."),
    "Head of Visual Merchandising");
  assert.equal(entities.jobTitle("I will lead the migration next quarter."), null);
});
