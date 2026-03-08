# Arena of Intelligence

這個專案是一個 Next.js 模型競技場，支援：

- 盲測模式
- 非盲測模式
- 真實模型串接：GPT-5.2、Gemini 3.1 Pro Preview、Claude Opus 4.5
- 地端模型串接：Ollama 4090 / Ollama 5090 / vLLM 4090 的精選模型
- 遊戲結束後的平均排名、名次統計與使用者回饋匯出成 JSON

## 啟動方式

先安裝依賴：

```bash
npm install
```

再啟動開發伺服器：

```bash
npm run dev
```

打開 `http://localhost:3000` 即可使用。

## 必要環境變數

請在專案根目錄建立 `.env.local`，至少包含以下設定：

```bash
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_DEPLOYMENT=gpt-5.2
AZURE_OPENAI_API_VERSION=2024-12-01-preview

GEMINI_API_KEY=your_gemini_key

AZURE_ANTHROPIC_API_KEY=your_azure_anthropic_key
AZURE_ANTHROPIC_DEPLOYMENT=claude-opus-4-5
```

備註：

- Azure OpenAI endpoint 預設使用 notebook 中的 `https://9n00400.openai.azure.com/`，若要覆蓋再設定 `AZURE_OPENAI_ENDPOINT`。
- 若您沿用 notebook 裡的命名，也可以使用 `5.2_AZURE_OPENAI_API_KEY` 作為 Azure OpenAI key。
- Gemini 會直接使用您在網站上選到的 model id，不需要另外設定 `GEMINI_MODEL`。
- Anthropic base URL 預設使用 notebook 中的 `https://project3-docai-resource.services.ai.azure.com/anthropic/`，若要覆蓋再設定 `AZURE_ANTHROPIC_BASE_URL` 或 `ANTHROPIC_FOUNDRY_BASE_URL`。
- `AZURE_ANTHROPIC_DEPLOYMENT` 沒填時，程式會預設為 `claude-opus-4-5`。
- 地端模型目前預設轉發到程式內建的內網位址：`10.61.16.31:11434`、`10.61.16.119:11434`、`10.61.16.101:8000`。若內網位址變更，請同步修改 [src/app/api/chat/route.ts](src/app/api/chat/route.ts)。

## 地端模型標示

模型選擇頁中的地端模型會額外顯示：

- 伺服器來源，例如 `Ollama 5090`、`vLLM 4090`
- 速度標籤 `快 / 中 / 慢`

速度標籤是依照既有健康檢查結果整理的歷史參考值，用來幫助使用者在選模型前先預估等待時間。

## JSON 匯出

在結算頁按下「儲存回饋並輸出 JSON」後，系統會將結果寫到：

```bash
exports/arena-results/
```

JSON 內容包含：

- 模式（盲測 / 非盲測）
- 開始與結束時間
- 平均排名與排行榜
- 並列第一資訊
- 每回合 prompt、回應、排名與勝者
- 使用者對各模型與整體體驗的回饋

## 驗證

目前已使用以下指令確認專案 lint 通過：

```bash
npm run lint
```
