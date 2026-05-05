# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.
All notable changes to this project will be documented in this file.

O formato segue [Keep a Changelog](https://keepachangelog.com/) e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added · Adicionado

- Tela de detalhe do torneio com abas (Participantes, Partidas, Chaveamento) acessível tocando no card da home / Tournament detail screen with tabs (Participants, Matches, Bracket), reachable by tapping a home card
- Cadastro de participantes (criar, listar, remover com confirmação) com persistência SQLite / Participant management (create, list, delete with confirmation) persisted in SQLite
- Exclusão do torneio (cascata em participantes/partidas) via botão na tela de detalhe / Tournament deletion (cascading to participants/matches) from the detail screen
- Componente `Tabs` reutilizável (segmented control) / Reusable `Tabs` segmented-control component
- Pluralização localizada para contagem de participantes / Localized pluralization for participant count

### Fixed · Corrigido

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
