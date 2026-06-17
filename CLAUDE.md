# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arena of Intelligence** is a Next.js-based platform for comparing multiple LLMs side-by-side with blind testing and open comparison modes. It integrates cloud-based models (GPT, Gemini, Claude) and local models (Ollama, vLLM) with a single interface.

### Key Features
- **Model Comparison (Blind Arena)**: Compare models with anonymous labeling (Model A/B/C) or open comparison
- **Chat Studio**: Multi-turn conversations with a single model, supporting long-term memory, document context, and expert discussion modes
- **Local Model Support**: Integrates with Ollama and vLLM for on-premise models
- **Session Export**: Exports arena results as JSON with rankings, feedback, and detailed round-by-round data
- **Orchestration Modes**: Expert discussion, debate, and pressure-test scenarios using multiple models

## Technology Stack

- **Frontend**: React 19, Next.js 16.1.6, TypeScript
- **Styling**: Tailwind CSS v4, custom CSS with design tokens (emerald, gold, slate, marble color palette)
- **UI Components**: Custom React components with drag-and-drop (dnd-kit) and charting (Recharts)
- **API Clients**: OpenAI SDK, Google Generative AI SDK, Anthropic SDK
- **Backend**: Next.js API routes (no separate backend)
- **Storage**: LocalStorage for session persistence; exports to `exports/arena-results/`

## Project Structure

```
src/
├── app/                          # Next.js app directory (routing)
│   ├── page.tsx                  # Home page (landing page wrapper)
│   ├── layout.tsx                # Root layout with ArenaProvider
│   ├── globals.css               # Global styles + CSS variables + custom classes
│   ├── arena/page.tsx            # Blind arena page
│   ├── studio/page.tsx           # Chat studio page
│   └── api/
│       ├── chat/route.ts         # Main chat completion endpoint (multi-provider)
│       └── export/route.ts       # Session export endpoint
├── components/                   # React components
│   ├── PlatformHome.tsx          # Landing page with module selection
│   ├── LandingPage.tsx           # Initial landing flow
│   ├── BlindArena.tsx            # Blind testing arena component (28KB)
│   ├── ModelSelection.tsx        # Model picker for arena/studio (32KB)
│   ├── ChatStudio.tsx            # Chat interface with memory/docs (57KB)
│   ├── Analytics.tsx             # Leaderboard and statistics
│   ├── RankingPanel.tsx          # Ranking UI for arena rounds
│   └── Sidebar.tsx               # Navigation sidebar
├── context/
│   └── ArenaContext.tsx          # Global state management (useReducer)
├── lib/
│   ├── api.ts                    # Browser-side API wrapper (callModel, callImageModel, etc.)
│   ├── storage.ts                # LocalStorage persistence for sessions
│   ├── studio-storage.ts         # LocalStorage for studio conversations
│   └── session-summary.ts        # Arena results formatting
├── config/
│   └── models.ts                 # Model configurations, presets, defaults
└── types/
    └── index.ts                  # TypeScript types (AIModel, ArenaSession, etc.)
```

## Core Architecture

### Data Flow

1. **State Management**: ArenaContext (useReducer) manages:
   - `currentPhase`: navigation state (landing → selection → arena → analytics)
   - `arenaMode`: 'blind' or 'open'
   - `session`: current ArenaSession with rounds and responses
   - User selections and feedback

2. **API Layer** (`src/app/api/chat/route.ts`):
   - Single endpoint handles all model requests
   - Routes to Azure OpenAI (GPT-5.2/5.4), Google Gemini, Azure Anthropic (Claude), local Ollama/vLLM
   - Supports orchestration modes (expert-discussion, debate, pressure-test)
   - Returns: `{ response: string; images?: GeneratedImagePayload[] }`

3. **Client API** (`src/lib/api.ts`):
   - Wrapper around `/api/chat` endpoint
   - `callModel(modelId, prompt)` → string
   - `callImageModel(modelId, prompt)` → { response, images }
   - `callMultipleModels(modelIds, prompt)` → Map<string, string>

4. **Storage**:
   - Sessions saved to localStorage with key `arena_session_${sessionId}`
   - Exporting triggers `/api/export` to write JSON to `exports/arena-results/`
   - Studio conversations use separate storage: `studio_conversations` and `studio_messages_${convId}`

### Key Types

