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

- 🏆 **Sete formatos**: Mata-mata, **Dupla eliminação** (WB + LB + grande final), Pontos corridos, Grupos + Mata-mata, Liga + Playoffs (vôlei), **Copa do Mundo** (8 grupos × 4 → R16 → quartas → semis → final + 3º) e **Personalizado** (compõe fases livremente)
- 🛠️ Builder de torneio personalizado: 1–2 fases, escolhe formato, **até 8 grupos**, ida-e-volta, classificados, regra de pontuação por fase e disputa de 3º lugar opcional
- ⚖️ **Pontuação configurável**: estilo futebol (V3/E1/D0) ou vôlei oficial (3-0/3-1 → 3 / 3-2 → 2-1 / 0-3 → 0)
- 🥇 **Critério de desempate por confronto direto** (head-to-head) — quando há empate de pontos, mini-tabela entre os times empatados decide
- 🔄 Round-robin com **rodadas paralelas** (algoritmo circular / Berger): T1×T2 e T3×T4 jogam ao mesmo tempo, ninguém fica esperando
- 🌳 **Árvore de chaveamento visual** com linhas conectoras (single-elim e fase eliminatória de formatos multi-fase)
- 👥 Suporta qualquer número de participantes (BYE automático em chaves ímpares)
- 🚫 **Walkover (W.O.)** — botão dedicado no modal de placar marca o forfeit como 3-0 e exibe badge nas telas
- ⚽ Lançamento de placares, datas, horários e locais para cada partida
- 🖼️ **Exportar como imagem PNG**: compartilhar via apps do sistema ou salvar direto na galeria
- 📦 Exportar/importar torneio em JSON (preserva fases, partidas, agendamento e tudo mais)
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
- [x] Grupos + Mata-mata
- [x] Liga + Playoffs (vôlei: ida-e-volta + final + 3º lugar)
- [x] **Modelo de fases** + builder de torneio personalizado (1–2 fases configuráveis)
- [x] Editar nome do torneio
- [x] Exportar/importar torneio (backup JSON v2 com fases)
- [x] Coroa de campeão para torneios finalizados
- [x] Datas/horários/locais por partida
- [x] **Round-robin com rodadas paralelas** (algoritmo circular)
- [x] Árvore de chaveamento visual com conectores SVG
- [x] Exportar como **imagem PNG** (compartilhamento + salvar na galeria)
- [x] **Pontuação por fase** (estilo futebol ou vôlei oficial)
- [x] **Confronto direto** (head-to-head) como critério de desempate
- [x] **Walkover (W.O.)** com badge visual
- [x] Aviso de re-seed antes de sobrescrever playoffs já jogados
- [x] Brackets de mata-mata variáveis (4/8/16) saindo de liga única
- [x] Multi-grupo → bracket grande via cross-pairing adjacente
- [x] Testes unitários (Vitest) — atualmente 169 testes
- [ ] 3+ fases customizadas (hoje cap em 2)
- [x] Tiebreakers configuráveis por fase (FIFA, CONMEBOL, vôlei)
- [ ] Edição de participantes após geração do bracket sem regenerar
- [ ] Estatísticas multi-torneio (artilharia geral, defesa, etc.)
- [x] Polimento de empty states e loading skeletons

### Licença

[MIT](./LICENSE) © Eduardo Coutinho ([@educsj](https://github.com/educsj))

---

## 🇺🇸 English

### About

**Tournament Master** is a native Android/iOS app (React Native + Expo) for managing amateur tournaments — sports or otherwise. It runs **100% offline**, persisting all data on the device via SQLite.

### Features

- 🏆 **Seven formats**: Single Elimination, **Double Elimination** (WB + LB + grand final), Round Robin, Groups + Knockout, League + Playoffs (volleyball), **World Cup** (8 groups × 4 → R16 → QF → SF → Final + 3rd) and **Custom** (compose phases freely)
- 🛠️ Custom tournament builder: 1–2 phases, configurable format, **up to 8 groups**, home-and-away, qualifiers, per-phase scoring rule and optional 3rd-place playoff
- ⚖️ **Configurable scoring**: football-style (W3/D1/L0) or volleyball (3-0/3-1 → 3 / 3-2 → 2-1 / 0-3 → 0)
- 🥇 **Head-to-head tiebreaker** — when teams tie on points, a mini-table among them decides the order
- 🔄 Round-robin with **parallel rounds** (Berger / circle method): T1×T2 and T3×T4 play at the same time, no team waits idly
- 🌳 **Visual bracket tree** with SVG connector lines (single-elim and the knockout phase of multi-phase formats)
- 👥 Supports any number of participants (auto BYE for odd brackets)
- 🚫 **Walkover (W.O.)** — dedicated button in the score modal flags forfeits as 3-0 and shows a badge across the UI
- ⚽ Score entry, schedule and venue per match
- 🖼️ **Export as PNG image**: share through system apps or save directly to the gallery
- 📦 Tournament export/import (JSON v2 — preserves phases, matches, schedule and more)
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
- [x] Groups + Knockout
- [x] League + Playoffs (volleyball: home-and-away + final + 3rd-place)
- [x] **Phase model** + custom tournament builder (1–2 configurable phases)
- [x] Edit tournament name
- [x] Export/import tournament (JSON backup v2 with phases)
- [x] Champion crown for finished tournaments
- [x] Schedule / time / venue per match
- [x] **Round robin with parallel rounds** (circle method)
- [x] Visual bracket tree with SVG connectors
- [x] Export as **PNG image** (system share + save to gallery)
- [x] **Per-phase scoring** (football or volleyball)
- [x] **Head-to-head** tiebreaker
- [x] **Walkover (W.O.)** with visual badge
- [x] Re-seed warning before overwriting already-played playoffs
- [x] Variable knockout brackets (4/8/16) from a single league
- [x] Multi-group → larger bracket via adjacent cross-pairing
- [x] Unit tests (Vitest) — currently 169 tests
- [ ] 3+ custom phases (currently capped at 2)
- [x] Per-phase configurable tiebreakers (FIFA, CONMEBOL, Volleyball)
- [ ] Edit participants after bracket generation without regenerating
- [ ] Multi-tournament statistics (top scorer overall, etc.)
- [x] Empty states and loading skeleton polish

### License

[MIT](./LICENSE) © Eduardo Coutinho ([@educsj](https://github.com/educsj))
