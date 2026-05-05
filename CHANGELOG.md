# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.
All notable changes to this project will be documented in this file.

O formato segue [Keep a Changelog](https://keepachangelog.com/) e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

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
