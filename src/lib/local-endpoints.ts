// 地端推論伺服器端點設定。
// 預設值為內網位址；可用環境變數覆寫（部署到不同網段時不需改程式碼）。
// 僅在伺服器端使用（API route / graph runner）。

export const LOCAL_OLLAMA_4090_API_URL =
  process.env.LOCAL_OLLAMA_4090_API_URL ?? 'http://10.61.16.31:11434/api';
export const LOCAL_OLLAMA_5090_API_URL =
  process.env.LOCAL_OLLAMA_5090_API_URL ?? 'http://10.61.16.119:11434/api';

export interface LocalServerDescriptor {
  label: string;
  apiUrl: string;
}

export const LOCAL_SERVERS: LocalServerDescriptor[] = [
  { label: 'Ollama 4090', apiUrl: LOCAL_OLLAMA_4090_API_URL },
  { label: 'Ollama 5090', apiUrl: LOCAL_OLLAMA_5090_API_URL },
];
