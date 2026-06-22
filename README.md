# Digital Ally

Digital Ally (formerly BizBoost) is an advanced AI-powered platform designed to instantly generate professional websites, business newsletters, and analytical dashboards. Built with React, TypeScript, and powered by Google's Gemini 2.5 Flash model, it bridges the gap between business ideas and digital presence.

## 🚀 Features

- **AI Website Generation**: Transform text descriptions into fully responsive, modern landing pages using Tailwind CSS.
- **Dynamic Content Creation**: Automatically generates business newsletters and marketing copy customized for your brand.
- **Smart Dashboard & Analytics**: Get AI-driven insights and translations for business performance metrics.
- **Voice Interaction**:
  - **Speech-to-Text**: Dictate your website requirements and prompts.
  - **Text-to-Speech**: Listen to generated content and insights.
- **Customization**: Choose from curated color palettes and modify generated designs with follow-up prompts.
- **Multi-Language Support**: Interactive interface supporting multiple languages.
- **Live Preview & Code Export**: View changes in real-time and export clean, deployment-ready HTML/CSS code.
- **Privacy Controls**: Versioned consent before remote AI processing, local-only generation, and one-click data deletion.

## 🛠️ Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI Model**: [Google Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/) via `@google/genai` SDK
- **Environment**: Node.js

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd NAPATA
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory and add your Google Gemini API key:
    ```env
    GEMINI_API_KEY=your_google_gemini_api_key_here
    SERVER_CLIENT_TOKEN=replace_with_a_long_random_value
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

## 📜 Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run preview`: Locally previews the production build.
- `npm run start:server`: Starts the authenticated AI proxy.

## Privacy

No business details or generated content are persisted by Digital Ally. Users
must choose remote AI processing or local-only templates before using
generation features. See [PRIVACY.md](PRIVACY.md) for the data-flow, retention,
deletion, logging, and deployment policy.

## 📂 Project Structure

```
NAPATA/
├── components/          # UI Components (Header, InputPanel, OutputPanel, etc.)
├── hooks/               # Custom hooks (useSpeechToText, useTextToSpeech)
├── services/            # API services (geminiService.ts)
├── App.tsx             # Main application logic and state management
├── constants.ts        # App constants (Languages, Prompts, Color Palettes)
├── index.html          # Entry HTML file
└── vite.config.ts      # Vite configuration
```

## 🧩 Architectural diagram
<img width="8192" height="1783" alt="arch" src="https://github.com/user-attachments/assets/39777d99-e887-4785-9cd3-036b48e1dbea" />

## 🔀 Data flow diagram
<img width="6818" height="8192" alt="DFD-2026-06-06-051046" src="https://github.com/user-attachments/assets/8834b79b-d627-4a70-9c19-5efe69f842e2" />

## 💡 Usage

1.  **Enter Business Details**: Provide your name, business name, and contact info.
2.  **Describe Your Vision**: Use the text area or microphone to describe the website you want (e.g., "A modern coffee shop website with a menu section").
3.  **Select Style**: Choose a color palette that fits your brand identity.
4.  **Generate**: Click "Generate Website" to watch the AI build your site in seconds.
5.  **Refine**: Use the modification prompt to ask for changes (e.g., "Make the hero section darker").

## 🤝 Contributing

We welcome ELUSOC contributors. Please read the contribution guide before opening
issues or pull requests:

- [CONTRIBUTING.md](CONTRIBUTING.md)

## 🔐 Security

Please review the security policy for reporting vulnerabilities:

- [SECURITY.md](SECURITY.md)

## 📄 License

This project is licensed under the MIT License.
