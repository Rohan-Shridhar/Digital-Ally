/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_CLIENT_TOKEN: string;
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