```typescript
AIModel {
  id: string
  name: string
  provider: string
  source?: 'cloud' | 'local'
  speed?: 'fast' | 'medium' | 'slow'
  serverLabel?: string
  capabilities?: ModelCapability[]
  isArenaSpecial?: boolean
  orchestration?: ArenaOrchestrationConfig
}

ArenaSession {
  id: string
  mode: 'blind' | 'open'
  selectedModels: AIModel[]
  rounds: MatchRound[]
  startTime: number
  feedback?: UserFeedback
}

MatchRound {
  id: string
  prompt: string
  responses: ModelResponse[] // one per model
  rankings: RankingResult[] // user's ranking (1, 2, 3)
}
```

## Environment Configuration

Create `.env.local` with:

```bash
# Azure OpenAI (GPT)
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-5.2
AZURE_OPENAI_API_VERSION=2024-12-01-preview
# Optional endpoint (default: https://9n00400.openai.azure.com/)
AZURE_OPENAI_ENDPOINT=...

# Google Gemini
GEMINI_API_KEY=...

# Azure Anthropic (Claude)
AZURE_ANTHROPIC_API_KEY=...
AZURE_ANTHROPIC_DEPLOYMENT=claude-opus-4-5
# Optional base URL (default: https://project3-docai-resource.services.ai.azure.com/anthropic/)
AZURE_ANTHROPIC_BASE_URL=...

# Local inference endpoints (optional — defaults to internal addresses below)
LOCAL_OLLAMA_4090_API_URL=http://10.61.16.31:11434/api
LOCAL_OLLAMA_5090_API_URL=http://10.61.16.119:11434/api
```

**Local Models**: Endpoints are defined in `src/lib/local-endpoints.ts`, reading the env vars above with internal-address defaults:
- Ollama 4090: `10.61.16.31:11434` (`LOCAL_OLLAMA_4090_API_URL`)
- Ollama 5090: `10.61.16.119:11434` (`LOCAL_OLLAMA_5090_API_URL`)

`GET /api/health` probes each local server's `/api/tags`; ModelSelection shows live 在線/離線 status. The `chat-router.ts` graph imports the same endpoint constants.

## Development Commands

```bash
# Install dependencies
npm install

# Run dev server (Next.js on localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint with ESLint
npm run lint
```

## Common Development Tasks

### Adding a New Model

1. **Update `src/config/models.ts`**: Add AIModel object to `AVAILABLE_MODELS` array with correct `provider`, `source`, `capabilities`
2. **Update `src/app/api/chat/route.ts`**: Add routing logic for the model's API in the chat endpoint
3. **Environment Variables**: If cloud-based, add keys to `.env.local`

### Modifying Arena Flow

- **Phases**: Edit `ArenaContext.tsx` `currentPhase` reducer and dispatch calls in components
- **Prompt templates**: SAMPLE_PROMPTS in `src/components/BlindArena.tsx`
- **System prompt**: ARENA_SYSTEM_PROMPT in `src/app/api/chat/route.ts` (currently enforces Traditional Chinese, no Markdown)

### Styling & Design

- **Custom CSS variables**: Defined in `src/app/globals.css` (emerald, gold, slate, marble colors)
- **Utility classes**: `.metal-button`, `.soft-button`, `.stone-border`, `.marble-card`, `.glass-panel`, `.field-shell`, `.response-text`
- **Tailwind v4**: Uses new `@theme` syntax; postcss config in `postcss.config.mjs`
- **Font stacks**: Serif (Iowan Old Style, Noto Serif TC, Times New Roman); Sans (Avenir Next, Segoe UI, Noto Sans TC)

### Exporting Session Data

- Triggered by user in Analytics component
- POST to `/api/export` with session data
- Returns JSON with:
  - Mode, timing, total rounds
  - Leaderboard (avg rank, wins by position)
  - Per-round details: prompt, responses, rankings, winners
  - User feedback per model and overall

## Important Notes

1. **Chinese Language First**: UI and prompts are Traditional Chinese (zh-TW). System prompts explicitly request Traditional Chinese output only.

2. **Local Model Configuration**: Update hardcoded IPs in `src/app/api/chat/route.ts` if local network addresses change (LOCAL_OLLAMA_4090_API_URL, etc.)

3. **Model Orchestration**: Special modes (expert-discussion, debate, pressure-test) use ArenaOrchestrationConfig to coordinate multiple models; logic in chat endpoint handles synthesis/judging.

4. **Session Persistence**: All arena data stored locally via localStorage; no database. Export to JSON is the only persistence mechanism for long-term storage.

5. **Speed Labels**: Local models show speed indicators (快/中/慢) based on benchmarkLatencySeconds; used in ModelSelection UI to help users estimate wait times.

6. **Image Generation**: Supported by Gemini models; responses include base64-encoded images in GeneratedImagePayload format.

