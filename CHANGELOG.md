# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.
All notable changes to this project will be documented in this file.

O formato segue [Keep a Changelog](https://keepachangelog.com/) e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Fixed · Corrigido

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
