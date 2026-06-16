# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.
All notable changes to this project will be documented in this file.

O formato segue [Keep a Changelog](https://keepachangelog.com/) e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added · Adicionado (mais recente / most recent)

#### Skeletons de carregamento / Loading skeletons

- **Placeholders animados** enquanto os dados carregam do SQLite — a lista de torneios, classificação, partidas, chaveamento e grupos agora mostram cartões "pulsando" em vez de piscar o estado vazio antes dos dados aparecerem. Novo componente reutilizável `Skeleton` / `SkeletonList` (`src/components/ui/Skeleton.tsx`). O estado vazio só aparece depois que o carregamento conclui de fato (flag `loaded` no store de torneios; sinal "ainda não carregado" via `byTournament[id] === undefined` nas telas de partidas). / **Animated placeholders** while data loads from SQLite — tournaments list, standings, matches, bracket and groups show pulsing cards instead of flashing the empty state. New reusable `Skeleton` / `SkeletonList`. Empty states now appear only after loading truly completes.

#### Critérios de desempate por fase / Per-phase tiebreakers

- **Desempate configurável por fase** — toggle no construtor de fases (formato pontos corridos) entre três presets: **FIFA** (pontos → saldo → gols pró → confronto direto → ordem alfabética), **CONMEBOL** (pontos → confronto direto → saldo → gols pró → ordem alfabética) e **Vôlei** (pontos → vitórias → saldo de sets → sets pró → confronto direto). A classificação, os grupos, a imagem exportada e o chaveamento dos playoffs passam a respeitar o preset da fase de origem. (Schema v11: nova coluna `tiebreaker` em `phases`; torneios antigos preservam a ordem legada via backfill para `conmebol`.) / **Configurable tiebreaker preset per round-robin phase** — pick FIFA, CONMEBOL, or Volleyball in the phase builder. Standings, group tables, the exported image, and playoff seeding all honor the source phase's preset. Schema v11 adds a `tiebreaker` column; existing tournaments keep their legacy order (backfilled to `conmebol`).
- **Motor de desempate generalizado** — `computeStandings` agora aceita uma ordem de critérios (preset nomeado ou lista explícita) e quebra empates recursivamente, com confronto direto montando uma mini-tabela só entre os times empatados. / **Generalized ranking engine** — `computeStandings` takes an ordered criterion list (named preset or explicit array) and breaks ties recursively; head-to-head builds a mini-table among only the tied teams.

#### Ícones de participantes / Participant badges

- **Catálogo de 28 ícones** + paleta de 10 cores. Cada participante pode ter um ícone (Trophy, Star, Crown, Shield, Flame, Sword, Skull, Rocket, Diamond, etc.) sobre uma cor de fundo, exibido em listas, cards de partida, árvore de chaveamento e na imagem Champions exportada. Sem ícone, o app cai pra iniciais sobre fundo neutro. (Schema v10: colunas `icon` + `icon_color` em participants, ambas nullable.) / **28-icon catalog + 10-color palette.** Each participant can pick an icon over a colored circle; renders across lists, match cards, the bracket tree, and the Champions-style export. No icon → falls back to initials on a neutral background (schema v10).
- **Picker via modal** — bottom sheet com grid horizontal de ícones e fila de cores. Acessível tocando no badge ao lado do nome (na criação OU em qualquer participante existente). A cor escolhida na criação fica memorizada pra "carimbar" vários participantes em sequência. / **Modal picker** — bottom sheet with icon grid + color row. Tap the badge next to the name field (when adding) or any existing participant's badge (to edit). The picked color persists across additions for stamping out a series.

#### Imagem do torneio — estilo Champions / Tournament image — Champions style

- **Novo layout "Champions"** na exportação de imagem — chaveamento simétrico de duas pontas convergindo num troféu central, fundo gradiente escuro e linhas de conexão amarelas, no espírito dos brackets de mata-mata da Champions League. Toggle "Simples / Champions" aparece quando o torneio tem chave de 4, 8 ou 16 times. Brackets de outros tamanhos / round-robin / dupla eliminação continuam só com o estilo Simples. / **New "Champions" image-export layout** — symmetric two-sided bracket converging on a centered trophy, dark gradient background, yellow connector lines. Toggle ("Simple / Champions") shows up only for 4/8/16-team brackets; other shapes stay on Simple.

#### Identidade visual / Visual identity

- **Nova arte do app** — ícone de troféu dourado em fundo azul de marca (#1a78f5). Renderizado a partir de SVGs versionados (`assets/icon-source.svg` + `assets/icon-foreground-source.svg`) via `node scripts/generate-icons.mjs`, gerando icon, adaptive-icon, splash-icon e favicon nas dimensões certas. / **New app artwork** — gold trophy on the brand-blue background. Source SVGs are committed; running `node scripts/generate-icons.mjs` (one-shot, uses sharp) produces all PNG variants.
- **Splash animado** — sobre o splash estático, exibe o troféu surgindo com mola, confetes disparados dos dois cantos superiores e o nome do app aparecendo logo abaixo (PT-BR: "Meu Torneio" / EN: "My Tournament"). Após ~2s o overlay esmaece e revela a tela inicial. Implementado com `react-native-reanimated` + `react-native-confetti-cannon`. / **Animated splash overlay** — trophy springs in, confetti bursts from both top corners, app name fades in below (PT "Meu Torneio" / EN "My Tournament"). Fades out after ~2s revealing the home screen. Built with reanimated + confetti-cannon.

#### Dupla eliminação / Double elimination

- **Bracket reset** opcional na chave dupla — toggle por fase no construtor custom. Quando ativado, gera uma 2ª grande final que vira a partida decisiva caso o time da chave de perdedores ganhe a 1ª. A propagação dos dois finalistas para a GF2 é automática; o status do torneio só fica "finalizado" quando a partida decisiva (GF1 ou GF2 conforme o caso) é jogada. (Schema v9.) / **Bracket reset** opt-in flag for double elimination. When enabled, generates a 2nd grand final that becomes the deciding match if the LB Champion wins GF1. Both finalists auto-propagate into GF2; status logic only marks "finished" once the match that actually decides the title is played (schema v9).
- **Formato `double_elimination`** — chave de vencedores (WB) + chave de perdedores (LB) + grande final. Cada perdedor da WB é propagado automaticamente para o slot correto da LB; perdedor da LB está eliminado. Suporte inicial para 4, 8 e 16 times. (Schema v8: nova coluna `loser_next_match_id` + slots explícitos.) / **`double_elimination` format** — winners + losers brackets with a single grand final. WB losers auto-drop to the right LB slot; LB losers are out. Initial release supports 4, 8, 16-team brackets (schema v8 adds `loser_next_match_id` + explicit slot columns).
- **Tela de partidas com seções WB / LB / Grande Final** — cada bracket tem rótulo próprio e ordenação de rodadas independente. Disponível tanto no preset top-level quanto no construtor custom. / **Matches screen rendering with WB / LB / GF sections** — each bracket gets its own labeled block.
- **Limitações desta release** (potenciais melhorias futuras): sem **árvore visual** dedicada para chave dupla (continua só nos formatos single-elim por enquanto); cap em 16 times. / **Initial-release limitations**: no visual tree for DE yet; capped at 16 teams.

#### Formatos com mais flexibilidade / More flexible formats

- **Até 8 grupos no construtor custom** (era 4) — desbloqueia composições estilo Champions League / Copa do Mundo. Quando a próxima fase é mata-mata, o número de classificados é derivado automaticamente (top-2 de cada grupo) e exibido como campo somente-leitura, evitando configurações inválidas. Para liga única → mata-mata, o picker de classificados virou um toggle entre 2/4/8/16 (potências de 2 válidas). / **Up to 8 groups in the custom builder** (was 4) — unlocks Champions League / World Cup-style shapes. Qualifiers auto-derive from group count when the next phase is single-elim and lock to {2,4,8,16} otherwise.
- **Disputa de 3º lugar** opcional no mata-mata — toggle por fase. Adiciona uma partida extra entre os perdedores das semifinais; perdedores são propagados automaticamente quando a SF é jogada. (Schema v7.) / **Third-place playoff** opt-in flag on single-elim phases. Generates an extra match between SF losers; loser propagation runs automatically on SF score save (schema v7).
- **Preset "Copa do Mundo"** — opção no picker de formato que pré-preenche o construtor custom com 8 grupos × 4 → R16 → quartas → semis → final + 3º lugar. O usuário pode editar livremente depois. / **"World Cup" preset** — type-picker option that pre-fills the custom builder with 8 groups × 4 → R16 → QF → SF → Final + 3rd-place. Fully editable.

### Added · Adicionado (sessão atual / current session)

#### Modelo de fases / Phase model

- **Modelo de `Phase`** (schema v3) — torneios passam a ser uma lista ordenada de fases com `format`, `legs`, `groupCount`, `qualifiers`, `ordinal`, `status`. Os 4 presets existentes ganham fases default via `defaultPhasesForType`. Migration idempotente faz backfill em torneios pré-existentes. / **Phase entity** (schema v3): tournaments are now an ordered list of phases. Existing presets get default shapes; idempotent migration backfills pre-existing tournaments.
- **Geração phase-driven** (PR refactor sem mudança de UX) — `generateBracketForTournament` itera sobre fases em vez de branchar em `tournament.type`, abrindo caminho pra composições arbitrárias. / Phase-driven generation refactor (no UX change) — `generateBracketForTournament` iterates phases instead of branching on `tournament.type`.
- **Builder de torneio personalizado** (`'custom'`) — wizard pra compor 1–2 fases com `format`, `legs`, `groupCount`, `qualifiers` e `scoring`. Validação inline rejeita composições não-suportadas com mensagens claras. / **Custom tournament builder**: wizard for composing 1–2 phases with format/legs/groupCount/qualifiers/scoring. Inline validation rejects unsupported shapes with clear messages.

#### Novos formatos / New formats

- **Liga + Playoffs (vôlei)** — single-group double round-robin (legs=2) seguido de placement playoff (final + 3º lugar). Default de pontuação = vôlei oficial (3-0/3-1: 3-0 / 3-2: 2-1 / 0-3: 0-3). / **League + Playoffs (volleyball)** — single-group double round-robin followed by a placement playoff (final + 3rd-place). Default scoring = FIVB.
- **Brackets de mata-mata variáveis** (4/8/16) saindo de uma liga única, semeados via NCAA-style (1v8, 4v5, 2v7, 3v6 …). / Variable single-elim bracket sizes from a single league, NCAA seed positions.
- **Multi-grupo → bracket grande** via cross-pairing adjacente: 4 grupos → bracket de 8; 8 grupos → bracket de 16. Pares de grupos contribuem 1A-2B / 1B-2A. / Multi-group → larger SE bracket via adjacent cross-pairing.

#### Pontuação e desempate / Scoring and tiebreakers

- **Pontuação por fase** (schema v5) — escolha entre Futebol (V3/E1/D0) e Vôlei (3-0/3-1 → 3 / 3-2 → 2-1 / 0-3 → 0). Picker exposto na criação do torneio para todos os presets que produzem standings; wizard custom permite por fase. Helper puro `pointsForMatch(scoreA, scoreB, rule)`. / **Per-phase scoring** (schema v5) — Football or Volleyball rule. Picker on the new-tournament screen for any preset with a league phase; custom wizard sets per phase.
- **Desempate por confronto direto** (head-to-head) — quando 2+ times empatam em pontos, mini-tabela usando só os jogos entre eles decide a ordem. Cai pra critérios gerais (saldo, gols pró, nome) só se H2H também empatar. / **Head-to-head tiebreaker** between points and goal-diff in the standings ladder; mini-table uses only matches between the tied teams.

#### Walkover

- **Walkover (W.O.)** — botão dedicado no modal de placar marca o forfeit (3-0 default) e flag `walkover` na partida. Badge visual nas telas de partidas, árvore de chaveamento e imagem compartilhável. (Schema v6.) / Walkover support — score modal exposes a "W.O. for X" action that sets the forfeit score and flags the match. Visual badge across all match displays.

#### Round-robin agendamento / Round-robin scheduling

- **Rodadas paralelas** via método circular (Berger): para N times, N/2 partidas por rodada e N-1 rodadas no total — todos jogam ao mesmo tempo, ninguém fica esperando. Para N ímpar, um time tem bye por rodada. Cabeçalhos "Rodada N" agora dividem as partidas. / **Parallel rounds** via the circle/Berger method.
- **Ida-e-volta** (`legs=2`) com mando invertido na 2ª volta, ocupando rodadas N..2(N-1). / Home-and-away (`legs=2`) with reversed home/away on the second leg.

#### Imagem do torneio / Tournament image

- **Exportar como PNG** — view dedicada (sem chrome de nav) com cabeçalho, classificação, partidas agrupadas por fase/rodada e árvore visual nos formatos com mata-mata. Captura via `react-native-view-shot`. / **PNG export** — dedicated read-only view captured by `react-native-view-shot`.
- **Compartilhar** via sheet do sistema (WhatsApp, e-mail, etc.) ou **salvar direto na galeria** (`expo-media-library` com prompt de permissão). / Share via system sheet or save directly to the photo gallery.

#### Outras melhorias / Other improvements

- **Árvore de chaveamento visual** com linhas conectoras SVG (substitui o placeholder "em breve" da tela de chaveamento). Usado também na imagem compartilhável para single-elim e fase eliminatória. / Visual bracket tree with SVG connector lines.
- **Agendamento por partida** — modal ganha campos opcionais de data, hora e local. Chip com ícones aparece nos cards quando setado. / Per-match scheduling — date / time / venue fields with a discreet chip on the cards.
- **Aviso de re-seed** antes de sobrescrever playoffs já jogados — alerta ao editar placar de fase de grupos quando partidas posteriores já têm resultado. / Re-seed safety alert before clobbering played playoffs.
- **Backup format v2** (round-trip de fases customizadas) — backups antigos (v1) continuam importáveis com fallback pra `defaultPhasesForType`. / Backup format v2 with phases roundtrip; v1 backups remain importable.
- **View "Grupos" disponível para custom multi-grupo** — gate dos botões de navegação derivado dos matches (não mais do `tournament.type`). / Groups view available for custom multi-group configurations.

### Fixed · Corrigido (sessão atual / current session)

- **Tema claro/escuro não pegava no app inteiro** — picker em Configurações só atualizava o store; o runtime do NativeWind nunca era avisado, então classes `dark:` continuavam reagindo só ao SO. Agora `colorScheme.set()` roda em toda mudança, a preferência é persistida via AsyncStorage, e ~10 cores hardcoded de ícones viraram tokens reativos via novo `useThemeIcon`. / **Light/dark theme didn't actually toggle the app** — picker only updated the Zustand store; NativeWind's runtime was never notified, so `dark:` classes kept following the OS. Now `colorScheme.set()` fires on every change, the preference persists via AsyncStorage, and ~10 hardcoded icon colors became theme-reactive tokens.
- **Placar das partidas eliminatórias era apagado ao salvar** — em torneios "Liga + Playoffs" (e qualquer multi-fase), salvar o placar da final ou 3º lugar disparava `seedNextPhase`, que limpava os slots e placares do playoff. Fix: `seedNextPhase` só roda quando a partida editada é da fase de grupos (`stage === 'group'`); editar uma partida que já é de playoff não dispara re-seed. / **Playoff scores were silently wiped on save** — saving a final/3rd-place score on Liga + Playoffs (or any multi-phase) triggered `seedNextPhase` which cleared playoff slots. Fix: only re-seed when the edited match is itself in the group/league phase.

### Refactor

- **Funções DB-bound viraram wrappers de helpers puros**: `recomputeTournamentStatus` agora delega pra `computeTournamentStatus`; `seedKnockoutFromGroups` / `seedPlayoffFromLeague` delegam pra `compute*Seeding`. Os helpers puros têm cobertura por unit tests (vitest, sem necessidade de mock de SQLite). / DB-bound functions now thin-wrap pure helpers covered by unit tests.

### Tests

- Suite cresceu de 50 → **142 testes**, todos verdes. Áreas cobertas: scheduling round-robin, bracket placeholders variáveis, scoring (FIFA + vôlei), validação de phases customizadas, seeding (single-league + groups + placement), status do torneio por formato, tiebreaker H2H, parser de backup v1/v2.

### Schema migrations

- v3: tabela `phases` + coluna `phase_id` em `matches`, com backfill por `tournament.type`.
- v4: relaxa `CHECK` em `tournaments.type` via rebuild da tabela (permite novos formatos sem migration nova).
- v5: coluna `scoring` em `phases` (default `'fifa'`).
- v6: coluna `walkover` em `matches` (default 0).

### Added · Adicionado (anterior / previously added)

- **Exportar torneio em JSON** — botão na tela de detalhe que serializa torneio + participantes + partidas (preservando referências cruzadas) e abre o sheet de compartilhamento do sistema (Drive, WhatsApp, Email, etc). Nome do arquivo é gerado automaticamente: `nome-do-torneio-AAAA-MM-DD.json`. / **Export tournament to JSON** — button on the detail screen serializes the tournament + participants + matches (preserving cross-references) and opens the system share sheet (Drive, WhatsApp, Email…). Filename auto-generated: `tournament-name-YYYY-MM-DD.json`.
- **Importar torneio de JSON** — botão na home abre seletor de arquivos, valida o backup (JSON parseável, versão suportada, tipos válidos, schema correto) e importa transacionalmente como um NOVO torneio (re-mapeando IDs internamente para evitar colisão com outros torneios já existentes). / **Import tournament from JSON** — button on the home screen opens a file picker, validates the backup (parseable JSON, supported version, valid types, schema-correct) and imports transactionally as a NEW tournament (re-mapping internal ids to avoid colliding with existing tournaments).
- **Coroa de campeão na home** — torneios com status `finished` agora destacam visualmente: ícone de coroa dourada, fundo âmbar, label "FINALIZADO" em destaque. Torneios `ongoing` mostram um ponto verde + label em destaque. / **Champion crown on home** — `finished` tournaments now stand out: gold crown icon, amber background, prominent "FINISHED" label. `ongoing` tournaments show a green dot + emphasized label.
- **Testes unitários** para serialização/desserialização (round-trip, versão, validação de schema), totalizando **50 testes**, todos passando. / Unit tests for serialization round-trip, version handling and schema validation. **50 tests** total, all passing.

### Fixed · Corrigido

- `Error code: table matches has no column named group_label` ao gerar partidas em torneios pré-existentes — a migração v2 (que adicionava `group_label` e `stage`) podia falhar silenciosamente em alguns dispositivos por causa do `CHECK` constraint dentro de `ALTER TABLE ADD COLUMN` (suporte inconsistente entre versões do SQLite). Reescrita pra ser **idempotente**: usa `PRAGMA table_info` pra checar colunas existentes e adicionar só as que faltam, sem `CHECK` (validação no app), com try/catch e log de erro. Converge de qualquer estado, incluindo DBs deixados parcialmente migrados. / `Error code: table matches has no column named group_label` when generating matches on pre-existing tournaments — the v2 migration could fail silently on some devices due to `CHECK` constraints inside `ALTER TABLE ADD COLUMN` (inconsistent SQLite version support). Rewritten to be **idempotent**: uses `PRAGMA table_info` to check which columns exist and only adds the missing ones, no `CHECK` constraints (app-level validation), wrapped in try/catch with error logging. Converges from any starting state, including DBs left partially migrated.

### Added · Adicionado

- **Grupos + Mata-mata** end-to-end (3º formato): sorteio em 2 grupos balanceados via *snake seeding* (top seeds não caem no mesmo grupo), fase de grupos por round-robin, e quando todos os jogos da fase de grupos terminam, **classificação automática dos top 2 de cada grupo** para as semifinais (1A x 2B, 1B x 2A) → final. Mínimo de 4 participantes. / **Groups + Knockout** end-to-end (3rd format): draws into 2 balanced groups via *snake seeding* (top seeds split across groups), group-stage round-robin, and once the group stage finishes the **top 2 of each group are auto-seeded** into the semifinals (1A vs 2B, 1B vs 2A) → final. Minimum 4 participants.
- Nova tela **Grupos** (`/torneios/[id]/grupos`): cada grupo tem sua mini-tabela (J/V/E/D/P) com top 2 destacados em azul, e a lista das partidas do grupo logo abaixo. / New **Groups** screen with one mini-standings table per group (P/W/D/L/Pts), top 2 highlighted in brand color, and the group's matches listed below.
- Editar nome do torneio: ícone de lápis no header da tela de detalhe abre modal pra renomear. / Edit tournament name: pencil icon in detail-screen header opens a rename modal.
- Migração de schema v2: novas colunas `matches.group_label` e `matches.stage` (`'main' | 'group' | 'knockout'`). Migrações agora aplicam passo-a-passo a partir do `PRAGMA user_version` em vez de "tudo ou nada". / Schema migration v2: new `matches.group_label` and `matches.stage` columns. Migrations now apply step-by-step from `PRAGMA user_version` instead of all-or-nothing.
- Tela de Partidas reconhece `stage`: para grupos+mata-mata mostra "Fase de grupos" + chaves separadamente. Empate só é permitido nos jogos de grupo (semis e final precisam de vencedor). / Matches screen is `stage`-aware: for groups+knockout it lists "Group stage" matches followed by the bracket. Draws are only allowed for group-stage games (semis and final require a winner).
- **Testes unitários** (Vitest) para a lógica pura: `nextPowerOfTwo`, `bracketSeedOrder`, `generateSingleEliminationBracket` (incluindo BYEs), `generateRoundRobinMatches`, `splitIntoGroups`, `generateGroupStageMatches`, `generateGroupsKnockoutPlaceholders` e `computeStandings` (com critérios de desempate). 34 testes, todos verdes. Scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`. / **Unit tests** (Vitest) for pure logic. 34 tests, all green. Scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`.

### Added (anterior) · Previously added

- **Round Robin (Pontos corridos)** end-to-end: gera N*(N-1)/2 partidas (todos contra todos), permite empate, calcula classificação. / End-to-end Round Robin support: generates N*(N-1)/2 all-vs-all matches, allows draws, computes standings.
- Tela de **Classificação** (`/torneios/[id]/classificacao`): tabela tipo FIFA com J / V / E / D / SG / P. Critérios de desempate: pontos → saldo de gols → gols pró → nome. 1º lugar destacado em azul. / **Standings** screen with FIFA-style table: Played / Wins / Draws / Losses / Goal Diff / Points. Tiebreakers: points → goal diff → goals for → name. Top spot highlighted.
- Status do torneio para Round Robin: `finished` quando TODAS as partidas têm placar (incluindo empates). / Tournament status for Round Robin: `finished` only when ALL matches have a score (draws count as played).
- Tela de detalhe agora mostra navegação **type-aware**: mata-mata vê "Chaveamento", round-robin vê "Classificação", grupos+mata-mata mostra banner "Em breve". / Detail screen now shows **type-aware** navigation: single elim sees "Bracket", round robin sees "Standings", groups+knockout shows a "coming soon" banner.

- Lançamento de placar por partida via modal: toque em qualquer partida com dois oponentes definidos, digite o placar de cada lado, e o vencedor avança automaticamente para o slot correto da próxima partida. Limpar resultado também propaga (zera o slot do próximo). / Per-match score entry via modal: tap any match with two opponents defined, type each side's score, and the winner is auto-promoted to the correct slot of the next match. Clearing a result also propagates (resets the next match's slot).
- Status do torneio agora transiciona automaticamente: `draft` → `ongoing` ao primeiro placar lançado, `ongoing` → `finished` quando a final é decidida. / Tournament status now auto-transitions: `draft` → `ongoing` on first score entry, `ongoing` → `finished` when the final is decided.
- Validação: empate não é permitido no mata-mata. / Validation: draws are not allowed in single elimination.
- Geração automática de chaveamento mata-mata: dado o conjunto de participantes, monta um bracket de tamanho potência de 2 com BYEs distribuídos nas posições corretas (top seeds avançam direto). As partidas vazias dos rounds seguintes são pré-criadas como placeholders e ligadas via `next_match_id`. / Automatic single-elimination bracket generation: from the participant list, builds a power-of-two bracket with BYEs at the correct seed positions (top seeds advance directly). Empty matches in subsequent rounds are pre-created as placeholders linked via `next_match_id`.
- Botão "Gerar chaveamento" / "Recriar chaveamento" na tela de detalhe (com confirmação ao recriar). / "Generate bracket" / "Regenerate bracket" button on the detail screen (with confirmation on regenerate).
- Tela "Partidas" exibe as partidas geradas agrupadas por rodada (Final / Semifinal / Quartas / etc.), destaca o vencedor e marca BYE / TBD apropriadamente. / The "Matches" screen shows generated matches grouped by round (Final / Semifinal / Quarterfinals / etc.), highlights the winner and labels BYE / TBD slots correctly.

### Adicionado (anterior) · Previously added

- Tela de detalhe do torneio com abas (Participantes, Partidas, Chaveamento) acessível tocando no card da home / Tournament detail screen with tabs (Participants, Matches, Bracket), reachable by tapping a home card
- Cadastro de participantes (criar, listar, remover com confirmação) com persistência SQLite / Participant management (create, list, delete with confirmation) persisted in SQLite
- Exclusão do torneio (cascata em participantes/partidas) via botão na tela de detalhe / Tournament deletion (cascading to participants/matches) from the detail screen
- Componente `Tabs` reutilizável (segmented control) / Reusable `Tabs` segmented-control component
- Pluralização localizada para contagem de participantes / Localized pluralization for participant count

### Changed · Mudado

- Trocado `<Slot />` por `<Stack screenOptions={{ animation: 'none' }} />` no layout aninhado de detalhe do torneio. O `<Slot />` rendia os filhos sem prover um navegador, e `react-native-screens` (com Fabric/SDK 54) espera um navegador para registrar suas Screens nativas no layout effect — daí o `Couldn't find a navigation context` durante `commitLayoutEffectOnFiber`. / Replaced `<Slot />` with `<Stack screenOptions={{ animation: 'none' }} />` in the nested tournament detail layout. `<Slot />` rendered children without providing a navigator, but `react-native-screens` (Fabric/SDK 54) expects one for native Screen registration during the layout-effect commit — hence the `Couldn't find a navigation context` during `commitLayoutEffectOnFiber`.
- Refatorada a tela de detalhe do torneio para usar **rotas reais** do expo-router (`app/torneios/[id]/_layout.tsx` + `index.tsx`/`partidas.tsx`/`chaveamento.tsx`) em vez de troca de aba via React state. As abas agora usam `router.replace` para alternar, eliminando qualquer ciclo state-driven que possa interagir mal com `react-native-screens`. Também adicionado `ErrorBoundary` no root para capturar render errors com mensagem amigável em vez de tela vermelha. / Refactored the tournament detail screen to use **real expo-router routes** (`app/torneios/[id]/_layout.tsx` + `index.tsx`/`partidas.tsx`/`chaveamento.tsx`) instead of React state-driven tab swapping. Tabs now switch via `router.replace`, removing any state cycle that could conflict with `react-native-screens`. Also added a root-level `ErrorBoundary` so render errors show a friendly message instead of the red box.

### Fixed · Corrigido

- `Couldn't find a navigation context` continuava a quebrar mesmo após manter os painéis montados — removido o `<Stack.Screen>` que era renderizado em três branches condicionais (mount/unmount confundia o navegador) e trocado o `FlatList` da lista de participantes por `ScrollView` + `.map` (eliminando a virtualização do `react-native-screens`/`VirtualizedList` que parecia interagir mal com nosso layout). / `Couldn't find a navigation context` still crashed even after keeping panels mounted — removed the `<Stack.Screen>` rendered inside three conditional branches (its mount/unmount confused the navigator) and swapped the participants `FlatList` for `ScrollView` + `.map` (dropping `VirtualizedList` virtualization which was interacting badly with our layout).
- Tela de detalhe ainda quebrava com `Couldn't find a navigation context` em alguns cenários — refatorado para manter os 3 painéis (Participantes / Partidas / Chaveamento) sempre montados (com `display: 'none'` para os inativos), evitando ciclo de mount/unmount durante a troca de aba. Também adicionada `<Stack.Screen>` explícita, `useMemo`/`useCallback` em handlers e `tabItems`, e cleanup do efeito assíncrono via flag `cancelled`. / Detail screen still crashed with `Couldn't find a navigation context` in some cases — refactored to keep all 3 panels (Participants / Matches / Bracket) always mounted (using `display: 'none'` for inactive ones), eliminating mount/unmount cycles during tab switching. Also added explicit `<Stack.Screen>`, memoized handlers/tabItems, and cancelled-flag cleanup for the async effect.
- `Render Error: Couldn't find a navigation context` ao trocar de aba na tela de detalhe — `useTranslation` mutava `i18n.locale` durante render, disparando cascata de re-renders que confundia o navegador. Agora o locale é passado em cada chamada de `t()` via `i18n.t(key, { locale, ...opts })`, sem side effect. Também memoizadas as `screenOptions` dos layouts para reduzir re-mounts. / `Render Error: Couldn't find a navigation context` when switching tabs on the detail screen — `useTranslation` mutated `i18n.locale` during render, cascading re-renders that broke the navigator. Now the locale is passed per `t()` call via `i18n.t(key, { locale, ...opts })` with no side effect. Also memoized layout `screenOptions` to reduce re-mount churn.
- `Console Error: The result of getSnapshot should be cached to avoid an infinite loop` ao abrir a tela de detalhe — selector `s.byTournament[id] ?? []` retornava um novo array vazio a cada chamada. Trocado por uma constante estável `EMPTY_PARTICIPANTS` congelada. / `getSnapshot should be cached` infinite-loop warning when opening the detail screen — `s.byTournament[id] ?? []` returned a brand-new array every call. Replaced with a frozen module-level `EMPTY_PARTICIPANTS` reference.
- Crash em runtime `java.lang.String cannot be cast to java.lang.Boolean` e diversos avisos de incompatibilidade — todas as deps nativas tinham sido instaladas em versões mais novas do que o Expo SDK 54 suporta. Rodado `npx expo install --fix` para fixar nas versões compatíveis (expo-router 6.0.x, reanimated 4.1.x, worklets 0.5.x, babel-preset-expo 54.0.x, etc). / Runtime crash `java.lang.String cannot be cast to java.lang.Boolean` plus several compatibility warnings — all native deps had been installed at versions newer than Expo SDK 54 supports. Ran `npx expo install --fix` to pin to compatible versions.
- Bundler quebrava com `Cannot find module 'babel-preset-expo'` — adicionada como devDependency explícita (com `legacy-peer-deps` o npm não estava instalando como transitiva). / Bundler crashed with `Cannot find module 'babel-preset-expo'` — added as explicit devDependency (with `legacy-peer-deps` npm wasn't installing it transitively).
- Bundler quebrava com `Cannot find module 'react-native-worklets/plugin'` ao iniciar o app — adicionado `react-native-worklets` (necessário pelo Reanimated v4) e ajustado `babel.config.js` para usar `react-native-worklets/plugin` diretamente. / Bundler crashed with `Cannot find module 'react-native-worklets/plugin'` on startup — added `react-native-worklets` (required by Reanimated v4) and switched `babel.config.js` to `react-native-worklets/plugin`.

### Added · Adicionado

- Estrutura inicial do projeto com Expo + TypeScript / Initial Expo + TypeScript scaffold
- Configuração do NativeWind (Tailwind CSS) / NativeWind setup
- Roteamento com Expo Router (tabs + stack) / Expo Router with tabs + stack
- Persistência SQLite com schema e migrações / SQLite persistence with schema and migrations
- Gerenciamento de estado com Zustand (settings + torneios) / Zustand stores
- Internacionalização PT-BR (padrão) e EN / i18n with Brazilian Portuguese (default) and English
- Tela inicial com listagem de torneios / Home screen with tournaments list
- Criação de torneios (mata-mata, pontos corridos, grupos + mata-mata) / Create tournament flow
- Tela de configurações (idioma, tema) / Settings screen (language, theme)
- Tela "Sobre" / About screen
- Tema claro/escuro/sistema / Light/dark/system theme
- README bilíngue, LICENSE (MIT), CHANGELOG / Bilingual README, MIT LICENSE, CHANGELOG
