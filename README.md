# Meu Torneio · Tournament Master

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-lightgrey)](#)
[![Built with Expo](https://img.shields.io/badge/built%20with-Expo-000020?logo=expo)](https://expo.dev)

> 🇧🇷 Aplicativo mobile **offline-first** para criação e gestão de torneios amadores. ·
> 🇺🇸 **Offline-first** mobile app for amateur tournament management.

---

## 🇧🇷 Português

### Sobre

**Meu Torneio** é um aplicativo Android/iOS nativo (React Native + Expo) para criar e gerenciar torneios amadores — esportivos ou não. Funciona **100% offline**, salvando todos os dados no dispositivo via SQLite.

### Recursos

- 🏆 Três formatos de torneio: **Mata-mata**, **Pontos corridos** e **Grupos + Mata-mata**
- 👥 Suporta qualquer número de participantes (BYE automático em chaves ímpares)
- ⚽ Lançamento de placares, datas, horários e locais para cada partida
- 📴 Funcionamento totalmente offline (SQLite local)
- 🌗 Tema claro / escuro / sistema
- 🌍 Português (Brasil) e Inglês

### Stack

- React Native (Expo) + TypeScript
- Expo Router (navegação)
- NativeWind (Tailwind CSS)
- Expo SQLite (persistência local)
- Zustand (estado global)
- i18n-js + expo-localization (internacionalização)
- Lucide Icons

### Como rodar

Pré-requisitos: Node.js 20+ e o app **Expo Go** no celular (ou emulador Android/iOS).

```bash
# Instalar dependências
npm install --legacy-peer-deps

# Iniciar o servidor de desenvolvimento
npm start

# Ou abrir direto no Android/iOS/Web
npm run android
npm run ios
npm run web

# Rodar testes unitários
npm test                 # uma vez
npm run test:watch       # modo watch
npm run test:coverage    # com relatório de cobertura

# Verificar tipos
npm run typecheck
```

### Estrutura do projeto

```
.
├── app/                  # Rotas (Expo Router)
│   ├── (tabs)/           # Tabs: Torneios, Configurações, Sobre
│   └── torneios/         # Telas de criação/edição
├── src/
│   ├── components/       # Componentes reutilizáveis (UI + domínio)
│   ├── db/               # SQLite: schema, migrations, queries
│   ├── i18n/             # Locales pt-BR e en + hook useTranslation
│   ├── stores/           # Stores Zustand
│   ├── types/            # Tipos compartilhados
│   └── utils/            # Helpers
├── assets/               # Ícones e splash
├── tailwind.config.js
├── metro.config.js
└── app.json
```

### Roadmap

- [x] Estrutura inicial: Expo Router, NativeWind, SQLite, i18n
- [x] Tela de listagem de torneios + criação
- [x] Tela de detalhe do torneio + cadastro de participantes
- [x] Geração de chaveamento (Mata-mata) com BYE automático
- [x] Lançamento de placares e avanço automático do vencedor
- [x] Status do torneio (rascunho → em andamento → finalizado)
- [x] Pontos corridos (todos contra todos) com tabela de classificação
- [x] Grupos + Mata-mata (2 grupos, top 2 classificam para semis)
- [x] Editar nome do torneio
- [x] Exportar/importar torneio (backup JSON via compartilhamento)
- [x] Coroa de campeão para torneios finalizados
- [x] Testes unitários (Vitest) para a lógica pura
- [ ] Datas/horários/locais por partida
- [ ] Visualização gráfica de bracket com zoom/pan
- [ ] Tabela de classificação (Pontos corridos)
- [ ] Fase de grupos + mata-mata
- [ ] Lançamento de placares com feedback visual
- [ ] Visualização de chaves com zoom/pan
- [ ] Exportação/importação de torneios

### Licença

[MIT](./LICENSE) © Eduardo Coutinho ([@educsj](https://github.com/educsj))

---

## 🇺🇸 English

### About

**Tournament Master** is a native Android/iOS app (React Native + Expo) for managing amateur tournaments — sports or otherwise. It runs **100% offline**, persisting all data on the device via SQLite.

### Features

- 🏆 Three tournament formats: **Single Elimination**, **Round Robin** and **Groups + Knockout**
- 👥 Supports any number of participants (auto BYE for odd brackets)
- ⚽ Score entry, schedule and venue per match
- 📴 Fully offline (local SQLite)
- 🌗 Light / Dark / System theme
- 🌍 English and Brazilian Portuguese

### Stack

- React Native (Expo) + TypeScript
- Expo Router
- NativeWind (Tailwind CSS)
- Expo SQLite (local persistence)
- Zustand (state management)
- i18n-js + expo-localization
- Lucide Icons

### Getting started

Requirements: Node.js 20+ and the **Expo Go** app on your phone (or an Android/iOS emulator).

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start the dev server
npm start

# Or run directly on Android/iOS/Web
npm run android
npm run ios
npm run web

# Run unit tests
npm test                 # once
npm run test:watch       # watch mode
npm run test:coverage    # with coverage report

# Type-check
npm run typecheck
```

### Project structure

```
.
├── app/                  # Routes (Expo Router)
│   ├── (tabs)/           # Tabs: Tournaments, Settings, About
│   └── torneios/         # Create/edit screens
├── src/
│   ├── components/       # Reusable components (UI + domain)
│   ├── db/               # SQLite: schema, migrations, queries
│   ├── i18n/             # pt-BR and en locales + useTranslation hook
│   ├── stores/           # Zustand stores
│   ├── types/            # Shared types
│   └── utils/            # Helpers
├── assets/               # Icons and splash
├── tailwind.config.js
├── metro.config.js
└── app.json
```

### Roadmap

- [x] Initial scaffold: Expo Router, NativeWind, SQLite, i18n
- [x] Tournaments list + creation screen
- [x] Tournament detail + participant management
- [x] Bracket generation (Single Elimination) with auto BYE
- [x] Score entry with auto-advance to next round
- [x] Tournament status (draft → ongoing → finished)
- [x] Round robin (everyone plays everyone) with standings table
- [x] Groups + Knockout (2 groups, top 2 advance to semis)
- [x] Edit tournament name
- [x] Export/import tournament (JSON backup via system share)
- [x] Champion crown for finished tournaments
- [x] Unit tests (Vitest) for pure logic
- [ ] Schedule/location per match
- [ ] Graphical bracket visualization with zoom/pan
- [ ] Standings table (Round Robin)
- [ ] Group stage + knockout
- [ ] Score entry with visual feedback
- [ ] Bracket visualization with zoom/pan
- [ ] Tournament import/export

### License

[MIT](./LICENSE) © Eduardo Coutinho ([@educsj](https://github.com/educsj))
